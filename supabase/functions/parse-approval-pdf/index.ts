// parse-approval-pdf — 財務省「製造たばこ小売定価認可」PDF を Gemini で構造化抽出する。
// 入力: { pdfBase64: string, kind: 'new' | 'change' }
// 出力: { rows: [{ brand, product_name, package_size, origin_country, approval_date?, price?, price_before?, price_after?, changed_on? }] }
// 設計: 財務省PDFはテキスト層が壊れている（Crypt filter / カスタムフォント）ため決定論パース不可。
//       Gemini に PDF をネイティブ入力し、パイプたばこ行のみを responseSchema 付きで抽出させる。
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// モデル選定（精度最優先・主軸は 2.5-flash）。
// GEMINI_MODEL_FALLBACKS は既定 OFF（空）。429/503 が常態化する場合のみ
// 「PDF入力＋responseSchema 対応」モデルだけをカンマ区切りで指定する（例: gemini-2.0-flash,gemini-2.5-pro）。
// ※ gemma 等のテキスト専用モデルは PDF 不可・responseSchema 非対応のため指定しないこと。
const MODELS: string[] = (() => {
  const primary = (Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash").trim()
  const fallbacks = (Deno.env.get("GEMINI_MODEL_FALLBACKS") ?? "").split(",").map((s) => s.trim())
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of [primary, ...fallbacks]) {
    if (m && !seen.has(m)) { seen.add(m); out.push(m) }
  }
  return out
})()

// 同一モデルでの最大リトライ回数（初回 + この回数）。429/503/5xx のみ対象。
const MAX_RETRIES_PER_MODEL = 2

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 429/503 応答から待機秒数を推定する。`retryDelay:"12s"` / `Please retry in 12.3s` を拾い、
// 取れなければ既定 5s。上限 30s（Edge Function 全体のタイムアウトを超えないため）。
function parseRetryAfterMs(detail: string): number {
  const s = String(detail || "")
  const m = s.match(/retry(?:Delay)?["\s:]*([0-9.]+)\s*s/i) || s.match(/retry in\s+([0-9.]+)\s*s/i)
  const sec = m ? Number(m[1]) : NaN
  const ms = Number.isFinite(sec) && sec > 0 ? Math.ceil(sec * 1000) : 5000
  return Math.min(ms, 30_000)
}

// 1モデルへ generateContent を投げる（同一モデルで retry 込み）。
// 返り値: { ok:true, data } | { ok:false, status, detail, retryable }
async function callGeminiModel(apiKey: string, model: string, payload: unknown) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
    let res: Response
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    } catch (e) {
      // ネットワーク例外はリトライ可能扱い
      if (attempt < MAX_RETRIES_PER_MODEL) { await sleep(5000); continue }
      return { ok: false as const, status: 0, detail: `Gemini 呼び出し失敗: ${e}`, retryable: true }
    }
    if (res.ok) return { ok: true as const, data: await res.json() }
    const detail = await res.text()
    // 429（レート制限）・503（高負荷）・その他 5xx はリトライ可能。それ以外（4xx）は即失敗。
    const retryable = res.status === 429 || res.status >= 500
    if (retryable && attempt < MAX_RETRIES_PER_MODEL) { await sleep(parseRetryAfterMs(detail)); continue }
    return { ok: false as const, status: res.status, detail, retryable }
  }
  return { ok: false as const, status: 0, detail: "unknown", retryable: false }
}

// モデル別の generationConfig を組む。thinking 無効化（タイムアウト回避）は 2.5-flash 系のみ対応。
// pro は thinking 無効化不可・2.0 は thinking 非搭載のため、付けると 400 になりうる→付与しない。
function buildPayload(model: string, kind: string, pdfBase64: string) {
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: { type: "object", properties: { rows: { type: "array", items: ROW_SCHEMA } }, required: ["rows"] },
    temperature: 0,
    maxOutputTokens: 65536,
  }
  if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 }
  return {
    contents: [{ parts: [{ inline_data: { mime_type: "application/pdf", data: pdfBase64 } }, { text: buildPrompt(kind) }] }],
    generationConfig,
  }
}

const ROW_SCHEMA = {
  type: "object",
  properties: {
    brand: { type: "string", description: "ブランド名（製品名の先頭ブランド）" },
    product_name: { type: "string", description: "銘柄の正式名称" },
    package_size: { type: "string", description: "容量・包装（例: 100.0g 缶）" },
    origin_country: { type: "string", description: "製造国" },
    approval_date: { type: "string", description: "認可日 YYYY-MM-DD（新規認可のみ・不明は空文字）" },
    price: { type: "integer", description: "小売定価（円・税込・新規認可時の認可価格）" },
    price_before: { type: "integer", description: "変更前の小売定価（円・変更認可のみ）" },
    price_after: { type: "integer", description: "変更後の小売定価（円・変更認可のみ）" },
    changed_on: { type: "string", description: "変更（実施）年月日 YYYY-MM-DD（変更認可のみ・不明は空文字）" },
  },
  required: ["product_name"],
}

function buildPrompt(kind: string): string {
  const common =
    "あなたは日本の財務省が公表する『製造たばこの小売定価の認可』PDFを読み取る専門アシスタントです。" +
    "PDFの表から、一番左の『製造たばこの区分』が『パイプたばこ』である行だけを抽出してください。" +
    "紙巻たばこ・葉巻たばこ・かみたばこ等、パイプたばこ以外の区分の行は完全に無視します。" +
    "金額は円の整数（カンマ・『円』除去）。日付は YYYY-MM-DD。値が無い項目は空にしてください。" +
    // 2026-04-17 以降の新フォーマット対応（notes/V-PEACH_approval-update-reqs.md §2）
    "【セル結合に注意】新しいPDFでは左側のグルーピング列（『ブランド名』『製造国』など）が同一ブランド内でセル結合されており、" +
    "2行目以降が空欄に見えることがあります。これらの空欄の行は必ず直前の行の値を引き継いで補完してください" +
    "（ブランド名 brand も 製造国 origin_country も同様に補完する）。" +
    "【product_name は完全名称】product_name は『ブランド名＋半角スペース＋銘柄名』の完全な名称にしてください。" +
    "銘柄名の列がブランド名を含まない新フォーマットでは、補完したブランド名を先頭に付けた完全名称を product_name とします。" +
    "ただし銘柄名が既にブランド名で始まっている場合（旧フォーマット）は二重に付けず、そのまま使ってください。" +
    "brand には（補完後の）ブランド名のみを入れてください。"
  if (kind === "change") {
    return common +
      " これは『変更認可』のPDFです。各銘柄について brand, product_name, package_size, origin_country, " +
      "変更前定価(price_before), 変更後定価(price_after), 変更実施年月日(changed_on) を抽出してください。"
  }
  return common +
    " これは『新規認可』のPDFです。各銘柄について brand, product_name, package_size, origin_country, " +
    "認可された小売定価(price), 認可日(approval_date) を抽出してください。"
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } })
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY が未設定です（Supabase の Edge Function secret に設定してください）" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } })
  }

  let pdfBase64: string, kind: string
  try {
    const body = await req.json()
    pdfBase64 = String(body.pdfBase64 ?? "")
    kind = body.kind === "change" ? "change" : "new"
  } catch {
    return new Response(JSON.stringify({ error: "JSON ボディが不正です" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } })
  }
  if (!pdfBase64) {
    return new Response(JSON.stringify({ error: "pdfBase64 が空です" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } })
  }
  // 概算サイズ上限（base64 ~ 12MB → 原本 ~9MB）
  if (pdfBase64.length > 12_000_000) {
    return new Response(JSON.stringify({ error: "PDF が大きすぎます（~9MB 以下にしてください）" }), { status: 413, headers: { ...CORS, "Content-Type": "application/json" } })
  }

  // モデルを順に試行: 各モデルで retry+backoff（429/503/5xx）→ なお失敗ならフォールバック先へ。
  // リトライ不能（4xx 非429・例: 不正リクエスト）はモデルを変えても無駄なので即中断する。
  // deno-lint-ignore no-explicit-any — Gemini 応答は any（元実装踏襲）
  let data: any = null
  let usedModel = ""
  let lastStatus = 0
  let lastDetail = "unknown"
  for (const model of MODELS) {
    const r = await callGeminiModel(apiKey, model, buildPayload(model, kind, pdfBase64))
    if (r.ok) { data = r.data; usedModel = model; break }
    lastStatus = r.status
    lastDetail = r.detail
    if (!r.retryable) break
  }
  if (data === null) {
    const hint = (lastStatus === 429 || lastStatus >= 500)
      ? "（全モデルがレート制限/高負荷で失敗しました。1〜2分おいて再試行してください）"
      : ""
    return new Response(JSON.stringify({ error: `Gemini エラー (${lastStatus})${hint}`, detail: String(lastDetail).slice(0, 500) }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } })
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"
  let rows: unknown[] = []
  try {
    const parsed = JSON.parse(text)
    rows = Array.isArray(parsed?.rows) ? parsed.rows : []
  } catch {
    return new Response(JSON.stringify({ error: "Gemini 応答の JSON 解析に失敗", raw: String(text).slice(0, 500) }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } })
  }

  return new Response(JSON.stringify({ rows, kind, model: usedModel }), { headers: { ...CORS, "Content-Type": "application/json" } })
})

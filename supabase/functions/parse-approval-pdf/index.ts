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

// モデル選定（無料枠前提・課金なし）。Google AI Studio 無料枠の RPD（1日あたり）が決め手:
//   gemini-3.1-flash-lite = RPD 500（突出）, gemini-2.5/3/3.5-flash = 各 20, gemini-3.1-pro = 0（無料不可）。
//   旧主軸 gemini-2.5-flash は RPD 20 しかなく、重い PDF 取込ですぐ枯れて 429 になっていた（free_tier_input_token_count 超過）。
// → 主軸を gemini-3.1-flash-lite（RPD 500・RPM 15・TPM 250K）へ。フォールバックは gemini-3.5-flash の1枚のみ。
//   旧フォールバック gemini-2.5-flash は外した: 共用キーで 503『high demand』が 80s+ ハングし（単一呼び出しで
//   Edge Function の 150s 上限に達する主因）、かつ RPD 20 を即枯渇させて 429 を量産していた（2026-06-16 実測）。
//   GEMINI_MODEL / GEMINI_MODEL_FALLBACKS で上書き可。
// 制約: フォールバックは「PDF入力＋responseSchema 対応」モデルのみ。gemma 系はテキスト専用（PDF/構造化不可）で除外。
//       gemini-3.1-pro は無料枠 0 のため無料運用では指定しない（課金時のみ有効）。
const MODELS: string[] = (() => {
  const primary = (Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-flash-lite").trim()
  const fallbacks = (Deno.env.get("GEMINI_MODEL_FALLBACKS") ?? "gemini-3.5-flash").split(",").map((s) => s.trim())
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of [primary, ...fallbacks]) {
    if (m && !seen.has(m)) { seen.add(m); out.push(m) }
  }
  return out
})()

// 同一モデルでの最大リトライ回数（初回 + この回数）。429/503/5xx のみ対象。
// インタラクティブな取込なので 1 回に抑える（待たせすぎない）。
const MAX_RETRIES_PER_MODEL = 1

// 1回の Gemini 呼び出しの上限。AbortController で強制中断する。正常応答は 2〜32s。
// 2.5-flash 等が 503『high demand』で 80s+ ハングする実測があり、これを切らないと
// 単一呼び出しだけで Edge Function の 150s 上限に達するため、45s で打ち切って次モデルへ委ねる。
const PER_CALL_TIMEOUT_MS = 45_000

// backoff の待機に使える合計予算。429 時に長く待たず素早く「混雑・再試行」を返すため小さく。
const GLOBAL_BUDGET_MS = 20_000

// 全体のウォールクロック上限。Edge Function の ~150s 制限に対し余裕（~30s）を残し、
// この期限を超える呼び出し・待機は行わない（504/546 になる前に 502＋再試行案内で返す）。
const HARD_DEADLINE_MS = 120_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 429/503 応答から待機秒数を推定する。`retryDelay:"12s"` / `Please retry in 12.3s` を拾い、
// 取れなければ既定 5s。上限 10s（インタラクティブ取込のため長く待たない／全体時間は HARD_DEADLINE で別途制限）。
function parseRetryAfterMs(detail: string): number {
  const s = String(detail || "")
  const m = s.match(/retry(?:Delay)?["\s:]*([0-9.]+)\s*s/i) || s.match(/retry in\s+([0-9.]+)\s*s/i)
  const sec = m ? Number(m[1]) : NaN
  const ms = Number.isFinite(sec) && sec > 0 ? Math.ceil(sec * 1000) : 5000
  return Math.min(ms, 10_000)
}

// 1モデルへ generateContent を投げる（同一モデルで retry 込み）。
// 各呼び出しは AbortController で PER_CALL_TIMEOUT_MS（残り時間でクランプ）に強制中断し、
// 503『high demand』の長時間ハングが Edge Function の 150s 上限を食い潰すのを防ぐ。
// 返り値: { ok:true, data } | { ok:false, status, detail, retryable }
async function callGeminiModel(apiKey: string, model: string, payload: unknown, hardDeadline: number) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
    // ウォールクロックの残り時間で1呼び出しの上限を決める（最大 PER_CALL_TIMEOUT_MS）。
    const budget = Math.min(PER_CALL_TIMEOUT_MS, hardDeadline - Date.now())
    if (budget <= 1000) return { ok: false as const, status: 0, detail: "全体の処理時間を超過（混雑のため打ち切り）", retryable: false }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), budget)
    let res: Response
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal })
    } catch (e) {
      clearTimeout(timer)
      const aborted = (e as { name?: string })?.name === "AbortError"
      // 中断（ハング）・ネットワーク例外は同一モデルで粘らず次モデルへ委ねる（ハング再発の防止）。
      const detail = aborted ? `${model} が ${Math.round(budget / 1000)}s 以内に応答せず中断（混雑）` : `Gemini 呼び出し失敗: ${e}`
      console.error(`[parse-approval-pdf] ${detail}`)
      return { ok: false as const, status: 0, detail, retryable: true }
    }
    clearTimeout(timer)
    if (res.ok) return { ok: true as const, data: await res.json() }
    const detail = await res.text()
    // 失敗詳細をログに残す（get_logs で PerDay/PerMinute 等のクォータ種別を Gemini 枠消費なしに確認できる）
    console.error(`[parse-approval-pdf] ${model} HTTP ${res.status}: ${detail.slice(0, 300)}`)
    // 429（レート制限）・503（高負荷）・その他 5xx はリトライ可能。それ以外（4xx）は即失敗。
    const retryable = res.status === 429 || res.status >= 500
    const wait = parseRetryAfterMs(detail)
    // 待機が予算（GLOBAL_BUDGET_MS）内かつ待機後も全体期限に収まる場合のみ同一モデルで再試行。
    if (retryable && attempt < MAX_RETRIES_PER_MODEL && wait <= GLOBAL_BUDGET_MS && Date.now() + wait + 2000 <= hardDeadline) {
      await sleep(wait); continue
    }
    return { ok: false as const, status: res.status, detail, retryable }
  }
  return { ok: false as const, status: 0, detail: "unknown", retryable: false }
}

// モデル別の generationConfig を組む。thinking 無効化（タイムアウト回避・抽出に不要）は flash 系のみ付与。
// pro/gemma には付けない（pro は無効化不可・gemma は非対応で 400 を招くため）。
// ※ thinking を有効化すると flash-lite は degenerate 生成（出力がトークン上限まで暴走）に陥る実測あり（2026-06-16）。
//   price_after の取りこぼしは thinking ではなく「プロンプトの簡潔化」で解消した（buildPrompt 参照）。
function buildPayload(model: string, kind: string, pdfBase64: string) {
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: { type: "object", properties: { rows: { type: "array", items: ROW_SCHEMA } }, required: ["rows"] },
    temperature: 0,
    // 暴走（degenerate 生成）の物理ガード。~200 行のコンパクトJSONでも十分で、
    // 万一モデルが回り続けても 150s 上限に達する前に必ず打ち切られる。
    maxOutputTokens: 16384,
  }
  if (/flash/i.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 }
  return {
    contents: [{ parts: [{ inline_data: { mime_type: "application/pdf", data: pdfBase64 } }, { text: buildPrompt(kind) }] }],
    generationConfig,
  }
}

// ※ description は PDF の列見出しに一致させること（『現行小売定価』『変更小売定価』）。
//   『変更前/変更後』のような言い換えにすると flash-lite が price_after の列を取りこぼし、
//   さらに数字を延々と出力する degenerate 生成（MAX_TOKENS まで暴走→JSON破綻）に陥る実測あり（2026-06-16）。
//   列見出し一致版にしたところ 6/6 で price_before=現行・price_after=変更 を 2〜3秒で正確抽出。
const ROW_SCHEMA = {
  type: "object",
  properties: {
    brand: { type: "string", description: "ブランド名のみ" },
    product_name: { type: "string", description: "ブランド名＋半角スペース＋銘柄名の完全名称" },
    package_size: { type: "string", description: "容量・包装（例: 100.0g 箱）" },
    origin_country: { type: "string", description: "製造国" },
    approval_date: { type: "string", description: "認可日 YYYY-MM-DD（新規認可のみ）" },
    price: { type: "integer", description: "小売定価の円整数（新規認可のみ）" },
    price_before: { type: "integer", description: "現行小売定価の円整数（変更認可の変更前）" },
    price_after: { type: "integer", description: "変更小売定価の円整数（変更認可の変更後）" },
    changed_on: { type: "string", description: "変更実施年月日 YYYY-MM-DD（変更認可のみ）" },
  },
  required: ["product_name"],
}

// プロンプトは「簡潔さ」が重要。冗長化すると flash-lite が thinking 無効でも誤読/取りこぼし（特に変更認可の
// 2価格列）を起こす。逆に簡潔化すると thinking 不要で price_before/price_after を 2〜3秒で正確に読む（2026-06-16 実測）。
// セル結合の brand/origin 補完はフロント（ApprovalUpdate.vue）でも二重に行うため、ここでは要点のみ記す。
function buildPrompt(kind: string): string {
  const common =
    "財務省『製造たばこの小売定価の認可』PDFを読み取るアシスタントです。" +
    "表のうち一番左の『製造たばこの区分』が『パイプたばこ』の行だけを抽出し、他区分（紙巻・葉巻・かみたばこ等）は完全に無視します。" +
    "金額は円の整数（カンマ・『円』除去）、値が無ければ空。" +
    "日付は和暦を西暦に変換し YYYY-MM-DD で出力（令和N年=2018+N年、例『8.6.1』→2026-06-01／平成N年=1988+N年）。" +
    "左のグループ列（ブランド名・製造国）がセル結合で2行目以降空欄のときは直前行の値で補完。" +
    "product_name は『ブランド名＋半角スペース＋銘柄名』の完全名称（銘柄名が既にブランド名で始まる場合は二重化しない）。brand はブランド名のみ。"
  if (kind === "change") {
    return common +
      " これは変更認可PDF。小売定価の列が隣接して2つあります:『現行小売定価』=price_before、『変更小売定価』=price_after。" +
      "必ず両方の列を別々に読み取り、price_after（変更後）を空にしないこと。" +
      "各行 brand, product_name, package_size, origin_country, price_before, price_after, 変更実施年月日(changed_on) を返す。"
  }
  return common +
    " これは新規認可PDF。各行 brand, product_name, package_size, origin_country, 小売定価(price), 認可日(approval_date) を返す。"
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

  // モデルを順に試行: 各モデルで retry+backoff（429/503/5xx）→ なお失敗なら（4xx 含め）次のフォールバック先へ。
  // モデルにより PDF/responseSchema の対応差があるため、4xx でも別モデルなら成功しうる前提で委ねる。
  // deno-lint-ignore no-explicit-any — Gemini 応答は any（元実装踏襲）
  let data: any = null
  let usedModel = ""
  let lastStatus = 0
  let lastDetail = "unknown"
  const hardDeadline = Date.now() + HARD_DEADLINE_MS
  for (const model of MODELS) {
    if (Date.now() > hardDeadline) break  // 全体期限超過：以降のフォールバックは試さない
    const r = await callGeminiModel(apiKey, model, buildPayload(model, kind, pdfBase64), hardDeadline)
    if (r.ok) { data = r.data; usedModel = model; break }
    lastStatus = r.status
    lastDetail = r.detail
    // 非リトライ系（4xx 等）でも別モデルなら成功しうる（PDF/responseSchema の対応差）ので次モデルへ委ねる。
  }
  if (data === null) {
    const hint = (lastStatus === 0 || lastStatus === 429 || lastStatus >= 500)
      ? "（混雑/レート制限のため取得できませんでした。30秒〜1分おいてもう一度お試しください）"
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

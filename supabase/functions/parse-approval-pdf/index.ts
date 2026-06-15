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

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash"

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
    "【ブランド名のセル結合に注意】新しいPDFでは『ブランド名』列が同一ブランド内でセル結合されており、" +
    "2行目以降のブランド名が空欄に見えることがあります。空欄の行は必ず直前の行のブランド名を引き継いで補完してください。" +
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`
  const payload = {
    contents: [{
      parts: [
        { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
        { text: buildPrompt(kind) },
      ],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: { type: "object", properties: { rows: { type: "array", items: ROW_SCHEMA } }, required: ["rows"] },
      temperature: 0,
      // thinking を無効化（抽出タスクには不要・100品目超の変更認可で 150s タイムアウトを回避）
      thinkingConfig: { thinkingBudget: 0 },
      // 100行超の JSON 出力が途中で切れないよう上限を拡大
      maxOutputTokens: 65536,
    },
  }

  let geminiRes: Response
  try {
    geminiRes = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
  } catch (e) {
    return new Response(JSON.stringify({ error: `Gemini 呼び出し失敗: ${e}` }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } })
  }
  if (!geminiRes.ok) {
    const detail = await geminiRes.text()
    return new Response(JSON.stringify({ error: `Gemini エラー (${geminiRes.status})`, detail: detail.slice(0, 500) }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } })
  }

  const data = await geminiRes.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"
  let rows: unknown[] = []
  try {
    const parsed = JSON.parse(text)
    rows = Array.isArray(parsed?.rows) ? parsed.rows : []
  } catch {
    return new Response(JSON.stringify({ error: "Gemini 応答の JSON 解析に失敗", raw: String(text).slice(0, 500) }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } })
  }

  return new Response(JSON.stringify({ rows, kind, model: MODEL }), { headers: { ...CORS, "Content-Type": "application/json" } })
})

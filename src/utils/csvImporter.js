// V-PEACH 売上CSV取り込みユーティリティ
// 参照: V-PEACH/notes/V-PEACH_sales-import-plan.md

// ─── ファイル読み込み（Shift-JIS） ────────────────────────────────────────
export function readShiftJisFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const decoder = new TextDecoder('shift-jis')
        resolve(decoder.decode(reader.result))
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error || new Error('FileReader error'))
    reader.readAsArrayBuffer(file)
  })
}

// ─── シンプル CSV パーサ ──────────────────────────────────────────────────
// クォート対応の最小実装。改行は行区切り、" でクォート、"" でエスケープ。
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else { inQuotes = false }
      } else {
        field += ch
      }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\r') { /* skip; \n が来た時点で行切る */ }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else { field += ch }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.length > 0 && !(r.length === 1 && r[0] === ''))
}

// ─── 金額パース（"\1644700" / "1,644,700" / "1644700" 全対応） ──────
function parseMoney(raw) {
  if (raw == null) return 0
  // バックスラッシュ・円マーク・カンマ・空白を除去
  const cleaned = String(raw).replace(/[\\¥,\s]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

// ─── ヘッダー内容から CSV 種別を判定 ──────────────────────────────────────
// Airメイト: ヘッダーに「カテゴリー」「売上合計」を含む
// Airレジ:   ヘッダーに「集計期間」「割引額」を含む
// どちらでもなければ null
export function detectCsvKindFromHeader(text) {
  const rows = parseCsv(text)
  if (rows.length === 0) return null
  const header = rows[0].map(h => (h || '').trim())
  if (header.includes('カテゴリー') && header.includes('売上合計')) return 'airmate'
  if (header.includes('集計期間') && header.includes('割引額')) return 'airregi'
  return null
}

// ─── Airメイト CSV パース ─────────────────────────────────────────────────
// ヘッダー: 順位,カテゴリー,出数ABC分析,出数構成比,出数合計,売上ABC分析,売上構成比,売上合計,粗利ABC分析,粗利構成比,粗利合計
// シーシャ → service_sales（割引前）、物販 → merchandise_sales
const AIRMATE_CATEGORY_MAP = {
  'シーシャ': 'service',
  '物販': 'merchandise'
}

export function parseAirmateCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('Airメイト CSV にデータがありません')
  const header = rows[0]
  const idxCategory = header.indexOf('カテゴリー')
  const idxSalesTotal = header.indexOf('売上合計')
  if (idxCategory < 0 || idxSalesTotal < 0) {
    throw new Error('Airメイト CSV のヘッダーに「カテゴリー」または「売上合計」が見つかりません')
  }
  let raw_service_sales = 0
  let raw_merchandise_sales = 0
  const seen = new Set()
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const category = (r[idxCategory] || '').trim()
    const target = AIRMATE_CATEGORY_MAP[category]
    if (!target) continue
    const amount = parseMoney(r[idxSalesTotal])
    if (target === 'service') raw_service_sales = amount
    else if (target === 'merchandise') raw_merchandise_sales = amount
    seen.add(target)
  }
  if (!seen.has('service')) {
    throw new Error('Airメイト CSV にカテゴリー「シーシャ」が見つかりません')
  }
  // 物販が無い月もあり得る → 0 のまま
  return { raw_service_sales, raw_merchandise_sales }
}

// ─── Airレジ CSV パース ───────────────────────────────────────────────────
// ヘッダー: 集計期間,売上,会計数,会計単価,客数,客単価,商品数,現金支払合計額,現金その他支払合計額,割引額
// 集計期間は YYYYMMDD、割引額は負値 → ABS で正規化
export function parseAirregiCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('Airレジ CSV にデータがありません')
  const header = rows[0]
  const idxDate = header.indexOf('集計期間')
  const idxSales = header.indexOf('売上')
  const idxCustomer = header.indexOf('客数')
  const idxDiscount = header.indexOf('割引額')
  if (idxDate < 0 || idxDiscount < 0) {
    throw new Error('Airレジ CSV のヘッダーに「集計期間」または「割引額」が見つかりません')
  }
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const dateRaw = (r[idxDate] || '').trim()
    if (!/^\d{8}$/.test(dateRaw)) continue
    const sale_date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
    const discount_amount = Math.abs(parseMoney(r[idxDiscount]))
    const gross_sales = idxSales >= 0 ? parseMoney(r[idxSales]) : null
    const customer_count = idxCustomer >= 0 ? Number(r[idxCustomer]) || null : null
    out.push({ sale_date, discount_amount, gross_sales, customer_count })
  }
  if (out.length === 0) throw new Error('Airレジ CSV から有効な日次レコードが取得できませんでした')
  return out
}

// ─── ファイル名から店舗キー / 期間を抽出 ─────────────────────────────────
// 例: airmate_baba-main_20251225-20260129.csv
//     売上集計_baba-2nd_20251201-20251231.csv
const STORE_KEY_FROM_FILENAME = {
  'baba-main': 'baba_main',
  'baba-2nd':  'baba_2nd',
  'nakano':    'nakano'
}

export function detectStoreKeyFromFilename(filename) {
  const base = filename.replace(/\.csv$/i, '')
  for (const k of Object.keys(STORE_KEY_FROM_FILENAME)) {
    if (base.includes(k)) return STORE_KEY_FROM_FILENAME[k]
  }
  return null
}

export function detectDateRangeFromFilename(filename) {
  const m = filename.match(/(\d{8})-(\d{8})/)
  if (!m) return null
  const fmt = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return { start_date: fmt(m[1]), end_date: fmt(m[2]) }
}

// ─── 事業月度範囲の割引合計をクライアント側で算出（DB日次キャッシュ + 当月CSV） ──
// dbDailyRows: { sale_date, discount_amount }[] — 前月最終盤のキャッシュ
// csvDailyRows: { sale_date, discount_amount }[] — 当月CSVパース結果
// 同じ日付があれば CSV 側を優先
export function calcDiscountTotalInPeriod(dbDailyRows, csvDailyRows, startDate, endDate) {
  const map = new Map()
  for (const r of dbDailyRows) map.set(r.sale_date, r.discount_amount)
  for (const r of csvDailyRows) map.set(r.sale_date, r.discount_amount)
  let total = 0
  let daysFromDb = 0
  let daysFromCsv = 0
  const csvDateSet = new Set(csvDailyRows.map(r => r.sale_date))
  for (const [date, amount] of map.entries()) {
    if (date < startDate || date > endDate) continue
    total += Number(amount) || 0
    if (csvDateSet.has(date)) daysFromCsv++
    else daysFromDb++
  }
  return { total_discount: total, days_from_db: daysFromDb, days_from_csv: daysFromCsv }
}

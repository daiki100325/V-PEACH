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
// Airメイト:   ヘッダーに「カテゴリー」「売上合計」を含む
// Airレジ:     ヘッダーに「集計期間」「割引額」を含む
// HRMOS シフト: ヘッダーが [拠点ID, 従業員ID, 日付, 勤務区分]
// HRMOS スタッフ: ヘッダーに「社員ID」「ログインID」「姓」「名」「入社日」を含む
// HRMOS 勤務区分: ヘッダーに「勤務区分ID」「勤務区分名」「並び順」を含む
// どれでもなければ null
export function detectCsvKindFromHeader(text) {
  const rows = parseCsv(text)
  if (rows.length === 0) return null
  const header = rows[0].map(h => (h || '').trim())
  if (header.includes('カテゴリー') && header.includes('売上合計')) return 'airmate'
  if (header.includes('集計期間') && header.includes('割引額')) return 'airregi'
  if (
    header.length === 4 &&
    header.includes('拠点ID') && header.includes('従業員ID') &&
    header.includes('日付') && header.includes('勤務区分')
  ) return 'hrmos_shifts'
  if (
    header.includes('社員ID') && header.includes('ログインID') &&
    header.includes('姓') && header.includes('名') && header.includes('入社日')
  ) return 'hrmos_staffs'
  if (
    header.includes('勤務区分ID') && header.includes('勤務区分名') && header.includes('並び順')
  ) return 'hrmos_segments'
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
// 日本語店舗名（優先）または英語キーでマッチ。
// 戻り値は InputApp の csvFiles キー（baba / nakano / baba_2nd）
const STORE_NAME_JP = [
  ['馬場2号店', 'baba_2nd'],  // 「馬場本店」より先にチェック
  ['馬場本店',  'baba'],
  ['中野店',    'nakano'],
]
const STORE_KEY_FROM_FILENAME_EN = {
  'baba-main': 'baba',
  'baba-2nd':  'baba_2nd',
  'nakano':    'nakano'
}

export function detectStoreKeyFromFilename(filename) {
  const base = filename.replace(/\.csv$/i, '')
  for (const [name, key] of STORE_NAME_JP) {
    if (base.includes(name)) return key
  }
  for (const [k, key] of Object.entries(STORE_KEY_FROM_FILENAME_EN)) {
    if (base.includes(k)) return key
  }
  return null
}

export function detectDateRangeFromFilename(filename) {
  const m = filename.match(/(\d{8})-(\d{8})/)
  if (!m) return null
  const fmt = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return { start_date: fmt(m[1]), end_date: fmt(m[2]) }
}

// ─── HRMOS シフト CSV パース ──────────────────────────────────────────────
// ヘッダー: 拠点ID, 従業員ID, 日付, 勤務区分
// 例: 7,2,2026-01-06,85
export function parseHrmosShiftsCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('シフト CSV にデータがありません')
  const header = rows[0]
  const idxLocation = header.indexOf('拠点ID')
  const idxStaff = header.indexOf('従業員ID')
  const idxDate = header.indexOf('日付')
  const idxSegment = header.indexOf('勤務区分')
  if (idxStaff < 0 || idxDate < 0 || idxSegment < 0) {
    throw new Error('シフト CSV のヘッダーに必須列（従業員ID/日付/勤務区分）が見つかりません')
  }
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const dateRaw = (r[idxDate] || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) continue
    const staffId = Number(r[idxStaff])
    const segmentId = Number(r[idxSegment])
    if (!Number.isFinite(staffId) || !Number.isFinite(segmentId)) continue
    out.push({
      locationId: idxLocation >= 0 ? Number(r[idxLocation]) || null : null,
      staffId,
      date: dateRaw,
      segmentId
    })
  }
  if (out.length === 0) throw new Error('シフト CSV から有効なレコードが取得できませんでした')
  return out
}

// ─── HRMOS スタッフマスタ CSV パース ──────────────────────────────────────
// `display_name` = "姓 名"、ロールは display_name / account_name から自動判定
const FIXED_SALARY_NAMES = new Set(['立花 弘行', '木村 仁美', '中道 雄耶', '塚本 大己'])
const OWNER_RYO_ACCOUNT = 'ryo'

export function decideHrmosStaffRole(displayName, accountName) {
  if (FIXED_SALARY_NAMES.has(displayName)) return 'fixed_salary'
  if (accountName && String(accountName).toLowerCase() === OWNER_RYO_ACCOUNT) return 'owner_ryo'
  return 'part_time'
}

export function parseHrmosStaffsCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('スタッフ CSV にデータがありません')
  const header = rows[0]
  const idxId = header.indexOf('社員ID')
  const idxLogin = header.indexOf('ログインID')
  const idxLast = header.indexOf('姓')
  const idxFirst = header.indexOf('名')
  const idxJoined = header.indexOf('入社日')
  const idxLeft = header.indexOf('退職日')
  if (idxId < 0 || idxLast < 0 || idxFirst < 0) {
    throw new Error('スタッフ CSV のヘッダーに必須列（社員ID/姓/名）が見つかりません')
  }
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const hrmosId = Number(r[idxId])
    if (!Number.isFinite(hrmosId)) continue
    const lastName = (r[idxLast] || '').trim()
    const firstName = (r[idxFirst] || '').trim()
    if (!lastName && !firstName) continue
    const displayName = [lastName, firstName].filter(Boolean).join(' ')
    const accountName = idxLogin >= 0 ? (r[idxLogin] || '').trim() : null
    const joinedRaw = idxJoined >= 0 ? (r[idxJoined] || '').trim() : ''
    const leftRaw = idxLeft >= 0 ? (r[idxLeft] || '').trim() : ''
    out.push({
      hrmos_staff_id: hrmosId,
      display_name: displayName,
      account_name: accountName || null,
      role: decideHrmosStaffRole(displayName, accountName),
      joined_on: /^\d{4}-\d{2}-\d{2}$/.test(joinedRaw) ? joinedRaw : null,
      left_on: /^\d{4}-\d{2}-\d{2}$/.test(leftRaw) ? leftRaw : null
    })
  }
  return out
}

// ─── HRMOS 勤務区分マスタ CSV パース ──────────────────────────────────────
// 店舗判定（segment_name プレフィックスマッチ）と shift_type 判定を同時に行う
// stores テーブルの store_id を解決するため、storeKeyToId マップを渡す
//   { baba_main: 1, nakano: 2, baba_2nd: 3 }
const SEGMENT_STORE_PATTERNS = [
  { key: 'baba_main', match: ['高田馬場本店', '馬場本店', '馬場地区基本店'] },
  { key: 'baba_2nd',  match: ['高田馬場2号店', '馬場2号店', '馬場地区2号店'] },
  { key: 'nakano',    match: ['中野店'] }
]

const SEGMENT_NON_PAYROLL_PATTERNS = ['倉庫業務', '会議等', '営業中']

export function decideHrmosSegmentClassification(segmentName) {
  const name = String(segmentName || '')
  // 1. 按分対象外（倉庫業務・会議等）
  for (const p of SEGMENT_NON_PAYROLL_PATTERNS) {
    if (name.includes(p)) return { storeKey: null, shiftType: 'misc', defaultHours: 0, isPayrollTarget: false }
  }
  // 2. 「[」プレフィックス（短縮営業・短縮稼働など特殊枠）→ 警告対象
  if (name.startsWith('[')) {
    return { storeKey: null, shiftType: 'misc', defaultHours: 0, isPayrollTarget: false }
  }
  // 3. 店舗判定
  let storeKey = null
  for (const p of SEGMENT_STORE_PATTERNS) {
    if (p.match.some(m => name.includes(m))) { storeKey = p.key; break }
  }
  // 4. シフトタイプ判定
  //    - "オーラス"/"オールイン" は早番+遅番分解計上のため allin
  //    - "8.0h" 等の特殊バリアントは misc 扱い（手動上書きで対応）
  if (name.includes('8.0h') || name.includes('6.5h')) {
    return { storeKey, shiftType: 'misc', defaultHours: 0, isPayrollTarget: false }
  }
  if (name.includes('オーラス') || name.includes('オールイン')) {
    return { storeKey, shiftType: 'allin', defaultHours: 11.5, isPayrollTarget: storeKey != null }
  }
  if (name.includes('早番')) return { storeKey, shiftType: 'early',  defaultHours: 7.5, isPayrollTarget: storeKey != null }
  if (name.includes('中番')) return { storeKey, shiftType: 'middle', defaultHours: 6.0, isPayrollTarget: storeKey != null }
  if (name.includes('遅番')) return { storeKey, shiftType: 'late',   defaultHours: 6.0, isPayrollTarget: storeKey != null }
  // 5. 上記いずれにも該当しない（公休/振替/有休/在籍なし等）→ 按分対象外
  return { storeKey: null, shiftType: 'misc', defaultHours: 0, isPayrollTarget: false }
}

export function parseHrmosSegmentsCsv(text, storeKeyToId) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('勤務区分 CSV にデータがありません')
  const header = rows[0]
  const idxId = header.indexOf('勤務区分ID')
  const idxName = header.indexOf('勤務区分名')
  if (idxId < 0 || idxName < 0) {
    throw new Error('勤務区分 CSV のヘッダーに必須列（勤務区分ID/勤務区分名）が見つかりません')
  }
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const segId = Number(r[idxId])
    if (!Number.isFinite(segId)) continue
    const name = (r[idxName] || '').trim()
    if (!name) continue
    const c = decideHrmosSegmentClassification(name)
    const storeId = c.storeKey ? (storeKeyToId?.[c.storeKey] ?? null) : null
    out.push({
      hrmos_segment_id: segId,
      segment_name: name,
      store_id: storeId,
      shift_type: c.shiftType,
      default_hours: c.defaultHours,
      is_payroll_target: c.isPayrollTarget && storeId != null
    })
  }
  return out
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

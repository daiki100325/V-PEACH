import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

function requireSupabase() {
  if (!supabase) throw new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

function normalizeStoreKey(key) {
  if (key === 'baba') return 'baba_main'
  return key
}

async function getStoreIdByKey(storeKey) {
  const key = normalizeStoreKey(storeKey)
  const { data, error } = await supabase.from('stores').select('id').eq('store_key', key).single()
  if (error) throw error
  return data.id
}

// ─── 店舗一覧 ───────────────────────────────────────────────────────────────

export async function getStores() {
  requireSupabase()
  const { data, error } = await supabase
    .from('stores')
    .select('id,store_key,name')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

// ─── pe_monthly_records ─────────────────────────────────────────────────────

export async function getMonthlyRecord(storeKey, periodKey) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const pk = Number(periodKey)
  const { data, error } = await supabase
    .from('pe_monthly_records')
    .select('*')
    .eq('store_id', storeId)
    .eq('period_key', pk)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertMonthlyRecord(storeKey, periodKey, fields) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const pk = Number(periodKey)
  const row = {
    store_id: storeId,
    period_key: pk,
    updated_at: new Date().toISOString(),
    ...fields
  }
  const { error } = await supabase
    .from('pe_monthly_records')
    .upsert(row, { onConflict: 'store_id,period_key' })
  if (error) throw error
}

/** 指定年の全月分レコードを一括取得（YYYY01〜YYYY12） */
export async function getMonthlyRecordsForYear(storeKey, year) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const fromPk = year * 100 + 1
  const toPk = year * 100 + 12
  const { data, error } = await supabase
    .from('pe_monthly_records')
    .select('*')
    .eq('store_id', storeId)
    .gte('period_key', fromPk)
    .lte('period_key', toPk)
    .order('period_key', { ascending: true })
  if (error) throw error
  return data || []
}

// ─── pe_monthly_company_records ──────────────────────────────────────────────

/** 指定月の全社人件費レコードを取得（新方式入力済みかどうかの判定にも使用） */
export async function getMonthlyCompanyRecord(periodKey) {
  requireSupabase()
  const pk = Number(periodKey)
  const { data, error } = await supabase
    .from('pe_monthly_company_records')
    .select('*')
    .eq('period_key', pk)
    .maybeSingle()
  if (error) throw error
  return data
}

/** 記録済みの最新 period_key を返す（未記録なら null） */
export async function getLatestPeriodKey() {
  requireSupabase()
  const { data, error } = await supabase
    .from('pe_monthly_company_records')
    .select('period_key')
    .order('period_key', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.period_key ?? null
}

/** 全社人件費レコードを upsert */
export async function upsertMonthlyCompanyRecord(periodKey, fields) {
  requireSupabase()
  const pk = Number(periodKey)
  const row = {
    period_key: pk,
    updated_at: new Date().toISOString(),
    ...fields
  }
  const { error } = await supabase
    .from('pe_monthly_company_records')
    .upsert(row, { onConflict: 'period_key' })
  if (error) throw error
}

/** 指定年の全社人件費レコードを一括取得 */
export async function getMonthlyCompanyRecordsForYear(year) {
  requireSupabase()
  const fromPk = year * 100 + 1
  const toPk = year * 100 + 12
  const { data, error } = await supabase
    .from('pe_monthly_company_records')
    .select('*')
    .gte('period_key', fromPk)
    .lte('period_key', toPk)
    .order('period_key', { ascending: true })
  if (error) throw error
  return data || []
}

// ─── pe_company_settings ────────────────────────────────────────────────────

export async function getCompanySettings() {
  requireSupabase()
  const { data, error } = await supabase
    .from('pe_company_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data ?? { id: 1, exec_remuneration: 0, debt_repayment: 0 }
}

export async function upsertCompanySettings(fields) {
  requireSupabase()
  const { error } = await supabase
    .from('pe_company_settings')
    .upsert({ id: 1, ...fields }, { onConflict: 'id' })
  if (error) throw error
}

// ─── pe_store_settings ──────────────────────────────────────────────────────

export async function getStoreSettings(storeKey) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const { data, error } = await supabase
    .from('pe_store_settings')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle()
  if (error) throw error
  return data ?? {
    store_id: storeId,
    fixed_rent: 0,
    fixed_utilities: 0,
    fixed_sundries: 0,
    payment_fee_rate: 0.025
  }
}

export async function upsertStoreSettings(storeKey, fields) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const { error } = await supabase
    .from('pe_store_settings')
    .upsert({ store_id: storeId, ...fields }, { onConflict: 'store_id' })
  if (error) throw error
}

// ─── pe_store_settings_revisions ────────────────────────────────────────────

/** 指定期間に有効な店舗固定費設定を返す（effective_from <= periodKey の最新） */
export async function getActiveStoreSettings(storeKey, periodKey) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const pk = Number(periodKey)
  const { data, error } = await supabase
    .from('pe_store_settings_revisions')
    .select('*')
    .eq('store_id', storeId)
    .lte('effective_from', pk)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (data) return data
  // フォールバック: 旧テーブルを参照
  return getStoreSettings(storeKey)
}

/** 店舗固定費の全改定履歴を新しい順で返す */
export async function getStoreSettingsRevisions(storeKey) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const { data, error } = await supabase
    .from('pe_store_settings_revisions')
    .select('*')
    .eq('store_id', storeId)
    .order('effective_from', { ascending: false })
  if (error) throw error
  return data || []
}

/** 店舗固定費の改定を追加 */
export async function addStoreSettingsRevision(storeKey, effectiveFrom, fields) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const { error } = await supabase
    .from('pe_store_settings_revisions')
    .insert({ store_id: storeId, effective_from: Number(effectiveFrom), ...fields })
  if (error) throw error
}

/** 店舗固定費の改定を削除 */
export async function deleteStoreSettingsRevision(id) {
  requireSupabase()
  const { error } = await supabase
    .from('pe_store_settings_revisions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── pe_company_settings_revisions ──────────────────────────────────────────

/** 指定期間に有効な全社共通費設定を返す */
export async function getActiveCompanySettings(periodKey) {
  requireSupabase()
  const pk = Number(periodKey)
  const { data, error } = await supabase
    .from('pe_company_settings_revisions')
    .select('*')
    .lte('effective_from', pk)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (data) return data
  return getCompanySettings()
}

/** 全社共通費の全改定履歴を新しい順で返す */
export async function getCompanySettingsRevisions() {
  requireSupabase()
  const { data, error } = await supabase
    .from('pe_company_settings_revisions')
    .select('*')
    .order('effective_from', { ascending: false })
  if (error) throw error
  return data || []
}

/** 全社共通費の改定を追加 */
export async function addCompanySettingsRevision(effectiveFrom, fields) {
  requireSupabase()
  const { error } = await supabase
    .from('pe_company_settings_revisions')
    .insert({ effective_from: Number(effectiveFrom), ...fields })
  if (error) throw error
}

/** 全社共通費の改定を削除 */
export async function deleteCompanySettingsRevision(id) {
  requireSupabase()
  const { error } = await supabase
    .from('pe_company_settings_revisions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── pe_benchmarks_revisions ─────────────────────────────────────────────────

/** 指定期間に有効なベンチマーク目標値を返す（{ f_ratio, ... } の単一オブジェクト） */
export async function getActiveBenchmarks(periodKey) {
  requireSupabase()
  const pk = Number(periodKey)
  const { data, error } = await supabase
    .from('pe_benchmarks_revisions')
    .select('*')
    .lte('effective_from', pk)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (data) return data
  // フォールバック: pe_benchmarks シングルトンを参照
  return getBenchmarks()
}

/** ベンチマーク目標値の全改定履歴を新しい順で返す */
export async function getBenchmarksRevisions() {
  requireSupabase()
  const { data, error } = await supabase
    .from('pe_benchmarks_revisions')
    .select('*')
    .order('effective_from', { ascending: false })
  if (error) throw error
  return data || []
}

/** ベンチマーク目標値の改定を追加 */
export async function addBenchmarksRevision(effectiveFrom, fields) {
  requireSupabase()
  const { error } = await supabase
    .from('pe_benchmarks_revisions')
    .insert({ effective_from: Number(effectiveFrom), ...fields })
  if (error) throw error
}

/** ベンチマーク目標値の改定を削除 */
export async function deleteBenchmarksRevision(id) {
  requireSupabase()
  const { error } = await supabase
    .from('pe_benchmarks_revisions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── pe_benchmarks ──────────────────────────────────────────────────────────

/** デフォルトベンチマーク目標値を返す（シングルトン id=1） */
export async function getBenchmarks() {
  requireSupabase()
  const { data, error } = await supabase
    .from('pe_benchmarks')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data ?? {}
}

export async function upsertBenchmarks(fields) {
  requireSupabase()
  const { error } = await supabase
    .from('pe_benchmarks')
    .upsert({ id: 1, ...fields }, { onConflict: 'id' })
  if (error) throw error
}

// ─── V-MINT cost_reports 参照（読み取り専用） ─────────────────────────────

/** 指定店舗・対象月のcost_reportsデータを取得（フレーバー・炭コスト計算用） */
export async function getCostReportForPE(storeKey, periodKey) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const pk = Number(periodKey)

  const { data: report, error: reportError } = await supabase
    .from('cost_reports')
    .select('*')
    .eq('store_id', storeId)
    .eq('period_key', pk)
    .maybeSingle()
  if (reportError) throw reportError
  if (!report) return null

  const { data: brandSales, error: salesError } = await supabase
    .from('flavor_brand_sales')
    .select('*')
    .eq('report_id', report.id)
  if (salesError) throw salesError

  const { data: drinks, error: drinksError } = await supabase
    .from('drink_orders')
    .select('period_key,amount')
    .eq('store_id', storeId)
    .eq('period_key', pk)
  if (drinksError) throw drinksError

  return { report, brandSales: brandSales || [], drinks: drinks || [] }
}

/** V-MINTの集計期間（start_date, end_date）のみを取得 */
export async function getCostReportDates(storeKey, periodKey) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const pk = Number(periodKey)
  const { data, error } = await supabase
    .from('cost_reports')
    .select('start_date,end_date')
    .eq('store_id', storeId)
    .eq('period_key', pk)
    .maybeSingle()
  if (error) throw error
  return data
}

// ─── pe_daily_sales_cache（売上CSVインポート用） ──────────────────────────

/**
 * 指定店舗・期間の日次キャッシュレコードを取得
 * @returns [{ sale_date, discount_amount, gross_sales, customer_count }, ...]
 */
export async function getDailySalesInRange(storeKey, startDate, endDate) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const { data, error } = await supabase
    .from('pe_daily_sales_cache')
    .select('sale_date,discount_amount,gross_sales,customer_count')
    .eq('store_id', storeId)
    .gte('sale_date', startDate)
    .lte('sale_date', endDate)
    .order('sale_date', { ascending: true })
  if (error) throw error
  return data || []
}

/**
 * 日次レコードを upsert
 * @param storeKey 店舗キー
 * @param rows [{ sale_date, discount_amount, gross_sales, customer_count }, ...]
 */
export async function upsertDailySalesCache(storeKey, rows) {
  requireSupabase()
  if (!rows || rows.length === 0) return
  const storeId = await getStoreIdByKey(storeKey)
  const payload = rows.map(r => ({
    store_id: storeId,
    sale_date: r.sale_date,
    discount_amount: r.discount_amount,
    gross_sales: r.gross_sales ?? null,
    customer_count: r.customer_count ?? null,
    imported_at: new Date().toISOString()
  }))
  const { error } = await supabase
    .from('pe_daily_sales_cache')
    .upsert(payload, { onConflict: 'store_id,sale_date' })
  if (error) throw error
}

/**
 * 指定店舗の「beforeDate より古い」日次レコードを削除（インポート末尾の自動クリーンアップ用）
 */
export async function deleteOldDailySalesCache(storeKey, beforeDate) {
  requireSupabase()
  const storeId = await getStoreIdByKey(storeKey)
  const { error } = await supabase
    .from('pe_daily_sales_cache')
    .delete()
    .eq('store_id', storeId)
    .lt('sale_date', beforeDate)
  if (error) throw error
}

// ─── pe_hrmos_staffs（HRMOS スタッフマスタ） ─────────────────────────────
// 参照: V-PEACH/notes/V-PEACH_shifts-csv-import-plan.md §2.1

export async function getHrmosStaffs() {
  requireSupabase()
  const { data, error } = await supabase
    .from('pe_hrmos_staffs')
    .select('*')
    .order('hrmos_staff_id', { ascending: true })
  if (error) throw error
  return data || []
}

/**
 * staffs CSV 取込時のバルク upsert
 * @param rows [{ hrmos_staff_id, display_name, account_name, role, default_store_id?, joined_on?, left_on?, note? }, ...]
 */
export async function upsertHrmosStaffs(rows) {
  requireSupabase()
  if (!rows || rows.length === 0) return
  const payload = rows.map(r => ({ ...r, updated_at: new Date().toISOString() }))
  const { error } = await supabase
    .from('pe_hrmos_staffs')
    .upsert(payload, { onConflict: 'hrmos_staff_id' })
  if (error) throw error
}

/** 個別ロール上書き */
export async function updateHrmosStaffRole(hrmosStaffId, role) {
  requireSupabase()
  const { error } = await supabase
    .from('pe_hrmos_staffs')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('hrmos_staff_id', hrmosStaffId)
  if (error) throw error
}

// ─── pe_hrmos_segments（HRMOS 勤務区分マスタ） ───────────────────────────
// 参照: V-PEACH/notes/V-PEACH_shifts-csv-import-plan.md §2.2

export async function getHrmosSegments() {
  requireSupabase()
  const { data, error } = await supabase
    .from('pe_hrmos_segments')
    .select('*')
    .order('hrmos_segment_id', { ascending: true })
  if (error) throw error
  return data || []
}

/**
 * segments CSV 取込時のバルク upsert
 * @param rows [{ hrmos_segment_id, segment_name, store_id, shift_type, default_hours, is_payroll_target, note? }, ...]
 */
export async function upsertHrmosSegments(rows) {
  requireSupabase()
  if (!rows || rows.length === 0) return
  const payload = rows.map(r => ({ ...r, updated_at: new Date().toISOString() }))
  const { error } = await supabase
    .from('pe_hrmos_segments')
    .upsert(payload, { onConflict: 'hrmos_segment_id' })
  if (error) throw error
}

/** 自動判定不可レコードの手動上書き */
export async function updateHrmosSegment(hrmosSegmentId, fields) {
  requireSupabase()
  const { error } = await supabase
    .from('pe_hrmos_segments')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('hrmos_segment_id', hrmosSegmentId)
  if (error) throw error
}

// ─── pe_jp_holidays / pe_jp_holidays_meta（祝日キャッシュ） ──────────────
// 参照: V-PEACH/notes/V-PEACH_shifts-csv-import-plan.md §3.4

/**
 * 祝日キャッシュ取得（年指定 or 範囲指定）
 * @param yearOrRange  number（年指定: 2026）または { from: 2025, to: 2027 }
 */
export async function getJpHolidays(yearOrRange) {
  requireSupabase()
  let query = supabase.from('pe_jp_holidays').select('holiday_date,holiday_name').order('holiday_date')
  if (typeof yearOrRange === 'number') {
    const fromDate = `${yearOrRange}-01-01`
    const toDate = `${yearOrRange}-12-31`
    query = query.gte('holiday_date', fromDate).lte('holiday_date', toDate)
  } else if (yearOrRange && typeof yearOrRange === 'object') {
    const fromDate = `${yearOrRange.from}-01-01`
    const toDate = `${yearOrRange.to}-12-31`
    query = query.gte('holiday_date', fromDate).lte('holiday_date', toDate)
  }
  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * 祝日 API フェッチ成功時のバルク upsert
 * @param rows [{ holiday_date: '2026-01-01', holiday_name: '元日' }, ...]
 */
export async function upsertJpHolidays(rows) {
  requireSupabase()
  if (!rows || rows.length === 0) return
  const payload = rows.map(r => ({
    holiday_date: r.holiday_date,
    holiday_name: r.holiday_name,
    fetched_at: new Date().toISOString()
  }))
  const { error } = await supabase
    .from('pe_jp_holidays')
    .upsert(payload, { onConflict: 'holiday_date' })
  if (error) throw error
}

/** 祝日マスタの取得状況メタを参照 */
export async function getJpHolidaysMeta() {
  requireSupabase()
  const { data, error } = await supabase
    .from('pe_jp_holidays_meta')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data ?? { id: 1, last_fetched_at: null, last_fetch_status: null, last_fetch_error: null }
}

/** 祝日マスタの取得状況メタを更新 */
export async function updateJpHolidaysMeta(payload) {
  requireSupabase()
  const row = {
    id: 1,
    ...payload,
    updated_at: new Date().toISOString()
  }
  const { error } = await supabase
    .from('pe_jp_holidays_meta')
    .upsert(row, { onConflict: 'id' })
  if (error) throw error
}

// ─── V-MINT cost_price_masters ──────────────────────────────────────────

/** 指定periodKeyに有効なV-MINTの単価マスター（フレーバー・炭単価）を返す */
export async function getCostPriceForPeriod(periodKey) {
  requireSupabase()
  const pk = Number(periodKey)
  const { data, error } = await supabase
    .from('cost_price_masters')
    .select('*')
    .lte('effective_from', pk)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ?? { price_flavor_per_g: 40, price_charcoal_per_kg: 600 }
}

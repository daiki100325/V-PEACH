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

// ─── pe_benchmarks ──────────────────────────────────────────────────────────

/** storeKey=null で全社共通ベンチマークを取得 */
export async function getBenchmarks(storeKey) {
  requireSupabase()
  let query = supabase.from('pe_benchmarks').select('*')
  if (storeKey) {
    const storeId = await getStoreIdByKey(storeKey)
    query = query.eq('store_id', storeId)
  } else {
    query = query.is('store_id', null)
  }
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function upsertBenchmark(storeKey, itemName, targetValue, isPercentage) {
  requireSupabase()
  const storeId = storeKey ? await getStoreIdByKey(storeKey) : null
  const { error } = await supabase
    .from('pe_benchmarks')
    .upsert(
      { store_id: storeId, item_name: itemName, target_value: targetValue, is_percentage: isPercentage },
      { onConflict: 'store_id,item_name' }
    )
  if (error) throw error
}

export async function deleteBenchmark(storeKey, itemName) {
  requireSupabase()
  const storeId = storeKey ? await getStoreIdByKey(storeKey) : null
  let query = supabase.from('pe_benchmarks').delete().eq('item_name', itemName)
  if (storeId) {
    query = query.eq('store_id', storeId)
  } else {
    query = query.is('store_id', null)
  }
  const { error } = await query
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

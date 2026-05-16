/**
 * V-MINTのcost_reportsデータからフレーバー・炭・ジュースの変動費を計算
 * costReport: {report, brandSales, drinks} の形式
 */
export function calcVariableCostFromCostReport(costReport, priceFlavorPerG, priceCharcoalPerKg) {
  if (!costReport?.report) return { flavorCost: 0, charcoalCost: 0, drinkCost: 0 }
  const report = costReport.report
  const brandSales = costReport.brandSales || []
  const drinks = costReport.drinks || []
  const n = (v) => Number(v) || 0

  // フレーバー消費グラム（提供分のみ、物販分を除く）
  const flavorServeG = brandSales.reduce((acc, s) => {
    const merchG = n(s.merch_count) * n(s.grams_per_pack)
    return acc + Math.max(0, n(s.total_consumption_g) - merchG)
  }, 0)

  // 炭消費量(kg)
  const charcoalServeKg = n(report.charcoal_nyanco_flat_serve) + n(report.charcoal_kingco_flat_serve)

  // ジュース発注合計
  const drinkCost = drinks.reduce((acc, d) => acc + n(d.amount), 0)

  return {
    flavorCost: flavorServeG * n(priceFlavorPerG),
    charcoalCost: charcoalServeKg * n(priceCharcoalPerKg),
    drinkCost
  }
}

/** flavor_brand_salesから物販販売数量（merch_count + merch_count_secondary）を合計 */
export function calcMerchandiseSalesQty(brandSales) {
  return (brandSales || []).reduce((acc, s) => {
    return acc + (Number(s.merch_count) || 0) + (Number(s.merch_count_secondary) || 0)
  }, 0)
}

/**
 * PL計算メイン関数
 * @param {Object} record - pe_monthly_records行 {total_sales, labor_cost, payment_fee, utilities, sundries, rent}
 * @param {Object} settings - pe_store_settings行 {fixed_rent, fixed_utilities, fixed_sundries, fixed_payment_fee, physical_profit_margin}
 * @param {Object} variableCosts - {flavorCost, charcoalCost, drinkCost}
 * @param {number} merchandiseSalesQty - 物販販売数量
 * @param {number} merchandiseUnitPrice - 物販1単位あたり販売値
 * @param {Object|null} companySettings - {exec_remuneration, debt_repayment}（全社集計時のみ）
 */
export function calcPL(record, settings, variableCosts, merchandiseSalesQty, merchandiseUnitPrice, companySettings = null) {
  const n = (v) => Number(v) || 0

  const totalSales = n(record?.total_sales)
  const merchandiseSales = n(merchandiseSalesQty) * n(merchandiseUnitPrice)
  const serviceSales = Math.max(0, totalSales - merchandiseSales)
  const physicalMargin = n(settings?.physical_profit_margin) || 0.1
  const merchandiseProfit = merchandiseSales * physicalMargin

  const flavorCost = n(variableCosts?.flavorCost)
  const charcoalCost = n(variableCosts?.charcoalCost)
  const drinkCost = n(variableCosts?.drinkCost)
  const variableCostTotal = flavorCost + charcoalCost + drinkCost

  // 各経費: レコードの値が存在すればそれを使い、なければ設定値のデフォルトを使用
  const rent = record?.rent != null ? n(record.rent) : n(settings?.fixed_rent)
  const laborCost = n(record?.labor_cost)
  const paymentFee = record?.payment_fee != null ? n(record.payment_fee) : n(settings?.fixed_payment_fee)
  const utilities = record?.utilities != null ? n(record.utilities) : n(settings?.fixed_utilities)
  const sundries = record?.sundries != null ? n(record.sundries) : n(settings?.fixed_sundries)
  const fixedCostTotal = rent + laborCost + paymentFee + utilities + sundries

  const grossProfit = totalSales - variableCostTotal
  const laborRate = grossProfit > 0 ? laborCost / grossProfit : null
  const operatingProfit = grossProfit - fixedCostTotal

  const execRemuneration = companySettings ? n(companySettings.exec_remuneration) : 0
  const debtRepayment = companySettings ? n(companySettings.debt_repayment) : 0
  const finalProfit = operatingProfit + merchandiseProfit - execRemuneration - debtRepayment

  return {
    totalSales,
    merchandiseSales,
    serviceSales,
    merchandiseProfit,
    flavorCost,
    charcoalCost,
    drinkCost,
    variableCostTotal,
    rent,
    laborCost,
    paymentFee,
    utilities,
    sundries,
    fixedCostTotal,
    grossProfit,
    laborRate,
    operatingProfit,
    execRemuneration,
    debtRepayment,
    finalProfit
  }
}

const PL_NUMERIC_KEYS = [
  'totalSales', 'merchandiseSales', 'serviceSales', 'merchandiseProfit',
  'flavorCost', 'charcoalCost', 'drinkCost', 'variableCostTotal',
  'rent', 'laborCost', 'paymentFee', 'utilities', 'sundries', 'fixedCostTotal',
  'grossProfit', 'operatingProfit', 'execRemuneration', 'debtRepayment', 'finalProfit'
]

/** 複数PLResultから移動平均を計算（nullを除外して平均） */
export function calcRolling3MonthAvg(plResults) {
  const valid = (plResults || []).filter(Boolean)
  if (valid.length === 0) return null
  const result = {}
  for (const k of PL_NUMERIC_KEYS) {
    result[k] = valid.reduce((sum, r) => sum + (Number(r[k]) || 0), 0) / valid.length
  }
  result.laborRate = result.grossProfit > 0 ? result.laborCost / result.grossProfit : null
  return result
}

/** 複数PLResultの合計を計算（nullを除外して合算） */
export function calcAnnualSum(plResults) {
  const valid = (plResults || []).filter(Boolean)
  if (valid.length === 0) return null
  const result = {}
  for (const k of PL_NUMERIC_KEYS) {
    result[k] = valid.reduce((sum, r) => sum + (Number(r[k]) || 0), 0)
  }
  result.laborRate = result.grossProfit > 0 ? result.laborCost / result.grossProfit : null
  return result
}

/** 金額を日本円形式でフォーマット（例: 1,234,567円） */
export function formatJPY(value) {
  if (value == null || isNaN(value)) return '—'
  return `¥${Math.round(value).toLocaleString('ja-JP')}`
}

/** 割合をパーセント形式でフォーマット（例: 23.4%） */
export function formatPct(value) {
  if (value == null || isNaN(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

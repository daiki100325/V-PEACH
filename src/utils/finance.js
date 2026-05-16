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

/**
 * PL計算メイン関数
 * @param {Object} record - pe_monthly_records行 {service_sales, merchandise_sales, labor_cost}
 * @param {Object} settings - pe_store_settings行 {fixed_rent, fixed_utilities, fixed_sundries, payment_fee_rate}
 * @param {Object} variableCosts - {flavorCost, charcoalCost, drinkCost}
 * @param {Object|null} companySettings - {exec_remuneration, debt_repayment}（全社集計時のみ）
 */
export function calcPL(record, settings, variableCosts, companySettings = null) {
  const n = (v) => Number(v) || 0

  // 売上
  const serviceSales = n(record?.service_sales)
  const merchandiseSales = n(record?.merchandise_sales)
  const totalSales = serviceSales + merchandiseSales
  const consumptionTax = totalSales / 11
  const totalSalesAfterTax = totalSales * (10 / 11)

  // 原価（V-MINTデータ + 物販フレーバー固定計算）
  const flavorCost = n(variableCosts?.flavorCost)
  const charcoalCost = n(variableCosts?.charcoalCost)
  const drinkCost = n(variableCosts?.drinkCost)
  const merchandiseFlavorCost = merchandiseSales * 0.89
  const costTotal = flavorCost + charcoalCost + drinkCost + merchandiseFlavorCost

  // 粗利
  const grossProfit = totalSalesAfterTax - costTotal

  // 販管費（家賃・光熱費・雑費は設定値。決済手数料は売上連動。役員報酬は全社時のみ）
  const rent = n(settings?.fixed_rent)
  const laborCost = n(record?.labor_cost)
  const paymentFeeRate = n(settings?.payment_fee_rate) || 0.025
  const paymentFee = totalSalesAfterTax * paymentFeeRate
  const utilities = n(settings?.fixed_utilities)
  const sundries = n(settings?.fixed_sundries)
  const execRemuneration = companySettings ? n(companySettings.exec_remuneration) : 0
  const sgaTotal = rent + laborCost + paymentFee + utilities + sundries + execRemuneration

  // 利益
  const laborRate = grossProfit > 0 ? laborCost / grossProfit : null
  const operatingProfit = grossProfit - sgaTotal

  // 全社調整（全社集計時のみ）
  const debtRepayment = companySettings ? n(companySettings.debt_repayment) : 0
  const netCashFlow = operatingProfit - debtRepayment

  return {
    serviceSales,
    merchandiseSales,
    totalSales,
    consumptionTax,
    totalSalesAfterTax,
    flavorCost,
    charcoalCost,
    drinkCost,
    merchandiseFlavorCost,
    costTotal,
    grossProfit,
    laborRate,
    rent,
    laborCost,
    paymentFee,
    utilities,
    sundries,
    execRemuneration,
    sgaTotal,
    operatingProfit,
    debtRepayment,
    netCashFlow
  }
}

const PL_NUMERIC_KEYS = [
  'serviceSales', 'merchandiseSales', 'totalSales', 'consumptionTax', 'totalSalesAfterTax',
  'flavorCost', 'charcoalCost', 'drinkCost', 'merchandiseFlavorCost', 'costTotal',
  'grossProfit',
  'rent', 'laborCost', 'paymentFee', 'utilities', 'sundries', 'execRemuneration', 'sgaTotal',
  'operatingProfit',
  'debtRepayment', 'netCashFlow'
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

/** 金額を日本円形式でフォーマット（例: ¥1,234,567） */
export function formatJPY(value) {
  if (value == null || isNaN(value)) return '—'
  return `¥${Math.round(value).toLocaleString('ja-JP')}`
}

/** 割合をパーセント形式でフォーマット（例: 23.4%） */
export function formatPct(value) {
  if (value == null || isNaN(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

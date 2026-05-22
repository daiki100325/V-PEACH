/**
 * 重みつき枠数を計算（時間を係数として積算）
 * @param {Object} p - { slots6h, slots7_5h }
 * @returns {number} 重みつき枠数（時間ベース）
 */
export function calcWeightedSlots({ slots6h = 0, slots7_5h = 0 } = {}) {
  return 6.0 * Number(slots6h) + 7.5 * Number(slots7_5h)
}

/**
 * 店舗ごとの人件費を算出（固定給 + 変動費按分）
 * @param {Object} p
 * @param {number} p.fixedSalaryTotal - 店舗所属の固定給合計
 * @param {number} p.storeWeightedSlots - 当該店舗のバイト重みつき枠数
 * @param {number} p.totalWeightedSlots - 全店舗バイト重みつき枠数合計
 * @param {number} p.totalVariablePayroll - 当月バイト給与＋交通費の全社総額
 * @returns {{ fixed: number, variable: number, total: number }}
 */
export function calcStoreLaborCost({ fixedSalaryTotal = 0, storeWeightedSlots = 0, totalWeightedSlots = 0, totalVariablePayroll = 0 } = {}) {
  const fixed = Number(fixedSalaryTotal) || 0
  if (totalWeightedSlots <= 0) {
    return { fixed, variable: 0, total: fixed }
  }
  const variable = (Number(totalVariablePayroll) || 0) * Number(storeWeightedSlots) / Number(totalWeightedSlots)
  return { fixed, variable, total: fixed + variable }
}

/**
 * 社長代替コストを算出（参考値・PLには計上しない）
 * @param {Object} p - { ryoSlots6h, ryoSlots7_5h, ryoHourlyRate }
 * @returns {number} 機会費用（円）
 */
export function calcRyoOpportunityCost({ ryoSlots6h = 0, ryoSlots7_5h = 0, ryoHourlyRate = 1300 } = {}) {
  const hours = 6.0 * Number(ryoSlots6h) + 7.5 * Number(ryoSlots7_5h)
  return (Number(ryoHourlyRate) || 1300) * hours
}

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
 * @param {Object} record - pe_monthly_records行 {service_sales, merchandise_sales, labor_cost, part_time_slots_6h, ...}
 * @param {Object} settings - pe_store_settings行 {fixed_rent, fixed_utilities, fixed_sundries, payment_fee_rate, fixed_salary_total}
 * @param {Object} variableCosts - {flavorCost, charcoalCost, drinkCost}
 * @param {Object|null} companySettings - {exec_remuneration, debt_repayment, ryo_hourly_rate}（全社集計時のみ）
 * @param {Object|null} laborParams - 新方式人件費パラメータ {totalVariablePayroll, totalWeightedSlots, ryoHourlyRate?}
 *   laborParams が null のとき record.labor_cost にフォールバック（過去月互換）
 *   ryoHourlyRate を laborParams で渡せば、companySettings を渡さない店舗別calcPLでも社長代替コストを算出できる
 */
export function calcPL(record, settings, variableCosts, companySettings = null, laborParams = null) {
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
  const merchandiseFlavorCost = merchandiseSales * (10 / 11) * 0.89
  const costTotal = flavorCost + charcoalCost + drinkCost + merchandiseFlavorCost

  // 粗利
  const grossProfit = totalSalesAfterTax - costTotal

  // 人件費（新方式: 枠数按分 or レガシー: 直接入力フォールバック）
  let laborCost, laborFixed, laborVariable, ryoOpportunityCost
  if (laborParams) {
    const storeSlots = calcWeightedSlots({
      slots6h: record?.part_time_slots_6h,
      slots7_5h: record?.part_time_slots_7_5h
    })
    const lc = calcStoreLaborCost({
      fixedSalaryTotal: settings?.fixed_salary_total,
      storeWeightedSlots: storeSlots,
      totalWeightedSlots: laborParams.totalWeightedSlots,
      totalVariablePayroll: laborParams.totalVariablePayroll
    })
    laborFixed = lc.fixed
    laborVariable = lc.variable
    laborCost = lc.total
    const ryoRate = laborParams.ryoHourlyRate ?? companySettings?.ryo_hourly_rate ?? 1300
    ryoOpportunityCost = calcRyoOpportunityCost({
      ryoSlots6h: record?.ryo_slots_6h,
      ryoSlots7_5h: record?.ryo_slots_7_5h,
      ryoHourlyRate: ryoRate
    })
  } else {
    laborCost = n(record?.labor_cost)
    laborFixed = null
    laborVariable = null
    ryoOpportunityCost = null
  }

  // 販管費（家賃・光熱費・雑費は設定値。決済手数料は売上連動）
  const rent = n(settings?.fixed_rent)
  const paymentFeeRate = n(settings?.payment_fee_rate) || 0.025
  const paymentFee = totalSalesAfterTax * paymentFeeRate
  const utilities = n(settings?.fixed_utilities)
  const sundries = n(settings?.fixed_sundries)
  const sgaTotal = rent + laborCost + paymentFee + utilities + sundries

  // 利益
  const laborRate = grossProfit > 0 ? laborCost / grossProfit : null
  const operatingProfit = grossProfit - sgaTotal

  // 全社調整（全社集計時のみ）
  const execRemuneration = companySettings ? n(companySettings.exec_remuneration) : 0
  const debtRepayment = companySettings ? n(companySettings.debt_repayment) : 0
  const netCashFlow = operatingProfit - execRemuneration - debtRepayment

  // FLR比（税引後売上ベース）
  const fRatio = totalSalesAfterTax > 0 ? costTotal / totalSalesAfterTax : null
  const lRatio = totalSalesAfterTax > 0 ? laborCost / totalSalesAfterTax : null
  const rRatio = totalSalesAfterTax > 0 ? rent / totalSalesAfterTax : null

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
    fRatio,
    lRatio,
    rRatio,
    rent,
    laborCost,
    laborFixed,
    laborVariable,
    ryoOpportunityCost,
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
  'rent', 'laborCost', 'laborFixed', 'laborVariable', 'ryoOpportunityCost',
  'paymentFee', 'utilities', 'sundries', 'execRemuneration', 'sgaTotal',
  'operatingProfit',
  'debtRepayment', 'netCashFlow'
]

// 新方式人件費の内訳は「旧式月のみの集計」では意味を持たないので、
// 全行 null のときは結果も null とする
const PL_NULLABLE_KEYS = ['laborFixed', 'laborVariable', 'ryoOpportunityCost']

function aggregateKey(valid, k, divisor) {
  if (PL_NULLABLE_KEYS.includes(k)) {
    const nonNull = valid.filter(r => r[k] != null)
    if (nonNull.length === 0) return null
    return nonNull.reduce((s, r) => s + Number(r[k]), 0) / divisor
  }
  return valid.reduce((s, r) => s + (Number(r[k]) || 0), 0) / divisor
}

/** 複数PLResultから移動平均を計算（nullを除外して平均） */
export function calcRolling3MonthAvg(plResults) {
  const valid = (plResults || []).filter(Boolean)
  if (valid.length === 0) return null
  const result = {}
  for (const k of PL_NUMERIC_KEYS) {
    result[k] = aggregateKey(valid, k, valid.length)
  }
  result.laborRate = result.grossProfit > 0 ? result.laborCost / result.grossProfit : null
  result.fRatio = result.totalSalesAfterTax > 0 ? result.costTotal / result.totalSalesAfterTax : null
  result.lRatio = result.totalSalesAfterTax > 0 ? result.laborCost / result.totalSalesAfterTax : null
  result.rRatio = result.totalSalesAfterTax > 0 ? result.rent / result.totalSalesAfterTax : null
  return result
}

/** 複数PLResultの合計を計算（nullを除外して合算） */
export function calcAnnualSum(plResults) {
  const valid = (plResults || []).filter(Boolean)
  if (valid.length === 0) return null
  const result = {}
  for (const k of PL_NUMERIC_KEYS) {
    result[k] = aggregateKey(valid, k, 1)
  }
  result.laborRate = result.grossProfit > 0 ? result.laborCost / result.grossProfit : null
  result.fRatio = result.totalSalesAfterTax > 0 ? result.costTotal / result.totalSalesAfterTax : null
  result.lRatio = result.totalSalesAfterTax > 0 ? result.laborCost / result.totalSalesAfterTax : null
  result.rRatio = result.totalSalesAfterTax > 0 ? result.rent / result.totalSalesAfterTax : null
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

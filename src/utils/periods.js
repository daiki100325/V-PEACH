export function parsePeriodKey(periodKey) {
  const normalized = Number(String(periodKey || '').replace(/[^\d]/g, ''))
  if (!Number.isInteger(normalized)) return null
  const year = Math.floor(normalized / 100)
  const month = normalized % 100
  if (year < 2000 || month < 1 || month > 12) return null
  return { year, month, periodKey: normalized }
}

export function formatPeriodLabel(periodKey) {
  const parsed = parsePeriodKey(periodKey)
  if (!parsed) return ''
  return `${parsed.year}年${parsed.month}月`
}

export function toMonthNumFromPeriodKey(periodKey) {
  const parsed = parsePeriodKey(periodKey)
  return parsed ? parsed.month : null
}

export function buildYearOptions({ startYear = 2025, futureYears = 1, baseDate = new Date() } = {}) {
  const endYear = baseDate.getFullYear() + futureYears
  const years = []
  for (let year = startYear; year <= endYear; year += 1) {
    years.push({ value: String(year), label: `${year}年`, year })
  }
  return years
}

export function buildMonthOptions() {
  return Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    month: index + 1,
    label: `${index + 1}月`
  }))
}

export function composePeriodKey(yearValue, monthValue) {
  const year = Number(yearValue)
  const month = Number(monthValue)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return ''
  return String((year * 100) + month)
}

/** カレンダー上の「今月」の period_key（例: 202605） */
export function getCurrentPeriodKey(baseDate = new Date()) {
  return baseDate.getFullYear() * 100 + (baseDate.getMonth() + 1)
}

/** 翌月の period_key。12月→翌年1月 */
export function getNextPeriodKey(periodKey) {
  const parsed = parsePeriodKey(periodKey)
  if (!parsed) return null
  let { year, month } = parsed
  if (month === 12) {
    year += 1
    month = 1
  } else {
    month += 1
  }
  return year * 100 + month
}

/** 前月の period_key */
export function getPrevPeriodKey(periodKey) {
  const parsed = parsePeriodKey(periodKey)
  if (!parsed) return null
  let { year, month } = parsed
  if (month === 1) {
    year -= 1
    month = 12
  } else {
    month -= 1
  }
  return year * 100 + month
}

export function buildPeriodOptions({ startYear = 2025, futureYears = 1, baseDate = new Date() } = {}) {
  const currentYear = baseDate.getFullYear()
  const currentMonth = baseDate.getMonth() + 1
  const years = buildYearOptions({ startYear, futureYears, baseDate })
  const options = []

  for (let yearIndex = years.length - 1; yearIndex >= 0; yearIndex -= 1) {
    const year = years[yearIndex].year
    for (let month = 12; month >= 1; month -= 1) {
      const periodKey = year * 100 + month
      options.push({
        value: String(periodKey),
        periodKey,
        year,
        month,
        label: formatPeriodLabel(periodKey),
        isCurrentMonth: year === currentYear && month === currentMonth
      })
    }
  }

  return options
}

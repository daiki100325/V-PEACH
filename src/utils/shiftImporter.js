// V-PEACH HRMOS シフト CSV 取込 — 計算ロジック
// 参照: V-PEACH/notes/V-PEACH_shifts-csv-import-plan.md §3
//
// 純粋関数として実装し、ユニットテスト容易性を確保する。
// CSV パースは csvImporter.js の parseHrmosShiftsCsv に委譲し、
// 本ファイルでは「マスタ + シフト行 + 祝日 → 店舗別枠数集計」を担う。

import { parseHrmosShiftsCsv, readShiftJisFile } from './csvImporter.js'

const STORE_KEYS = ['baba_main', 'nakano', 'baba_2nd']
const BABA_2ND_KEY = 'baba_2nd'

/** ファイル → 行配列（Shift-JIS デコード経由） */
export async function parseShiftsCsvFile(file) {
  const text = await readShiftJisFile(file)
  return parseHrmosShiftsCsv(text)
}

/** 土日 または 祝日 判定 */
function isWeekendOrHoliday(dateStr, holidaySet) {
  if (holidaySet && holidaySet.has(dateStr)) return true
  const d = new Date(`${dateStr}T00:00:00`)
  const w = d.getDay()  // 0 = 日曜, 6 = 土曜
  return w === 0 || w === 6
}

/** 馬場2号店遅番の土日祝補正：6h → 7.5h、その他は元の hours のまま */
function applyBaba2ndLateHolidayBoost(storeKey, shiftType, hours, isHoliday) {
  if (storeKey === BABA_2ND_KEY && shiftType === 'late' && isHoliday) return 7.5
  return hours
}

/**
 * シフト計算のコア（純粋関数）
 *
 * @param shiftRows  parseHrmosShiftsCsv の出力 [{ staffId, date, segmentId }, ...]
 * @param staffsById Map<hrmos_staff_id, { role: 'fixed_salary'|'part_time'|'owner_ryo', ... }>
 * @param segmentsById Map<hrmos_segment_id, { store_id, store_key, shift_type, default_hours, is_payroll_target }>
 *                     store_key は呼び出し側で stores テーブルから解決して詰めておく
 * @param holidaySet Set<string> 祝日日付
 * @param targetPeriodKey number（例: 202601） — 当月の事業月度フィルタ用
 *
 * @returns {
 *   slots: { [storeKey]: { pt6h, pt7_5h, ryo6h, ryo7_5h } },
 *   warnings: string[],          // マスタ未登録/対象外区分等の警告
 *   diagnostics: {
 *     storeOpeningDays: { [storeKey]: number },
 *     unknownStaffIds: number[],
 *     unknownSegmentIds: number[],
 *     miscSegmentSamples: { segmentId, date, staffId }[]
 *   }
 * }
 */
export function calcSlotsFromShifts(shiftRows, staffsById, segmentsById, holidaySet, targetPeriodKey) {
  const warnings = []
  const unknownStaffIds = new Set()
  const unknownSegmentIds = new Set()
  const miscSegmentSamples = []

  // fillMap[storeKey][date][shiftType] = { staffId, hours, role }
  const fillMap = {}
  for (const k of STORE_KEYS) fillMap[k] = {}

  // 当月フィルタ（YYYY-MM を targetPeriodKey から生成）
  const targetMonth = targetPeriodKey
    ? `${Math.floor(targetPeriodKey / 100)}-${String(targetPeriodKey % 100).padStart(2, '0')}`
    : null

  for (const r of shiftRows) {
    if (targetMonth && !r.date.startsWith(targetMonth)) continue
    const seg = segmentsById.get(r.segmentId)
    if (!seg) { unknownSegmentIds.add(r.segmentId); continue }
    if (!seg.is_payroll_target) {
      if (seg.shift_type === 'misc' && miscSegmentSamples.length < 10) {
        miscSegmentSamples.push({ segmentId: r.segmentId, date: r.date, staffId: r.staffId })
      }
      continue
    }
    const staff = staffsById.get(r.staffId)
    if (!staff) { unknownStaffIds.add(r.staffId); continue }
    const storeKey = seg.store_key
    if (!storeKey || !fillMap[storeKey]) continue

    const isHoliday = isWeekendOrHoliday(r.date, holidaySet)

    if (seg.shift_type === 'allin') {
      // オーラス/オールイン → 早番7.5h + 遅番(6h or 7.5h) として分解
      setIfEmpty(fillMap, storeKey, r.date, 'early', { staffId: r.staffId, hours: 7.5, role: staff.role })
      const lateHours = applyBaba2ndLateHolidayBoost(storeKey, 'late', 6.0, isHoliday)
      setIfEmpty(fillMap, storeKey, r.date, 'late',  { staffId: r.staffId, hours: lateHours, role: staff.role })
      continue
    }

    const hours = applyBaba2ndLateHolidayBoost(storeKey, seg.shift_type, seg.default_hours, isHoliday)
    setIfEmpty(fillMap, storeKey, r.date, seg.shift_type, { staffId: r.staffId, hours, role: staff.role })
  }

  // 4. りょーさん枠（埋まっていない早番/遅番。中番は対象外）
  //    判定対象日 = その店舗の fillMap にレコードが1件でもある日
  const ryoSlots = { baba_main: { h6: 0, h7_5: 0 }, nakano: { h6: 0, h7_5: 0 }, baba_2nd: { h6: 0, h7_5: 0 } }
  const storeOpeningDays = {}
  for (const storeKey of STORE_KEYS) {
    const dates = Object.keys(fillMap[storeKey])
    storeOpeningDays[storeKey] = dates.length
    for (const date of dates) {
      const isHoliday = isWeekendOrHoliday(date, holidaySet)
      for (const shiftType of ['early', 'late']) {
        if (fillMap[storeKey][date][shiftType]) continue
        const hours = (storeKey === BABA_2ND_KEY && shiftType === 'late' && isHoliday) ? 7.5
                    : (shiftType === 'early' ? 7.5 : 6.0)
        if (hours === 7.5) ryoSlots[storeKey].h7_5 += 1
        else ryoSlots[storeKey].h6 += 1
      }
    }
  }

  // 5. バイト枠集計（固定給・りょーさんは除外。中番もバイトのみ集計）
  const ptSlots = { baba_main: { h6: 0, h7_5: 0 }, nakano: { h6: 0, h7_5: 0 }, baba_2nd: { h6: 0, h7_5: 0 } }
  for (const storeKey of STORE_KEYS) {
    for (const date of Object.keys(fillMap[storeKey])) {
      for (const shiftType of ['early', 'middle', 'late']) {
        const fill = fillMap[storeKey][date][shiftType]
        if (!fill) continue
        if (fill.role !== 'part_time') continue
        // hours は 7.5 または 6.0 にバケット化
        if (Math.abs(fill.hours - 7.5) < 0.01) ptSlots[storeKey].h7_5 += 1
        else ptSlots[storeKey].h6 += 1
      }
    }
  }

  // 警告組み立て
  if (unknownStaffIds.size > 0) {
    warnings.push(`マスタ未登録のスタッフID: ${[...unknownStaffIds].join(', ')}（スタッフ CSV を再取込してください）`)
  }
  if (unknownSegmentIds.size > 0) {
    warnings.push(`マスタ未登録の勤務区分ID: ${[...unknownSegmentIds].join(', ')}（勤務区分 CSV を再取込してください）`)
  }
  if (miscSegmentSamples.length > 0) {
    warnings.push(`按分対象外（misc）の勤務区分が ${miscSegmentSamples.length} 件以上含まれています。設定モードで勤務区分マスタを確認してください。`)
  }

  // 6. 結果フォーマット
  const slots = {}
  for (const storeKey of STORE_KEYS) {
    slots[storeKey] = {
      pt6h:    ptSlots[storeKey].h6,
      pt7_5h:  ptSlots[storeKey].h7_5,
      ryo6h:   ryoSlots[storeKey].h6,
      ryo7_5h: ryoSlots[storeKey].h7_5
    }
  }

  return {
    slots,
    warnings,
    diagnostics: {
      storeOpeningDays,
      unknownStaffIds: [...unknownStaffIds],
      unknownSegmentIds: [...unknownSegmentIds],
      miscSegmentSamples
    }
  }
}

function setIfEmpty(fillMap, storeKey, date, shiftType, value) {
  if (!fillMap[storeKey][date]) fillMap[storeKey][date] = {}
  if (!fillMap[storeKey][date][shiftType]) fillMap[storeKey][date][shiftType] = value
}

/** UI 表示用フォーマット（店舗ごとに合計時間も付与） */
export function formatSlotsForUi(result) {
  const out = []
  for (const storeKey of STORE_KEYS) {
    const s = result.slots[storeKey] || { pt6h: 0, pt7_5h: 0, ryo6h: 0, ryo7_5h: 0 }
    const ptWeighted  = 6 * s.pt6h + 7.5 * s.pt7_5h
    const ryoWeighted = 6 * s.ryo6h + 7.5 * s.ryo7_5h
    out.push({
      storeKey,
      ...s,
      ptWeighted,
      ryoWeighted,
      totalWeighted: ptWeighted + ryoWeighted,
      openingDays: result.diagnostics?.storeOpeningDays?.[storeKey] ?? 0
    })
  }
  return out
}

/**
 * 高水準ラッパー — File を受け取り、マスタ・祝日を引数で受けて計算
 * 呼び出し側で getHrmosStaffs / getHrmosSegments / getStores / fetchJpHolidaysCached を実行して渡す。
 */
export async function calcShiftsFromFile(file, targetPeriodKey, { staffs, segments, holidaySet, storeKeyById }) {
  const rows = await parseShiftsCsvFile(file)
  const staffsById = new Map(staffs.map(s => [s.hrmos_staff_id, s]))
  const segmentsById = new Map(segments.map(seg => [
    seg.hrmos_segment_id,
    { ...seg, store_key: seg.store_id != null ? storeKeyById.get(seg.store_id) || null : null }
  ]))
  return calcSlotsFromShifts(rows, staffsById, segmentsById, holidaySet, targetPeriodKey)
}

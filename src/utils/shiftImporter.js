// V-PEACH HRMOS シフト CSV 取込 — 計算ロジック
// 参照: V-PEACH/notes/old/V-PEACH_shifts-csv-import-plan.md §3
//
// 純粋関数として実装し、ユニットテスト容易性を確保する。
// CSV パースは csvImporter.js の parseHrmosShiftsCsv に委譲し、
// 本ファイルでは「マスタ + シフト行 + 店舗別シフト枠ルール + 祝日 → 店舗別枠数集計」を担う。
//
// マルチストア P3: 店舗ハードコード（STORE_KEYS 固定配列・ryoSlots/ptSlots の店舗キー固定
// オブジェクト・馬場2号店の遅番×土日祝補正）を撤廃。
//   - 集計対象店舗は呼び出し側（store_type==='shop' かつ is_active な店舗）から storeKeys で受け取る
//   - シフト枠時間（早番/中番/遅番 × 平日/土日祝 × 店舗）は pe_store_shift_rules
//     （getStoreShiftRules の出力）から受け取り、対象月の世代を選択して参照する
// DB 非依存の純粋関数である流儀は維持し、ルールも呼び出し側で取得して引数で渡す。

import { parseHrmosShiftsCsv, readShiftJisFile } from './csvImporter.js'

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

/** 日付 → day_type（'weekday' | 'holiday'）。pe_store_shift_rules.day_type と対応 */
function dayTypeOf(dateStr, holidaySet) {
  return isWeekendOrHoliday(dateStr, holidaySet) ? 'holiday' : 'weekday'
}

/**
 * pe_store_shift_rules（全世代）から、対象月に有効な枠時間ルックアップを構築する。
 *
 * 世代選択: (store_key, shift_type, day_type) ごとに `effective_from <= periodKey` の中で
 *           最大 effective_from の世代を採用（V-PEACH 既存 getActiveStoreSettings と同方式）。
 *
 * @param shiftRules getStoreShiftRules() の出力
 *        [{ store_key, effective_from, shift_type, day_type, hours }, ...]
 * @param periodKey 対象月 YYYYMM（number）
 * @returns (storeKey, shiftType, dayType) => number | undefined
 *          （該当ルールが無ければ undefined。フォールバック判断は呼び出し側で行う）
 */
function buildShiftRuleResolver(shiftRules, periodKey) {
  const pk = Number(periodKey)
  const picked = new Map()  // `${store_key}|${shift_type}|${day_type}` -> { effectiveFrom, hours }
  for (const r of shiftRules || []) {
    if (r.store_key == null) continue
    const ef = Number(r.effective_from)
    if (ef > pk) continue  // 対象月より後に発効する世代は対象外
    const key = `${r.store_key}|${r.shift_type}|${r.day_type}`
    const cur = picked.get(key)
    if (!cur || ef > cur.effectiveFrom) picked.set(key, { effectiveFrom: ef, hours: Number(r.hours) })
  }
  return (storeKey, shiftType, dayType) => {
    const hit = picked.get(`${storeKey}|${shiftType}|${dayType}`)
    return hit ? hit.hours : undefined
  }
}

/**
 * 枠時間(hours)を {h6, h7_5} の2バケットへ写像。
 * 下流（InputApp の laborSlots）が 6h/7.5h の2区分に依存しているため、当面この粒度を維持する。
 * 6.0 → 'h6' / 7.5 → 'h7_5'。それ以外の値が来た場合は近い方へ丸めて console.warn する
 * （ルールが多様化したらバケット構造ごと見直しが必要。現行データでは 6.0/7.5 のみ）。
 */
function hoursToBucket(hours) {
  if (Math.abs(hours - 7.5) < 0.01) return 'h7_5'
  if (Math.abs(hours - 6.0) < 0.01) return 'h6'
  const bucket = Math.abs(hours - 7.5) < Math.abs(hours - 6.0) ? 'h7_5' : 'h6'
  console.warn(`[shiftImporter] 想定外のシフト枠時間 ${hours}h を ${bucket === 'h7_5' ? '7.5h' : '6h'} 枠として丸めました。pe_store_shift_rules を確認してください。`)
  return bucket
}

/**
 * シフト計算のコア（純粋関数）
 *
 * @param shiftRows  parseHrmosShiftsCsv の出力 [{ staffId, date, segmentId }, ...]
 * @param staffsById Map<hrmos_staff_id, { role: 'fixed_salary'|'part_time'|'owner_ryo', ... }>
 * @param segmentsById Map<hrmos_segment_id, { store_id, store_key, shift_type, default_hours, is_payroll_target }>
 *                     store_key は呼び出し側で stores テーブルから解決して詰めておく
 * @param holidaySet Set<string> 祝日日付
 * @param targetPeriodKey number（例: 202601） — 当月の事業月度フィルタ・ルール世代選択用
 * @param storeKeys 集計対象の店舗キー配列（呼び出し側で store_type==='shop' かつ is_active を抽出して渡す）
 * @param shiftRules getStoreShiftRules() の出力（全世代）。対象月の枠時間決定に使用
 *
 * @returns {
 *   slots: { [storeKey]: { pt6h, pt7_5h, ryo6h, ryo7_5h } },
 *   warnings: string[],          // マスタ未登録/対象外区分/ルール未定義等の警告
 *   diagnostics: {
 *     storeOpeningDays: { [storeKey]: number },
 *     unknownStaffIds: number[],
 *     unknownSegmentIds: number[],
 *     miscSegmentSamples: { segmentId, date, staffId }[]
 *   }
 * }
 */
export function calcSlotsFromShifts(shiftRows, staffsById, segmentsById, holidaySet, targetPeriodKey, storeKeys = [], shiftRules = []) {
  const warnings = []
  const unknownStaffIds = new Set()
  const unknownSegmentIds = new Set()
  const miscSegmentSamples = []
  const missingRuleKeys = new Set()  // ルール未定義でフォールバックした `${store}|${shift}|${day}`

  // 対象月に有効な店舗別シフト枠ルックアップ（世代選択込み）
  const ruleHours = buildShiftRuleResolver(shiftRules, targetPeriodKey)

  /**
   * 枠時間を引く。ルール優先・未定義時は fallback（segment.default_hours 等）→ standard の順に既定。
   * 未定義時は missingRuleKeys に記録し、最終的に警告へ集約する。
   */
  const resolveHours = (storeKey, shiftType, dayType, fallback, standard) => {
    const r = ruleHours(storeKey, shiftType, dayType)
    if (r != null) return r
    missingRuleKeys.add(`${storeKey}|${shiftType}|${dayType}`)
    return fallback != null ? fallback : standard
  }

  // fillMap[storeKey][date][shiftType] = { staffId, hours, role }
  const fillMap = {}
  for (const k of storeKeys) fillMap[k] = {}

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

    const dayType = dayTypeOf(r.date, holidaySet)

    if (seg.shift_type === 'allin') {
      // オーラス/オールイン → 早番 + 遅番 として分解計上（枠時間はルールから取得）
      const earlyH = resolveHours(storeKey, 'early', dayType, 7.5, 7.5)
      const lateH  = resolveHours(storeKey, 'late',  dayType, 6.0, 6.0)
      setIfEmpty(fillMap, storeKey, r.date, 'early', { staffId: r.staffId, hours: earlyH, role: staff.role })
      setIfEmpty(fillMap, storeKey, r.date, 'late',  { staffId: r.staffId, hours: lateH,  role: staff.role })
      continue
    }

    // 通常区分: ルールの枠時間を採用（未定義時は segment.default_hours へフォールバック）
    const hours = resolveHours(storeKey, seg.shift_type, dayType, seg.default_hours, seg.default_hours)
    setIfEmpty(fillMap, storeKey, r.date, seg.shift_type, { staffId: r.staffId, hours, role: staff.role })
  }

  // 4. りょーさん枠（埋まっていない早番/遅番。中番は対象外）
  //    判定対象日 = その店舗の fillMap にレコードが1件でもある日
  const ryoSlots = {}
  for (const k of storeKeys) ryoSlots[k] = { h6: 0, h7_5: 0 }
  const storeOpeningDays = {}
  for (const storeKey of storeKeys) {
    const dates = Object.keys(fillMap[storeKey])
    storeOpeningDays[storeKey] = dates.length
    for (const date of dates) {
      const dayType = dayTypeOf(date, holidaySet)
      for (const shiftType of ['early', 'late']) {
        if (fillMap[storeKey][date][shiftType]) continue
        // 標準既定: 早番 7.5h / 遅番 6.0h（ルール未定義時のフォールバック）
        const hours = resolveHours(storeKey, shiftType, dayType, null, shiftType === 'early' ? 7.5 : 6.0)
        ryoSlots[storeKey][hoursToBucket(hours)] += 1
      }
    }
  }

  // 5. バイト枠集計（固定給・りょーさんは除外。中番もバイトのみ集計）
  const ptSlots = {}
  for (const k of storeKeys) ptSlots[k] = { h6: 0, h7_5: 0 }
  for (const storeKey of storeKeys) {
    for (const date of Object.keys(fillMap[storeKey])) {
      for (const shiftType of ['early', 'middle', 'late']) {
        const fill = fillMap[storeKey][date][shiftType]
        if (!fill) continue
        if (fill.role !== 'part_time') continue
        // hours は 6h/7.5h の2バケットへ写像（fill.hours はルール/既定値由来）
        ptSlots[storeKey][hoursToBucket(fill.hours)] += 1
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
  if (missingRuleKeys.size > 0) {
    warnings.push(`pe_store_shift_rules に未定義の枠があり、暫定値（勤務区分の既定時間／標準値）で計算しました: ${[...missingRuleKeys].join(', ')}`)
  }

  // 6. 結果フォーマット
  const slots = {}
  for (const storeKey of storeKeys) {
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

/** UI 表示用フォーマット（店舗ごとに合計時間も付与）。店舗キーは result.slots から動的に取得 */
export function formatSlotsForUi(result) {
  const out = []
  for (const storeKey of Object.keys(result.slots || {})) {
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
 * 高水準ラッパー — File を受け取り、マスタ・祝日・店舗リスト・シフト枠ルールを引数で受けて計算
 * 呼び出し側で getHrmosStaffs / getHrmosSegments / getStores / getStoreShiftRules /
 * fetchJpHolidaysCached を実行して渡す。
 *
 * @param storeKeys 集計対象の店舗キー配列（active な shop 店舗）
 * @param shiftRules getStoreShiftRules() の出力（全世代）
 */
export async function calcShiftsFromFile(file, targetPeriodKey, { staffs, segments, holidaySet, storeKeyById, storeKeys = [], shiftRules = [] }) {
  const rows = await parseShiftsCsvFile(file)
  const staffsById = new Map(staffs.map(s => [s.hrmos_staff_id, s]))
  const segmentsById = new Map(segments.map(seg => [
    seg.hrmos_segment_id,
    { ...seg, store_key: seg.store_id != null ? storeKeyById.get(seg.store_id) || null : null }
  ]))
  return calcSlotsFromShifts(rows, staffsById, segmentsById, holidaySet, targetPeriodKey, storeKeys, shiftRules)
}

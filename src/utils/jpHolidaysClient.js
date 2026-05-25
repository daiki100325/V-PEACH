// V-PEACH 日本祝日 API クライアント
// 参照: V-PEACH/notes/V-PEACH_shifts-csv-import-plan.md §3.4
//
// データソース: https://holidays-jp.github.io/api/v1/date.json
// - 無料 / 認証不要 / CORS 許可済み
// - GitHub Pages 上の個人運用 → 障害時は Supabase キャッシュにフォールバック

import {
  getJpHolidays,
  upsertJpHolidays,
  getJpHolidaysMeta,
  updateJpHolidaysMeta
} from '../api.js'

const HOLIDAYS_API = 'https://holidays-jp.github.io/api/v1/date.json'

// 30日経過したらバックグラウンド再取得
const STALE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * holidays-jp から全祝日を取得（過去〜翌年分まで網羅）
 * @returns [{ holiday_date: '2026-01-01', holiday_name: '元日' }, ...]
 */
export async function fetchHolidaysFromApi() {
  const res = await fetch(HOLIDAYS_API, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`祝日API HTTP ${res.status}`)
  const json = await res.json()
  return Object.entries(json).map(([date, name]) => ({
    holiday_date: date,
    holiday_name: name
  }))
}

/**
 * 必要に応じて祝日マスタを再取得し、キャッシュに保存
 * - 対象月 YYYYMM の年が pe_jp_holidays に1件もない → 強制フェッチ（throw する）
 * - 最終取得から30日経過 → バックグラウンドフェッチ（失敗してもキャッシュ続行）
 * - それ以外 → 何もしない
 *
 * @param targetPeriodKey 例: 202601
 * @returns { fetched: boolean, status: 'success'|'failed'|'skipped', error?: string }
 */
export async function refreshHolidaysIfStale(targetPeriodKey) {
  const targetYear = Math.floor(Number(targetPeriodKey) / 100)

  // 対象年の祝日が1件でもキャッシュにあるか
  const yearRows = await getJpHolidays(targetYear)
  const meta = await getJpHolidaysMeta()
  const lastFetched = meta.last_fetched_at ? new Date(meta.last_fetched_at).getTime() : 0
  const elapsed = Date.now() - lastFetched
  const isStale = !lastFetched || elapsed > STALE_MS

  const mustFetch = yearRows.length === 0
  if (!mustFetch && !isStale) {
    return { fetched: false, status: 'skipped' }
  }

  try {
    const rows = await fetchHolidaysFromApi()
    await upsertJpHolidays(rows)
    await updateJpHolidaysMeta({
      last_fetched_at: new Date().toISOString(),
      last_fetch_status: 'success',
      last_fetch_error: null
    })
    return { fetched: true, status: 'success' }
  } catch (err) {
    await updateJpHolidaysMeta({
      last_fetched_at: new Date().toISOString(),
      last_fetch_status: 'failed',
      last_fetch_error: String(err?.message || err)
    })
    // 対象年のキャッシュが完全に空ならエラーを再 throw（運用継続不能）
    if (mustFetch) throw err
    return { fetched: false, status: 'failed', error: String(err?.message || err) }
  }
}

/**
 * UI 上の「いま再取得する」ボタン用：強制的に API から取り直す
 * @returns { status: 'success'|'failed', error?: string }
 */
export async function forceRefreshHolidays() {
  try {
    const rows = await fetchHolidaysFromApi()
    await upsertJpHolidays(rows)
    await updateJpHolidaysMeta({
      last_fetched_at: new Date().toISOString(),
      last_fetch_status: 'success',
      last_fetch_error: null
    })
    return { status: 'success' }
  } catch (err) {
    await updateJpHolidaysMeta({
      last_fetched_at: new Date().toISOString(),
      last_fetch_status: 'failed',
      last_fetch_error: String(err?.message || err)
    })
    return { status: 'failed', error: String(err?.message || err) }
  }
}

/**
 * 月次入力フローで使うラッパー：refresh → キャッシュ取得 → Set 返却
 * @param targetPeriodKey 例: 202601
 * @returns Set<string> 例: Set(['2026-01-01', '2026-01-12', ...])
 */
export async function fetchJpHolidaysCached(targetPeriodKey) {
  await refreshHolidaysIfStale(targetPeriodKey).catch(() => { /* 失敗時もキャッシュで続行 */ })
  const targetYear = Math.floor(Number(targetPeriodKey) / 100)
  // 前後年も含めて取得（年跨ぎ事業月度や翌年祝日チェック用）
  const rows = await getJpHolidays({ from: targetYear - 1, to: targetYear + 1 })
  return new Set(rows.map(r => r.holiday_date))
}

/**
 * 「現在の年 + 翌年」の祝日カバレッジを返す（PortalMenu の年初アラート用）
 * @returns { currentYearOk: boolean, nextYearOk: boolean }
 */
export async function checkHolidaysCoverage() {
  const now = new Date()
  const cy = now.getFullYear()
  const ny = cy + 1
  const [cyRows, nyRows] = await Promise.all([getJpHolidays(cy), getJpHolidays(ny)])
  return {
    currentYearOk: cyRows.length > 0,
    nextYearOk: nyRows.length > 0
  }
}

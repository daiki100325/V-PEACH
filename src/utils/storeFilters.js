// マルチストア P5: 休止店舗の「表示除外」と「閉店翌月以降の集計除外」を司る共通ヘルパー。
// 参照: notes/V-PEACH_multi-store-scaling-plan.md（P5）
//
// 用語整理:
//  - 休止（is_active=false）= 店舗選択 UI から既定で隠す対象。過去 PL 閲覧時はトグルで表示可。
//  - 閉店月（closed_at の属する YYYYMM）= 営業実績がある最後の月。翌月以降は PL 集計・
//    人件費按分の分母から除外する（closed_at は休止操作時に当日がセットされる）。

/**
 * stores 行の closed_at（'YYYY-MM-DD' 文字列 or null）を閉店月 YYYYMM（number）へ変換する。
 * getStores() 由来の生キー（closed_at）／キャメルケース（closedAt）のどちらも受け付ける。
 * 閉店していなければ null を返す。
 * @param {object} store
 * @returns {number|null} 閉店月（例: 202608）または null
 */
export function closedMonthOf(store) {
  const raw = store?.closed_at ?? store?.closedAt ?? null
  if (!raw) return null
  const s = String(raw)
  const year = s.slice(0, 4)
  const month = s.slice(5, 7)
  if (year.length !== 4 || month.length !== 2) return null
  const n = Number(year) * 100 + Number(month)
  return Number.isFinite(n) ? n : null
}

/**
 * 指定 periodKey（YYYYMM）時点で、その店舗が PL 集計・按分分母の対象かを判定する。
 * 閉店月までは対象（その月は営業実績があるため）、閉店翌月以降は除外。
 * 休止フラグ単体では除外しない（過去の営業月は引き続き集計対象）。
 * @param {object} store
 * @param {number|string} periodKey YYYYMM
 * @returns {boolean}
 */
export function isStoreOpenForPeriod(store, periodKey) {
  const closed = closedMonthOf(store)
  if (closed == null) return true
  return Number(periodKey) <= closed
}

/**
 * 店舗選択ドロップダウンに出す店舗を返す共通フィルタ。
 * showInactive=false（既定）なら休止店舗（is_active=false）を除外する。
 * is_active / isActive のどちらの形でも判定できるようにしている。
 * @param {Array} stores
 * @param {boolean} showInactive 休止店舗も表示するか
 * @returns {Array}
 */
export function selectableStores(stores, showInactive = false) {
  if (showInactive) return stores
  return (stores || []).filter(s => (s?.isActive ?? s?.is_active) !== false)
}

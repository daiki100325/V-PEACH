# TROUBLESHOOTING

## Case: トレンドチャートの指標トグルがチャートに反映されない（デフォルト指標は出るが切替不可）
- Date: 2026-06-01
- Severity: High
- Owner: daiki

### Symptoms
- カテゴリ展開後、個別指標ボタンを押してもトレンドチャートの表示指標が切り替わらない。初期表示のデフォルト指標（税込総売上・F比・L比・R比・会社手残り）は正しく描画される

### Cause
- `PLTrendChart.vue` で Chart.js インスタンスを `chart: null` として `data()` に宣言していたため、`new Chart(...)` の戻り値が Vue 3 のリアクティブ Proxy にラップされていた
- Chart.js は内部で多数の参照同一性比較（`===`）や自己参照を持つ。Proxy 経由だと raw オブジェクトと Proxy の同一性が崩れ、`chart.update()` がデータセット変更を再描画に反映できない
- マウント時はコンストラクタが同期的に初回描画するため、デフォルト指標だけは表示され「出るのに切り替わらない」状態になっていた

### Fix
- `init()` で `this.chart = markRaw(new Chart(...))` とし、インスタンスをリアクティブ化対象外にする（`import { markRaw } from 'vue'`）
- Files: `src/components/PLTrendChart.vue`

### 教訓
- Chart.js / Leaflet / 各種 Web SDK など**外部ライブラリの可変インスタンスを `data()` に保持しない**。保持する場合は必ず `markRaw()` でラップする（または `data()` に宣言せず非リアクティブなインスタンスフィールドとして持つ）。初回描画は動くため、テストで「更新が効かない」症状として後から顕在化しやすい

## Case: トレンドチャートのカテゴリトグルボタンが反応しない（展開しない）
- Date: 2026-06-01
- Severity: High
- Owner: daiki

### Symptoms
- PL モードのトレンドチャートで「売上」等のカテゴリボタンを押しても展開エリアが開かない。ボタンが完全に無反応に見える（PLT-05 の回帰）

### Cause
- `PLTrendChart.vue` で `visibleMetrics` を `Set` から `Array` に移行した際、展開エリアの指標ボタン `:style`（34行目）だけ `visibleMetrics.has(m.key)` が取りこぼされていた
- カテゴリボタンのクリック自体は `expandedCategory` をセットできているが、続く再レンダリングで `v-if="expandedCategory"` の展開エリアを描画する瞬間、Array に存在しない `.has()` を呼んで `TypeError: visibleMetrics.has is not a function` が発生 → Vue の render が中断され DOM 更新が反映されず、結果「ボタンが反応しない」ように見えた

### Fix
- 34行目の `visibleMetrics.has(m.key)` を `visibleMetrics.includes(m.key)` に置換（30行目の class バインドは既に `.includes()` 済みだった）
- Files: `src/components/PLTrendChart.vue`

### 教訓
- `Set`→`Array` のようなデータ型移行では、テンプレート内の `.has()` / `.add()` / `.delete()` 等の Set 専用メソッドを grep で洗い出して全置換する。class バインドだけ直して style バインドを見落とすと部分的に壊れる

## Case: 祝日マスタ「いま再取得する」がネットワーク切断時に「取得中...」で止まる
- Date: 2026-05-30
- Severity: Medium
- Owner: daiki

### Symptoms
- 設定 → 祝日マスタ → 「いま再取得する」をネットワーク切断状態で押すと、ボタンが「取得中...」のまま無限に止まり、失敗表示が出ない

### Cause
- `fetchHolidaysFromApi()` の `fetch()` にタイムアウトがなく、ネットワーク切断時は OS の TCP タイムアウト（数分〜無限）まで待ち続けるため `finally` ブロックに到達しない

### Root cause (deeper)
ネットワーク断時に複数の場所で連鎖的に例外が発生していた:
1. `fetchHolidaysFromApi()` がタイムアウトなく無限待機
2. `forceRefreshHolidays()` の catch 内で `updateJpHolidaysMeta()`（Supabase）が断で失敗 → 例外が外へ
3. `onRefreshHolidays()` で `reloadHolidays()`（Supabase 再読込）が alert 判定より前に走り、これも断で失敗 → alert に到達せず

### Fix
1. `fetchHolidaysFromApi()` に `AbortController` + 10秒タイムアウト
2. `forceRefreshHolidays()` / `refreshHolidaysIfStale()` の catch 内の `updateJpHolidaysMeta()` を try/catch で囲み失敗を飲み込む
3. `onRefreshHolidays()` で alert を `reloadHolidays()` より前に移動し、reload 失敗も `.catch(() => {})` で飲み込む。さらに想定外例外用の保険として外側 catch も追加
- Files: `src/utils/jpHolidaysClient.js`, `src/components/apps/SettingsApp.vue`

## Case: 月次入力「開始する」を押しても画面遷移しない
- Date: 2026-05-21
- Severity: High
- Owner: daiki

### Symptoms
- 月次入力モード（手入力／CSV インポート両方）で対象月を選択して「開始する」を押下しても、ローディング（「集計期間を取得中...」「データを読み込み中...」）が表示・消失したあと画面が遷移しない（step=0 の対象月選択画面のまま）
- ブラウザの DevTools Console に `Could not find the table 'public.pe_monthly_company_records' in the schema cache` のエラーが出る
- 既存の alert ダイアログが出るはずだが、状況によってはブラウザの popup ブロックや見落としで気付けないことがある

### Cause
- `DB_MIGRATION_labor_cost_20260520.sql`（人件費計算ロジック移行マイグレーション）が Supabase に未適用で、`pe_monthly_company_records` テーブルが存在しない
- `InputApp.startCsvEntry()` / `startManualEntry()` の冒頭で `getMonthlyCompanyRecord(periodKey)` を呼び、ここで例外が throw されるため `this.step = 1` まで到達せず画面遷移できない

### Fix
- Supabase Dashboard → SQL Editor で `V-PEACH/supabase/DB_MIGRATION_labor_cost_20260520.sql` の中身を実行
- 反映直後はスキーマキャッシュが古いことがあるので、Dashboard の Database → Tables で `pe_monthly_company_records` が表示されるのを確認し、ブラウザをハードリロード

### Prevention
- 新規テーブル参照を追加する PR は、`supabase/DB_MIGRATION_*.sql` を必ずセットでコミットし、`CHANGELOG_DEV.md` に「Supabase 側で SQL 実行が必要」を明記する
- フロントで新テーブル参照を追加する変更を加える前に、ローカル Supabase で migration を流して動作確認する

### Links
- Dev log: [[V-PEACH/CHANGELOG_DEV]]
- Migration: `supabase/DB_MIGRATION_labor_cost_20260520.sql`

---

## Case: シフト CSV 取込の集計数値が手カウントと合わない
- Date: 2026-05-25
- Severity: Info（パース処理のバグではなく CSV データ起因）
- Owner: daiki

### Symptoms
- `vangvieng_shifts_202601.csv` を取込んだ結果が、スタッフ共有シフト表の手カウントと一致しない
  - 馬場本店: バイト6h 26（期待 28）、りょー6h 1（期待 0）
  - 馬場2号店: バイト6h 18（期待 19）、りょー6h 1（期待 0）

### Cause
**パース処理・計算ロジックは正しい。** HRMOS エクスポート CSV とシフト表の正本データに 3 件のズレが存在した：

| 日付 | 店舗 | 内容 | アプリへの影響 |
|------|------|------|--------------|
| 1/22 遅番 | 馬場本店 | CSV に中道雄耶（`fixed_salary`）が登録。シフト表ではバイトが担当 | バイト6h が 1 件カウントされない |
| 1/23 遅番 | 馬場本店 | CSV にエントリなし。シフト表ではバイトが出勤 | バイト6h -1、りょー6h が 1 件余分にカウント |
| 1/26 遅番 | 馬場2号店 | CSV にエントリなし。シフト表ではバイトが出勤 | バイト6h -1、りょー6h が 1 件余分にカウント |

### Resolution
調査の結果、**パース処理・CSV データともに正しかった**。手カウントの元になったシフト表に未登録の変更（後から修正されたシフト）が含まれており、CSV が実態を正確に反映していた。インポート結果も実態と一致しており、バグは存在しなかった。

### Prevention
- 集計結果に疑問があるときは、まず「シフト表が最終確定版か」を確認する。シフト変更後に手カウントの元になったシフト表が更新されていない場合、CSV 側が正しいことがある。

### Links
- Dev log: [[V-PEACH/CHANGELOG_DEV]]
- Importer: `src/utils/shiftImporter.js`, `src/utils/csvImporter.js`

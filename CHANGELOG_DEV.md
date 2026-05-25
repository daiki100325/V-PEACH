# CHANGELOG_DEV

## 2026-05-25
- What: 月次入力CSVモードのステップ表示を全6画面に統一（1/6〜6/6）。人件費A/B/Cにインジケーターを追加（CSVモード限定）、既存1/3〜3/3を1/6〜3/6に修正
- Why: 最初の3画面にしかステップ番号がなく、残りの人件費入力画面で現在位置が分からなかった
- Files: `src/components/apps/InputApp.vue`
- Related: [[V-PEACH/CHANGELOG_DEV]]

## 2026-05-25
- What: 月次入力トップ画面で対象月を自動セット。`getLatestPeriodKey()`（`pe_monthly_company_records` 降順1件）で最新記録月を取得し、その翌月を `selectedYear/Month` に初期値として設定
- Why: 毎月同じ月を手動で選び直す手間を省くため
- Files: `src/api.js`, `src/components/apps/InputApp.vue`
- Related: [[V-PEACH/CHANGELOG_DEV]]

## 2026-05-25
- What: 月次入力CSVモードのステップ順を修正（売上CSV → 売上プレビュー → シフトCSV → 人件費A/B/C → 確認）。シフトCSVファイル選択後に「選択されていません」のままになるUIバグを修正（`shiftsCsvFileName` を別途保持して表示）
- Why: 以前の順番（売上CSV → シフトCSV → 売上プレビュー）はプレビューの前にシフト取込があり違和感があった。ファイル名表示は `event.target.value = ''`（同一ファイル再選択許容）がネイティブUIをリセットしてしまっていたため
- Files: `src/components/apps/InputApp.vue`
- Related: [[V-PEACH/CHANGELOG_DEV]]

## 2026-05-25
- What: シフト CSV 集計ズレの原因調査。パース処理・CSV データともに正しく、手カウント元のシフト表に未登録変更があったことが判明。バグなし・状況終了
- Why: バイト6h・りょー6h の数値が手カウントと合わないと報告があったため
- Files: なし（コード変更なし）
- Related: [[V-PEACH/TROUBLESHOOTING]]

## 2026-05-25
- What: `detectCsvKindFromHeader` の勤務区分判定を修正。`略称` → `並び順` カラムで判定（実際の HRMOS エクスポートに `略称` 列が存在せず `表示名` / `並び順` 形式だった）
- Why: 設定画面の勤務区分 CSV アップロードで「ヘッダー判定失敗」エラーが出て取込不可だったため
- Files: `src/utils/csvImporter.js`
- Related: [[V-PEACH/TROUBLESHOOTING]]

## 2026-05-25
- What: HRMOS シフト CSV 取込基盤を実装。マイグレーション（`pe_hrmos_staffs` / `pe_hrmos_segments` / `pe_jp_holidays` / `pe_jp_holidays_meta`）、`api.js` への CRUD 追加、`utils/jpHolidaysClient.js`（holidays-jp API + Supabase キャッシュ + 強制再取得）、`utils/shiftImporter.js`（シフト計算：店舗×日付×シフトタイプの fillMap、オーラス分解、馬場2号店遅番の土日祝補正、りょーさん枠＝早番/遅番の埋まらない枠、バイト枠＝固定給・社長除外）、`csvImporter.js` 拡張（HRMOS スタッフ／勤務区分／シフト CSV のヘッダ判定＋パース＋ロール・店舗・シフトタイプ自動判定）、`SettingsApp.vue` に「HRMOS マスタ管理」「祝日マスタ」セクション追加（CSV取込・既存上書き保持・ロール／按分対象の手動上書き・再取得 UI）、`InputApp.vue` の CSV モードに Step 2「シフト CSV アップロード」を挿入（任意・スキップ可・既存画面A/B 編集可）、`PortalMenu.vue` に年初祝日カバレッジバナー（自動 fetch + 失敗時のみ警告）
- Why: 月次入力の画面A/B 12マス手入力を `vangvieng_shifts_YYYYMM.csv` 1ファイルアップロードで自動化するため。実装は §9 のフェーズ1〜8 までを一括で実施し、フェーズ9（検証）はオーナー手動で2026年1〜4月 CSV を順次取込確認する想定。実データ確認の結果、計画書の店舗名表記「馬場地区基本店／2号店」「オールイン」「[短縮稼働]」は実際の HRMOS 上では「高田馬場本店／2号店」「オーラス」「[短縮営業]」だったため、両方の表記を許容する判定ロジックで実装
- Files: `supabase/DB_MIGRATION_hrmos_masters_20260525.sql`, `src/api.js`, `src/utils/jpHolidaysClient.js`, `src/utils/shiftImporter.js`, `src/utils/csvImporter.js`, `src/components/apps/SettingsApp.vue`, `src/components/apps/InputApp.vue`, `src/components/PortalMenu.vue`, `notes/V-PEACH_shifts-csv-import-plan.md`, `DECISIONS.md`, `notes/V-PEACH_architecture.md`, `notes/V-PEACH_supabase-er-diagram.md`, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_shifts-csv-import-plan]], [[V-PEACH/notes/V-PEACH_labor-cost-plan]], [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-24
- What: HRMOS シフト CSV 1ファイル取込計画書の Open Questions 5項目をオーナー確認結果で確定。設計判断確定事項セクションに置換し、祝日マスタを外部 API + Supabase キャッシュ方式に変更（holidays-jp 採用）
- Why: ① 給与＋交通費総額（画面C）は手入力維持、② オールイン枠は早番7.5h+遅番6hに分解計上、③ 中番バイト枠は按分に含める、④ 短縮稼働など特殊枠は現状発生しないので無視、⑤ 祝日マスタは追加コスト・認証不要・CORS 許可済みの holidays-jp API を Supabase にキャッシュして自動更新、UI で再取得可、年初に翌年祝日カバレッジを PortalMenu でチェックしてアラート表示。これに伴い `pe_jp_holidays` / `pe_jp_holidays_meta` テーブル設計、`jpHolidaysClient.js` の新規追加、PortalMenu への年初バナー追加を計画に反映
- Files: `notes/V-PEACH_shifts-csv-import-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_shifts-csv-import-plan]]

## 2026-05-24
- What: HRMOS シフト CSV 1ファイル取込で人件費入力画面A/B を自動化する実装計画書を作成
- Why: 現状は月次入力で 3店舗×バイト/りょーさん×6h/7.5h = 12 マス + 給与総額1マスの手入力が必要。HRMOS が出力する `vangvieng_shifts_YYYYMM.csv` 1ファイルをアップロードするだけで画面A/B が自動算出されるパイプライン設計をまとめた。マスタ（スタッフ/勤務区分）は Supabase に保持し、初回投入後は HRMOS マスタ変更時のみ更新。固定給4名・りょーさん・バイトのロール判定、店舗判定（勤務区分名のプレフィックス）、土日祝日の馬場2号店遅番 7.5h 補正、店舗営業日判定（fillMap にレコードがある日）まで詳細化。Open Questions として給与総額の取り扱い（A:現状維持/B:給与CSV/C:時給マスタ）・オールイン枠・中番按分・短縮稼働枠・祝日マスタ運用の5点を明記
- Files: `notes/V-PEACH_shifts-csv-import-plan.md`, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_shifts-csv-import-plan]], [[V-PEACH/notes/V-PEACH_labor-cost-plan]]

## 2026-05-24
- What: 2025年12月分日別売上をキャッシュテーブル投入用 SQL を生成（3店舗×25日＝75レコード）
- Why: システム稼働開始は2026年1月だが、事業月度2026年1月の集計期間が12月を含むため、フロントのCSVインポートを経由せず Supabase SQL Editor で直接投入できる形に整形
- Files: `csv/done/SEED_daily_sales_cache_202512.sql`

## 2026-05-23
- What: 月次入力 CSV モード Step 2 プレビュー画面に残っていた旧 `labor_cost` 直接入力欄（店舗ごと1ボックス × 3店舗）を撤去。さらに CSV モードで step 6（最終確認）に到達してもテンプレートが存在せず空白画面になっていたバグを修正し、Manual モードと同等の確認画面（売上・バイト枠・りょーさん枠・全店給与＋交通費合計）を追加
- Why: 5/21 に人件費新方式（重みつき枠按分）への移行を完了したが、CSV モード Step 2 のテンプレートだけが旧仕様のまま残り、ユーザーから「枠数入力ではなく単純な人件費入力ボックスが表示される」と指摘された。`canNext` のコメント（line 428）には「旧人件費欄削除済み」と書かれていたが実態の template は未削除で、入力値も `submitCsv` で参照されない完全な dead code 状態だった
- Files: `src/components/apps/InputApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_labor-cost-plan]]

## 2026-05-22
- What: notes/ を現行仕様に同期（人件費新方式・CSV UI統合・PLApp N+1削減の3件を反映）
- Why: 2026-05-18 以降の実装変更（5/21 人件費新方式PL統合・N+1削減、5/22 CSV 6→3ボックス）が全 notes に未反映だったため
- Files: `notes/_index.md`, `notes/V-PEACH_requirements.md`, `notes/V-PEACH_architecture.md`, `notes/V-PEACH_finance-spec.md`, `notes/V-PEACH_next-actions.md`, `notes/V-PEACH_release-plan.md`, `notes/V-PEACH_supabase-er-diagram.md`, `notes/V-PEACH_test-plan.md`, `notes/V-PEACH_labor-cost-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_labor-cost-plan]]

## 2026-05-22
- What: 月次入力CSVモードの Step1 アップロードUIを6ボックス→3ボックス（店舗ごと1ボックス）に統合。`<input type="file" multiple>` で当該店舗の商品別売上CSV（Airメイト）と日別売上CSV（Airレジ）を同時選択できるようにし、ヘッダー内容（「カテゴリー」「売上合計」 vs 「集計期間」「割引額」）から自動で種別判定→該当スロットへ振り分け。再選択は追加マージ方式（既存スロットは未指定なら温存・指定があれば後勝ちで上書き）、同種重複や種別不明CSVは黄バッジ警告で表示。商品別/日別の各行に「削除」ボタンを追加し、誤アップロード時に当該スロットのみクリア可能に（警告メッセージも同時クリア）
- Why: 毎月のCSVアップロード工数を半減させるため。3店舗 × 2種類 = 6回のファイル選択が、3店舗 × 1回 = 3回で済む。ファイル名規約（`airmate_xxx` / `売上集計_xxx`）に依存せずヘッダーで判別するため、命名揺れにも強い。誤アップロードのリカバリ（片方だけやり直す等）も1クリックで可能
- Files: `src/utils/csvImporter.js`, `src/components/StoreCsvUpload.vue`（新規）, `src/components/apps/InputApp.vue`, `src/components/FileSlot.vue`（削除）
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-21
- What: PLApp の N+1 リクエストを大幅削減。`prefetchPeriods(periodKeys)` を新設し、`pe_monthly_company_records` と全店 `pe_monthly_records` を**期間範囲ぶん1バッチ**でまとめて取得。`loadMonthlyPLCore` は事前取得済みデータを受け取る形に変更し、内部での `getMonthlyCompanyRecord` / `Promise.all(getMonthlyRecord × 3店舗)` / `getActiveCompanySettings` の重複呼び出しを排除。`loadPL` 上位で `getActiveBenchmarks` と `getActiveCompanySettings` も並列1回取得に統合。さらに当該月の全店レコードが揃って null の場合は `getCostPriceForPeriod` / `getActiveStoreSettings` / `getCostReportForPE` も呼ばないよう早期 return を導入。`loadMonthlyPL` / `loadRolling3PL` / `loadTrendForPeriod` / `loadAnnualPL` は `loadPL` 本体に統合
- Why: 前タスク（人件費新方式の PL 統合）で `loadMonthlyPLCore` 内に各種 prefetch を追加した結果、トレンド12ヶ月計算で 195+ 並列リクエストが Supabase に投げられ、ブラウザの同時接続上限と Supabase の rate limit が干渉して `pe_benchmarks_revisions` を含む一部リクエストが `ERR_TIMED_OUT` になり PL 表示が分単位で停止していた
- Files: `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_labor-cost-plan]]

## 2026-05-21
- What: 人件費計算ロジック新方式（重みつき枠按分方式）の PL 側統合を完成。`PLApp.loadMonthlyPLCore` で `pe_monthly_company_records` の当月行と全店 `pe_monthly_records` を取得し `laborParams = { totalVariablePayroll, totalWeightedSlots, ryoHourlyRate }` を構築。`calcPL` に渡し、PL ⑬人件費の下に「固定給／変動費按分」サブ行と「※ りょーさん代替コスト（参考・PL非計上）」を表示。3ヶ月平均・年次集計では `laborFixed/laborVariable/ryoOpportunityCost` を「全行 null なら結果も null」とする集計関数 `aggregateKey` を導入し、旧式月のみの場合に内訳が ¥0 で表示される齟齬を防止
- Why: 月次入力モードの3画面（バイト枠数・りょーさん枠数・給与＋交通費総額）と設定の `fixed_salary_total`/`ryo_hourly_rate` は実装済みだったが、PL 側は常に `record.labor_cost` のレガシーフォールバックで動作しており、InputApp で入力した枠数が PL に反映されていなかった
- Files: `src/utils/finance.js`, `src/components/apps/PLApp.vue`, `TROUBLESHOOTING.md`
- Related: [[V-PEACH/notes/V-PEACH_labor-cost-plan]]

## 2026-05-21
- What: 月次入力モードで「開始する」を押しても画面遷移しないバグの原因（`DB_MIGRATION_labor_cost_20260520.sql` 未適用で `pe_monthly_company_records` テーブルが存在しないこと）を `TROUBLESHOOTING.md` に記録
- Why: 月次入力フローの冒頭で `getMonthlyCompanyRecord` が落ち `step=1` に遷移できない事象。再発防止のため migration セット忘れに対する運用ルールも追記
- Files: `TROUBLESHOOTING.md`

## 2026-05-20
- What: 人件費計算ロジック実装計画ドキュメント新規作成（中野店店長壁打ち最終方針＝重みつき枠按分方式の実装手順・データモデル・UI 仕様を整理）
- Why: 月次PL／月次入力／設定3モードを横断する変更のため、着手前に DB マイグレーション・API・UI・PL 表示・移行戦略を一気通貫で固める必要があった
- Files: `notes/V-PEACH_labor-cost-plan.md`, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_labor-cost-plan]], [[V-PEACH/notes/V-PEACH_next-actions]]

## 2026-05-19
- What: next-actions に人件費計算ロジック設計タスクを追加（簡易計算方式の検討・社長代替シフトの機会損失/将来コスト可視化）
- Why: 個別積み上げ計算は工数過大。かつ社長シフトの費用 0 計上が実態を歪めているため、設計を先行整理
- Files: `notes/V-PEACH_next-actions.md`

## 2026-05-19
- What: 経営PL（月次）のフィルターパネル下段に各店舗の集計期間バッジを追加。年月確定時に自動取得・表示
- Why: PLを開く前に各店舗のV-MINT集計期間が確認できるようにする（月次入力画面と同じ情報を経営PLでも）
- Files: `src/components/apps/PLApp.vue`

## 2026-05-19
- What: 経営PL画面の表示順序変更 — FLR比を最上部（データなしバナーの直後）に移動
- Why: FLRは最重要KPIのため、スクロールせず即視認できる位置に置く運用要望
- Files: `src/components/apps/PLApp.vue`

## 2026-05-18
- What: notes/ を現行仕様に同期（Phase 7 反映・CSV インポートモード追記・5指標修正）
- Why: requirements / architecture / release-plan / next-actions / sales-import-plan / test-plan / finance-spec が Phase 7-4 完了前の記述で止まっていたため
- Files: `notes/V-PEACH_requirements.md`, `notes/V-PEACH_architecture.md`, `notes/V-PEACH_release-plan.md`, `notes/V-PEACH_next-actions.md`, `notes/V-PEACH_sales-import-plan.md`, `notes/V-PEACH_test-plan.md`, `notes/V-PEACH_finance-spec.md`

## 2026-05-18
- What: 売上CSV取り込みのファイル名による店舗キー検証アラートを撤廃。任意のファイル名でアップロード可能に
- Why: Airメイト/Airレジ からダウンロードしたCSVをリネームせずそのまま使えるようにする運用要望
- Files: `src/components/apps/InputApp.vue`

## 2026-05-18
- What: 売上CSV取り込み Phase 7-3〜7-4 実装。InputApp Step 0 に「CSV インポート / 手入力」タブ切替を追加（デフォルト=CSV）。CSV インポートフローを実装：6ファイル一括アップロード → 前月キャッシュ + 当月CSV から事業月度範囲の割引総額を算出 → プレビュー（割引前/後・前月キャッシュ参照日数・既存値の上書き警告・人件費入力）→ 保存（`pe_daily_sales_cache` upsert + `pe_monthly_records` upsert + 古いキャッシュ自動削除）。Shift-JIS は `TextDecoder` でブラウザ完結、CSVパーサは自前実装で papaparse 不要。ファイル名から店舗キー・期間を自動検出。前月キャッシュ欠落時は確認ダイアログで警告
- Why: Phase 7-2 で DB 基盤が整ったため、毎月「6ファイルアップロードだけで `service_sales` / `merchandise_sales` が事業月度ベースで自動計算 + upsert」されるUI/ロジックを完成させる
- Files: `src/utils/csvImporter.js`（新規）, `src/components/FileSlot.vue`（新規）, `src/components/apps/InputApp.vue`（大幅改修）, `src/api.js`（`getDailySalesInRange` / `upsertDailySalesCache` / `deleteOldDailySalesCache` 追加）
- Related: [[V-PEACH/notes/V-PEACH_sales-import-plan]]

## 2026-05-18
- What: 売上CSV取り込み Phase 7-1/7-2 着手。`pe_daily_sales_cache` テーブル作成マイグレーション + 2025年12月分の SEED SQL（3店舗 × 25日 = 75行）を作成。CSV から PowerShell で SEED 自動生成。仕様書のスキーマ齟齬（`pe_stores` → `stores`、uuid → bigint、割引額の符号正規化）を修正
- Why: Phase 7-3（フロント実装）に進む前に、DB スキーマと初回データ投入を確定。実 CSV を読んで Shift-JIS / カラム構造 / 割引額が負値である点などを確認
- Files: `supabase/DB_MIGRATION_daily_sales_cache_20260518.sql`（新規）, `supabase/SEED_daily_sales_cache_202512.sql`（新規）, `notes/V-PEACH_sales-import-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_sales-import-plan]]

## 2026-05-18
- What: 売上CSV取り込み検討資料を改訂。事業月度が前月最終盤を含む特性を踏まえ、Airレジ日別売上を `pe_daily_sales_cache` テーブルにキャッシュし当月CSVだけで運用する方針に変更。インポート時に自動削除（当月度 start_date より古いレコード）、初回（2025年12月分）は SQL 直接投入で対応
- Why: 単純運用だと毎月「前月+当月」の2ヶ月分 CSV が必要で手順が倍化するため、前月分を DB に保持して再利用する設計に転換
- Files: `notes/V-PEACH_sales-import-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]

## 2026-05-18
- What: 月次入力 Step 0（対象月選択画面）に V-MINT 集計期間プレビューを追加。「開始する」ボタン下に全店舗の集計期間（start_date〜end_date・日数）を独立カードで表示。対象月確定時（periodKey watch）に自動フェッチ
- Why: 月次入力を始める前に V-MINT の棚卸し集計期間が確認できるようにする。別カードで視覚的に分離（メインカードとは異なる情報ブロック）
- Files: `src/components/apps/InputApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-18
- What: 売上データ自動取り込み（Airメイト/Airレジ CSV）の検討資料を notes に新規追加
- Why: 月次入力の手作業をなくし、事業月度ベースで CSV インポートだけで売上記録が完了する仕組みを設計するため、要件・計算ロジック・UI フロー・Open Questions を整理
- Files: `notes/V-PEACH_sales-import-plan.md`（新規）, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_requirements]], [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]

## 2026-05-18
- What: 全金額入力ボックスにブラー時カンマ桁区切り表示を追加（`CurrencyInput.vue` 共通コンポーネント化）
- Why: 100万単位の数字で桁間違いが起こりやすいため、フォーカスを外した瞬間にカンマ区切り表示する
- Files: `src/components/CurrencyInput.vue`（新規）, `src/components/apps/InputApp.vue`, `src/components/apps/SettingsApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-18
- What: `pe_benchmarks` を EAV形式からフラット・シングルトン形式に再設計し、`pe_company_settings` と同パターンに統一
- Why: `pe_benchmarks_revisions` と列構成を揃え保守性向上。`store_id` / `item_name` / `target_value` の EAV 方式を廃止し、フォールバック層として明確に位置づける
- Files: `src/api.js`, `supabase/DB_MIGRATION_benchmarks_restructure_20260518.sql`, `supabase/SEED_benchmarks_defaults_20260518.sql`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-18
- What: ベンチマーク設定の追跡指標を F比・L比・R比・営業利益率・労働分配率の5指標に変更（粗利率・原価率を除外）
- Why: FLR比はすでに PL 画面で可視化済みのため、ベンチマーク目標管理もそれに揃える
- Files: `src/components/apps/SettingsApp.vue`, `src/components/apps/PLApp.vue`, `supabase/DB_MIGRATION_benchmarks_flr_20260518.sql`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-17
- What: 経営PLにFLR比サマリーセクション追加・月次推移チャートをカテゴリー別全指標トグル対応に改修
- Why: FLR比（F比=原価率、L比=人件費/売上、R比=家賃/売上）の可視化要望。トレンドチャートは全PL項目＋FLR比を表示可能にし、カテゴリー別エクスパンドで指標ON/OFF制御。二重Y軸（左:金額、右:%）採用
- Files: `src/utils/finance.js`, `src/components/PLTrendChart.vue`, `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-17
- What: `notes/` 配下5ファイルを現行仕様（Phase 5+ 改修）に同期
- Why: 設定バージョン管理テーブル・UI改修・RLS有効化・全店舗一括入力フローが実装済みだったが notes に未反映だった
- Files: `notes/V-PEACH_architecture.md`, `notes/V-PEACH_supabase-er-diagram.md`, `notes/V-PEACH_requirements.md`, `notes/V-PEACH_release-plan.md`, `notes/V-PEACH_test-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_architecture]], [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]

## 2026-05-17
- What: 全テーブルで RLS を有効化（Option A: anon 全許可ポリシー）
- Why: Supabase の「RLS has not been enabled」警告を解消。URL非公開・信頼ユーザー前提のため anon 全許可とし既存動作を維持
- Files: `supabase/DB_MIGRATION_enable_rls_20260517.sql`

## 2026-05-17
- What: 設定画面の「現在適用中」レコードを削除可能に変更（店舗別固定費・全社共通費・ベンチマーク目標値、2件以上ある場合のみ削除ボタン表示）
- Why: 最新レコードは従来削除不可だったが、誤登録修正のため削除できるよう要望。削除後は次の最新レコードが自動的に適用される
- Files: `src/components/apps/SettingsApp.vue`

## 2026-05-17
- What: pe_store_settings デフォルト値の流し込みSQL作成（フォールバック用）
- Why: pe_store_settings_revisions が未適用の期間にフォールバックした際、固定費が0にならないようデフォルト値を設定するため
- Files: `supabase/SEED_store_settings_defaults.sql`

## 2026-05-17
- What: 設定「店舗別固定費」を1店舗表示+セレクターバー方式に変更（全店舗一覧表示→ピル切替UI）
- Why: 全3店舗を縦に並べると1店舗あたりのコンテンツ量が多くスクロールが深くなるため、PLモードと同様の横並びセレクターで店舗をシームレスに切り替える方式へ変更
- Files: `src/components/apps/SettingsApp.vue`

## 2026-05-17
- What: 設定3種をバージョン管理化（effective_from ベースの改定履歴 + 現在適用中表示 + 新規改定フォーム）
- Why: V-MINT2.0の単位原価マスタと同様に、設定値を月単位の有効日付付きで改定履歴管理できるようにするため
- Files: `src/components/apps/SettingsApp.vue`, `src/api.js`, `src/components/apps/PLApp.vue`, `supabase/DB_MIGRATION_versioned_settings.sql`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-17
- What: 設定「店舗別固定費」を全店舗一覧表示に変更（店舗選択ドロップダウン廃止）
- Why: 月次入力と同様に、店舗を選ばず1画面で全3店舗の固定費を確認・編集できるよう改善
- Files: `src/components/apps/SettingsApp.vue`

## 2026-05-17
- What: 経営PL をシングルページ化・月次入力を全店舗一括フロー化・集計期間表示追加
- Why: (1) PL はフィルター選択→PL表示の2ステップだったが1画面にまとめてUX改善。(2) 月次入力は店舗ごとに開始が必要だったが全3店舗分を連続入力できるよう変更。(3) V-MINTの集計期間（cost_reports.start_date/end_date）を入力画面に表示
- Files: `src/components/apps/PLApp.vue`, `src/components/apps/InputApp.vue`, `src/api.js`, `src/App.vue`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-17
- What: `V-PEACH_supabase-er-diagram.md` — Supabase ER 図（`pe_*` 4 テーブル + V-MINT 読み取り参照・Migration 履歴）
- Why: V-MINT2.0 と同様に DB 構造と共用関係を一覧できる正本を用意するため
- Files: `notes/V-PEACH_supabase-er-diagram.md`, `notes/_index.md`, `notes/V-PEACH_architecture.md`
- Related: [[V-PEACH/notes/V-PEACH_supabase-er-diagram]], [[V-MINT2.0/notes/V-MINT2.0_supabase-er-diagram]]

## 2026-05-17
- What: `V-PEACH_test-plan.md` — 空 DB 向けテスト計画（マスタ/月次の SQL 投入・期待値・テストケース一覧）
- Why: Phase 0〜5 完了後の一通り動作確認手順を文書化するため
- Files: `notes/V-PEACH_test-plan.md`, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_test-plan]]

## 2026-05-17
- What: `V-PEACH_finance-spec.md` — §1 Mermaid削除・番号振り直し、数値セル列を右揃えに統一
- Why: 利益フロー図は不要／表の金額・比率・演算列の桁揃えを揃えるため
- Files: `notes/V-PEACH_finance-spec.md`
- Related: [[V-PEACH/notes/V-PEACH_finance-spec]]

## 2026-05-17
- What: Phase 5 — 売上・原価体系改修（提供/物販売上分離・消費税ライン・原価89%固定化・販管費再定義）
- Why: 旧来の `total_sales` 一本建てでは物販原価が未計上のまま粗利が過大評価されていた問題を解消
- Files: `src/utils/finance.js`, `src/api.js`, `src/components/apps/InputApp.vue`, `src/components/apps/PLApp.vue`, `src/components/apps/SettingsApp.vue`, `src/components/apps/PLTrendChart.vue`, `DB_MIGRATION.sql`
- Changes:
  - `pe_monthly_records`: `total_sales` → `service_sales` リネーム + `merchandise_sales` 追加、`rent/payment_fee/utilities/sundries` 廃止
  - `pe_store_settings`: `physical_profit_margin`/`fixed_payment_fee` 廃止 → `payment_fee_rate` 追加
  - `pe_merchandise_price_masters` テーブル・`pe_merchandise_sales_view` ビュー廃止
  - `calcPL()`: 消費税分離（× 10/11）・物販フレーバー原価 89% 固定・販管費 SGA 構造・`netCashFlow` を返す
  - InputApp.vue: 入力項目を提供売上/物販売上/人件費の3項目に絞り込み
  - PLApp.vue: 原価/販管費の大カテゴリー表示、ベンチマーク分母を `totalSalesAfterTax` に統一
- Related: [[V-PEACH/notes/V-PEACH_revision-plan]]

## 2026-05-16
- What: Phase 4 — トレンドチャートを月次・3ヶ月平均モードでも表示
- Why: 月次・3ヶ月平均モードでは年次モードと異なるデータ構造のため専用ロジックが必要だった
- Files: `src/components/apps/PLTrendChart.vue`, `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_release-plan]]

## 2026-05-16
- What: UI・ドキュメントの表記を「経営コックピット」から「経営ダッシュボード」に統一
- Why: プロダクト名称の表記揺れを解消
- Files: `index.html`, `src/components/common/PinAuth.vue`, `src/components/common/AppHeader.vue`, `notes/_index.md`, `notes/V-PEACH_requirements.md`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-15
- What: Phase 0 — プロジェクトスキャフォールド作成
- Why: V-MINT 2.0と同一スタック（Vue3/Vite/Tailwind/Supabase）でV-PEACHを独立リポジトリとして構築
- Files: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `.env.local`, `.gitignore`, `src/main.js`, `src/style.css`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-16
- What: Phase 1 — Supabase SQL Editor でマイグレーション実行完了
- Why: stores.id が bigint のため store_id を uuid→bigint に修正して再実行
- Files: `DB_MIGRATION.sql`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-15
- What: Phase 1 — DB_MIGRATION.sql 作成
- Why: V-MINT 2.0と同一Supabaseプロジェクトに `pe_` プレフィックスで5テーブル＋1Viewを追加
- Files: `DB_MIGRATION.sql`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-15
- What: Phase 2 — 共通コンポーネント・APIレイヤー・財務ロジック実装
- Why: V-MINT 2.0のUIパターンを踏襲しつつV-PEACH固有のPL計算ロジックを分離
- Files: `src/api.js`, `src/utils/finance.js`, `src/utils/periods.js`, `src/App.vue`, `src/components/PortalMenu.vue`, `src/components/common/*`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-15
- What: Phase 3 — 月次入力モード・設定モード・PLモード（基本）実装
- Why: 月次入力→設定→PL確認の3モードを骨格レベルで動作可能な状態にする
- Files: `src/components/apps/InputApp.vue`, `src/components/apps/SettingsApp.vue`, `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_release-plan]]

## 2026-05-15
- What: GitHubリポジトリ作成・subtree push・Cloudflare Pages接続・初回デプロイ完了
- Why: obsidian-vaultモノレポから `git subtree push --prefix=V-PEACH V-PEACH main` で独立リポジトリに分離
- Files: リモート `V-PEACH` → `https://github.com/daiki100325/V-PEACH.git`
- Related: [[V-PEACH/DECISIONS]]

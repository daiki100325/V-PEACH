---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — Release Plan

## Summary
- 設定→入力→分析の順に積み上げてリリース
- 各フェーズ完了でそれ単体として使える状態にする
- デプロイ：Cloudflare Pages（obsidian-vault からの `git subtree push` 運用）
- Phase 番号体系は [[V-PEACH/notes/V-PEACH_history]] を正史とする（本文書はそのリリース進捗ビュー）

## フェーズ状況

### ✅ Phase 0：プロジェクトセットアップ（2026-05-15 完了）
- Vite + Vue3 + Tailwind CSS + Supabase プロジェクト構成
- GitHub リポジトリ `daiki100325/V-PEACH` 作成・subtree push 設定
- Cloudflare Pages 接続・初回デプロイ完了
- PIN認証設定済み

### ✅ Phase 1：DBマイグレーション（2026-05-16 完了）
- `DB_MIGRATION.sql` を Supabase SQL Editor で実行完了
- 作成テーブル: `pe_store_settings` / `pe_company_settings` / `pe_monthly_records` / `pe_benchmarks` / `pe_merchandise_price_masters`
- 作成View: `pe_merchandise_sales_view`
- 注: `stores.id` が `bigint` のため `store_id` を `uuid→bigint` に修正して実行

### ✅ Phase 2：共通基盤・月次入力モード・設定モード（2026-05-15 完了）
- `src/api.js`：全 pe_ テーブルの CRUD + V-MINT cost_reports 参照
- `src/utils/finance.js`：PL計算・変動費計算・3ヶ月平均ロジック
- `InputApp.vue`：店舗別（総売上・人件費・各経費）+ 全社共通費（役員報酬・借入返済）のステップ入力
- `SettingsApp.vue`：店舗別固定費・全社共通費・物販販売値改定（effective_from管理）・ベンチマーク（スタブ）

### ✅ Phase 3：PLモード 基本実装（2026-05-15 完了）
- `PLApp.vue`：月次PL表示（全社集計・店舗別）
- 売上・変動費・固定費・営業利益・最終手残りの表示
- 労働分配率の自動計算・表示
- フィルター：拠点選択・期間モード選択（月次/3ヶ月平均/年次）

### ✅ Phase 4：PLモード 完全実装（2026-05-16 完了）
- トレンドチャート（Chart.js 折れ線）：月次・3ヶ月移動平均・年次
- Health Highlight（RED/GREEN判定）：ベンチマーク目標値との比較
- 3ヶ月平均・年次集計ロジック（`calcRolling3MonthAvg` / `calcAnnualSum`）
- ベンチマーク設定UIの実装

### ✅ Phase 5：売上・原価体系改修＋ UI大改修・設定バージョン管理・RLS（2026-05-17 完了）

**売上・原価体系改修**
- `total_sales` → `service_sales` + `merchandise_sales` 分離（月次入力・DB）
- 消費税ライン（× 1/11）追加、税引き後総売上ベースに統一
- 物販フレーバー原価を `merchandise_sales × 89%` 固定計算に変更
- 決済手数料を固定額から `totalSalesAfterTax × payment_fee_rate` 売上連動に変更
- 家賃・光熱費・雑費を月次入力から削除し設定値固定に変更
- `pe_merchandise_price_masters` テーブル・`pe_merchandise_sales_view` 廃止
- PLApp.vue の原価/販管費の大カテゴリー化、`netCashFlow` 表示
- ベンチマーク分母を `totalSalesAfterTax` に統一、`variable_cost_ratio` → `cost_ratio` にリネーム

**UI大改修・設定バージョン管理・RLS**
- **経営PL シングルページ化**：フィルター選択+PL表示を1画面に統合
- **月次入力 全店舗一括フロー化**：3店舗を連続入力できるステップに変更。V-MINT 集計期間を参照表示
- **設定3種のバージョン管理化**：`pe_store_settings_revisions` / `pe_company_settings_revisions` / `pe_benchmarks_revisions` 追加。`effective_from` で改定履歴管理
- **設定画面 UI 改修**：店舗別固定費をピルセレクター方式に変更。「現在適用中」+「改定履歴」の2段表示。現在適用中の削除（2件以上のみ）
- **全テーブルRLS有効化**：anon 全許可ポリシーで既存動作を維持しつつ警告を解消

### ✅ Phase 6：FLR比表示・月次推移チャート全指標化・ベンチマーク改修（2026-05-17〜18 完了）

**FLR比表示・月次推移チャート全指標化（2026-05-17）**
- PL画面に FLR比サマリーセクション（F比・L比・R比）を常時表示（Health Check 直上）
- 月次推移チャートを全PL項目＋FLR比のカテゴリー別トグル対応に全面改修
- Y軸二重軸（左：金額万円、右：%）。初期表示は「税込総売上・F比・L比・R比・会社手残り」

**ベンチマーク指標改修（2026-05-18）**
- `pe_benchmarks` を EAV形式からフラット・シングルトン形式（`id=1`）に再設計
- 追跡指標を F比・L比・R比・営業利益率・労働分配率の5指標に変更（粗利率・原価率を除外）
- `pe_benchmarks_revisions` に `f_ratio` / `l_ratio` / `r_ratio` カラムを追加

**月次入力 Step 0 V-MINT 集計期間プレビュー（2026-05-18）**
- 対象月（年・月）確定時に「開始する」ボタン下へ全店舗の集計期間を独立カードで自動表示
- `periodKey` watch で `getCostReportDates` を並列フェッチ。未入力店舗は「未入力」表示

### ✅ Phase 7：Airメイト / Airレジ CSV 自動取込（2026-05-18 完了）

**Phase 7-1：サンプル CSV 収集・パーサ仕様確定**
- 3店舗 × 2種類（Airメイト / Airレジ）の実 CSV を入手
- Shift-JIS デコード・カラム構成を確認し自前パーサ（papaparse 不採用）で仕様確定

**Phase 7-2：`pe_daily_sales_cache` テーブル作成 + 2025年12月分 SEED**
- `DB_MIGRATION_daily_sales_cache_20260518.sql`・`SEED_daily_sales_cache_202512.sql` を Supabase に投入

**Phase 7-3 / 7-4：フロント実装・Supabase 連携**
- `InputApp.vue` に CSV インポートモードを追加（手入力モードは後に廃止 → 2026-05-30）
- `csvImporter.js`（Airメイト・Airレジ CSV パーサ・ヘッダー内容で種別自動判定）
- プレビュー画面（割引前/後・割引総額・前月キャッシュ参照日数）
- `pe_daily_sales_cache` upsert + `upsertMonthlyRecord` + 古いキャッシュ削除のフローが通る
- エラー処理（前月キャッシュ欠落の確認ダイアログ・パースエラー表示）対応済み

### ✅ Phase 8：人件費新方式・重みつき枠按分方式実装（2026-05-21 完了）
- `DB_MIGRATION_labor_cost_20260520.sql` 適用済み（`pe_monthly_records` 枠数4列・`pe_monthly_company_records` 新設・`fixed_salary_total` / `ryo_hourly_rate` 追加）
- `finance.js`：`calcWeightedSlots` / `calcStoreLaborCost` / `calcRyoOpportunityCost` を追加。`calcPL` に `laborParams` 引数を追加し新方式／レガシーフォールバックを切り替え（フォールバックは Phase 11 で廃止）
- `SettingsApp.vue`：店舗別固定費に「所属固定給月報酬」・全社共通費に「社長代替時給」入力欄を追加
- `InputApp.vue`：人件費3画面（A：バイト枠数・B：りょーさん枠数・C：給与+交通費総額）を追加。旧 `labor_cost` 直接入力を撤去
- `PLApp.vue`：⑬人件費に「固定給／変動費按分」サブ行 + 「りょーさん代替コスト（参考）」表示

**PLApp N+1 削減（同日 2026-05-21）**
- `prefetchPeriods(periodKeys)` を新設し `pe_monthly_company_records` と全店 `pe_monthly_records` をバッチ取得
- `loadMonthlyPL` / `loadRolling3PL` / `loadTrendForPeriod` / `loadAnnualPL` を `loadPL` に統合

### ✅ Phase 9：CSV アップロード UI 統合（2026-05-22 完了）
- `StoreCsvUpload.vue` 改修：6ファイルスロット → 店舗ごと 1 ボックス（`<input multiple>` で同時選択）。ヘッダー内容から Airメイト / Airレジ を自動判定して振り分け。再選択は追加マージ方式。誤アップロードは「削除」ボタンでスロット単体クリア。黄バッジ警告（重複・種別不明）
- `FileSlot.vue` 削除（`StoreCsvUpload.vue` に統合）

### ✅ Phase 10：HRMOS シフト CSV 取込基盤＋トレンドチャート仕様改修（2026-05-25 完了）

**HRMOS シフト CSV 取込基盤**
- `DB_MIGRATION_hrmos_masters_20260525.sql`：`pe_hrmos_staffs` / `pe_hrmos_segments` / `pe_jp_holidays` / `pe_jp_holidays_meta` 新設
- `src/utils/shiftImporter.js`：HRMOS シフト CSV 計算（店舗×日付×シフトタイプ正規化）
- `src/utils/jpHolidaysClient.js`：holidays-jp API + Supabase キャッシュ + 30日経過時バックグラウンド更新
- `src/utils/csvImporter.js` 拡張：HRMOS スタッフ・勤務区分 CSV 解析追加
- `SettingsApp.vue`：HRMOS マスタ管理（スタッフ・勤務区分・祝日キャッシュ確認・リフレッシュ）
- `InputApp.vue` Step 3：HRMOS シフト CSV アップロード画面（任意ステップ／Phase 11 で必須化）および店舗別集計結果表示
- `PortalMenu.vue`：年初バナー（マスタ未投入時の警告）

**UI/UX 改修**
- **シフト CSV ファイル選択 UI カスタム化**：`InputApp.vue` Step 3 の `input[type=file]` を非表示化しカスタムボタンでラップ。ファイル選択後はボタン横にファイル名を表示（「選択されていません」が残る不具合修正）
- **トレンドチャート・月次モード**：直近12ヶ月 → **選択年の 1〜12 月**。ラベルは「1月」–「12月」、タイトルは「月次推移（YYYY年）」
- **トレンドチャート・3ヶ月平均モード**：直近12ヶ月 → **選択年の 1〜12 月**（PL値自体は直近3ヶ月平均を維持）
- **トレンドチャート・年次モード**：選択年の月別 → **選択年終点・直近最大12年の年次合計PL**。ラベルは「YYYY年」、タイトルは「年次推移（直近12年）」

### ✅ Phase 11：月次入力フロー CSV 専用化・再編集モード（2026-05-30 完了）
- 売上 CSV はすでに専用化済み（Phase 7）だったが、人件費フロー（旧画面A・B の枠数手入力 + シフトCSV任意）も CSV 専用に統一
- 旧画面A（バイト枠）・画面B（りょーさん枠）の手入力を廃止し、1 枚の読み取り専用「人件費プレビュー」に統合
- シフト CSV を「任意」から事実上の必須に変更。代わりに「既存月の再編集モード」（全店の `pe_monthly_records` が揃った月で自動認識）を追加し、CSV 未アップロードでも DB 既存値で進行可能に
- 売上 CSV にも同じ再編集モードを適用し、再編集時は CSV 未アップでも DB 既存値で進める動線を整備
- Step 構成を 7 → 6 ステップに削減。当月の人件費＋交通費総額のみ手入力を維持（CSV 化できないため）
- `labor_cost` フォールバック方式を廃止し、`pe_monthly_company_records` 行がない月は PL 計算対象外として扱う方針に統一
- 祝日マスタ「いま再取得する」のネットワーク断耐性を3段階で修正（10秒タイムアウト・メタ更新失敗の握り潰し・alert 順序入替）

### ✅ Phase 12：UI/UX 最終調整・リリース前テスト（2026-06-01 完了）

**売上 CSV 一括アップロード・シフト CSV UI 統一（2026-06-01）**
- `StoreCsvUpload.vue`：ファイル入力を削除し表示専用化（スロット削除ボタンは維持）
- `csvImporter.js`：`detectStoreKeyFromFilename` に日本語店舗名判定を追加（「馬場2号店」「馬場本店」「中野店」→ UI キー変換）
- `InputApp.vue` Step 1：「店舗別3ボックス」→「1つの一括アップロードボタン＋店舗別ステータス表示」に変更。`handleBulkFilesUpload` がファイル名から店舗を自動判定し Airメイト/Airレジに振り分け。店舗名未検出ファイルはグローバル警告エリアに表示
- `InputApp.vue` Step 3：ボタンを Step 1 と同スタイル（全幅・ヘッダーカード内）に統一。削除ボタン追加。ステータスカードを分離。再編集モードの「DB既存値を使用中」バナーに全店舗の枠数サマリーを追加

**人件費プレビュー りょーさん枠 全店合計フッター追加（2026-06-01）**
- `InputApp.vue` Step 4：りょーさん枠テーブル下に全店合計フッターを追加。「全店合計: XXX.X h ／ 代替コスト: ¥YYYY（¥1,300/h）」形式で表示
- 時給は `getCompanySettings()` から `ryo_hourly_rate` を取得し `startCsvEntry` 時に反映（デフォルト 1,300）
- 各店舗行の表記を「代替コスト参考: X h」→「重みつき枠数 = X h」に統一（バイト行と表現を揃える）

**トレンドチャート 指標トグル不具合修正（2026-06-01）**
- `PLTrendChart.vue`：カテゴリ展開エリアの `:style` に残っていた `.has()` を `.includes()` に修正（展開描画時の `TypeError` 解消）
- `PLTrendChart.vue`：Chart.js インスタンスを `markRaw()` でラップし、リアクティブ Proxy による `chart.update()` 不発を解消（トグルがチャートに反映されない不具合）

## 現在のステータス — 🎉 正式リリース済み（2026-06-01）

**Phase 0〜12 を全完了し、V-PEACH は 2026-06-01 に正式リリース・本番稼働を開始した。**

- 機能実装は Phase 12（UI/UX 最終調整）まで完了
- **正式リリース前テスト完了（2026-06-01）**：[[V-PEACH_test-plan]] の機能テストを一巡クリア + finance-spec サンプル検証 + 本番スモークまで done。スキップは SET-15 / PLT-02 / EDG-02（既知・環境都合・仕様）
- 固定給初期値 SEED（`SEED_fixed_salaries_20260520.sql`）: ✅ 投入済み
- ベンチマーク目標値: ✅ Supabase 登録済み
- **本番デプロイ完了**：`git subtree push --prefix=V-PEACH V-PEACH main` → Cloudflare Pages 本番反映済み

## 今後のロードマップ
- **Phase 13: 店舗増減の GUI 対応（多店舗スケール対応）** — 計画確定済み・実装は 2026-06-02 以降。詳細・進捗は [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]] を正本とする。大規模改修につき保険ブランチ（V-MINT=`v3` / V-PEACH=`v2`）で進め、検証後に本番へマージ

## Related
- [[V-PEACH/notes/V-PEACH_history]] — Phase 番号体系の正史
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/CHANGELOG_DEV]]
- [[V-PEACH/notes/V-PEACH_requirements]]
- [[V-PEACH/notes/V-PEACH_architecture]]

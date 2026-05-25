---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — Release Plan

## Summary
- 設定→入力→分析の順に積み上げてリリース
- 各フェーズ完了でそれ単体として使える状態にする
- デプロイ：Cloudflare Pages（obsidian-vault からの `git subtree push` 運用）

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

### ✅ Phase 5：売上・原価体系改修（2026-05-17 完了）
- `total_sales` → `service_sales` + `merchandise_sales` 分離（月次入力・DB）
- 消費税ライン（× 1/11）追加、税引き後総売上ベースに統一
- 物販フレーバー原価を `merchandise_sales × 89%` 固定計算に変更
- 決済手数料を固定額から `totalSalesAfterTax × payment_fee_rate` 売上連動に変更
- 家賃・光熱費・雑費を月次入力から削除し設定値固定に変更
- `pe_merchandise_price_masters` テーブル・`pe_merchandise_sales_view` 廃止
- PLApp.vue の原価/販管費の大カテゴリー化、`netCashFlow` 表示
- ベンチマーク分母を `totalSalesAfterTax` に統一、`variable_cost_ratio` → `cost_ratio` にリネーム

### ✅ Phase 5+：UI大改修・設定バージョン管理・RLS（2026-05-17 完了）
- **経営PL シングルページ化**：フィルター選択+PL表示を1画面に統合
- **月次入力 全店舗一括フロー化**：3店舗を連続入力できるステップに変更。V-MINT 集計期間を参照表示
- **設定3種のバージョン管理化**：`pe_store_settings_revisions` / `pe_company_settings_revisions` / `pe_benchmarks_revisions` 追加。`effective_from` で改定履歴管理
- **設定画面 UI 改修**：店舗別固定費をピルセレクター方式に変更。「現在適用中」+「改定履歴」の2段表示。現在適用中の削除（2件以上のみ）
- **全テーブルRLS有効化**：anon 全許可ポリシーで既存動作を維持しつつ警告を解消

### ✅ Phase 6：FLR比表示・月次推移チャート全指標化（2026-05-17 完了）
- PL画面に FLR比サマリーセクション（F比・L比・R比）を常時表示（Health Check 直上）
- 月次推移チャートを全PL項目＋FLR比のカテゴリー別トグル対応に全面改修
- Y軸二重軸（左：金額万円、右：%）。初期表示は「税込総売上・F比・L比・R比・会社手残り」

### ✅ ベンチマーク指標改修（2026-05-18 完了）
- `pe_benchmarks` を EAV形式からフラット・シングルトン形式（`id=1`）に再設計
- 追跡指標を F比・L比・R比・営業利益率・労働分配率の5指標に変更（粗利率・原価率を除外）
- `pe_benchmarks_revisions` に `f_ratio` / `l_ratio` / `r_ratio` カラムを追加

### ✅ 月次入力 Step 0 V-MINT 集計期間プレビュー（2026-05-18 完了）
- 対象月（年・月）確定時に「開始する」ボタン下へ全店舗の集計期間を独立カードで自動表示
- `periodKey` watch で `getCostReportDates` を並列フェッチ。未入力店舗は「未入力」表示

### ✅ Phase 7-1：サンプル CSV 収集・パーサ仕様確定（2026-05-18 完了）
- 3店舗 × 2種類（Airメイト / Airレジ）の実 CSV を入手
- Shift-JIS デコード・カラム構成を確認し自前パーサ（papaparse 不採用）で仕様確定

### ✅ Phase 7-2：`pe_daily_sales_cache` テーブル作成 + 2025年12月分 SEED（2026-05-18 完了）
- `DB_MIGRATION_daily_sales_cache_20260518.sql`・`SEED_daily_sales_cache_202512.sql` を Supabase に投入

### ✅ Phase 7-3 / 7-4：フロント実装・Supabase 連携（2026-05-18 完了）
- `InputApp.vue` に CSV/手入力タブ切替を追加（デフォルト = CSV）
- `csvImporter.js`（Airメイト・Airレジ CSV パーサ・ヘッダー内容で種別自動判定）
- プレビュー画面（割引前/後・割引総額・前月キャッシュ参照日数）
- `pe_daily_sales_cache` upsert + `upsertMonthlyRecord` + 古いキャッシュ削除のフローが通る

### ✅ CSV アップロード UI 統合（2026-05-22 完了）
- `StoreCsvUpload.vue` 改修：6ファイルスロット → 店舗ごと 1 ボックス（`<input multiple>` で同時選択）。ヘッダー内容から Airメイト / Airレジ を自動判定して振り分け。再選択は追加マージ方式。誤アップロードは「削除」ボタンでスロット単体クリア。黄バッジ警告（重複・種別不明）。
- `FileSlot.vue` 削除（`StoreCsvUpload.vue` に統合）

### ✅ 人件費新方式（重みつき枠按分方式）実装（2026-05-21 完了）
- `DB_MIGRATION_labor_cost_20260520.sql` 適用済み（`pe_monthly_records` 枠数4列・`pe_monthly_company_records` 新設・`fixed_salary_total` / `ryo_hourly_rate` 追加）
- `finance.js`：`calcWeightedSlots` / `calcStoreLaborCost` / `calcRyoOpportunityCost` を追加。`calcPL` に `laborParams` 引数を追加し新方式／レガシーフォールバックを切り替え
- `SettingsApp.vue`：店舗別固定費に「所属固定給月報酬」・全社共通費に「社長代替時給」入力欄を追加
- `InputApp.vue`：手入力／CSV 両モードで人件費3画面（A：バイト枠数・B：りょーさん枠数・C：給与+交通費総額）を追加。旧 `labor_cost` 直接入力を撤去
- `PLApp.vue`：⑬人件費に「固定給／変動費按分」サブ行 + 「りょーさん代替コスト（参考）」表示。新方式未入力月はレガシー表示でフォールバック

### ✅ PLApp N+1 削減（2026-05-21 完了）
- `prefetchPeriods(periodKeys)` を新設し `pe_monthly_company_records` と全店 `pe_monthly_records` をバッチ取得
- `loadMonthlyPL` / `loadRolling3PL` / `loadTrendForPeriod` / `loadAnnualPL` を `loadPL` に統合

### ✅ HRMOS シフト CSV 取込基盤（2026-05-25 完了）
- `DB_MIGRATION_hrmos_masters_20260525.sql`：`pe_hrmos_staffs` / `pe_hrmos_segments` / `pe_jp_holidays` / `pe_jp_holidays_meta` 新設
- `src/utils/shiftImporter.js`：HRMOS シフト CSV 計算（店舗×日付×シフトタイプ正規化）
- `src/utils/jpHolidaysClient.js`：holidays-jp API + Supabase キャッシュ + 30日経過時バックグラウンド更新
- `src/utils/csvImporter.js` 拡張：HRMOS スタッフ・勤務区分 CSV 解析追加
- `SettingsApp.vue`：HRMOS マスタ管理（スタッフ・勤務区分・祈日キャッシュ確認・リフレッシュ）
- `InputApp.vue` Step 3：HRMOS シフト CSV アップロード画面（任意ステップ）および店舗別集計結果表示
- `PortalMenu.vue`：年初バナー（マスタ未投入時の警告）

### ✅ UI/UX 改修（2026-05-25 完了）
- **シフト CSV ファイル選択 UI カスタム化**：`InputApp.vue` Step 3 の `input[type=file]` を非表示化しカスタムボタンでラップ。ファイル選択後はボタン横にファイル名を表示（「選択されていません」が残る不具合修正）
- **トレンドチャート・月次モード**：直近12ヶ月 → **選択年の 1〜12 月**。ラベルは「1月」–12月」、タイトルは「月次推移（YYYY年）」
- **トレンドチャート・3ヶ月平均モード**：直近12ヶ月 → **選択年の 1〜12 月**（PL値自体は直近3ヶ月平均を維持）
- **トレンドチャート・年次モード**：選択年の月別 → **選択年終点・直近最大12年の年次合計PL**。ラベルは「2026年」“YYYY年」、タイトルは「年次推移（直近12年）」

### 🔄 Phase 7-5：エラー処理・UX 仕上げ（dev 確認待ち）
- 前月キャッシュ欠落の確認ダイアログ・パースエラー表示等、主要ケース対応済み
- dev 環境での動作確認・UX 最終調整が残タスク

## 現在のステータス
HRMOS シフト CSV 取込基盤 + UI/UX 改修（トレンドチャート仕様変更・シフトファイル選択 UI）まで完了。Phase 7-5（エラー処理・UX）は dev 確認中。
テスト実施待ち（手順: [[V-PEACH/notes/V-PEACH_test-plan]]）。
固定給初期値 SEED はオーナー確認後に別途投入。

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/CHANGELOG_DEV]]
- [[V-PEACH/notes/V-PEACH_requirements]]
- [[V-PEACH/notes/V-PEACH_architecture]]

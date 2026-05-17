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

## 現在のステータス
全フェーズ完了。テスト実施待ち（手順: [[V-PEACH/notes/V-PEACH_test-plan]]）。

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/CHANGELOG_DEV]]
- [[V-PEACH/notes/V-PEACH_requirements]]
- [[V-PEACH/notes/V-PEACH_architecture]]

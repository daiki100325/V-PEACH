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

### 🔲 Phase 4：PLモード 完全実装（未着手）
- トレンドチャート（Chart.js 折れ線）：月次・3ヶ月移動平均・年次
- Health Highlight（RED/GREEN判定）：ベンチマーク目標値との比較
- 3ヶ月平均・年次集計ロジックの実装（現在はTODO）
- ベンチマーク設定UIの実装

## 次のアクション
1. ローカルで `npm install` → `npm run dev` で動作確認
2. 設定モードで各店舗の固定費・物販販売値を初期設定
3. 月次入力モードでテストデータを投入
4. Phase 4（トレンドチャート）着手

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/CHANGELOG_DEV]]
- [[V-PEACH/notes/V-PEACH_requirements]]
- [[V-PEACH/notes/V-PEACH_architecture]]

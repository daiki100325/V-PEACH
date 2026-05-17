---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — Architecture

## Summary
- Vue3/Vite フロントエンド + Supabase（V-MINT 2.0と同一プロジェクト）+ Cloudflare Pages
- V-MINT 2.0のテーブルをView経由で参照し、フロント側ロジックを軽量化
- obsidian-vault モノレポから `git subtree push --prefix=V-PEACH V-PEACH main` でデプロイ

## スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | Vue 3 + Vite + Tailwind CSS |
| チャート | Chart.js（PLTrendChart.vue・Phase 4 実装済み） |
| Backend | Supabase (PostgreSQL) |
| Infra | Cloudflare Pages |
| V-MINT連携 | `cost_reports` / `flavor_brand_sales` / `drink_orders` 参照 |

## ディレクトリ構成

```
V-PEACH/
├── src/
│   ├── App.vue                  # ルート（3モード切替）
│   ├── api.js                   # Supabase CRUD（pe_テーブル + V-MINT読み取り）
│   ├── main.js
│   ├── style.css
│   ├── utils/
│   │   ├── finance.js           # PL計算・変動費計算・3ヶ月平均ロジック
│   │   └── periods.js           # 期間キー操作ユーティリティ
│   └── components/
│       ├── PortalMenu.vue       # 3モードカード選択画面
│       ├── common/
│       │   ├── AppHeader.vue
│       │   ├── AppFooter.vue
│       │   ├── LoadingOverlay.vue
│       │   ├── PinAuth.vue
│       │   └── ConfirmDialog.vue
│       └── apps/
│           ├── PLApp.vue        # (1) PLモード（シングルページ・フィルター統合）
│           ├── InputApp.vue     # (2) 月次入力モード（全店舗一括フロー）
│           └── SettingsApp.vue  # (3) 設定モード（バージョン管理・改定履歴）
├── supabase/
│   ├── DB_MIGRATION.sql                     # Phase 1: pe_* 4テーブル作成
│   ├── DB_MIGRATION_revision_20260517.sql   # Phase 5: 売上分離・カラム整理
│   ├── DB_MIGRATION_versioned_settings.sql  # Phase 5+: 設定バージョン管理テーブル追加
│   ├── DB_MIGRATION_enable_rls_20260517.sql # Phase 5+: 全テーブルRLS有効化
│   └── SEED_store_settings_defaults.sql     # フォールバック用デフォルト値投入
└── .env.local                   # 環境変数（gitignore済み）
```

## データベース設計

### pe_store_settings（店舗別固定費・定率）
```sql
CREATE TABLE pe_store_settings (
  store_id bigint PRIMARY KEY REFERENCES stores(id),
  fixed_rent numeric DEFAULT 0,
  fixed_utilities numeric DEFAULT 0,
  fixed_sundries numeric DEFAULT 0,
  payment_fee_rate numeric DEFAULT 0.025  -- 決済手数料率（totalSalesAfterTax連動）
);
```
> `fixed_payment_fee`（固定額）・`physical_profit_margin` は廃止済み。

### pe_company_settings（全社共通費・シングルトン）
```sql
CREATE TABLE pe_company_settings (
  id integer PRIMARY KEY DEFAULT 1,
  exec_remuneration numeric DEFAULT 0,
  debt_repayment numeric DEFAULT 0
);
```
> 役員報酬は販管費内・全社集計時のみ計上。借入返済は営業利益から差し引き純現金収支を算出。

### pe_monthly_records（月次実績）
```sql
CREATE TABLE pe_monthly_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id bigint REFERENCES stores(id),
  period_key integer NOT NULL,        -- YYYYMM
  service_sales numeric DEFAULT 0,    -- 提供売上（税込）
  merchandise_sales numeric DEFAULT 0, -- 物販売上（税込）
  labor_cost numeric DEFAULT 0,
  UNIQUE(store_id, period_key)
);
```
> 旧 `total_sales` は `service_sales` にリネーム。`rent` / `payment_fee` / `utilities` / `sundries` は廃止（設定値・計算値に移行）。

### pe_benchmarks（目標値）
```sql
CREATE TABLE pe_benchmarks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id bigint REFERENCES stores(id),  -- NULLは全社共通
  item_name text NOT NULL,
  target_value numeric,
  is_percentage boolean DEFAULT true
);
```
> `item_name` の値: `labor_rate` / `gross_profit_margin` / `operating_profit_margin` / `cost_ratio`

### 設定バージョン管理テーブル（Phase 5+追加）

設定3種を `effective_from`（YYYYMM）付きで改定履歴管理。PL計算時は `effective_from <= periodKey` の最新行を取得し、行がなければ旧テーブルにフォールバックする。

```sql
CREATE TABLE pe_store_settings_revisions (
  id             bigserial PRIMARY KEY,
  store_id       bigint NOT NULL REFERENCES stores(id),
  effective_from int NOT NULL,
  fixed_rent numeric, fixed_utilities numeric,
  fixed_sundries numeric, payment_fee_rate numeric,
  note text, created_at timestamptz DEFAULT now(),
  UNIQUE(store_id, effective_from)
);

CREATE TABLE pe_company_settings_revisions (
  id             bigserial PRIMARY KEY,
  effective_from int NOT NULL UNIQUE,
  exec_remuneration numeric, debt_repayment numeric,
  note text, created_at timestamptz DEFAULT now()
);

CREATE TABLE pe_benchmarks_revisions (
  id             bigserial PRIMARY KEY,
  effective_from int NOT NULL UNIQUE,
  labor_rate numeric, gross_profit_margin numeric,
  operating_profit_margin numeric, cost_ratio numeric,
  note text, created_at timestamptz DEFAULT now()
);
```
> `pe_benchmarks_revisions` は4指標を1行に集約（`pe_benchmarks` の item_name 1行ごと方式とは異なる）。

## 財務ロジック（src/utils/finance.js）

| 指標 | 計算式 |
|------|--------|
| 税込み総売上 | `service_sales + merchandise_sales` |
| 消費税 | `totalSales × (1/11)` |
| 税引き後総売上 | `totalSales × (10/11)` |
| 物販フレーバー原価 | `merchandise_sales × 0.89` |
| 原価合計 | `flavorCost + charcoalCost + drinkCost + merchandiseFlavorCost` |
| 粗利 | `totalSalesAfterTax − costTotal` |
| 決済手数料 | `totalSalesAfterTax × payment_fee_rate` |
| 販管費合計 | `rent + laborCost + paymentFee + utilities + sundries + execRemuneration`（全社のみ役員報酬含む）|
| 営業利益 | `grossProfit − sgaTotal` |
| 純現金収支 | `operatingProfit − debtRepayment`（全社のみ）|
| 労働分配率 | `laborCost / grossProfit`（grossProfit > 0 のみ）|

## デプロイフロー

```bash
# obsidian-vault の main ブランチにコミット後
git subtree push --prefix=V-PEACH V-PEACH main
# → GitHub daiki100325/V-PEACH main に push
# → Cloudflare Pages が自動ビルド・デプロイ
```

## Context
- Supabase プロジェクトは V-MINT 2.0 と共用（moejgsremxdksmzrowpw）
- `pe_` プレフィックスで既存テーブルと分離
- `.env.local` は gitignore 済み。Cloudflare環境変数で本番設定
- 全 `pe_*` テーブルで RLS 有効（anon 全許可ポリシー）。URL非公開・PIN認証前提のため全許可で既存動作を維持
- ER 図・V-MINT との参照関係: [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/notes/V-PEACH_requirements]]
- [[V-PEACH/notes/V-PEACH_release-plan]]

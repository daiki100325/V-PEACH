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
│           ├── PLApp.vue        # (1) PLモード
│           ├── InputApp.vue     # (2) 月次入力モード
│           └── SettingsApp.vue  # (3) 設定モード
├── DB_MIGRATION.sql             # Supabase実行用マイグレーション
└── .env.local                   # 環境変数（gitignore済み）
```

## データベース設計

### pe_store_settings（店舗別固定費）
```sql
CREATE TABLE pe_store_settings (
  store_id bigint PRIMARY KEY REFERENCES stores(id),  -- stores.idがbigintのためuuidから変更
  fixed_rent numeric DEFAULT 0,
  fixed_utilities numeric DEFAULT 0,
  fixed_sundries numeric DEFAULT 0,
  fixed_payment_fee numeric DEFAULT 0,
  physical_profit_margin numeric DEFAULT 0.1
);
```

### pe_company_settings（全社共通費・シングルトン）
```sql
CREATE TABLE pe_company_settings (
  id integer PRIMARY KEY DEFAULT 1,
  exec_remuneration numeric DEFAULT 0,
  debt_repayment numeric DEFAULT 0
);
```
> 役員報酬・借入返済は全社集計時のみ1回差し引く。店舗別PLには含めない。

### pe_monthly_records（月次実績）
```sql
CREATE TABLE pe_monthly_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id bigint REFERENCES stores(id),
  period_key integer NOT NULL,   -- YYYYMM
  total_sales numeric DEFAULT 0,
  labor_cost numeric DEFAULT 0,
  payment_fee numeric,           -- NULLなら pe_store_settings.fixed_payment_fee を使用
  utilities numeric,
  sundries numeric,
  rent numeric,
  UNIQUE(store_id, period_key)
);
```

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

### pe_merchandise_price_masters（物販販売値改定履歴）
```sql
CREATE TABLE pe_merchandise_price_masters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  effective_from integer NOT NULL UNIQUE,  -- YYYYMM
  price_per_unit numeric NOT NULL,
  note text
);
```
> V-MINTの `cost_price_masters` と同パターン。次の改定まで価格維持。

### pe_merchandise_sales_view（物販販売数量・参照用）
```sql
CREATE VIEW pe_merchandise_sales_view AS
SELECT cr.store_id, cr.period_key,
  COALESCE(SUM(fbs.merch_count), 0) + COALESCE(SUM(fbs.merch_count_secondary), 0) AS total_merch_qty
FROM cost_reports cr
LEFT JOIN flavor_brand_sales fbs ON fbs.report_id = cr.id
GROUP BY cr.store_id, cr.period_key;
```

## 財務ロジック（src/utils/finance.js）

| 指標 | 計算式 |
|------|--------|
| 物販売上 | 物販販売数量 × pe_merchandise_price_masters.price_per_unit |
| 提供売上 | 総売上 − 物販売上 |
| 物販売益 | 物販売上 × physical_profit_margin |
| フレーバー変動費 | 提供消費g × cost_price_masters.price_flavor_per_g |
| 炭変動費 | 炭消費kg × cost_price_masters.price_charcoal_per_kg |
| ジュース変動費 | drink_orders.amount の合計 |
| 粗利 | 総売上 − 変動費合計 |
| 労働分配率 | 人件費 / 粗利 |
| 営業利益 | 粗利 − 固定費合計 |
| 最終会社手残り | 営業利益 + 物販売益 − 役員報酬 − 借入返済（全社のみ） |

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

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/notes/V-PEACH_requirements]]
- [[V-PEACH/notes/V-PEACH_release-plan]]

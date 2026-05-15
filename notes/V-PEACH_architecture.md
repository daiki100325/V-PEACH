---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — Architecture

## Summary
- Vue3/Vite フロントエンド + Supabase（V-MINT 2.0と同一プロジェクト）+ Cloudflare Pages
- V-MINT 2.0のテーブルをPostgreSQL View経由で参照し、フロント側ロジックを軽量化

## スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | Vue 3 + Vite + Tailwind CSS |
| チャート | Chart.js（推移グラフ） |
| Backend | Supabase (PostgreSQL) |
| Infra | Cloudflare Pages |
| V-MINT連携 | PostgreSQL View（`brand_inventory_logs` / `sales_reports` 参照） |

## データベース拡張

```sql
-- 月次実績データ
CREATE TABLE pe_monthly_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id uuid REFERENCES stores(id),
  period_key char(7),              -- YYYY-MM
  total_sales numeric,
  labor_cost numeric,
  shisha_sales_actual numeric,     -- 自動計算結果のスナップショット
  other_costs_actual jsonb         -- 決済手数料などの内訳
);

-- 店舗別デフォルト設定
CREATE TABLE pe_store_settings (
  store_id uuid PRIMARY KEY REFERENCES stores(id),
  fixed_rent numeric,
  fixed_utilities numeric,
  fixed_sundries numeric,
  exec_remuneration numeric,
  debt_repayment numeric,
  physical_profit_margin numeric DEFAULT 0.1
);

-- 目標値（ベンチマーク）
CREATE TABLE pe_benchmarks (
  store_id uuid REFERENCES stores(id),
  item_name text,                  -- 'labor_rate', 'cost_rate' etc
  target_value numeric,
  is_percentage boolean DEFAULT true
);
```

## Context
- Supabase プロジェクトは V-MINT 2.0 と共用。新規テーブルは `pe_` プレフィックスで分離
- V-MINT 2.0 の物販データ（brand_sales_qty）はView集計でフロントから直接参照しない

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/notes/V-PEACH_requirements]]

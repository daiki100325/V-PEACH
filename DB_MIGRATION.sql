-- V-PEACH DB Migration
-- Supabase プロジェクト: moejgsremxdksmzrowpw (V-MINT 2.0と共用)
-- 実行場所: Supabase Dashboard > SQL Editor
-- 実行前に stores テーブルの存在を確認すること

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 店舗別固定費設定
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_store_settings (
  store_id bigint PRIMARY KEY REFERENCES stores(id),
  fixed_rent numeric DEFAULT 0,
  fixed_utilities numeric DEFAULT 0,
  fixed_sundries numeric DEFAULT 0,
  fixed_payment_fee numeric DEFAULT 0,
  physical_profit_margin numeric DEFAULT 0.1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 全社共通固定費（シングルトン id=1）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_company_settings (
  id integer PRIMARY KEY DEFAULT 1,
  exec_remuneration numeric DEFAULT 0,
  debt_repayment numeric DEFAULT 0,
  CONSTRAINT pe_company_settings_single_row CHECK (id = 1)
);
-- 初期レコードを挿入（冪等）
INSERT INTO pe_company_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 月次実績（店舗別）
--    各経費カラムがNULLの場合は pe_store_settings の固定値を使用（フロント側で解決）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_monthly_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id bigint REFERENCES stores(id),
  period_key integer NOT NULL,   -- YYYYMM（例: 202605）
  total_sales numeric DEFAULT 0,
  labor_cost numeric DEFAULT 0,
  payment_fee numeric,           -- NULLなら pe_store_settings.fixed_payment_fee を使用
  utilities numeric,             -- NULLなら pe_store_settings.fixed_utilities を使用
  sundries numeric,              -- NULLなら pe_store_settings.fixed_sundries を使用
  rent numeric,                  -- NULLなら pe_store_settings.fixed_rent を使用
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, period_key)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ベンチマーク目標値
--    store_id = NULL は全社共通ベンチマーク
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_benchmarks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id bigint REFERENCES stores(id),
  item_name text NOT NULL,
  target_value numeric,
  is_percentage boolean DEFAULT true,
  UNIQUE NULLS NOT DISTINCT (store_id, item_name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 物販販売値改定履歴
--    V-MINTの cost_price_masters と同パターン
--    effective_from: 適用開始月（YYYYMM整数）
--    次の改定が登録されるまでその価格が維持される
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_merchandise_price_masters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  effective_from integer NOT NULL UNIQUE,  -- YYYYMM
  price_per_unit numeric NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 物販販売数量参照View
--    V-MINTの flavor_brand_sales（cost_reportsに紐付く）から月次の物販販売数量を集計
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW pe_merchandise_sales_view AS
SELECT
  cr.store_id,
  cr.period_key,
  COALESCE(SUM(fbs.merch_count), 0) + COALESCE(SUM(fbs.merch_count_secondary), 0) AS total_merch_qty
FROM cost_reports cr
LEFT JOIN flavor_brand_sales fbs ON fbs.report_id = cr.id
GROUP BY cr.store_id, cr.period_key;

-- ─────────────────────────────────────────────────────────────────────────────
-- 確認クエリ（実行後に動作確認用）
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'pe_%';
-- SELECT * FROM pe_company_settings;

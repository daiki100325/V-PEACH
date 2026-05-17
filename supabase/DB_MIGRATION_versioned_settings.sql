-- V-PEACH 設定値バージョン管理テーブル追加
-- 実行場所: Supabase Dashboard > SQL Editor
-- 概要: 店舗別固定費・全社共通費・ベンチマーク目標値を effective_from(YYYYMM) 付きで履歴管理する

-- ─────────────────────────────────────────────────────────────────────────────
-- [1] 店舗別固定費 改定履歴
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_store_settings_revisions (
  id             bigserial PRIMARY KEY,
  store_id       bigint NOT NULL REFERENCES stores(id),
  effective_from int NOT NULL,
  fixed_rent          numeric NOT NULL DEFAULT 0,
  fixed_utilities     numeric NOT NULL DEFAULT 0,
  fixed_sundries      numeric NOT NULL DEFAULT 0,
  payment_fee_rate    numeric NOT NULL DEFAULT 0.025,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, effective_from)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- [2] 全社共通費 改定履歴
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_company_settings_revisions (
  id             bigserial PRIMARY KEY,
  effective_from int NOT NULL UNIQUE,
  exec_remuneration  numeric NOT NULL DEFAULT 0,
  debt_repayment     numeric NOT NULL DEFAULT 0,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- [3] ベンチマーク目標値 改定履歴（4指標を1行に集約）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_benchmarks_revisions (
  id             bigserial PRIMARY KEY,
  effective_from int NOT NULL UNIQUE,
  labor_rate              numeric,
  gross_profit_margin     numeric,
  operating_profit_margin numeric,
  cost_ratio              numeric,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- [4] 既存データを初期改定として移行（effective_from = 202501）
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO pe_store_settings_revisions
  (store_id, effective_from, fixed_rent, fixed_utilities, fixed_sundries, payment_fee_rate, note)
SELECT store_id, 202501, fixed_rent, fixed_utilities, fixed_sundries, payment_fee_rate, '移行時の初期設定'
FROM pe_store_settings
ON CONFLICT (store_id, effective_from) DO NOTHING;

INSERT INTO pe_company_settings_revisions
  (effective_from, exec_remuneration, debt_repayment, note)
SELECT 202501, exec_remuneration, debt_repayment, '移行時の初期設定'
FROM pe_company_settings WHERE id = 1
ON CONFLICT (effective_from) DO NOTHING;

INSERT INTO pe_benchmarks_revisions
  (effective_from, labor_rate, gross_profit_margin, operating_profit_margin, cost_ratio, note)
SELECT
  202501,
  MAX(CASE WHEN item_name = 'labor_rate'              THEN target_value END),
  MAX(CASE WHEN item_name = 'gross_profit_margin'     THEN target_value END),
  MAX(CASE WHEN item_name = 'operating_profit_margin' THEN target_value END),
  MAX(CASE WHEN item_name = 'cost_ratio'              THEN target_value END),
  '移行時の初期設定'
FROM pe_benchmarks WHERE store_id IS NULL
ON CONFLICT (effective_from) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 確認クエリ
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT * FROM pe_store_settings_revisions ORDER BY store_id, effective_from;
-- SELECT * FROM pe_company_settings_revisions ORDER BY effective_from;
-- SELECT * FROM pe_benchmarks_revisions ORDER BY effective_from;

-- ============================================================
-- V-PEACH 人件費計算ロジック移行マイグレーション
-- 実施日: 2026-05-20
-- 目的: シフト枠数による人件費自動按分方式への移行
-- ============================================================

-- 1. pe_monthly_records にシフト枠数 4列を追加
ALTER TABLE pe_monthly_records
  ADD COLUMN IF NOT EXISTS part_time_slots_6h   numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS part_time_slots_7_5h numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ryo_slots_6h         numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ryo_slots_7_5h       numeric DEFAULT 0;

-- 2. pe_monthly_company_records テーブル新規作成（全社単位の月次変動人件費総額）
CREATE TABLE IF NOT EXISTS pe_monthly_company_records (
  period_key             integer PRIMARY KEY,
  total_variable_payroll numeric DEFAULT 0,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- 3. pe_store_settings に固定給合計列を追加
ALTER TABLE pe_store_settings
  ADD COLUMN IF NOT EXISTS fixed_salary_total numeric DEFAULT 0;

-- 4. pe_store_settings_revisions に固定給合計列を追加
ALTER TABLE pe_store_settings_revisions
  ADD COLUMN IF NOT EXISTS fixed_salary_total numeric DEFAULT 0;

-- 5. pe_company_settings に社長代替時給列を追加
ALTER TABLE pe_company_settings
  ADD COLUMN IF NOT EXISTS ryo_hourly_rate numeric DEFAULT 1300;

-- 6. pe_company_settings_revisions に社長代替時給列を追加
ALTER TABLE pe_company_settings_revisions
  ADD COLUMN IF NOT EXISTS ryo_hourly_rate numeric DEFAULT 1300;

-- ============================================================
-- 注意: pe_monthly_records.labor_cost は互換性のため残す。
-- フロントは新方式（シフト枠按分）を優先し、
-- pe_monthly_company_records 行がない過去月のみ labor_cost を参照する。
-- ============================================================

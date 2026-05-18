-- ベンチマーク指標に F比・L比・R比 カラムを追加
-- 2026-05-18: gross_profit_margin / cost_ratio を UI から除外し、
--             F比・L比・R比・営業利益率・労働分配率の5指標に変更

ALTER TABLE pe_benchmarks_revisions
  ADD COLUMN IF NOT EXISTS f_ratio numeric,
  ADD COLUMN IF NOT EXISTS l_ratio numeric,
  ADD COLUMN IF NOT EXISTS r_ratio numeric;

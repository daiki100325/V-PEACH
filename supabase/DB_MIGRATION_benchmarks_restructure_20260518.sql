-- pe_benchmarks を EAV形式からフラット形式に再設計
-- pe_company_settings と同パターン（シングルトン id=1）
-- store_id / item_name / target_value / is_percentage を廃止

DROP TABLE IF EXISTS pe_benchmarks CASCADE;

CREATE TABLE pe_benchmarks (
  id                      integer PRIMARY KEY DEFAULT 1,
  f_ratio                 numeric,
  l_ratio                 numeric,
  r_ratio                 numeric,
  operating_profit_margin numeric,
  labor_rate              numeric,
  CONSTRAINT pe_benchmarks_single_row CHECK (id = 1)
);

-- RLS 再設定（DB_MIGRATION_enable_rls_20260517.sql と同ポリシー）
ALTER TABLE pe_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_benchmarks FOR ALL TO anon USING (true) WITH CHECK (true);

-- シングルトン行を挿入（値は SEED ファイルで投入）
INSERT INTO pe_benchmarks (id) VALUES (1) ON CONFLICT DO NOTHING;

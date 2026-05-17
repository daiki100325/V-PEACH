-- RLS 有効化（Option A: anon に全操作を許可）
-- URL非公開・信頼ユーザー前提の内部ツール向け設定
-- すべてのテーブルで警告を解消しつつ既存動作を維持する

-- pe_store_settings
ALTER TABLE pe_store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_store_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- pe_store_settings_revisions
ALTER TABLE pe_store_settings_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_store_settings_revisions FOR ALL TO anon USING (true) WITH CHECK (true);

-- pe_company_settings
ALTER TABLE pe_company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_company_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- pe_company_settings_revisions
ALTER TABLE pe_company_settings_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_company_settings_revisions FOR ALL TO anon USING (true) WITH CHECK (true);

-- pe_monthly_records
ALTER TABLE pe_monthly_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_monthly_records FOR ALL TO anon USING (true) WITH CHECK (true);

-- pe_benchmarks
ALTER TABLE pe_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_benchmarks FOR ALL TO anon USING (true) WITH CHECK (true);

-- pe_benchmarks_revisions
ALTER TABLE pe_benchmarks_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_benchmarks_revisions FOR ALL TO anon USING (true) WITH CHECK (true);

-- ベンチマーク デフォルト値シード（pe_benchmarks テーブル・フラット形式）
-- pe_benchmarks_revisions にデータがない場合のフォールバック値
-- NULL の項目のみ更新（既存値を上書きしない）

UPDATE pe_benchmarks
SET
  f_ratio                 = COALESCE(f_ratio, 0.20),
  l_ratio                 = COALESCE(l_ratio, 0.30),
  r_ratio                 = COALESCE(r_ratio, 0.15),
  operating_profit_margin = COALESCE(operating_profit_margin, 0.30),
  labor_rate              = COALESCE(labor_rate, 0.40)
WHERE id = 1;

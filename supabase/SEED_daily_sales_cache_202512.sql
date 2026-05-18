-- V-PEACH 日次売上キャッシュ 初回データ投入（2025年12月分）
-- 実行日: 2026-05-18
-- 実行場所: Supabase Dashboard > SQL Editor
-- 前提:    DB_MIGRATION_daily_sales_cache_20260518.sql を先に実行済みであること
-- 参照:    V-PEACH/notes/V-PEACH_sales-import-plan.md § 2.2.3
-- 概要:
--   本アプリは 2026年1月分から記録を開始する。
--   2026年1月度（馬場本店: 2025-12-25 〜 2026-01-29 等）の事業月度は
--   前月最終盤の日次データを含むため、それを pe_daily_sales_cache に
--   事前投入しておく必要がある。
--   2025年12月の Airレジ CSV から店舗ごとに日次レコードを upsert する。
--   2026年1月度のインポート末尾で「start_date より古いレコード」が削除されるが、
--   start_date 以降（12/25〜12/29 等）は自然に残るためそれで足りる。
--
-- データソース:
--   V-PEACH/csv/売上集計_baba-main_20251201-20251231.csv
--   V-PEACH/csv/売上集計_baba-2nd_20251201-20251231.csv
--   V-PEACH/csv/売上集計_nakano_20251201-20251231.csv
--
-- 投入件数:
--   baba_main: 25 行（休業日除く）
--   baba_2nd:  25 行（休業日除く）
--   nakano:    25 行（休業日除く）
--   合計:      75 行

INSERT INTO pe_daily_sales_cache (store_id, sale_date, discount_amount, gross_sales, customer_count) VALUES
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-01', 300, 62400, 18),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-03', 0, 91300, 23),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-04', 600, 42400, 15),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-05', 0, 56200, 18),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-06', 400, 40800, 15),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-07', 200, 75700, 19),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-08', 600, 57500, 19),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-10', 0, 54100, 17),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-11', 600, 44800, 15),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-12', 700, 39100, 12),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-13', 0, 59800, 19),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-14', 400, 43900, 14),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-15', 600, 62200, 21),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-17', 300, 78500, 24),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-18', 0, 35600, 11),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-19', 0, 74000, 23),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-20', 0, 48900, 17),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-21', 0, 93700, 28),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-22', 400, 51300, 18),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-24', 600, 64300, 21),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-25', 300, 61000, 18),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-26', 0, 40900, 14),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-27', 0, 76700, 27),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-28', 600, 75200, 25),
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), '2025-12-29', 200, 85200, 25),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-01', 900, 87500, 28),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-03', 600, 74500, 28),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-04', 900, 89400, 30),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-05', 900, 91500, 34),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-06', 400, 111500, 41),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-07', 1000, 86650, 33),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-08', 600, 74900, 27),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-10', 300, 86200, 29),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-11', 0, 89000, 28),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-12', 300, 71400, 24),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-13', 0, 92700, 24),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-14', 2100, 97300, 35),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-15', 0, 62200, 21),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-17', 1200, 96700, 35),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-18', 300, 90800, 29),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-19', 300, 77900, 25),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-20', 0, 92100, 34),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-21', 600, 84700, 33),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-22', 300, 73300, 23),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-24', 900, 93300, 32),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-25', 0, 69700, 26),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-26', 1200, 99700, 33),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-27', 900, 102800, 36),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-28', 1700, 112600, 40),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), '2025-12-29', 2100, 120000, 35),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-01', 0, 85300, 26),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-03', 0, 58700, 23),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-04', 0, 60800, 23),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-05', 500, 59100, 22),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-06', 600, 127000, 44),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-07', 0, 120600, 45),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-08', 300, 44100, 15),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-10', 600, 92300, 28),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-11', 0, 64800, 23),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-12', 0, 80200, 20),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-13', 600, 108600, 37),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-14', 300, 123700, 42),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-15', 0, 76700, 24),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-17', 300, 96800, 32),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-18', 0, 55200, 19),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-19', 0, 86300, 30),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-20', 1100, 117800, 48),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-21', 300, 120500, 41),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-22', 1700, 96800, 34),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-24', 1100, 90000, 39),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-25', 0, 62500, 22),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-26', 600, 108900, 36),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-27', 300, 111400, 37),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-28', 1800, 145100, 40),
  ((SELECT id FROM stores WHERE store_key = 'nakano'), '2025-12-29', 500, 148100, 52)
ON CONFLICT (store_id, sale_date) DO UPDATE SET
  discount_amount = EXCLUDED.discount_amount,
  gross_sales     = EXCLUDED.gross_sales,
  customer_count  = EXCLUDED.customer_count,
  imported_at     = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 確認クエリ
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT s.store_key, COUNT(*) AS days, SUM(c.discount_amount) AS total_discount
--   FROM pe_daily_sales_cache c JOIN stores s ON s.id = c.store_id
--  WHERE c.sale_date BETWEEN '2025-12-01' AND '2025-12-31'
--  GROUP BY s.store_key ORDER BY s.store_key;
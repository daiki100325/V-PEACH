-- V-PEACH 売上・原価体系 改修マイグレーション
-- 実行日: 2026-05-17
-- 実行場所: Supabase Dashboard > SQL Editor
-- 参照: V-PEACH/notes/V-PEACH_revision-plan.md § 5. DB スキーマ変更
-- 注意: テストデータのみのため既存データとの互換性は考慮しない。上から順に実行すること。

-- ─────────────────────────────────────────────────────────────────────────────
-- [1] pe_monthly_records: total_sales → service_sales リネーム
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE pe_monthly_records
  RENAME COLUMN total_sales TO service_sales;

-- ─────────────────────────────────────────────────────────────────────────────
-- [2] pe_monthly_records: 物販売上カラム追加
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE pe_monthly_records
  ADD COLUMN merchandise_sales numeric DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- [3] pe_monthly_records: 月次入力から廃止するカラムを削除
--     （家賃・決済手数料・光熱費・雑費はすべて pe_store_settings の設定値から自動適用）
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE pe_monthly_records
  DROP COLUMN IF EXISTS rent,
  DROP COLUMN IF EXISTS payment_fee,
  DROP COLUMN IF EXISTS utilities,
  DROP COLUMN IF EXISTS sundries;

-- ─────────────────────────────────────────────────────────────────────────────
-- [4] pe_store_settings: 廃止カラムを削除
--     physical_profit_margin → 物販フレーバー原価を一律 89% 固定とするため不要
--     fixed_payment_fee      → 決済手数料を売上連動の率に変更するため廃止
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE pe_store_settings
  DROP COLUMN IF EXISTS physical_profit_margin;

ALTER TABLE pe_store_settings
  DROP COLUMN IF EXISTS fixed_payment_fee;

-- ─────────────────────────────────────────────────────────────────────────────
-- [5] pe_store_settings: 決済手数料率カラムを追加
--     UI 入力は %（例: 2.5）、DB 保存は小数値（例: 0.025）
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE pe_store_settings
  ADD COLUMN payment_fee_rate numeric DEFAULT 0.025;

-- ─────────────────────────────────────────────────────────────────────────────
-- [6] pe_merchandise_price_masters: テーブル削除
--     物販売上を月次直接入力に変更したため単価マスタ不要
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS pe_merchandise_price_masters;

-- ─────────────────────────────────────────────────────────────────────────────
-- [7] pe_merchandise_sales_view: ビュー削除
--     物販販売数量の集計が不要になったため廃止
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS pe_merchandise_sales_view;

-- ─────────────────────────────────────────────────────────────────────────────
-- 確認クエリ（実行後の動作確認用）
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'pe_monthly_records' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'pe_store_settings' ORDER BY ordinal_position;

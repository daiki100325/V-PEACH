-- V-PEACH 日次売上キャッシュ追加マイグレーション
-- 実行日: 2026-05-18
-- 実行場所: Supabase Dashboard > SQL Editor
-- 参照: V-PEACH/notes/V-PEACH_sales-import-plan.md § 5.3
-- 概要:
--   Airレジ日別売上CSVを「店舗 × 日付」単位でキャッシュするテーブルを新設。
--   事業月度が前月最終盤を含む（例: 馬場本店 2026年3月度 = 2026-02-26 〜 2026-03-22）ため、
--   素直に運用すると毎月「前月分 + 当月分」の2ヶ月分CSVが必要になり手順が倍化する。
--   前月分の日次データをDBに保持しておくことで、毎月「当月CSV」1ファイル/店舗だけで
--   事業月度ベースの割引総額が集計できる。
--   インポート時に「当月度start_dateより古いレコード」を自動削除するため、
--   常時90行前後（3店舗 × 30日）に収まる設計。

-- ─────────────────────────────────────────────────────────────────────────────
-- [1] pe_daily_sales_cache テーブル作成
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_daily_sales_cache (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        bigint NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sale_date       date NOT NULL,
  discount_amount numeric NOT NULL DEFAULT 0,   -- 正の数で保持（CSVは負値だがABSで正規化）
  gross_sales     numeric,                       -- 日次総売上（任意・監査用）
  customer_count  integer,                       -- 客数（任意・監査用）
  raw_payload     jsonb,                         -- CSV原文（再計算用・任意）
  imported_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, sale_date)
);

CREATE INDEX IF NOT EXISTS idx_pe_daily_sales_cache_store_date
  ON pe_daily_sales_cache(store_id, sale_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- [2] RLS 有効化（既存テーブル群と同じ anon_all ポリシー）
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE pe_daily_sales_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_daily_sales_cache FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 確認クエリ（実行後の動作確認用）
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'pe_daily_sales_cache' ORDER BY ordinal_position;
-- SELECT * FROM pg_policies WHERE tablename = 'pe_daily_sales_cache';
-- SELECT * FROM pg_indexes WHERE tablename = 'pe_daily_sales_cache';

-- ============================================================
-- 認可状況モード — DB マイグレーション（認可済み銘柄 + 価格履歴）
-- 正本: V-PEACH/notes/V-PEACH_requirements.md（認可状況モード）
-- 適用: 2026-06-15 Supabase MCP 経由（migration: approval_status_tables_20260615）
-- 注意: 本ファイルは記録用。DB へは適用済みのため再実行しないこと
-- ============================================================

-- 銘柄マスタ
CREATE TABLE public.pe_approval_items (
  id            bigserial PRIMARY KEY,
  brand         text NOT NULL,                       -- ブランド名
  product_name  text NOT NULL,                       -- 名称
  package_size  text,                                -- 製品区分（容量・"100.0g 缶" 等。改行→空白正規化）
  origin_country text,                               -- 製造国
  approval_date date,                                 -- 認可日（CSV マスク "20XX/X/X" は null）
  current_price integer,                              -- 現行小売定価（円・税込）
  tobacco_class text NOT NULL DEFAULT 'パイプたばこ', -- 区分（常に パイプたばこ）
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (brand, product_name, package_size)          -- 変更認可マッチング/重複防止キー
);
ALTER TABLE public.pe_approval_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON public.pe_approval_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX idx_pe_approval_items_brand ON public.pe_approval_items (brand);

-- 価格変更履歴
CREATE TABLE public.pe_approval_price_history (
  id           bigserial PRIMARY KEY,
  item_id      bigint NOT NULL REFERENCES public.pe_approval_items(id) ON DELETE CASCADE,
  changed_on   date,                                 -- 変更日
  price_before integer,                               -- 変更前定価
  price_after  integer,                               -- 変更後定価（CSV 履歴は before のみの場合あり）
  source       text NOT NULL DEFAULT 'pdf_change',   -- 'csv_seed' | 'pdf_new' | 'pdf_change'
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.pe_approval_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON public.pe_approval_price_history FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE INDEX idx_pe_approval_price_history_item ON public.pe_approval_price_history (item_id);

-- 初期投入: scripts/seed_approval_items.mjs で
--   sample/製造たばこの小売定価の認可20251215 - パイプたばこ.csv を整形し supabase-js で bulk insert
--   （2026-06-15 実行: items=5526 / history=1659）。
-- current_price 導出規則: 小売定価(col6) ?? pair1価格(col8・日付なし=現行) ?? null。
-- 履歴規則: (変更日, 変更前定価) のペアを 1 イベントとし price_after = 1つ新しい価格。

-- ─── 追補（2026-06-15）: ブランド distinct RPC ＋ ブランド表記正規化 ───────────
-- (1) ブランド一覧 RPC（PostgREST の行上限 1000 で distinct が欠ける問題を回避）
--     migration: approval_brands_distinct_rpc_20260615 で適用済み
create or replace function public.get_approval_brands()
returns table(brand text) language sql stable as $$
  select distinct brand from public.pe_approval_items
  where brand is not null and brand <> '' order by brand
$$;
grant execute on function public.get_approval_brands() to anon;

-- (2) ブランド表記の正規化（大文字小文字・空白の揺れで同一ブランドが別扱いになる問題）
--     方針: UPPER + 連続空白を1つ + trim。Azure は "Azure hookah tobacco Black" 等の
--     ライン違いを "AZURE HOOKAH TOBACCO" に統合。execute_sql で適用済み（distinct 133→119）。
update public.pe_approval_items
set brand = case
      when upper(regexp_replace(btrim(brand),'\s+',' ','g')) like 'AZURE HOOKAH TOBACCO%'
      then 'AZURE HOOKAH TOBACCO'
      else upper(regexp_replace(btrim(brand),'\s+',' ','g')) end,
    updated_at = now()
where brand is distinct from (case
      when upper(regexp_replace(btrim(brand),'\s+',' ','g')) like 'AZURE HOOKAH TOBACCO%'
      then 'AZURE HOOKAH TOBACCO'
      else upper(regexp_replace(btrim(brand),'\s+',' ','g')) end);
-- 新規取込・再seed でも同方針を維持: api.js `normalizeBrand` / seed の normalizeBrand。

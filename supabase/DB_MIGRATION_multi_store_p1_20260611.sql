-- ============================================================
-- マルチストア改修 P1 — DB マイグレーション（additive・後方互換）
-- 正本: V-PEACH/notes/V-PEACH_multi-store-scaling-plan.md §4-1 / §6 P1
-- 適用: 2026-06-11 Supabase MCP 経由
--       （migration: multi_store_p1_stores_shift_rules_app_ui_settings）
-- 注意: 本ファイルは記録用。DB へは適用済みのため再実行しないこと
--       （ADD COLUMN / CREATE TABLE は IF NOT EXISTS なしの単発実行前提）
-- ============================================================

-- (a) stores 列追加
ALTER TABLE public.stores ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.stores ADD COLUMN display_order int;
ALTER TABLE public.stores ADD COLUMN store_type text NOT NULL DEFAULT 'shop';
ALTER TABLE public.stores ADD COLUMN closed_at date;
ALTER TABLE public.stores ADD CONSTRAINT stores_store_type_check CHECK (store_type IN ('shop','office'));

-- (b) pe_store_shift_rules（店舗別シフト枠時間・改定履歴付き／R8）
CREATE TABLE public.pe_store_shift_rules (
  id             bigserial PRIMARY KEY,
  store_id       bigint  NOT NULL REFERENCES public.stores(id),
  effective_from int     NOT NULL,           -- YYYYMM
  shift_type     text    NOT NULL CHECK (shift_type IN ('early','middle','late')),
  day_type       text    NOT NULL CHECK (day_type IN ('weekday','holiday')),
  hours          numeric NOT NULL,
  note           text,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (store_id, effective_from, shift_type, day_type)
);
ALTER TABLE public.pe_store_shift_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON public.pe_store_shift_rules FOR ALL TO anon USING (true) WITH CHECK (true);

-- (c) app_ui_settings（両アプリ共有 UI 状態・シングルトン／R3）
CREATE TABLE public.app_ui_settings (
  id                   integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  show_inactive_stores boolean NOT NULL DEFAULT false
);
ALTER TABLE public.app_ui_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON public.app_ui_settings FOR ALL TO anon USING (true) WITH CHECK (true);
INSERT INTO public.app_ui_settings (id) VALUES (1);

-- SEED: 既存4店舗の store_type / display_order
UPDATE public.stores SET store_type = 'office', display_order = 0 WHERE store_key = 'office';
UPDATE public.stores SET display_order = 1 WHERE store_key = 'baba_main';
UPDATE public.stores SET display_order = 2 WHERE store_key = 'nakano';
UPDATE public.stores SET display_order = 3 WHERE store_key = 'baba_2nd';

-- SEED: pe_store_shift_rules 初期世代（現行実装の再現・effective_from=202512）
-- 実態（pe_hrmos_segments 実データ + shiftImporter.js）: 早番7.5h / 中番6h / 遅番6h、
-- 馬場2号店のみ 遅番×土日祝 = 7.5h（applyBaba2ndLateHolidayBoost 相当）
-- ※計画書当初の「早番6h/中番7.5h」表記は実態と逆だったため実データ準拠で投入（計画書 §4-1 訂正済み）
INSERT INTO public.pe_store_shift_rules (store_id, effective_from, shift_type, day_type, hours, note)
SELECT s.id, 202512, v.shift_type, v.day_type,
       CASE WHEN s.store_key = 'baba_2nd' AND v.shift_type = 'late' AND v.day_type = 'holiday'
            THEN 7.5 ELSE v.hours END,
       '初期世代（現行ハードコード・pe_hrmos_segments 実データ再現）'
FROM public.stores s
CROSS JOIN (VALUES
  ('early',  'weekday', 7.5), ('early',  'holiday', 7.5),
  ('middle', 'weekday', 6.0), ('middle', 'holiday', 6.0),
  ('late',   'weekday', 6.0), ('late',   'holiday', 6.0)
) AS v(shift_type, day_type, hours)
WHERE s.store_key IN ('baba_main','nakano','baba_2nd');

-- ============================================================
-- 適用後検証（2026-06-11 実施済み・すべて OK）
-- 1) stores: 4行とも is_active=true / display_order 0-3 / office のみ store_type='office'
-- 2) pe_store_shift_rules: 18行（3店舗×6パターン）・baba_2nd late×holiday のみ 7.5
-- 3) app_ui_settings: id=1 / show_inactive_stores=false の1行
-- 4) 既存 RPC 回帰: fetch_stock_overview / fetch_dashboard_stock_overview /
--    fetch_request_inventory_data / fetch_transfer_flavors（202606）全て正常応答（各242行）
-- ============================================================

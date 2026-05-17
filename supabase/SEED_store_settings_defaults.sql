-- pe_store_settings デフォルト値の流し込み
-- 目的: pe_store_settings_revisions にフォールバックした際のデフォルト値を設定
-- 実行場所: Supabase Dashboard > SQL Editor
-- 実行前提: stores テーブルに store_key カラムが存在すること
--   baba_main = 馬場本店, nakano = 中野店, baba_2nd = 馬場2号店

INSERT INTO pe_store_settings (store_id, fixed_rent, fixed_utilities, fixed_sundries, payment_fee_rate)
VALUES
  ((SELECT id FROM stores WHERE store_key = 'baba_main'), 132000, 40000, 13000, 0.025),
  ((SELECT id FROM stores WHERE store_key = 'nakano'),    330000, 40000, 13000, 0.025),
  ((SELECT id FROM stores WHERE store_key = 'baba_2nd'), 206000, 40000, 13000, 0.025)
ON CONFLICT (store_id) DO UPDATE SET
  fixed_rent       = EXCLUDED.fixed_rent,
  fixed_utilities  = EXCLUDED.fixed_utilities,
  fixed_sundries   = EXCLUDED.fixed_sundries,
  payment_fee_rate = EXCLUDED.payment_fee_rate;

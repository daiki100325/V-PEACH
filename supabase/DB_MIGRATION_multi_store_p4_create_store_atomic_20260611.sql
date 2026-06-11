-- ============================================================================
-- マルチストア改修 P4: create_store_atomic RPC
-- 参照: notes/V-PEACH_multi-store-scaling-plan.md §4-4 / §6 P4
--
-- 新店舗追加ウィザード（一発確定）のサーバ側トランザクション。
-- stores 行 + 固定費設定（現行値 + 初期世代）+ シフト枠ルール（6パターン）を
-- 1 関数内で一括 insert する。plpgsql 関数は単一トランザクションで実行されるため、
-- いずれかの insert が失敗すれば全体がロールバックされ、
-- 「stores だけある半端な店舗」は構造的に生まれない（R7・§7 アトミック性）。
--
-- 適用: Supabase MCP（apply_migration）経由 — §5-3-4 書き込みルール（承認後実行）
-- ============================================================================

CREATE OR REPLACE FUNCTION create_store_atomic(
  p_store_key      text,    -- 店舗キー（英小文字始まり・英数字とアンダースコア。作成後は不変／R6）
  p_name           text,    -- 表示名（後から変更可）
  p_effective_from int,     -- 固定費・シフトルールの初期世代 YYYYMM（例: 202607）
  p_settings       jsonb,   -- { fixed_rent, fixed_utilities, fixed_sundries, payment_fee_rate, fixed_salary_total } 全キー必須
  p_shift_rules    jsonb    -- [{ shift_type, day_type, hours }, ...] early/middle/late × weekday/holiday の6行必須
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_store_id  bigint;
  v_order     int;
  v_rule      jsonb;
  v_count     int;
  v_key       text;
  v_required  text[] := ARRAY['fixed_rent','fixed_utilities','fixed_sundries','payment_fee_rate','fixed_salary_total'];
BEGIN
  -- ── バリデーション ────────────────────────────────────────────────
  IF p_store_key IS NULL OR p_store_key !~ '^[a-z][a-z0-9_]{1,29}$' THEN
    RAISE EXCEPTION 'store_key が不正です（英小文字始まり・英数字/アンダースコア・2〜30文字）: %', p_store_key;
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION '店舗名が空です';
  END IF;
  IF p_effective_from IS NULL OR p_effective_from < 202001 OR p_effective_from > 209912
     OR (p_effective_from % 100) < 1 OR (p_effective_from % 100) > 12 THEN
    RAISE EXCEPTION 'effective_from が不正です（YYYYMM）: %', p_effective_from;
  END IF;
  IF EXISTS (SELECT 1 FROM stores WHERE store_key = p_store_key) THEN
    RAISE EXCEPTION 'store_key は既に使用されています: %', p_store_key;
  END IF;

  -- 固定費設定: 5 項目すべて必須（R7 必須化・一発確定）
  FOREACH v_key IN ARRAY v_required LOOP
    IF NOT (p_settings ? v_key) OR (p_settings ->> v_key) IS NULL THEN
      RAISE EXCEPTION '固定費設定 % が未入力です', v_key;
    END IF;
    IF (p_settings ->> v_key)::numeric < 0 THEN
      RAISE EXCEPTION '固定費設定 % が負の値です: %', v_key, p_settings ->> v_key;
    END IF;
  END LOOP;

  -- シフトルール: early/middle/late × weekday/holiday の6パターン全部そろっていること（R7/R8）
  SELECT count(DISTINCT (r ->> 'shift_type') || '|' || (r ->> 'day_type'))
    INTO v_count
    FROM jsonb_array_elements(p_shift_rules) AS r
   WHERE (r ->> 'shift_type') IN ('early','middle','late')
     AND (r ->> 'day_type')   IN ('weekday','holiday')
     AND (r ->> 'hours')::numeric > 0;
  IF v_count IS DISTINCT FROM 6 OR jsonb_array_length(p_shift_rules) <> 6 THEN
    RAISE EXCEPTION 'シフト枠ルールは early/middle/late × weekday/holiday の6行が必須です（受領: %行・有効: %種）',
      jsonb_array_length(p_shift_rules), v_count;
  END IF;

  -- ── 一括 insert（失敗時は関数全体がロールバック）──────────────────
  -- 1. stores（常に shop・営業中・末尾の表示順）
  SELECT coalesce(max(display_order), 0) + 1 INTO v_order FROM stores;
  INSERT INTO stores (store_key, name, is_active, display_order, store_type, closed_at)
  VALUES (p_store_key, trim(p_name), true, v_order, 'shop', NULL)
  RETURNING id INTO v_store_id;

  -- 2. 固定費設定（現行値テーブル: PL 計算の現行参照先）
  INSERT INTO pe_store_settings (store_id, fixed_rent, fixed_utilities, fixed_sundries, payment_fee_rate, fixed_salary_total)
  VALUES (
    v_store_id,
    (p_settings ->> 'fixed_rent')::numeric,
    (p_settings ->> 'fixed_utilities')::numeric,
    (p_settings ->> 'fixed_sundries')::numeric,
    (p_settings ->> 'payment_fee_rate')::numeric,
    (p_settings ->> 'fixed_salary_total')::numeric
  );

  -- 3. 固定費設定の初期世代（改定履歴: getActiveStoreSettings の参照先）
  INSERT INTO pe_store_settings_revisions
    (store_id, effective_from, fixed_rent, fixed_utilities, fixed_sundries, payment_fee_rate, fixed_salary_total, note)
  VALUES (
    v_store_id,
    p_effective_from,
    (p_settings ->> 'fixed_rent')::numeric,
    (p_settings ->> 'fixed_utilities')::numeric,
    (p_settings ->> 'fixed_sundries')::numeric,
    (p_settings ->> 'payment_fee_rate')::numeric,
    (p_settings ->> 'fixed_salary_total')::numeric,
    '新店舗作成時の初期設定（create_store_atomic）'
  );

  -- 4. シフト枠ルールの初期世代（6行）
  FOR v_rule IN SELECT * FROM jsonb_array_elements(p_shift_rules) LOOP
    INSERT INTO pe_store_shift_rules (store_id, effective_from, shift_type, day_type, hours, note)
    VALUES (
      v_store_id,
      p_effective_from,
      v_rule ->> 'shift_type',
      v_rule ->> 'day_type',
      (v_rule ->> 'hours')::numeric,
      '新店舗作成時の初期設定（create_store_atomic）'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_store_id,
    'store_key', p_store_key,
    'name', trim(p_name),
    'display_order', v_order
  );
END;
$$;

-- PostgREST（anon キー）から呼べるようにする（他テーブル同様 anon 全許可の運用）
GRANT EXECUTE ON FUNCTION create_store_atomic(text, text, int, jsonb, jsonb) TO anon, authenticated;

-- ============================================================
-- V-PEACH HRMOS シフト CSV 取込基盤マイグレーション
-- 実施日: 2026-05-25
-- 目的: HRMOS スタッフ/勤務区分マスタ + 日本祝日キャッシュの永続化
-- 参照: V-PEACH/notes/V-PEACH_shifts-csv-import-plan.md
-- ============================================================

-- ─── 1. HRMOS スタッフマスタ ────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_hrmos_staffs (
  hrmos_staff_id    integer PRIMARY KEY,             -- HRMOS 社員ID
  display_name      text NOT NULL,                   -- 姓名（例: "立花 弘行"）
  account_name      text,                            -- HRMOS ログインID（例: "vangvieng", "ryo"）
  role              text NOT NULL DEFAULT 'part_time',-- 'fixed_salary' | 'part_time' | 'owner_ryo'
  default_store_id  bigint REFERENCES stores(id),    -- 所属店舗（参考。按分は勤務区分側で判定）
  joined_on         date,
  left_on           date,
  note              text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_hrmos_staffs_role ON pe_hrmos_staffs(role);

-- ─── 2. HRMOS 勤務区分マスタ ────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_hrmos_segments (
  hrmos_segment_id   integer PRIMARY KEY,            -- HRMOS 勤務区分ID（例: 81）
  segment_name       text NOT NULL,                  -- "中野店 早番" 等
  store_id           bigint REFERENCES stores(id),   -- 馬場本店/中野店/馬場2号店/NULL（按分対象外）
  shift_type         text NOT NULL,                  -- 'early' | 'middle' | 'late' | 'allin' | 'misc'
  default_hours      numeric NOT NULL DEFAULT 0,     -- 7.5/6.0/11.5/0
  is_payroll_target  boolean NOT NULL DEFAULT true,  -- 按分対象か（false=倉庫業務/会議等/特殊枠）
  note               text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_hrmos_segments_store ON pe_hrmos_segments(store_id);
CREATE INDEX IF NOT EXISTS idx_pe_hrmos_segments_payroll ON pe_hrmos_segments(is_payroll_target);

-- ─── 3. 日本祝日キャッシュ ──────────────────────────────────
CREATE TABLE IF NOT EXISTS pe_jp_holidays (
  holiday_date  date PRIMARY KEY,
  holiday_name  text NOT NULL,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. 祝日マスタ取得状況メタ（シングルトン id=1） ───────────
CREATE TABLE IF NOT EXISTS pe_jp_holidays_meta (
  id                 integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_fetched_at    timestamptz,
  last_fetch_status  text,                          -- 'success' | 'failed'
  last_fetch_error   text,
  updated_at         timestamptz DEFAULT now()
);

INSERT INTO pe_jp_holidays_meta (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- ─── 5. RLS 有効化（既存 pe_* と同じ anon_all ポリシー） ─────
ALTER TABLE pe_hrmos_staffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_hrmos_staffs FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE pe_hrmos_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_hrmos_segments FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE pe_jp_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_jp_holidays FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE pe_jp_holidays_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON pe_jp_holidays_meta FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- 注意: 取込履歴 pe_hrmos_shift_imports は v2 で検討（初回実装はスキップ）
-- ============================================================

---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — テスト計画

> 作成日: 2026-05-17（最終更新: 2026-05-25 — HRMOS シフト CSV 取込基盤・人件費新方式・CSV/PL UI 改修まで反映）
> 対象: Phase 0〜HRMOS シフト CSV 取込（2026-05-25 完了分）後の一通り機能（設定 → CSV インポート / 月次入力 → PL分析）
> 前提: Supabase の `pe_*` テーブルはマイグレーション済みだが **レコードが空** の状態から開始

## 1. 目的とスコープ

| 項目 | 内容 |
|------|------|
| **目的** | 本番相当環境で「設定 → 入力（CSV / 手入力） → PL表示」が一連で動くことを確認し、人件費新方式（重みつき枠按分）・HRMOS シフト CSV 取込・トレンドチャート改修を含む現行ロジックを検証する |
| **対象** | PIN認証、ポータル、設定モード（店舗別固定費・全社共通費・ベンチマーク・HRMOS マスタ・祝日マスタ）、月次入力モード（CSV インポート / 手入力 / シフト CSV / 人件費A・B・C）、PLモード（月次 / 3ヶ月平均 / 年次、全社・店舗別、FLR比、Health Check、トレンドチャート） |
| **対象外** | 自動単体テスト（未整備）、パフォーマンス負荷試験、RLS ポリシー詳細監査、Cloudflare 本番デプロイ手順そのもの、holidays-jp API 障害時の長期挙動 |

## 2. テスト環境

### 2.1 起動方法

```bash
cd V-PEACH
npm install
npm run dev
```

ブラウザで `http://localhost:5173`（Vite デフォルト）を開く。

### 2.2 必須環境変数（`.env.local`）

| 変数 | 用途 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase プロジェクト URL |
| `VITE_SUPABASE_ANON_KEY` | anon キー |
| `VITE_PIN_SHA256` | PIN の SHA-256 ハッシュ（小文字 hex） |
| `VITE_PIN_SALT` | PIN ソルト |

未設定時は Supabase 接続エラーまたは PIN 認証不可。テスト開始前に `.env.local` の存在を確認する。

### 2.3 DB 前提確認（Supabase SQL Editor）

```sql
-- pe_* テーブル存在確認（人件費新方式・HRMOS シフト基盤含む）
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'pe_%'
ORDER BY table_name;
-- 期待（全11テーブル）:
--   pe_benchmarks / pe_benchmarks_revisions
--   pe_company_settings / pe_company_settings_revisions
--   pe_daily_sales_cache
--   pe_hrmos_segments / pe_hrmos_staffs
--   pe_jp_holidays / pe_jp_holidays_meta
--   pe_monthly_company_records
--   pe_monthly_records
--   pe_store_settings / pe_store_settings_revisions

-- 人件費新方式カラム確認（pe_monthly_records）
SELECT column_name FROM information_schema.columns
WHERE table_name = 'pe_monthly_records'
ORDER BY ordinal_position;
-- 期待: service_sales, merchandise_sales, labor_cost,
--       part_time_slots_6h, part_time_slots_7_5h, ryo_slots_6h, ryo_slots_7_5h

-- 全社月次人件費（新方式の按分分母用）
SELECT column_name FROM information_schema.columns
WHERE table_name = 'pe_monthly_company_records'
ORDER BY ordinal_position;
-- 期待: period_key, total_variable_payroll, created_at, updated_at

-- 固定給合計カラム確認（pe_store_settings / pe_store_settings_revisions 両方）
SELECT table_name, column_name FROM information_schema.columns
WHERE table_name IN ('pe_store_settings', 'pe_store_settings_revisions')
  AND column_name = 'fixed_salary_total';
-- 期待: 2行（両テーブルとも fixed_salary_total を持つ）

-- 社長代替時給カラム確認（pe_company_settings / pe_company_settings_revisions）
SELECT table_name, column_name FROM information_schema.columns
WHERE table_name IN ('pe_company_settings', 'pe_company_settings_revisions')
  AND column_name = 'ryo_hourly_rate';
-- 期待: 2行

-- pe_benchmarks_revisions の5指標カラム
SELECT column_name FROM information_schema.columns
WHERE table_name = 'pe_benchmarks_revisions'
ORDER BY ordinal_position;
-- 期待: f_ratio, l_ratio, r_ratio, operating_profit_margin, labor_rate を含む
--       （gross_profit_margin / cost_ratio は除外済み）

-- HRMOS マスタ（シフト CSV 取込前提）
SELECT
  (SELECT COUNT(*) FROM pe_hrmos_staffs)   AS staffs_count,
  (SELECT COUNT(*) FROM pe_hrmos_segments) AS segments_count,
  (SELECT COUNT(*) FROM pe_jp_holidays)    AS holidays_count;
-- 期待: 取込前は全0。SET-10/11/14 のテスト後に値が入る

-- 店舗マスタ（V-MINT 共用）
SELECT id, store_key, name FROM stores
WHERE store_key IN ('baba_main', 'nakano', 'baba_2nd')
ORDER BY name;
```

**期待する `store_key` 対応**（`api.js` の正規化含む）:

| UI キー | DB `store_key` | 表示名 |
|---------|----------------|--------|
| `baba` | `baba_main` | 馬場本店 |
| `nakano` | `nakano` | 中野店 |
| `baba_2nd` | `baba_2nd` | 馬場2号店 |

### 2.4 V-MINT 連携データの有無

PL の変動費（⑥⑦⑧）は **V-MINT の `cost_reports` / `flavor_brand_sales` / `drink_orders`** に依存する。

| 状況 | PL 上の挙動 | テスト方針 |
|------|-------------|------------|
| 対象月に `cost_reports` あり | フレーバー・炭・ジュース原価が自動反映 | **推奨**: 実データがある月で検証 |
| なし | 変動費 3 項目は **0** | 計算検証は物販原価・販管費中心で実施。別途「V-MINT あり」ケースを 1 ヶ月だけ追加 |

確認クエリ:

```sql
SELECT s.store_key, cr.period_key
FROM cost_reports cr
JOIN stores s ON s.id = cr.store_id
WHERE s.store_key IN ('baba_main', 'nakano', 'baba_2nd')
ORDER BY cr.period_key DESC
LIMIT 20;
```

---

## 3. テストデータ投入方針

**投入順序は必ず以下**。後段が前段のマスタに依存する。

```
[Phase A] 店舗固定費（pe_store_settings + pe_store_settings_revisions）※fixed_salary_total 含む
    ↓
[Phase B] 全社共通費（pe_company_settings + pe_company_settings_revisions）※ryo_hourly_rate 含む
    ↓
[Phase C] ベンチマーク（pe_benchmarks_revisions）※任意だが Health Check 検証に推奨
    ↓
[Phase D] 月次実績（pe_monthly_records）— SQL 一括 or UI 入力
[Phase D'] 全社月次人件費（pe_monthly_company_records）— 新方式テスト用（任意）
    ↓
[Phase E] HRMOS マスタ・祝日キャッシュ — UI から CSV 取込（SET-10/11/14 で実施）
    ↓
[Phase F] PL 画面で集計・表示・チャート確認
```

> **設定は revisions テーブルを優先参照**：PL/InputApp は `pe_*_revisions` を `effective_from <= periodKey` の最新行で取得する。旧フラットテーブル（`pe_store_settings` 等）はフォールバック用。テストでは両方に投入しておく（SQL ON CONFLICT で重複可）。

### 3.1 マスタデータ（Phase A〜C）

#### 店舗固定費（実運用値ベース・人件費新方式の固定給含む）

Source: [[V-PEACH/notes/V-PEACH_finance-spec]] §4

| 店舗 | `fixed_rent` | `fixed_utilities` | `fixed_sundries` | `payment_fee_rate` | `fixed_salary_total` |
|------|-----------:|----------------:|---------------:|------------------:|---------------------:|
| 馬場本店 | 132,000 | 40,000 | 13,000 | 0.025 | 300,000 |
| 中野店 | 330,000 | 40,000 | 13,000 | 0.025 | 500,000 |
| 馬場2号店 | 206,000 | 40,000 | 13,000 | 0.025 | 250,000 |

> `fixed_salary_total` は固定給メンバー（馬場本店:おの / 中野店:ばな+ぴー / 馬場2号店:つー 等）の月報酬合計。テスト用サンプル値。

#### 全社共通費（検証用サンプル）

| 項目 | 値 |
|------|---:|
| `exec_remuneration` | 550,000 |
| `debt_repayment` | 1,000,000 |
| `ryo_hourly_rate` | 1,300 |

#### ベンチマーク（Health Check 用・5指標）

| キー | 目標（UI 入力 %） | DB 保存値 | 良い方向 |
|------|------------------:|----------:|---------|
| `f_ratio` | 25 | 0.25 | 実績 ≤ 目標 |
| `l_ratio` | 35 | 0.35 | 実績 ≤ 目標 |
| `r_ratio` | 15 | 0.15 | 実績 ≤ 目標 |
| `operating_profit_margin` | 25 | 0.25 | 実績 ≥ 目標 |
| `labor_rate` | 50 | 0.50 | 実績 ≤ 目標 |

### 3.2 月次実績（Phase D / D'）

**テスト期間**: `202601`〜`202603`（3ヶ月分）を基本セット。年次・3ヶ月平均・トレンドチャート検証に使用。

#### パターン設計

| 目的 | 内容 |
|------|------|
| 店舗差 | 3 店舗で売上規模・人件費を変える |
| 物販あり/なし | 馬場2号店は `merchandise_sales = 0` で物販原価 0 を確認 |
| トレンド | 202601→202603 で提供売上を段階的に増加 |
| レガシー人件費 | 202601・202602 は `labor_cost` 直接値（`pe_monthly_company_records` 行なし）でフォールバック検証 |
| 新方式人件費 | 202603 のみ `pe_monthly_company_records` 行 + 枠数を投入し、新方式 PL を検証 |

#### 月次データ一覧（税込・円）

| period_key | 店舗 | service_sales | merchandise_sales | labor_cost | pt_slots 6h / 7.5h | ryo_slots 6h / 7.5h | 備考 |
|-----------:|------|-------------:|------------------:|-----------:|------------------:|--------------------:|------|
| 202601 | 馬場本店 | 2,000,000 | 100,000 | 600,000 | 0 / 0 | 0 / 0 | レガシー人件費・基準月 |
| 202601 | 中野店 | 2,500,000 | 150,000 | 750,000 | 0 / 0 | 0 / 0 | |
| 202601 | 馬場2号店 | 1,800,000 | 0 | 550,000 | 0 / 0 | 0 / 0 | 物販なし |
| 202602 | 馬場本店 | 2,100,000 | 120,000 | 620,000 | 0 / 0 | 0 / 0 | 前月比プレースホルダ用 |
| 202602 | 中野店 | 2,600,000 | 160,000 | 760,000 | 0 / 0 | 0 / 0 | |
| 202602 | 馬場2号店 | 1,900,000 | 0 | 560,000 | 0 / 0 | 0 / 0 | |
| 202603 | 馬場本店 | 2,200,000 | 130,000 | 640,000 | 10 / 6 | 2 / 0 | 新方式検証用 |
| 202603 | 中野店 | 2,700,000 | 170,000 | 780,000 | 12 / 8 | 0 / 1 | |
| 202603 | 馬場2号店 | 2,000,000 | 50,000 | 570,000 | 8 / 4 | 1 / 0 | 物販少量 |

#### 全社月次人件費（202603 のみ・新方式検証用）

| period_key | `total_variable_payroll` |
|-----------:|-------------------------:|
| 202603 | 1,200,000 |

> 202601・202602 は `pe_monthly_company_records` 行を作らず、PL は `labor_cost` 直接値（レガシーフォールバック）で表示される。

### 3.3 SQL 一括投入スクリプト

Supabase SQL Editor で実行。`ON CONFLICT` により再実行可能。

```sql
-- ── Phase A: 店舗固定費（フラット + revisions 両方）──────────────
INSERT INTO pe_store_settings
  (store_id, fixed_rent, fixed_utilities, fixed_sundries, payment_fee_rate, fixed_salary_total)
SELECT s.id, v.rent, v.util, v.sund, v.rate, v.salary
FROM stores s
JOIN (VALUES
  ('baba_main', 132000, 40000, 13000, 0.025, 300000),
  ('nakano',    330000, 40000, 13000, 0.025, 500000),
  ('baba_2nd',  206000, 40000, 13000, 0.025, 250000)
) AS v(key, rent, util, sund, rate, salary) ON s.store_key = v.key
ON CONFLICT (store_id) DO UPDATE SET
  fixed_rent = EXCLUDED.fixed_rent,
  fixed_utilities = EXCLUDED.fixed_utilities,
  fixed_sundries = EXCLUDED.fixed_sundries,
  payment_fee_rate = EXCLUDED.payment_fee_rate,
  fixed_salary_total = EXCLUDED.fixed_salary_total;

INSERT INTO pe_store_settings_revisions
  (store_id, effective_from, fixed_rent, fixed_utilities, fixed_sundries, payment_fee_rate, fixed_salary_total, note)
SELECT s.id, 202601, v.rent, v.util, v.sund, v.rate, v.salary, 'test-plan SEED'
FROM stores s
JOIN (VALUES
  ('baba_main', 132000, 40000, 13000, 0.025, 300000),
  ('nakano',    330000, 40000, 13000, 0.025, 500000),
  ('baba_2nd',  206000, 40000, 13000, 0.025, 250000)
) AS v(key, rent, util, sund, rate, salary) ON s.store_key = v.key
ON CONFLICT (store_id, effective_from) DO UPDATE SET
  fixed_rent = EXCLUDED.fixed_rent,
  fixed_utilities = EXCLUDED.fixed_utilities,
  fixed_sundries = EXCLUDED.fixed_sundries,
  payment_fee_rate = EXCLUDED.payment_fee_rate,
  fixed_salary_total = EXCLUDED.fixed_salary_total;

-- ── Phase B: 全社共通費（フラット + revisions）──────────────────
INSERT INTO pe_company_settings
  (id, exec_remuneration, debt_repayment, ryo_hourly_rate)
VALUES (1, 550000, 1000000, 1300)
ON CONFLICT (id) DO UPDATE SET
  exec_remuneration = EXCLUDED.exec_remuneration,
  debt_repayment = EXCLUDED.debt_repayment,
  ryo_hourly_rate = EXCLUDED.ryo_hourly_rate;

INSERT INTO pe_company_settings_revisions
  (effective_from, exec_remuneration, debt_repayment, ryo_hourly_rate, note)
VALUES (202601, 550000, 1000000, 1300, 'test-plan SEED')
ON CONFLICT (effective_from) DO UPDATE SET
  exec_remuneration = EXCLUDED.exec_remuneration,
  debt_repayment = EXCLUDED.debt_repayment,
  ryo_hourly_rate = EXCLUDED.ryo_hourly_rate;

-- ── Phase C: ベンチマーク（フラット + revisions）────────────────
INSERT INTO pe_benchmarks (id, f_ratio, l_ratio, r_ratio, operating_profit_margin, labor_rate)
VALUES (1, 0.25, 0.35, 0.15, 0.25, 0.50)
ON CONFLICT (id) DO UPDATE SET
  f_ratio = EXCLUDED.f_ratio,
  l_ratio = EXCLUDED.l_ratio,
  r_ratio = EXCLUDED.r_ratio,
  operating_profit_margin = EXCLUDED.operating_profit_margin,
  labor_rate = EXCLUDED.labor_rate;

INSERT INTO pe_benchmarks_revisions
  (effective_from, f_ratio, l_ratio, r_ratio, operating_profit_margin, labor_rate, note)
VALUES (202601, 0.25, 0.35, 0.15, 0.25, 0.50, 'test-plan SEED')
ON CONFLICT (effective_from) DO UPDATE SET
  f_ratio = EXCLUDED.f_ratio,
  l_ratio = EXCLUDED.l_ratio,
  r_ratio = EXCLUDED.r_ratio,
  operating_profit_margin = EXCLUDED.operating_profit_margin,
  labor_rate = EXCLUDED.labor_rate;

-- ── Phase D: 月次実績（売上 + レガシー人件費 + 新方式枠数）──────
INSERT INTO pe_monthly_records
  (store_id, period_key, service_sales, merchandise_sales, labor_cost,
   part_time_slots_6h, part_time_slots_7_5h, ryo_slots_6h, ryo_slots_7_5h)
SELECT s.id, v.pk, v.svc, v.merch, v.labor,
       v.pt6, v.pt75, v.ryo6, v.ryo75
FROM stores s
JOIN (VALUES
  ('baba_main', 202601, 2000000, 100000, 600000,  0, 0, 0, 0),
  ('baba_main', 202602, 2100000, 120000, 620000,  0, 0, 0, 0),
  ('baba_main', 202603, 2200000, 130000, 640000, 10, 6, 2, 0),
  ('nakano',    202601, 2500000, 150000, 750000,  0, 0, 0, 0),
  ('nakano',    202602, 2600000, 160000, 760000,  0, 0, 0, 0),
  ('nakano',    202603, 2700000, 170000, 780000, 12, 8, 0, 1),
  ('baba_2nd',  202601, 1800000, 0,      550000,  0, 0, 0, 0),
  ('baba_2nd',  202602, 1900000, 0,      560000,  0, 0, 0, 0),
  ('baba_2nd',  202603, 2000000, 50000,  570000,  8, 4, 1, 0)
) AS v(key, pk, svc, merch, labor, pt6, pt75, ryo6, ryo75) ON s.store_key = v.key
ON CONFLICT (store_id, period_key) DO UPDATE SET
  service_sales = EXCLUDED.service_sales,
  merchandise_sales = EXCLUDED.merchandise_sales,
  labor_cost = EXCLUDED.labor_cost,
  part_time_slots_6h = EXCLUDED.part_time_slots_6h,
  part_time_slots_7_5h = EXCLUDED.part_time_slots_7_5h,
  ryo_slots_6h = EXCLUDED.ryo_slots_6h,
  ryo_slots_7_5h = EXCLUDED.ryo_slots_7_5h;

-- ── Phase D': 全社月次人件費（202603 のみ・新方式 PL 検証用）────
INSERT INTO pe_monthly_company_records (period_key, total_variable_payroll)
VALUES (202603, 1200000)
ON CONFLICT (period_key) DO UPDATE SET
  total_variable_payroll = EXCLUDED.total_variable_payroll,
  updated_at = now();

-- 投入確認
SELECT s.store_key, r.period_key, r.service_sales, r.merchandise_sales,
       r.labor_cost, r.part_time_slots_6h, r.part_time_slots_7_5h
FROM pe_monthly_records r
JOIN stores s ON s.id = r.store_id
ORDER BY r.period_key, s.store_key;

SELECT * FROM pe_monthly_company_records ORDER BY period_key;
```

### 3.4 UI 経由での投入（回帰テスト用）

SQL 投入後、**設定モード・月次入力モードの CRUD 自体**を別途 UI で確認する。

| 操作 | 手順 | 期待 |
|------|------|------|
| 設定読込 | 設定 → 店舗別固定費 → 馬場本店 | SQL 投入値（家賃・光熱・雑費・手数料率・固定給）が表示される |
| 設定更新 | 家賃を +1,000 した改定を `effective_from=202604` で追加 | `pe_store_settings_revisions` に 1 行追加。直後に「現在適用中」が更新 |
| 月次新規 | 入力 → 202604・手入力 → 3 店舗売上 → 画面A/B/C → 保存 | `pe_monthly_records` 3 行 + `pe_monthly_company_records` 1 行追加 |
| 月次更新 | 同月を再入力して金額変更 | upsert で上書き |
| 前月表示 | 202604 入力 Step1 | 202603 の提供売上がプレースホルダ / 前月実績に表示 |

---

## 4. 期待値（計算検証）

### 4.1 馬場本店・202601・V-MINT 変動費 = 0 / レガシー人件費の場合

入力: `service_sales=2,000,000`, `merchandise_sales=100,000`, `labor_cost=600,000`
設定: 家賃 132,000 / 光熱 40,000 / 雑費 13,000 / 手数料率 2.5%
人件費: **レガシー**（`pe_monthly_company_records` 行なし → `labor_cost` 直接参照）

| 項目 | 計算式 | 期待値（円・四捨五入） |
|------|--------|----------------------:|
| 税込み総売上 | 2,000,000 + 100,000 | 2,100,000 |
| 消費税 | 2,100,000 ÷ 11 | 190,909 |
| 税引き後総売上 | × 10/11 | 1,909,091 |
| 物販フレーバー原価 | 100,000 × 10/11 × 0.89 | 80,909 |
| 原価合計 | 0+0+0+80,909 | 80,909 |
| 粗利 | 1,909,091 − 80,909 | 1,828,182 |
| 決済手数料 | 1,909,091 × 0.025 | 47,727 |
| 販管費合計 | 132k+600k+47,727+40k+13k | 832,727 |
| 営業利益 | 1,828,182 − 832,727 | **995,455** |
| 粗利率 | 粗利 ÷ 税引き後総売上 | **95.8%** |
| 労働分配率 | 600,000 ÷ 粗利 | **32.8%** |
| 営業利益率 | 995,455 ÷ 1,909,091 | **52.1%** |
| F比 | 80,909 ÷ 1,909,091 | **4.2%** |
| L比 | 600,000 ÷ 1,909,091 | **31.4%** |
| R比 | 132,000 ÷ 1,909,091 | **6.9%** |

店舗別 PL では **役員報酬・借入返済・純現金収支は表示されない**（全社のみ）。
PL ⑬人件費の **「固定給／変動費按分」サブ行は表示されない**（レガシーフォールバック）。

### 4.2 馬場本店・202603・V-MINT 変動費 = 0 / 新方式人件費の場合

入力: `service_sales=2,200,000`, `merchandise_sales=130,000`
枠数: 馬場本店 pt6h=10 / pt7.5h=6 / ryo6h=2 / ryo7.5h=0
全社: `total_variable_payroll=1,200,000`
設定: 家賃 132,000 / 光熱 40,000 / 雑費 13,000 / 手数料率 2.5% / 固定給合計 300,000 / 社長時給 1,300

#### 枠数按分計算

| 店舗 | バイト 6h | 7.5h | 重みつき枠数 |
|------|---------:|-----:|-------------:|
| 馬場本店 | 10 | 6 | 6.0×10 + 7.5×6 = **105.0** |
| 中野店 | 12 | 8 | 6.0×12 + 7.5×8 = **132.0** |
| 馬場2号店 | 8 | 4 | 6.0×8 + 7.5×4 = **78.0** |
| **全店合計** | | | **315.0** |

馬場本店の変動費按分: 1,200,000 × 105.0 / 315.0 = **400,000**
馬場本店の人件費 = 固定給 300,000 + 変動費按分 400,000 = **700,000**
りょーさん代替コスト（参考・PL非計上）: 1,300 × (6.0×2 + 7.5×0) = **15,600**

#### PL 期待値

| 項目 | 計算 | 期待値（円） |
|------|------|------------:|
| 税込み総売上 | 2,200,000 + 130,000 | 2,330,000 |
| 税引き後総売上 | × 10/11 | 2,118,182 |
| 物販フレーバー原価 | 130,000 × 10/11 × 0.89 | 105,182 |
| 粗利 | 2,118,182 − 105,182 | 2,013,000 |
| 決済手数料 | 2,118,182 × 0.025 | 52,955 |
| ⑬ 人件費 | 固定給 300,000 + 変動費按分 400,000 | **700,000** |
| 　├ 固定給（サブ行） | | 300,000 |
| 　└ 変動費按分（サブ行） | | 400,000 |
| 販管費合計 | 132k+700k+52,955+40k+13k | 937,955 |
| 営業利益 | 2,013,000 − 937,955 | **1,075,045** |
| 労働分配率 | 700,000 ÷ 2,013,000 | **34.8%** |
| ※ りょーさん代替コスト（参考） | | 15,600 |

**PL ⑬人件費の下に「固定給／変動費按分」サブ行 + 「※ りょーさん代替コスト（参考・PL非計上）」が表示される**ことを確認。

### 4.3 全店舗合計・202603・V-MINT 変動費 = 0 の場合（参考）

| 項目 | 3 店舗合算 | 期待（概算） |
|------|----------:|-------------:|
| 税込み総売上 | 6,900,000 + 350,000 | 7,250,000 |
| 税引き後総売上 | × 10/11 | 6,590,909 |
| 人件費（固定給 + 変動費按分） | 1,050,000 + 1,200,000 | 2,250,000 |
| 家賃 | 132k+330k+206k | 668,000 |
| 役員報酬（全社のみ） | | 550,000 |
| 借入返済（全社のみ） | | 1,000,000 |

営業利益・純現金収支は物販原価・決済手数料・光熱雑費を含めた上で PL 画面の表示値と突合する。

### 4.4 finance-spec 完全サンプル（V-MINT あり・1 店舗相当）

[[V-PEACH/notes/V-PEACH_finance-spec]] §2 の入力を再現できる月（`cost_reports` あり）で、以下を確認:

| 項目 | 期待 |
|------|-----:|
| 営業利益 | 1,813,000 |
| 純現金収支 | 263,000 |
| 粗利率 | 75.4% |
| 労働分配率 | 41.7% |

※ V-MINT 実データがテスト値と一致しない場合は、**相対関係**（消費税 = 総売上÷11、物販原価 = 物販×10/11×89% 等）の検証に切り替える。

---

## 5. テストケース一覧

実施時は「結果」列に ✅ / ❌ / ⏭（スキップ）を記入する。

### 5.0 共通・認証

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| COM-01 | PIN | 正しい PIN を入力 | ポータル画面へ遷移 | |
| COM-02 | PIN | 誤った PIN を入力 | エラーメッセージ、画面ロック維持 | |
| COM-03 | ナビ | 各モードを開いてヘッダー「ポータルへ」 | ポータルに戻れる | |
| COM-04 | 履歴 | ブラウザ戻る（入力 Step 中） | 前ステップ or 確認ダイアログ | |
| COM-05 | 祝日バナー | 祝日マスタが当年または翌年を欠く状態でポータルを開く | 黄バナー「祝日マスタを更新してください」が表示される。マスタ取得後は消える | |
| COM-06 | 祝日バナー | 当年・翌年とも揃っている状態 | バナー非表示 | |

### 5.1 設定モード

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| SET-01 | 店舗固定費 | 設定 → 店舗別固定費を開く | ピルセレクターが表示され、馬場本店の「現在適用中」行が自動選択 | |
| SET-02 | 店舗固定費 | ピルで中野店・馬場2号店に切替 | 店舗ごとの改定履歴が切り替わる | |
| SET-03 | 店舗固定費 | 現在適用中の値を確認 | §3.1 の値（家賃・光熱費・雑費・手数料率・**所属固定給月報酬**）が表示 | |
| SET-04 | 改定追加 | 新規改定フォームに `effective_from=202604` + 新値（固定給合計含む）を入力して追加 | `pe_store_settings_revisions` に 1 行追加。直後に「現在適用中」が更新 | |
| SET-05 | 改定削除 | 現在適用中が 2 件以上のとき削除ボタンを押す | 最新行が削除され、直前行が現在適用中になる | |
| SET-06 | 削除不可 | 現在適用中が 1 件のとき | 削除ボタンが非表示 | |
| SET-07 | 全社共通費 | 役員報酬・借入返済・**社長代替時給**の現在適用中を読込 | 550,000 / 1,000,000 / ¥1,300/h が表示 | |
| SET-08 | ベンチマーク | 現在適用中を読込 | 5 指標（F比・L比・R比・営業利益率・労働分配率）の % 値が表示 | |
| SET-09 | ベンチマーク | 新規改定追加後、PLモードで別の期間を表示 | 期間に応じた目標値が Health Highlight に反映 | |
| SET-10 | HRMOS スタッフ | 設定メニュー → HRMOS マスタ管理 → スタッフ CSV をアップロード | `pe_hrmos_staffs` に upsert。登録件数・ロール別カウント（固定給／バイト／社長）が表示される | |
| SET-11 | HRMOS スタッフ ロール上書き | スタッフ行のロールを「バイト」→「固定給」に変更 | 即時 DB 反映。再取込してもロールは保持される | |
| SET-12 | HRMOS 勤務区分 | 勤務区分 CSV をアップロード | `pe_hrmos_segments` に upsert。按分対象／対象外カウントと misc 警告（あれば）表示 | |
| SET-13 | HRMOS 勤務区分 上書き | 「按分対象」チェック・店舗・シフトタイプ（早/中/遅/オーラス/その他）・default_hours を変更 | 即時 DB 反映。シフト CSV 取込時の按分結果に反映される | |
| SET-14 | 祝日マスタ | 設定メニュー → 祝日マスタ → 「いま再取得する」 | holidays-jp API から取得、`pe_jp_holidays` 更新。最終取得日時 + 件数表示が更新 | |
| SET-15 | 祝日マスタ 失敗 | ネットワーク遮断状態で再取得 | 「✗ 失敗」表示 + 「キャッシュで動作中」の赤バナー。既存キャッシュは保持 | |

### 5.2 月次入力モード（手入力）

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| INP-00 | Step 0 対象月自動セット | 月次入力モードを開く | `pe_monthly_company_records` の最新月の翌月が年/月セレクトに初期セットされる（未記録時は当月） | |
| INP-00a | Step 0 プレビュー | 年・月を両方選択 | 「開始する」ボタン下に全店舗の集計期間カードが自動表示される（cost_reports あり月） | |
| INP-00b | Step 0 プレビュー未入力 | cost_reports なし月を選択 | 各店舗に「未入力」と表示される | |
| INP-01 | フロー | 入力モードを開く → 手入力タブを選択 | 期間選択（YYYY年MM月）が表示される | |
| INP-02 | バリデーション | 提供売上未入力で次へ | 進めない（`canNext` false） | |
| INP-03 | 物販任意 | 物販空欄で保存 | `merchandise_sales = 0` として保存 | |
| INP-04 | 新規保存 | 202604 を選択し 3 店舗入力 → 画面A/B/C → 保存 | DB に 3 行追加（3店舗分）+ `pe_monthly_company_records` 1 行 | |
| INP-05 | 更新 | 同月を再入力して変更 | upsert で上書き | |
| INP-06 | V-MINT期間（店舗ヘッダー） | 入力 Step の店舗ヘッダー | `start_date`〜`end_date` が表示される（cost_reports あり月） | |
| INP-07 | 全店舗一括 | 3 店舗分を連続入力して保存 | 1 回の操作で 3 店舗 upsert される | |
| INP-08 | 中断 | 入力途中でポータル戻り | 確認ダイアログが出る | |
| INP-09 | 人件費画面A | 各店舗の 6h / 7.5h 枠数を入力 | リアルタイムで重みつき枠数（h）と全店合計（h）が計算表示される | |
| INP-10 | 人件費画面B | りょーさん枠数入力（任意） | 注釈「PL非計上・参考値として表示」が見える。代替コスト参考（h）がリアルタイム表示 | |
| INP-11 | 人件費画面C | 全店バイト給与＋交通費総額を入力 | `pe_monthly_company_records` に upsert される | |
| INP-12 | 人件費按分確認 | 新方式入力後に PL 表示 | ⑬ 人件費に「固定給 / 変動費按分」サブ行 + りょーさん代替コスト参考が表示される（§4.2 と一致） | |
| INP-13 | レガシーフォールバック | `pe_monthly_company_records` に行のない旧月（202601/202602）の PL | 人件費に内訳サブ行なし（レガシー `labor_cost` 値が表示） | |

### 5.2b 月次入力モード（CSV インポート・全7ステップ）

> 前提：`pe_daily_sales_cache` に 2025年12月分のキャッシュが投入済み。HRMOS マスタ（スタッフ/勤務区分/祝日）は SET-10/12/14 で取込済みであること。
>
> ステップ構成: Step 0（対象月・モード切替）→ **Step 1（売上CSV）→ Step 2（売上プレビュー）→ Step 3（シフトCSV・任意）→ Step 4（画面A）→ Step 5（画面B）→ Step 6（画面C）→ Step 7（最終確認）**。1/6〜6/6 の表示は Step 1〜6 のみ、Step 7 はバッジなし。

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| CSV-01 | モード切替 | Step 0 でデフォルトタブを確認 | 「CSV インポート」タブが選択済み | |
| CSV-02 | ファイルアップロード（Step 1, 1/6） | 3店舗 × ボックスで Airメイト+Airレジ を複数選択 | 各ボックス内で自動判定され Airメイト/Airレジ の2スロットが埋まり「次へ」が活性化する | |
| CSV-02b | 削除ボタン | 誤アップロードしたスロットの「削除」ボタンを押す | 当該スロットのみクリアされ、もう片方は残る | |
| CSV-02c | 種別不明ファイル | ヘッダーが Airメイト/Airレジ のどちらにも一致しない CSV をアップロード | 黄バッジ警告が表示され「次へ」が活性化しない | |
| CSV-03 | ヘッダー自動判定 | ファイル名に規約なし・ヘッダーが Airメイト形式の CSV をアップロード | 「Airメイト」スロットに自動振り分けされる | |
| CSV-04 | プレビュー（Step 2, 2/6） | Step 1 後「次へ」 | 店舗別に提供売上（割引後）・物販売上・割引総額・前月キャッシュ参照日数が表示される | |
| CSV-05 | シフト CSV 選択（Step 3, 3/6） | 「ファイルを選択」ボタンを押して `vangvieng_shifts_YYYYMM.csv` を選択 | ボタン横にファイル名が表示される（「選択されていません」が消える） | |
| CSV-05b | シフト CSV スキップ | Step 3 未アップロードのまま次へ | 「未アップロード（画面A・B で手入力）」表示のまま次へ進める | |
| CSV-05c | シフト CSV 取込 | HRMOS シフト CSV をアップロード | 「✓ 取込完了：画面A・B に反映されました」と店舗別集計（6h / 7.5h × バイト/りょーさん・営業日数）が表示。重みつき合計時間も併記 | |
| CSV-05d | シフト CSV 警告 | マスタ未登録のスタッフ/勤務区分を含む CSV をアップロード | 黄バナー「⚠ 警告」に未登録要素が列挙される（取込自体は実施） | |
| CSV-05e | シフト CSV マスタ未登録エラー | `pe_hrmos_staffs` / `pe_hrmos_segments` が空の状態で取込 | 赤エラー「HRMOS スタッフ／勤務区分マスタが未登録です」が表示され、画面A/B 未反映 | |
| CSV-06 | 画面A（Step 4, 4/6） | シフト CSV 取込後に Step 4 へ | 各店舗の 6h / 7.5h バイト枠数が自動入力済み。手動編集可能 | |
| CSV-07 | 画面B（Step 5, 5/6） | Step 5 へ | りょーさん 6h / 7.5h 枠数が自動入力済み。手動編集可能 | |
| CSV-08 | 画面C（Step 6, 6/6） | 全店バイト給与＋交通費総額を入力 | 数値必須（0円可）、未入力時は「次へ」が無効 | |
| CSV-09 | 最終確認（Step 7） | 「次へ」 | 店舗別に売上・枠数・全店給与＋交通費合計が一覧表示。バッジ番号なし | |
| CSV-10 | 保存 | 確認 → 保存 | `pe_monthly_records` に 3 行 upsert（売上＋枠数）。`pe_monthly_company_records` に当月行 upsert。`pe_daily_sales_cache` に当月分追加、当月度 start_date より古いキャッシュ自動削除 | |
| CSV-11 | 前月キャッシュ欠落 | キャッシュなし状態でインポート実行 | 警告ダイアログが表示される（前月最終盤のデータが取得できない旨） | |
| CSV-12 | CSV パースエラー | 不正な CSV（ヘッダー欠落等）をアップロード | 該当店舗スロットにエラー表示、先に進めない | |

### 5.3 PLモード — 月次

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| PLM-00 | デフォルト参照月 | PLモードを開く | `pe_monthly_company_records` の最新月（例：202603）が `selectedYear/Month` に自動セットされ「表示する」を押せる | |
| PLM-01 | 店舗別・レガシー | 馬場本店 / 202601 / 月次 | §4.1 の主要数値と一致（±1 円許容）。⑬人件費にサブ行**なし** | |
| PLM-01b | 店舗別・新方式 | 馬場本店 / 202603 / 月次 | §4.2 の主要数値と一致。⑬人件費に「固定給 / 変動費按分」サブ行 + りょーさん代替コスト参考行**あり** | |
| PLM-02 | 店舗別 | 馬場2号店 / 202601 / 月次 | 物販 0、物販原価 0 | |
| PLM-03 | 全社 | 全店舗合計 / 202603 / 月次 | 3 店舗合算。役員報酬・借入・**純現金収支**行が表示 | |
| PLM-04 | 全社 | 店舗別 PL | 役員報酬・純現金収支が **非表示** | |
| PLM-05 | 未入力 | データのない月を選択 | 「月次データがありません」バナー、数値は — | |
| PLM-06 | 構造 | PL 各セクション | FLR比サマリー（最上部）→ 売上 → 原価/粗利 → 販管費/営業利益 → （全社のみ）全社調整/純現金収支 → Health Check → トレンドチャート | |
| PLM-07 | 集計期間バッジ | 月次モードで年月確定 | フィルター下に全店舗の V-MINT 集計期間（`start_date〜end_date（日数）`）が並ぶ | |
| PLM-08 | FLR比サマリー | 月次PL表示時 | 「FLR比（対税引後売上）」セクションに F比・L比・R比 の3指標が3カラムで常時表示 | |

### 5.4 PLモード — 3ヶ月平均・年次

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| PLR-01 | 3ヶ月平均 | 馬場本店 / 202603 / 3ヶ月平均 | 202601〜03 の単純平均（有効月のみ） | |
| PLR-02 | 3ヶ月平均 | 労働分配率・FLR比 | 平均後の粗利・人件費・売上から再計算（月次率の平均ではない） | |
| PLA-01 | 年次 | 全店舗 / 2026 / 年次 | 202601〜12 の合算（未入力月は 0） | |
| PLA-02 | 年次 | 参照年のみ選択 UI | 月選択が非表示 | |

### 5.5 PLモード — トレンドチャート・Health Check

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| PLT-01 | チャート・月次 | 月次 PL 表示後 | チャートタイトルが「月次推移（YYYY年）」で、**選択年の1〜12月**がX軸に表示される | |
| PLT-02 | チャート・3ヶ月平均 | 3ヶ月平均 PL 表示後 | チャートタイトルが「月次推移（YYYY年）」で、選択年1〜12月がX軸。PL数値は選択月含む直近3ヶ月平均 | |
| PLT-03 | チャート・年次 | 年次 PL 表示後 | チャートタイトルが「年次推移（直近12年）」で、X軸が「2026年」「2027年」…と年単位で表示される | |
| PLT-04 | チャート・年跨ぎ | 月次で翌年1月を選択 | 翌年の1〜12月がX軸に切り替わる | |
| PLT-05 | チャート・カテゴリトグル | 売上/原価/販管費/利益/FLR比 のカテゴリーから個別指標をON/OFF | 二重Y軸（左:金額、右:%）でラインが追加・削除される。初期表示は「税込総売上・F比・L比・R比・会社手残り」 | |
| PLH-01 | Health | ベンチマーク設定後、202601 馬場本店 | 5 指標（F比・L比・R比・営業利益率・労働分配率）に実績%と OK/要注意 色 | |
| PLH-02 | Health | ベンチマーク未設定 | 「設定でベンチマーク目標値を設定できます」表示 | |

### 5.6 エッジ・異常系

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| EDG-01 | 粗利ゼロ | 原価 ≈ 売上となる入力（テスト用 1 ヶ月） | 労働分配率が —（null） | |
| EDG-02 | ネットワーク | Supabase 切断状態で PL 表示 | エラーアラート、クラッシュしない | |
| EDG-03 | 再読込 | PL 表示中に条件変更 | フィルター画面に戻り再集計できる | |
| EDG-04 | 枠数全0新方式 | 202603 で `total_variable_payroll` あり・全店枠数 0 で PL 表示 | 変動費按分はゼロ除算回避（按分0）、固定給のみ表示 | |

---

## 6. 推奨実施順序（チェックリスト）

```
□ 環境準備（§2）
□ DB スキーマ・店舗マスタ確認（§2.3）
□ V-MINT cost_reports 有無確認（§2.4）
□ SQL で Phase A〜D'（§3.3）を投入
□ 投入確認クエリで 9 行の月次データ + 1 行の全社レコードを確認
□ COM-01〜06 認証・ナビ・祝日バナー
□ SET-01〜09 設定モード（店舗固定費・全社共通費・ベンチマーク UI 確認）
□ SET-10〜15 HRMOS マスタ管理・祝日マスタ（CSV 取込含む）
□ INP-00〜13 月次入力・手入力（対象月自動セット・人件費A/B/C・新方式と旧方式の両方）
□ CSV-01〜12 月次入力・CSV インポート（売上 → プレビュー → シフトCSV → 画面A/B/C → 確認）
□ PLM-00〜08 月次 PL（§4.1 レガシー / §4.2 新方式 / FLR比 / 集計期間バッジ）
□ PLR-01〜02 / PLA-01〜02 集計モード
□ PLT-01〜05 / PLH-01〜02 チャート・Health
□ EDG-01〜04 エッジ
□ （任意）finance-spec 完全サンプル月で §4.4
□ 本番 Cloudflare でスモーク（PIN + 1 店舗 PL のみ）
```

---

## 7. 不具合記録テンプレート

| 項目 | 内容 |
|------|------|
| ID | PLM-01 等 |
| 再現手順 | |
| 期待 / 実際 | |
| スクリーンショット | |
| 関連ファイル | `src/...` |
| 重要度 | Critical / High / Medium / Low |

発見時は [[V-PEACH/TROUBLESHOOTING]] にケース追記、修正後は [[V-PEACH/CHANGELOG_DEV]] に記録。

---

## 8. テスト完了基準

| 基準 | 条件 |
|------|------|
| **必須** | §5 の COM / SET（SET-10〜15 含む）/ INP / CSV / PLM をすべて ✅（EDG-02 は環境都合で ⏭ 可） |
| **必須** | 月次トレンドチャートの X 軸が選択年の 1〜12 月表示、年次トレンドチャートの X 軸が年単位（PLT-01〜03） |
| **必須** | 馬場本店 202601 の営業利益が §4.1 と ±1 円以内（V-MINT=0・レガシー人件費前提） |
| **必須** | 馬場本店 202603 の営業利益が §4.2 と ±1 円以内（V-MINT=0・新方式人件費前提） + 「固定給／変動費按分」サブ行が表示される |
| **必須** | 全社 202603 で純現金収支行が表示され、役員報酬・借入が差し引かれる |
| **必須** | CSV モードで売上 → プレビュー → シフト CSV → 画面A/B/C → 確認 の順に Step 1〜7 を遷移できる（1/6〜6/6 のバッジ表示確認） |
| **必須** | HRMOS シフト CSV 取込で画面A/B の枠数が自動セットされ、編集可能 |
| **推奨** | PLR / PLA / PLT / PLH も ✅ |
| **推奨** | V-MINT データあり月で変動費 3 項目が 0 以外 |
| **推奨** | 祝日バナーが当年/翌年欠落時に出ること（COM-05/06） |

---

## Related

- [[V-PEACH/notes/V-PEACH_requirements]] — 機能要件
- [[V-PEACH/notes/V-PEACH_finance-spec]] — PL 読み方・計算サンプル
- [[V-PEACH/notes/V-PEACH_architecture]] — DB・API 構成
- [[V-PEACH/notes/V-PEACH_release-plan]] — フェーズ完了状況
- [[V-PEACH/notes/V-PEACH_shifts-csv-import-plan]] — HRMOS シフト CSV 取込計画
- [[V-PEACH/notes/V-PEACH_labor-cost-plan]] — 人件費新方式設計
- [[V-PEACH/TROUBLESHOOTING]]

---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — Architecture

## Summary
- Vue3/Vite フロントエンド + Supabase（V-MINT 2.0と同一プロジェクト）+ Cloudflare Pages
- V-MINT 2.0のテーブルをView経由で参照し、フロント側ロジックを軽量化
- obsidian-vault モノレポから `git subtree push --prefix=V-PEACH V-PEACH main` でデプロイ

## スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | Vue 3 + Vite + Tailwind CSS |
| チャート | Chart.js（PLTrendChart.vue・カテゴリー別トグル・二重Y軸） |
| Backend | Supabase (PostgreSQL) |
| Infra | Cloudflare Pages |
| V-MINT連携 | `cost_reports` / `flavor_brand_sales` / `drink_orders` 参照 |

## ディレクトリ構成

```
V-PEACH/
├── src/
│   ├── App.vue                  # ルート（3モード切替）
│   ├── api.js                   # Supabase CRUD（pe_テーブル + V-MINT読み取り）
│   ├── main.js
│   ├── style.css
│   ├── utils/
│   │   ├── finance.js           # PL計算・変動費計算・3ヶ月平均ロジック・人件費新方式関数（calcWeightedSlots/calcStoreLaborCost/calcRyoOpportunityCost）
│   │   ├── periods.js           # 期間キー操作ユーティリティ
│   │   ├── csvImporter.js       # Airメイト/Airレジ/HRMOS シフト・スタッフ・勤務区分 CSV 解析・Shift-JIS デコード・ヘッダー内容で種別自動判定
│   │   ├── shiftImporter.js     # HRMOS シフト計算（店舗×日付×シフトタイプ正規化・オーラス分解・りょーさん枠＝埋まらない早番/遅番）
│   │   └── jpHolidaysClient.js  # holidays-jp API クライアント + Supabase キャッシュ + 30日経過時バックグラウンド更新
│   └── components/
│       ├── PortalMenu.vue       # 3モードカード選択画面
│       ├── CurrencyInput.vue    # 金額入力（フォーカス時：数値のみ、ブラー時：カンマ区切り表示）
│       ├── StoreCsvUpload.vue   # 店舗単位 CSV アップロード（複数選択・ヘッダー内容で Airメイト/Airレジ 自動判定・削除ボタン）
│       ├── common/
│       │   ├── AppHeader.vue
│       │   ├── AppFooter.vue
│       │   ├── LoadingOverlay.vue
│       │   ├── PinAuth.vue
│       │   └── ConfirmDialog.vue
│       ├── PLTrendChart.vue # 月次推移チャート（カテゴリー別トグル・二重Y軸）
│       └── apps/
│           ├── PLApp.vue        # (1) PLモード（シングルページ・FLR比サマリー・人件費内訳表示・prefetchPeriods N+1削減）
│           ├── InputApp.vue     # (2) 月次入力モード（CSV インポート 6 ステップ・人件費プレビュー統合・既存月再編集モード）
│           └── SettingsApp.vue  # (3) 設定モード（バージョン管理・改定履歴・固定給月報酬/社長時給設定）
├── supabase/
│   ├── DB_MIGRATION.sql                            # Phase 1: pe_* 4テーブル作成
│   ├── DB_MIGRATION_revision_20260517.sql          # Phase 5: 売上分離・カラム整理
│   ├── DB_MIGRATION_versioned_settings.sql         # Phase 5: 設定バージョン管理テーブル追加
│   ├── DB_MIGRATION_enable_rls_20260517.sql        # Phase 5: 全テーブルRLS有効化
│   ├── DB_MIGRATION_benchmarks_flr_20260518.sql    # Phase 6: pe_benchmarks_revisions に FLR 3列追加
│   ├── DB_MIGRATION_benchmarks_restructure_20260518.sql # Phase 6: pe_benchmarks フラット化（5指標）
│   ├── DB_MIGRATION_daily_sales_cache_20260518.sql # Phase 7-2: pe_daily_sales_cache 作成
│   ├── DB_MIGRATION_labor_cost_20260520.sql        # Phase 8: pe_monthly_records 4列追加・pe_monthly_company_records 新設・固定給/社長時給列追加
│   ├── DB_MIGRATION_hrmos_masters_20260525.sql     # Phase 10: HRMOS シフト CSV 取込（pe_hrmos_staffs/segments + pe_jp_holidays/meta）
│   ├── SEED_store_settings_defaults.sql            # フォールバック用デフォルト値投入
│   ├── SEED_benchmarks_defaults_20260518.sql       # Phase 6: ベンチマーク初期値（5指標）
│   └── SEED_daily_sales_cache_202512.sql           # Phase 7-2: 2025年12月分初回キャッシュ
└── .env.local                   # 環境変数（gitignore済み）
```

## データベース設計

### pe_store_settings（店舗別固定費・定率）
```sql
CREATE TABLE pe_store_settings (
  store_id bigint PRIMARY KEY REFERENCES stores(id),
  fixed_rent numeric DEFAULT 0,
  fixed_utilities numeric DEFAULT 0,
  fixed_sundries numeric DEFAULT 0,
  payment_fee_rate numeric DEFAULT 0.025,  -- 決済手数料率（totalSalesAfterTax連動）
  fixed_salary_total numeric DEFAULT 0     -- 店舗所属固定給メンバーの月報酬合計（人件費新方式・2026-05-20追加）
);
```
> `fixed_payment_fee`（固定額）・`physical_profit_margin` は廃止済み。

### pe_company_settings（全社共通費・シングルトン）
```sql
CREATE TABLE pe_company_settings (
  id integer PRIMARY KEY DEFAULT 1,
  exec_remuneration numeric DEFAULT 0,
  debt_repayment numeric DEFAULT 0,
  ryo_hourly_rate numeric DEFAULT 1300  -- 社長代替コスト計算用時給（2026-05-20追加）
);
```
> 役員報酬は販管費内・全社集計時のみ計上。借入返済は営業利益から差し引き純現金収支を算出。

### pe_monthly_records（月次実績）
```sql
CREATE TABLE pe_monthly_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id bigint REFERENCES stores(id),
  period_key integer NOT NULL,              -- YYYYMM
  service_sales numeric DEFAULT 0,          -- 提供売上（税込）
  merchandise_sales numeric DEFAULT 0,      -- 物販売上（税込）
  part_time_slots_6h numeric DEFAULT 0,     -- バイトが埋めた 6h 枠数（人件費按分）
  part_time_slots_7_5h numeric DEFAULT 0,   -- バイトが埋めた 7.5h 枠数（人件費新方式）
  ryo_slots_6h numeric DEFAULT 0,           -- 社長が埋めた 6h 枠数（機会費用参考用）
  ryo_slots_7_5h numeric DEFAULT 0,         -- 社長が埋めた 7.5h 枠数（機会費用参考用）
  UNIQUE(store_id, period_key)
);
```
> 旧 `total_sales` は `service_sales` にリネーム。`rent` / `payment_fee` / `utilities` / `sundries` / `labor_cost` は廃止（設定値・計算値に移行）。人件費は `pe_monthly_company_records` の `total_variable_payroll` と枠数列から常に計算。

### pe_monthly_company_records（全社月次変動人件費・2026-05-20追加）
```sql
CREATE TABLE pe_monthly_company_records (
  period_key integer PRIMARY KEY,         -- YYYYMM
  total_variable_payroll numeric DEFAULT 0  -- 当月の全店バイト給与＋交通費の総額
);
```
> `pe_monthly_records` は店舗×月の粒度。全社単位の月次変動人件費総額（按分の分母に使う）は本テーブルに分離。`period_key` 行が存在しない月は PL 計算対象外（データなし）として扱う。

### pe_daily_sales_cache（日次売上キャッシュ・Phase 7-2追加）
```sql
CREATE TABLE pe_daily_sales_cache (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        bigint NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sale_date       date NOT NULL,
  discount_amount numeric NOT NULL DEFAULT 0,  -- 正の数で保持（CSV負値をABSで変換）
  gross_sales     numeric,
  customer_count  integer,
  raw_payload     jsonb,
  imported_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, sale_date)
);
```
> Airレジ日別CSVを店舗×日付単位で永続化。事業月度が暦月をまたぐため前月最終盤のデータを保持し、当月インポート時に参照する。インポート末尾で `sale_date < current_period_start_date` の古いレコードを店舗ごとに自動削除（常時90行前後に収まる設計）。

### pe_benchmarks（目標値・フォールバック）
```sql
CREATE TABLE pe_benchmarks (
  id                      integer PRIMARY KEY DEFAULT 1,
  f_ratio                 numeric,
  l_ratio                 numeric,
  r_ratio                 numeric,
  operating_profit_margin numeric,
  labor_rate              numeric,
  CONSTRAINT pe_benchmarks_single_row CHECK (id = 1)
);
```
> 2026-05-18 に EAV形式（store_id / item_name / target_value）からフラット・シングルトン形式に再設計。`pe_company_settings` と同パターン。主系は `pe_benchmarks_revisions`、このテーブルはフォールバック用。

### 設定バージョン管理テーブル（Phase 5追加）

設定3種を `effective_from`（YYYYMM）付きで改定履歴管理。PL計算時は `effective_from <= periodKey` の最新行を取得し、行がなければ旧テーブルにフォールバックする。

```sql
CREATE TABLE pe_store_settings_revisions (
  id             bigserial PRIMARY KEY,
  store_id       bigint NOT NULL REFERENCES stores(id),
  effective_from int NOT NULL,
  fixed_rent numeric, fixed_utilities numeric,
  fixed_sundries numeric, payment_fee_rate numeric,
  note text, created_at timestamptz DEFAULT now(),
  UNIQUE(store_id, effective_from)
);

CREATE TABLE pe_company_settings_revisions (
  id             bigserial PRIMARY KEY,
  effective_from int NOT NULL UNIQUE,
  exec_remuneration numeric, debt_repayment numeric,
  note text, created_at timestamptz DEFAULT now()
);

CREATE TABLE pe_benchmarks_revisions (
  id             bigserial PRIMARY KEY,
  effective_from int NOT NULL UNIQUE,
  f_ratio numeric, l_ratio numeric, r_ratio numeric,
  operating_profit_margin numeric, labor_rate numeric,
  note text, created_at timestamptz DEFAULT now()
);
-- 旧カラム: gross_profit_margin / cost_ratio は 2026-05-18 に除外済み
```
> `pe_benchmarks_revisions` は5指標（`f_ratio` / `l_ratio` / `r_ratio` / `operating_profit_margin` / `labor_rate`）を1行にフラット管理。2026-05-18 に `gross_profit_margin` / `cost_ratio` を除外し FLR 比 3 列を追加。`pe_benchmarks` はフォールバック用シングルトン（`id=1`）。

## 財務ロジック（src/utils/finance.js）

| 指標 | 計算式 |
|------|--------|
| 税込み総売上 | `service_sales + merchandise_sales` |
| 消費税 | `totalSales × (1/11)` |
| 税引き後総売上 | `totalSales × (10/11)` |
| 物販フレーバー原価 | `merchandise_sales × 0.89` |
| 原価合計 | `flavorCost + charcoalCost + drinkCost + merchandiseFlavorCost` |
| 粗利 | `totalSalesAfterTax − costTotal` |
| 決済手数料 | `totalSalesAfterTax × payment_fee_rate` |
| **人件費（新方式）** | `fixed_salary_total + totalVariablePayroll × storeWeightedSlots / allWeightedSlots` |
| **重みつき枠数** | `6.0 × slots6h + 7.5 × slots7_5h` |
| **社長代替コスト（参考）** | `ryoHourlyRate × (6.0 × ryoSlots6h + 7.5 × ryoSlots7_5h)` |
| 販管費合計 | `rent + laborCost + paymentFee + utilities + sundries`（全社のみ役員報酬を後段に別出し）|
| 営業利益 | `grossProfit − sgaTotal` |
| 純現金収支 | `operatingProfit − execRemuneration − debtRepayment`（全社のみ）|
| 労働分配率 | `laborCost / grossProfit`（grossProfit > 0 のみ）|
| **F比** | `costTotal / totalSalesAfterTax` |
| **L比** | `laborCost / totalSalesAfterTax` |
| **R比** | `rent / totalSalesAfterTax` |

### 主要関数
- `calcPL(record, settings, variableCosts, companySettings, laborParams)` — PL計算メイン。`laborParams` 必須（`pe_monthly_company_records` 行がない月は呼び出し元で null return する）
- `calcWeightedSlots({ slots6h, slots7_5h })` — 重みつき枠数
- `calcStoreLaborCost({ fixedSalaryTotal, storeWeightedSlots, totalWeightedSlots, totalVariablePayroll })` — 店舗人件費
- `calcRyoOpportunityCost({ ryoSlots6h, ryoSlots7_5h, ryoHourlyRate })` — 社長代替コスト（参考値）
- `prefetchPeriods(periodKeys)` — PLApp の N+1 削減用バッチ取得（`PLApp.vue` 内）

## デプロイフロー

```bash
# obsidian-vault の main ブランチにコミット後
git subtree push --prefix=V-PEACH V-PEACH main
# → GitHub daiki100325/V-PEACH main に push
# → Cloudflare Pages が自動ビルド・デプロイ
```

## Context
- Supabase プロジェクトは V-MINT 2.0 と共用（moejgsremxdksmzrowpw）
- `pe_` プレフィックスで既存テーブルと分離
- `.env.local` は gitignore 済み。Cloudflare環境変数で本番設定
- 全 `pe_*` テーブルで RLS 有効（anon 全許可ポリシー）。URL非公開・PIN認証前提のため全許可で既存動作を維持
- ER 図・V-MINT との参照関係: [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/notes/V-PEACH_requirements]]
- [[V-PEACH/notes/V-PEACH_release-plan]]

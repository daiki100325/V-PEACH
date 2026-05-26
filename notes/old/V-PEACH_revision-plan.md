---
tags: [project/v-peach, type/note, archived]
parent: [[V-PEACH/notes/_index]]
status: archived — 実装完了（Phase 5 売上・原価体系改修）。以降の実装変更による更新不要。参照専用。
---

# V-PEACH — 売上・原価体系 改修計画

> 作成: 2026-05-16
> 更新: 2026-05-17
> ステータス: **✅ 全タスク完了（2026-05-17）**
> 背景: 現行の `total_sales` 一本建て → 提供売上 / 物販売上 分離、消費税調整ラインの追加、原価・販管費の大カテゴリー化

---

## 1. 新しい PL 構造

```
税込み総売上                              ← service_sales + merchandise_sales
  ├ 税込み提供売上                        ← InputApp で月次手入力（service_sales）
  └ 税込み物販売上                        ← InputApp で月次手入力（merchandise_sales）
  − 消費税（× 1/11）
────────────────────────────────────────
税引き後総売上（× 10/11）

【原価】
  − 提供フレーバー原価                    ← V-MINT flavor_brand_sales（提供分のみ）
  − 炭原価                               ← V-MINT cost_reports
  − ジュース原価                          ← V-MINT drink_orders
  − 物販フレーバー原価（物販売上 × 89%）  ← merchandise_sales × 0.89
────────────────────────────────────────
粗利

【販管費】
  − 家賃                                 ← pe_store_settings.fixed_rent（設定値固定）
  − 人件費                               ← InputApp で月次手入力（必須）
  − 決済手数料                           ← totalSalesAfterTax × payment_fee_rate（自動計算）
  − 光熱費                               ← pe_store_settings.fixed_utilities（設定値固定）
  − 雑費                                 ← pe_store_settings.fixed_sundries（設定値固定）
  − 役員報酬                             ← pe_company_settings（全社集計時のみ）
────────────────────────────────────────
営業利益

  − 借入返済                             ← pe_company_settings（全社集計時のみ）
════════════════════════════════════════
純現金収支（会社手残り）                  （全社集計時のみ）
```

---

## 2. 各数値のインプット元

| 数値 | 区分 | インプット元 | 備考 |
|------|------|------------|------|
| `service_sales`（提供売上） | 月次手入力 | InputApp → `pe_monthly_records.service_sales` | 税込金額 |
| `merchandise_sales`（物販売上） | 月次手入力 | InputApp → `pe_monthly_records.merchandise_sales` | 税込金額 |
| `labor_cost`（人件費） | 月次手入力 | InputApp → `pe_monthly_records.labor_cost` | 必須 |
| `rent`（家賃） | **設定から強制適用** | `pe_store_settings.fixed_rent`（月次入力なし） | |
| `payment_fee`（決済手数料） | **設定から自動計算** | `totalSalesAfterTax × pe_store_settings.payment_fee_rate` | 税引き後総売上連動 |
| `utilities`（光熱費） | **設定から強制適用** | `pe_store_settings.fixed_utilities`（月次入力なし） | |
| `sundries`（雑費） | **設定から強制適用** | `pe_store_settings.fixed_sundries`（月次入力なし） | |
| 提供フレーバー原価 | V-MINT 自動参照 | `flavor_brand_sales.total_consumption_g` − `merch_count × grams_per_pack` × `cost_price_masters.price_flavor_per_g` | 提供分のみ |
| 炭原価 | V-MINT 自動参照 | `cost_reports.charcoal_nyanco_flat_serve + charcoal_kingco_flat_serve` × `cost_price_masters.price_charcoal_per_kg` | |
| ジュース原価 | V-MINT 自動参照 | `drink_orders.amount` の合計 | |
| 物販フレーバー原価 | **自動計算** | `merchandise_sales × 0.89` | 物販売上の89%固定 |
| `exec_remuneration`（役員報酬） | 設定（会社共通） | `pe_company_settings.exec_remuneration` | 販管費内・全社集計時のみ |
| `debt_repayment`（借入返済） | 設定（会社共通） | `pe_company_settings.debt_repayment` | 全社集計時のみ |

### 廃止されるインプット元

| 廃止 | 理由 |
|------|------|
| `pe_merchandise_price_masters` テーブル全体 | 物販売上を直接入力するため単価マスタ不要 |
| `pe_store_settings.physical_profit_margin` | 物販フレーバー原価を一律89%固定とするため設定不要 |
| `pe_store_settings.fixed_payment_fee` | 決済手数料を売上連動（`payment_fee_rate × totalSalesAfterTax`）に変更するため固定額設定を廃止 |
| `pe_monthly_records.payment_fee`（月次手入力） | 同上。計算値になるため月次入力項目から削除 |
| `pe_monthly_records.rent`（月次手入力） | 月次入力フォームから削除。`pe_store_settings.fixed_rent` を常時使用 |
| `pe_monthly_records.utilities`（月次手入力） | 同上。`pe_store_settings.fixed_utilities` を常時使用 |
| `pe_monthly_records.sundries`（月次手入力） | 同上。`pe_store_settings.fixed_sundries` を常時使用 |
| V-MINT `flavor_brand_sales.merch_count + merch_count_secondary`（販売数量集計目的） | 物販売上は月次直接入力に変更。ただし `merch_count × grams_per_pack` は提供フレーバー原価の提供分算出に引き続き使用 |

---

## 3. 店舗設定値リファレンス（SettingsApp で初期設定する値）

> 設定モード → 店舗設定 で入力する固定費・定率の参考値。

### 家賃（`fixed_rent`）

| 店舗 | 月額 |
|------|------|
| 馬場本店 | ¥132,000 |
| 中野店 | ¥220,000 |
| 馬場2号店 | ¥206,000 |

### 光熱費（`fixed_utilities`）

| 店舗 | 月額 |
|------|------|
| 全店共通 | ¥40,000 |

### 決済手数料（`payment_fee_rate`）

| 店舗 | 料率 | 計算式 |
|------|------|--------|
| 全店共通 | 2.5% | `totalSalesAfterTax × 0.025` |

> 月ごとに税引き後総売上連動で自動計算される。設定画面では率（%）で入力し、DB には小数値（0.025）で保存する。

### 雑費（`fixed_sundries`）

| 店舗 | 月額 |
|------|------|
| 全店共通 | ¥13,000 |

---

## 4. 指標の再定義

| 指標名 | 計算式（新） | 分母の基準 |
|--------|------------|-----------|
| 税込み総売上 | `service_sales + merchandise_sales` | — |
| 消費税 | `totalSales × (1/11)` | — |
| 税引き後総売上 | `totalSales × (10/11)` | — |
| 物販フレーバー原価 | `merchandise_sales × 0.89` | — |
| 原価合計 | `flavorCost + charcoalCost + drinkCost + merchandiseFlavorCost` | — |
| 粗利 | `totalSalesAfterTax − costTotal` | — |
| 販管費合計 | `rent + laborCost + paymentFee + utilities + sundries + execRemuneration` | — |
| 営業利益 | `grossProfit − sgaTotal` | — |
| 純現金収支 | `operatingProfit − debtRepayment` | 全社のみ |
| **粗利率** | `grossProfit / totalSalesAfterTax` | 税引き後総売上 |
| **原価率** | `costTotal / totalSalesAfterTax` | 税引き後総売上 |
| **労働分配率** | `laborCost / grossProfit`（grossProfit > 0 のみ） | — |
| **営業利益率** | `operatingProfit / totalSalesAfterTax` | 税引き後総売上 |

> ベンチマーク（healthHighlights）の分母はすべて `totalSalesAfterTax` に統一する。
> 物販売上は総売上に含まれ、物販フレーバー原価として原価に計上される。独立した「物販利益」行は廃止。

---

## 5. DB スキーマ変更

### 5-1. `pe_monthly_records` カラム変更

```sql
-- total_sales → service_sales にリネーム
ALTER TABLE pe_monthly_records
  RENAME COLUMN total_sales TO service_sales;

-- 物販売上カラム追加
ALTER TABLE pe_monthly_records
  ADD COLUMN merchandise_sales numeric DEFAULT 0;

-- 月次入力から廃止するカラムを削除
ALTER TABLE pe_monthly_records
  DROP COLUMN IF EXISTS rent,
  DROP COLUMN IF EXISTS payment_fee,
  DROP COLUMN IF EXISTS utilities,
  DROP COLUMN IF EXISTS sundries;
```

### 5-2. `pe_store_settings` カラム変更

```sql
-- physical_profit_margin は固定 89% 原価のため不要
ALTER TABLE pe_store_settings
  DROP COLUMN IF EXISTS physical_profit_margin;

-- 決済手数料を固定額から売上連動の率に変更
ALTER TABLE pe_store_settings
  DROP COLUMN IF EXISTS fixed_payment_fee;

ALTER TABLE pe_store_settings
  ADD COLUMN payment_fee_rate numeric DEFAULT 0.025;
```

### 5-3. `pe_merchandise_price_masters` テーブル削除

```sql
DROP TABLE IF EXISTS pe_merchandise_price_masters;
```

### 5-4. `pe_merchandise_sales_view` 削除

```sql
DROP VIEW IF EXISTS pe_merchandise_sales_view;
```

---

## 6. 実装タスク一覧

### Task 1: DB マイグレーション

**対象ファイル**: `DB_MIGRATION.sql`

- [x] `pe_monthly_records`: `total_sales` → `service_sales` リネーム
- [x] `pe_monthly_records`: `merchandise_sales numeric DEFAULT 0` カラム追加
- [x] `pe_monthly_records`: `rent` / `payment_fee` / `utilities` / `sundries` カラムを **DROP**
- [x] `pe_store_settings`: `physical_profit_margin` 削除
- [x] `pe_store_settings`: `fixed_payment_fee` 削除
- [x] `pe_store_settings`: `payment_fee_rate numeric DEFAULT 0.025` カラム追加
- [x] `pe_merchandise_price_masters` テーブル DROP TABLE
- [x] `pe_merchandise_sales_view` ビュー DROP VIEW

実行順序: Supabase SQL Editor でマイグレーション文を順に実行。

---

### Task 2: `src/utils/finance.js` 全面改修

#### 2-1. `calcPL()` 関数シグネチャ変更

```js
// 変更前
calcPL(record, settings, variableCosts, merchandiseSalesQty, merchandiseUnitPrice, companySettings)

// 変更後
calcPL(record, settings, variableCosts, companySettings = null)
// record に service_sales と merchandise_sales が入る
// merchandiseSalesQty・merchandiseUnitPrice は不要
```

#### 2-2. `calcPL()` 計算ロジック変更

```js
export function calcPL(record, settings, variableCosts, companySettings = null) {
  const n = (v) => Number(v) || 0

  // 売上
  const serviceSales = n(record?.service_sales)           // 提供売上（税込）
  const merchandiseSales = n(record?.merchandise_sales)   // 物販売上（税込）
  const totalSales = serviceSales + merchandiseSales      // 税込み総売上
  const consumptionTax = totalSales / 11                  // 消費税
  const totalSalesAfterTax = totalSales * (10 / 11)      // 税引き後総売上

  // 原価（V-MINTデータ + 物販フレーバー固定計算）
  const flavorCost = n(variableCosts?.flavorCost)         // 提供フレーバー原価
  const charcoalCost = n(variableCosts?.charcoalCost)     // 炭原価
  const drinkCost = n(variableCosts?.drinkCost)           // ジュース原価
  const merchandiseFlavorCost = merchandiseSales * 0.89   // 物販フレーバー原価（89%固定）
  const costTotal = flavorCost + charcoalCost + drinkCost + merchandiseFlavorCost

  // 粗利
  const grossProfit = totalSalesAfterTax - costTotal

  // 販管費（家賃・光熱費・雑費は設定値。決済手数料は売上連動。役員報酬は全社時のみ）
  const rent = n(settings?.fixed_rent)
  const laborCost = n(record?.labor_cost)
  const paymentFeeRate = n(settings?.payment_fee_rate) || 0.025
  const paymentFee = totalSalesAfterTax * paymentFeeRate
  const utilities = n(settings?.fixed_utilities)
  const sundries = n(settings?.fixed_sundries)
  const execRemuneration = companySettings ? n(companySettings.exec_remuneration) : 0
  const sgaTotal = rent + laborCost + paymentFee + utilities + sundries + execRemuneration

  // 利益
  const laborRate = grossProfit > 0 ? laborCost / grossProfit : null
  const operatingProfit = grossProfit - sgaTotal

  // 全社調整（全社集計時のみ）
  const debtRepayment = companySettings ? n(companySettings.debt_repayment) : 0
  const netCashFlow = operatingProfit - debtRepayment

  return {
    serviceSales,
    merchandiseSales,
    totalSales,
    consumptionTax,
    totalSalesAfterTax,
    flavorCost,
    charcoalCost,
    drinkCost,
    merchandiseFlavorCost,
    costTotal,
    grossProfit,
    laborRate,
    rent,
    laborCost,
    paymentFee,
    utilities,
    sundries,
    execRemuneration,
    sgaTotal,
    operatingProfit,
    debtRepayment,
    netCashFlow
  }
}
```

#### 2-3. `calcMerchandiseSalesQty()` 削除

物販売上は月次直接入力になるため不要。関数ごと削除。

#### 2-4. `PL_NUMERIC_KEYS` 更新

```js
const PL_NUMERIC_KEYS = [
  'serviceSales', 'merchandiseSales', 'totalSales', 'consumptionTax', 'totalSalesAfterTax',
  'flavorCost', 'charcoalCost', 'drinkCost', 'merchandiseFlavorCost', 'costTotal',
  'grossProfit',
  'rent', 'laborCost', 'paymentFee', 'utilities', 'sundries', 'execRemuneration', 'sgaTotal',
  'operatingProfit',
  'debtRepayment', 'netCashFlow'
]
```

#### 2-5. `calcRolling3MonthAvg` / `calcAnnualSum` の `laborRate` 再計算

```js
// laborRate は再計算（grossProfit ベース変わらず）
result.laborRate = result.grossProfit > 0 ? result.laborCost / result.grossProfit : null
```

---

### Task 3: `src/api.js` 変更

#### 3-1. 廃止する API 関数

```
getMerchandisePriceMasters()     → 削除
getMerchandisePriceForPeriod()   → 削除
addMerchandisePriceMaster()      → 削除
deleteMerchandisePriceMaster()   → 削除
```

#### 3-2. `upsertMonthlyRecord()` への影響

インターフェース変更なし（`fields` を動的に渡す形式のため）。
呼び出し元（InputApp.vue）で渡す `fields` オブジェクトのキーが変わる。

#### 3-3. `getCostReportForPE()` は維持

`flavor_brand_sales` の `merch_count × grams_per_pack` は提供フレーバー原価の提供分抽出に引き続き必要。削除しない。

---

### Task 4: `src/components/apps/InputApp.vue` 変更

#### 4-1. `formData` 変更

```js
// 変更前
formData: {
  total_sales: null,
  labor_cost: null,
  rent: null, payment_fee: null, utilities: null, sundries: null
}

// 変更後（月次入力は売上 2 項目 + 人件費のみ）
formData: {
  service_sales: null,       // 提供売上（税込）
  merchandise_sales: null,   // 物販売上（税込）
  labor_cost: null
  // rent / payment_fee / utilities / sundries はすべて設定値から自動取得
}
```

#### 4-2. Step 1 入力フォーム変更

入力フィールドは **3 項目のみ**に絞る。

| フィールド | 変更内容 |
|-----------|---------|
| 提供売上（税込） | `総売上` からリネーム。`v-model` を `formData.service_sales` に変更 |
| 物販売上（税込） | 新規追加。任意（空欄 = 0 扱い） |
| 人件費 | 変更なし（必須） |
| 家賃 | **削除**（設定値を強制適用） |
| 決済手数料 | **削除**（売上連動の自動計算） |
| 光熱費 | **削除**（設定値を強制適用） |
| 雑費 | **削除**（設定値を強制適用） |

#### 4-3. `canNext` バリデーション変更

```js
// 変更前
canNext: formData.total_sales != null && >= 0 && formData.labor_cost != null && >= 0

// 変更後
canNext: formData.service_sales != null && >= 0 && formData.labor_cost != null && >= 0
// merchandise_sales は 0 可・空欄可（オプション）
```

#### 4-4. Step 2 確認画面の表示更新

確認画面に表示するのは入力した 3 項目のみ。

| 項目 | 変更 |
|------|------|
| 提供売上（税込） | `総売上` からリネーム |
| 物販売上（税込） | 新規追加 |
| 人件費 | 変更なし |
| 家賃 / 決済手数料 / 光熱費 / 雑費 | **行ごと削除**（設定値・計算値のため入力確認不要） |

#### 4-5. `upsertMonthlyRecord` 呼び出し変更

```js
// 変更前
upsertMonthlyRecord(storeKey, periodKey, {
  total_sales: formData.total_sales,
  labor_cost: formData.labor_cost,
  rent: formData.rent,
  payment_fee: formData.payment_fee,
  utilities: formData.utilities,
  sundries: formData.sundries
})

// 変更後（保存するのは 3 項目のみ）
upsertMonthlyRecord(storeKey, periodKey, {
  service_sales: formData.service_sales,
  merchandise_sales: formData.merchandise_sales ?? 0,
  labor_cost: formData.labor_cost
  // rent / payment_fee / utilities / sundries は保存しない（設定値・計算値）
})
```

---

### Task 5: `src/components/apps/PLApp.vue` 変更

#### 5-1. `loadMonthlyPLCore()` 変更

```js
// 変更前
const [costPrices, mercPrice] = await Promise.all([
  getCostPriceForPeriod(periodKey),
  getMerchandisePriceForPeriod(periodKey)   // ← 削除
])
// ...
const qty = calcMerchandiseSalesQty(costReport?.brandSales)  // ← 削除
return calcPL(record, settings, variableCosts, qty, mercPrice.price_per_unit, null)

// 変更後
const costPrices = await getCostPriceForPeriod(periodKey)
// ...
return calcPL(record, settings, variableCosts, null)
// record.merchandise_sales は calcPL 内で直接参照し、物販フレーバー原価を自動計算
```

#### 5-2. PL 表示セクション変更

```
【現行】
  売上セクション: 総売上 / 提供売上 / 物販売上
  変動費セクション: フレーバー / 炭 / ジュース → 粗利
  固定費セクション: 家賃 / 人件費 / 決済手数料 / 光熱費 / 雑費 → 営業利益
  全社調整セクション: − 役員報酬 / − 借入返済 / + 物販売益 → 最終会社手残り

【新仕様】
  売上セクション:
    税込み総売上               totalSales
      ├ 税込み提供売上         serviceSales
      └ 税込み物販売上         merchandiseSales
    − 消費税                   consumptionTax
    ─────────────────
    税引き後総売上             totalSalesAfterTax

  原価セクション（大カテゴリー「原価」）:
    − 提供フレーバー原価       flavorCost
    − 炭原価                   charcoalCost
    − ジュース原価             drinkCost
    − 物販フレーバー原価       merchandiseFlavorCost（物販売上×89%）
    ─────────────────
    粗利                       grossProfit

  販管費セクション（大カテゴリー「販管費」）:
    − 家賃                     rent
    − 人件費                   laborCost（労働分配率 = laborCost / grossProfit）
    − 決済手数料               paymentFee
    − 光熱費                   utilities
    − 雑費                     sundries
    − 役員報酬                 execRemuneration（全社集計時のみ）
    ─────────────────
    営業利益                   operatingProfit

  全社調整セクション（全社集計時のみ）:
    − 借入返済                 debtRepayment
    ═════════════════
    純現金収支（会社手残り）   netCashFlow
```

#### 5-3. `BENCHMARK_DEFS` 変更

```js
// 分母を totalSalesAfterTax に統一、変動費率 → 原価率にリネーム
[
  {
    key: 'labor_rate',
    label: '労働分配率',
    getActual: (pl) => pl.laborRate,
    isGood: (a, t) => a <= t
  },
  {
    key: 'gross_profit_margin',
    label: '粗利率',
    // 分母: totalSalesAfterTax（税引き後総売上ベース）
    getActual: (pl) => pl.totalSalesAfterTax > 0 ? pl.grossProfit / pl.totalSalesAfterTax : null,
    isGood: (a, t) => a >= t
  },
  {
    key: 'operating_profit_margin',
    label: '営業利益率',
    // 分母: totalSalesAfterTax（税引き後総売上ベース）
    getActual: (pl) => pl.totalSalesAfterTax > 0 ? pl.operatingProfit / pl.totalSalesAfterTax : null,
    isGood: (a, t) => a >= t
  },
  {
    key: 'cost_ratio',
    label: '原価率',
    // 分母: totalSalesAfterTax（税引き後総売上ベース）
    getActual: (pl) => pl.totalSalesAfterTax > 0 ? pl.costTotal / pl.totalSalesAfterTax : null,
    isGood: (a, t) => a <= t
  },
]
```

#### 5-4. 全社集計ロジック（`loadMonthlyPLCore` の summed 処理）変更

```js
// execRemuneration は sgaTotal に含まれるため calcPL 内で処理済み
// 全社集計後の再計算
summed.execRemuneration = Number(companySettings?.exec_remuneration) || 0
summed.debtRepayment = Number(companySettings?.debt_repayment) || 0
summed.sgaTotal = summed.rent + summed.laborCost + summed.paymentFee + summed.utilities + summed.sundries + summed.execRemuneration
summed.operatingProfit = summed.grossProfit - summed.sgaTotal
summed.netCashFlow = summed.operatingProfit - summed.debtRepayment
summed.laborRate = summed.grossProfit > 0 ? summed.laborCost / summed.grossProfit : null
```

#### 5-5. トレンドチャート（PLTrendChart.vue）

チャートのデータセット定義を更新:
- `totalSales` データセット → `totalSalesAfterTax`（税引き後総売上）
- `finalProfit` / `finalOperatingProfit` → `operatingProfit` に変更
- `preTaxProfit` → `netCashFlow` に変更

---

### Task 6: `src/components/apps/SettingsApp.vue` 変更

#### 6-1. 廃止するセクション

- **物販販売値管理**セクション全体（`pe_merchandise_price_masters` 操作部分）を削除
  - `merchandisePriceMasters` データプロパティ削除
  - `loadMerchandisePriceMasters()` メソッド削除
  - `addMerchandisePrice()` / `deleteMerchandisePrice()` メソッド削除
  - 関連 template 部分削除

#### 6-2. 店舗設定の変更

- 「物販利益率」フィールドを削除（`physical_profit_margin` 廃止）
- 「決済手数料（固定額）」フィールドを削除（`fixed_payment_fee` 廃止）
- 「決済手数料率（%）」フィールドを追加（`payment_fee_rate`）
  - UI 入力は %（例: 2.5）、DB 保存は小数値（例: 0.025）に変換
  - 初期値: 2.5%
- `upsertStoreSettings` の `fields` を上記に合わせて更新

---

### Task 7: PLTrendChart.vue の参照キー更新

`PLTrendChart.vue` 内でデータを参照している箇所を確認し、以下のキーを更新する。

| 旧キー | 新キー |
|--------|--------|
| `totalSales`（売上ライン用） | `totalSalesAfterTax` |
| `finalProfit` / `finalOperatingProfit` | `operatingProfit` |
| `preTaxProfit` | `netCashFlow` |

---

## 7. 実装順序（推奨）

```
[1] DB マイグレーション実行（Supabase SQL Editor）
[2] finance.js 改修（calcPL + PL_NUMERIC_KEYS）
[3] api.js 変更（不要関数の削除）
[4] InputApp.vue 変更（入力項目の変更）
[5] PLApp.vue 変更（表示構造 + loadMonthlyPLCore + BENCHMARK_DEFS）
[6] SettingsApp.vue 変更（物販販売値管理セクション削除）
[7] PLTrendChart.vue 変更（参照キー更新）
[8] DB_MIGRATION.sql 更新（ドキュメントとして追記）
```

---

## 8. マイグレーション実行上の注意

> 既存データとの互換性は考慮しない（テストデータのみ）。すべて DROP / RENAME で完全移行する。

マイグレーション SQL は上から順に実行する。ロールバック不要。

```
[1] pe_monthly_records: RENAME total_sales → service_sales
[2] pe_monthly_records: ADD merchandise_sales
[3] pe_monthly_records: DROP rent / payment_fee / utilities / sundries
[4] pe_store_settings: DROP physical_profit_margin / fixed_payment_fee
[5] pe_store_settings: ADD payment_fee_rate
[6] DROP TABLE pe_merchandise_price_masters
[7] DROP VIEW pe_merchandise_sales_view
```

---

## Related
- [[V-PEACH/notes/V-PEACH_finance-spec]]
- [[V-PEACH/notes/V-PEACH_requirements]]
- ソース: `src/utils/finance.js`
- ソース: `src/components/apps/PLApp.vue`
- ソース: `src/components/apps/InputApp.vue`
- ソース: `src/components/apps/SettingsApp.vue`

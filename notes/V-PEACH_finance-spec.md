---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — 計算ロジック仕様（数値フロー可視化）

> ソース: `src/utils/finance.js` `calcPL()` / `src/components/apps/PLApp.vue`
> 最終更新: 2026-05-16

---

## 1. データ入力元の整理

| 数値 | 入力元 | 備考 |
|------|--------|------|
| `total_sales` | InputApp（月次手入力・必須） | 物販売上を含む総売上 |
| `labor_cost` | InputApp（月次手入力・必須） | |
| `rent` | InputApp（任意） → NULL時 `fixed_rent` | pe_store_settings フォールバック |
| `payment_fee` | InputApp（任意） → NULL時 `fixed_payment_fee` | pe_store_settings フォールバック |
| `utilities` | InputApp（任意） → NULL時 `fixed_utilities` | pe_store_settings フォールバック |
| `sundries` | InputApp（任意） → NULL時 `fixed_sundries` | pe_store_settings フォールバック |
| `merch_count + merch_count_secondary` | V-MINT `flavor_brand_sales`（自動） | 物販販売数量 |
| `total_consumption_g - merch_count × grams_per_pack` | V-MINT `flavor_brand_sales`（自動） | 提供消費g（物販分を除く） |
| `charcoal_nyanco_flat_serve + charcoal_kingco_flat_serve` | V-MINT `cost_reports`（自動） | 炭消費kg |
| `drink_orders.amount` | V-MINT `drink_orders`（自動） | ジュース発注額 |
| `price_flavor_per_g` | V-MINT `cost_price_masters`（参照） | 期間キーで有効な最新価格 |
| `price_charcoal_per_kg` | V-MINT `cost_price_masters`（参照） | 同上 |
| `price_per_unit` | pe_merchandise_price_masters（参照） | 物販販売単価（期間有効価格） |
| `physical_profit_margin` | pe_store_settings（設定） | 物販利益率デフォルト 0.1（10%） |
| `exec_remuneration` | pe_company_settings（設定） | 全社集計時のみ使用 |
| `debt_repayment` | pe_company_settings（設定） | 全社集計時のみ使用 |

---

## 2. 現行の計算フロー（finance.js `calcPL`）

```
【売上分解】
  merchandiseSalesQty  = Σ(merch_count + merch_count_secondary)
  merchandiseSales     = merchandiseSalesQty × price_per_unit
  serviceSales         = MAX(0, total_sales - merchandiseSales)
  merchandiseProfit    = merchandiseSales × physical_profit_margin

【変動費（シーシャ提供コストのみ）】
  flavorServeG    = Σ MAX(0, total_consumption_g - merch_count × grams_per_pack)
  flavorCost      = flavorServeG × price_flavor_per_g
  charcoalCost    = (charcoal_nyanco_flat_serve + charcoal_kingco_flat_serve) × price_charcoal_per_kg
  drinkCost       = Σ drink_orders.amount
  variableCostTotal = flavorCost + charcoalCost + drinkCost

【粗利・固定費】  ⚠️ ここに問題あり（後述）
  grossProfit     = total_sales - variableCostTotal   ← total_salesは物販売上を含む
  laborRate       = laborCost / grossProfit           （grossProfit > 0 のみ）
  fixedCostTotal  = rent + laborCost + paymentFee + utilities + sundries
  operatingProfit = grossProfit - fixedCostTotal

【全社調整（全社集計時のみ）】
  finalProfit     = operatingProfit + merchandiseProfit - execRemuneration - debtRepayment
```

### PL表示上の構造

```
総売上          total_sales
  └ 提供売上    serviceSales
  └ 物販売上    merchandiseSales
─ 変動費        variableCostTotal
  └ フレーバー  flavorCost
  └ 炭          charcoalCost
  └ ジュース    drinkCost
= 粗利          grossProfit             ← ⚠️
─ 固定費        fixedCostTotal
  └ 家賃        rent
  └ 人件費      laborCost  （労働分配率 = laborCost / grossProfit）
  └ 決済手数料  paymentFee
  └ 光熱費      utilities
  └ 雑費        sundries
= 営業利益      operatingProfit         ← ⚠️
─ 役員報酬      execRemuneration        （全社のみ）
─ 借入返済      debtRepayment           （全社のみ）
+ 物販売益      merchandiseProfit       （全社のみ）
= 最終会社手残り finalProfit            （全社のみ）
```

---

## 3. ⚠️ 計算ロジックの問題点：物販原価の未計上

### 問題の内容

`grossProfit = total_sales - variableCostTotal` の計算において、
`total_sales` には物販売上（`merchandiseSales`）が含まれているが、
`variableCostTotal`（変動費）には物販の**仕入原価（COGS）が含まれていない**。

物販の仕入原価 = `merchandiseSales × (1 - physical_profit_margin)`

この仕入原価が差し引かれないまま粗利・営業利益が計算され、
最後に `merchandiseProfit`（物販売益 = 売上 × 利益率）が加算される。

### 数値例

```
total_sales          = 1,500,000 円
  merchandiseSales   =   100,000 円（物販）
  serviceSales       = 1,400,000 円（提供）
physical_profit_margin = 10%
merchandiseCOGS（未計上）= 90,000 円
merchandiseProfit    =  10,000 円

variableCostTotal    =  300,000 円（flavor+charcoal+drink、物販原価を含まない）

--- 現行の計算 ---
grossProfit     = 1,500,000 - 300,000 = 1,200,000  ← 90,000円分の物販原価が混入
operatingProfit = 1,200,000 - 900,000 =   300,000  ← 90,000円過大
finalProfit     = 300,000 + 10,000   =   310,000  ← 90,000円過大

--- 正しい計算（提供ベース） ---
grossProfit     = 1,400,000 - 300,000 = 1,100,000
operatingProfit = 1,100,000 - 900,000 =   200,000
finalProfit     = 200,000 + 10,000   =   210,000  ← 差額 100,000 = 物販売上分
```

### 影響範囲

- `grossProfit`（粗利）: 物販売上分だけ過大
- `operatingProfit`（営業利益）: 同じく過大
- `laborRate`（労働分配率）: 過大な粗利を分母にするため過小評価
- `finalProfit`（最終手残り）: 最終的には物販売上分だけ過大
- ベンチマーク: `gross_profit_margin`・`operating_profit_margin`・`variable_cost_ratio` すべて歪む

---

## 4. 修正案の比較

### 案A：粗利の基準を提供売上（serviceSales）に変更【推奨】

```js
// finance.js calcPL() を修正
const grossProfit = serviceSales - variableCostTotal  // total_sales → serviceSales に変更
```

- 粗利・営業利益 = シーシャ提供事業のみの損益
- 物販は最終手残りラインで `+ merchandiseProfit` として加算（現行構造を維持）
- PLの「粗利」行の意味が明確になる（シーシャ原価に対する粗利）
- **变更箇所**: finance.js 1行のみ

**PL上の見え方（案A後）**

```
提供売上    1,400,000
─ 変動費      300,000
= 粗利      1,100,000  ← シーシャ提供の粗利（正確）
─ 固定費      900,000
= 営業利益    200,000  ← 提供事業の営業利益
+ 物販売益     10,000  ← 物販の純利益（物販売上 × margin）
= 最終手残り  210,000
```

ただし「総売上」行と「粗利」の差が変動費のみでなく物販売上も含む構造になるため、
PLの表示順・表示ラベルもあわせて変更が必要になる可能性あり。

### 案B：物販仕入原価を変動費に加算

```js
const merchandiseCOGS = merchandiseSales * (1 - physicalMargin)
const variableCostTotal = flavorCost + charcoalCost + drinkCost + merchandiseCOGS
// finalProfit 算出時の merchandiseProfit 加算は削除
```

- grossProfit・operatingProfit が正確になる
- `finalProfit = operatingProfit - execRemuneration - debtRepayment`
- 物販をシーシャと同一変動費ラインで扱う構造
- 変動費セクションに「物販仕入」行が追加される

---

## 5. 3ヶ月平均・年次集計での挙動

| 関数 | 挙動 |
|------|------|
| `calcRolling3MonthAvg` | 直近3ヶ月の各指標を単純平均。null月は除外（有効月数で割る） |
| `calcAnnualSum` | 12ヶ月の各指標を合算。データなし月は 0 扱い |
| 両方共通 | `laborRate` は平均/合算後の `laborCost / grossProfit` で再計算（月次の平均ではない） |

> 問題点は月次PL同様。3ヶ月平均・年次集計でも grossProfit の過大評価が引き継がれる。

---

## 6. ベンチマーク定義（healthHighlights）

| key | 表示名 | 計算式 | 良い方向 |
|-----|--------|--------|---------|
| `labor_rate` | 労働分配率 | `laborCost / grossProfit` | ↓ 低いほど良い |
| `gross_profit_margin` | 粗利率 | `grossProfit / totalSales` | ↑ 高いほど良い |
| `operating_profit_margin` | 営業利益率 | `operatingProfit / totalSales` | ↑ 高いほど良い |
| `variable_cost_ratio` | 変動費率 | `variableCostTotal / totalSales` | ↓ 低いほど良い |

> 設定画面から目標値（%）を入力 → DB保存時に `/100` して小数値に変換。読み出し時もそのまま比較。

---

## Related
- [[V-PEACH/notes/V-PEACH_requirements]]
- [[V-PEACH/notes/V-PEACH_architecture]]
- ソース: `src/utils/finance.js`
- ソース: `src/components/apps/PLApp.vue`

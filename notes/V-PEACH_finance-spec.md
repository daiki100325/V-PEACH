---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH 損益計算書（PL）の読み方と運用ガイド

> 対象読者：経営層
> 最終更新：2026-05-25（HRMOS シフト CSV 取込による人件費自動算出 実装完了後）

---

## はじめに

PL画面の数字を、

1. **何が載っているか**（全項目一覧）
2. **どう動くか**（サンプル）
3. **どう読むか**（指標と判断軸）
4. **どう運用するか**（月次入力と設定）

の順で示します。技術仕様はAppendixに分離。

---

## 1. PL全項目 — 載っている数字の全体像

PLは**上から下へ足し引きしながら利益に落ちていく入れ子**です。店舗別画面では **⑱ 営業利益** まで、全社合算ではそのあと **㉑ 純現金収支** まで見ます（役員報酬・借入返済は店舗に按分できないため店舗別には出しません）。太字の **⑤・⑪・⑱・㉑**（税引き後総売上・粗利・営業利益・純現金収支）が経営判断の基準値です。

### 1.1 売上ブロック（①〜⑤）

| # | 項目 | 演算 | 入力／自動 | 店舗 | 全社 |
|:---:|------|-----:|------------|:---:|:---:|
| ① | 提供売上（税込） | — | CSV インポート（Airメイト・割引後） | ○ | ○ |
| ② | 物販売上（税込） | — | CSV インポート（Airメイト） | ○ | ○ |
| ③ | 税込み総売上 | ① + ② | 自動 | ○ | ○ |
| ④ | 消費税相当 | ③ ÷ 11 | 自動（控除） | ○ | ○ |
| ⑤ | **税引き後総売上** | ③ − ④ | 自動 | ○ | ○ |

### 1.2 原価ブロック → 粗利（⑥〜⑪）

| # | 項目 | 演算 | 入力／自動 | 店舗 | 全社 |
|:---:|------|-----:|------------|:---:|:---:|
| ⑥ | 提供フレーバー原価 | — | 在庫システム自動 | ○ | ○ |
| ⑦ | 炭原価 | — | 在庫システム自動 | ○ | ○ |
| ⑧ | ジュース原価 | — | 在庫システム自動 | ○ | ○ |
| ⑨ | 物販フレーバー原価 | ② × 10/11 × 89% | 自動（固定率） | ○ | ○ |
| ⑩ | 原価合計 | ⑥ + ⑦ + ⑧ + ⑨ | 自動 | ○ | ○ |
| ⑪ | **粗利** | **⑤ − ⑩** | 自動 | ○ | ○ |

> **粗利の読み方**：家賃・人件費を払う前の本源的な利益。⑪が⑰を下回れば店舗単体は赤字。

### 1.3 販管費ブロック → 営業利益（⑫〜⑱）

| # | 項目 | 演算 | 入力／自動 | 店舗 | 全社 |
|:---:|------|-----:|------------|:---:|:---:|
| ⑫ | 家賃 | — | 店舗設定（固定） | ○ | ○ |
| ⑬ | 人件費 | — | **HRMOS シフト CSV → 枠数自動算出**（画面A/B に反映）+ 給与総額（画面C 手入力）で算出 | ○ | ○ |
| ⑭ | 決済手数料 | ⑤ × 設定料率 | 自動（売上連動） | ○ | ○ |
| ⑮ | 光熱費 | — | 店舗設定（固定） | ○ | ○ |
| ⑯ | 雑費 | — | 店舗設定（固定） | ○ | ○ |
| ⑰ | 販管費合計 | ⑫ + ⑬ + ⑭ + ⑮ + ⑯ | 自動 | ○ | ○ |
| ⑱ | **営業利益** | **⑪ − ⑰** | 自動 | ○ | ○ |

### 1.4 全社調整 → 純現金収支（⑲〜㉑）※全社合算のみ

| # | 項目 | 演算 | 入力／自動 | 店舗 | 全社 |
|:---:|------|-----:|------------|:---:|:---:|
| ⑲ | 役員報酬 | — | 全社設定（固定） | — | ○ |
| ⑳ | 借入返済 | — | 全社設定（固定） | — | ○ |
| ㉑ | **純現金収支（会社手残り）** | **⑱ − ⑲ − ⑳** | 自動 | — | ○ |

> ⑲⑳を販管費に入れない理由：**店舗別の事業パフォーマンスを比較可能にする**ため。会社全体の支払いは全社合算段階でのみ控除します。

---

## 2. サンプル — 3店舗合算1ヶ月

### 入力した数字

**CSVインポートモードの場合（通常運用）**

| 項目 | 入力方法 | 金額 |
|------|---------|-----:|
| 提供売上（税込） | Airメイト CSV から自動算出 | ¥6,500,000 |
| 物販売上（税込） | Airメイト CSV から自動算出 | ¥500,000 |
| バイト枠数（6h/7.5h × 3店舗） | HRMOS シフト CSV から**自動算出** → 画面A で確認 | — |
| りょーさん枠数（6h/7.5h × 3店舗） | 同上 → 画面B で確認 | — |
| 全店バイト給与＋交通費総額 | 画面C で**手入力**（1マス） | ¥2,000,000 |

### 在庫システムから自動取得

| 項目 | 金額 |
|------|-----:|
| 提供フレーバー原価 | ¥1,000,000 |
| 炭原価 | ¥40,000 |
| ジュース原価 | ¥120,000 |

### PL展開

`▲` は控除・合算ブロックへの足し込みを示します（§1 の記号番号と対応）。

#### 売上

| 項目 | 金額（円） |
|------|----------:|
| ① 提供売上（税込） | 6,500,000 |
| ② 物販売上（税込） | 500,000 |
| **③ 税込み総売上**（①+②） | **7,000,000** |
| ④ 消費税相当（③÷11） | ▲636,364 |
| **⑤ 税引き後総売上**（③−④） | **6,363,636** |

#### 原価 → 粗利

| 項目 | 金額（円） |
|------|----------:|
| ⑥ 提供フレーバー原価 | 1,000,000 |
| ⑦ 炭原価 | 40,000 |
| ⑧ ジュース原価 | 120,000 |
| ⑨ 物販フレーバー原価 | 404,545 |
| **⑩ 原価合計**（⑥+⑦+⑧+⑨） | **▲1,564,545** |
| **⑪ 粗利**（⑤−⑩） | **4,799,091** |

#### 販管費 → 営業利益

| 項目 | 金額（円） |
|------|----------:|
| ⑫ 家賃 | 668,000 |
| ⑬ 人件費 | 2,000,000 |
| ⑭ 決済手数料 | 159,091 |
| ⑮ 光熱費 | 120,000 |
| ⑯ 雑費 | 39,000 |
| **⑰ 販管費合計**（⑫+⑬+⑭+⑮+⑯） | **▲2,986,091** |
| **⑱ 営業利益**（⑪−⑰） | **1,813,000** |

#### 全社調整

| 項目 | 金額（円） |
|------|----------:|
| ⑲ 役員報酬 | ▲550,000 |
| ⑳ 借入返済 | ▲1,000,000 |
| **㉑ 純現金収支**（⑱−⑲−⑳） | **263,000** |

> 自動算出の根拠：消費税相当 = 税込総売上 ÷ 11／物販フレーバー原価 = 物販売上 × 10/11 × 89%／決済手数料 = 税引き後総売上 × 2.5%（その他の入力源は §4 参照）

### 算出される経営指標

| 指標 | 計算 | 結果 | 目安 |
|------|------|-----:|-----:|
| 粗利率 | 粗利 ÷ 税引き後総売上 | 75.4% | 75%以上で良好 |
| 原価率（F比） | 原価合計 ÷ 税引き後総売上 | 24.6% | 粗利率の裏返し |
| 営業利益率 | 営業利益 ÷ 税引き後総売上 | 28.5% | — |
| 労働分配率 | 人件費 ÷ 粗利 | 41.7% | 50%未満で良好 |
| **F比** | 原価合計 ÷ 税引き後総売上 | **24.6%** | — |
| **L比** | 人件費 ÷ 税引き後総売上 | **31.4%** | — |
| **R比** | 家賃合計 ÷ 税引き後総売上 | **10.5%** | — |

> FLR合計 = F比+L比+R比 = **66.5%**。残り33.5%から決済手数料・光熱費・雑費を賄い、営業利益を生み出す。

### 読み取り

**営業利益181万円、役員報酬+借入返済155万円を吸収して純現金収支+26万円の黒字着地**。粗利率75.4%・労働分配率41.7%・営業利益率28.5%とも目安をクリアし健全。物販+10万円は粗利+1万円弱に過ぎないため、引き続き**粗利を伸ばす主戦場は提供売上**で、原価圧縮も合わせて効きます。

---

## 3. 各指標の意味と判断軸

### 売上の2系統と物販原価89%固定

提供売上と物販売上は**原価構造が違うため別管理**。提供売上は実消費の積み上げ（フレーバー・炭・ドリンク）、物販売上は仕入れ価格にわずかな利幅を乗せる商売で実績原価率は概ね89%——毎月実数集計のコストに見合わないため**税抜売上の89%を一律計上**しています。

**判断上の含意**：物販売上100万円 → 粗利は約9万円（税込み売上の約10%）。物販は客単価の底上げ程度のインパクトで、**粗利を伸ばす主戦場は提供売上**。

### 粗利 — 経営の分水嶺

```
粗利 = 税引き後総売上 − 原価合計
```

家賃・人件費を払う前の本源的な利益。**粗利が販管費を下回れば赤字**で、経営判断の起点。目安は粗利率75%以上（店舗別に変更可）。

### 販管費 — 性格別の3区分

| 項目 | 性格 | 月次対応 |
|------|------|----------|
| 人件費（固定給部分） | 固定（担当メンバーの月報酬） | 設定値（`pe_store_settings_revisions.fixed_salary_total`） |
| 人件費（変動部分） | 変動（枠数按分） | HRMOS シフト CSV → 自動算出 / 画面A/B で確認・修正。給与総額は画面C 手入力 |
| 家賃 | 完全固定（契約額） | 設定値 |
| 光熱費・雑費 | 準固定 | 設定値（ブレが大きくなったら見直し） |
| 決済手数料 | 売上連動 | 売上×料率で自動 |

光熱費・雑費は厳密には変動しますが、月次のブレが経営判断を左右するほどではないため設定固定で運用。

### 営業利益と純現金収支の段差

```
営業利益    = 粗利 − 販管費合計
純現金収支 = 営業利益 − 役員報酬 − 借入返済
```

役員報酬と借入返済を販管費に含めず営業利益の後に置くのは、**店舗別の事業パフォーマンスを比較可能にする**ため。会社全体の支払いで店舗帰属できないので全社合算段階でのみ控除。

### FLR比 — 売上に対するコスト占有率

PL中段に常時表示されるサマリー指標。すべて **税引き後総売上を分母**に統一しているため、3つを足した値（FLR合計）が「売上のうちF+L+Rが何%を占めるか」を直読できる。

| 指標 | 計算式 | 解釈 |
|------|--------|------|
| **F比**（原価率） | 原価合計 ÷ 税引き後総売上 | 原材料コストの売上占有率 |
| **L比**（人件費率） | 人件費 ÷ 税引き後総売上 | 労働コストの売上占有率 |
| **R比**（家賃比率） | 家賃 ÷ 税引き後総売上 | 固定賃料の売上占有率 |

> ※「L比」と「労働分配率」の違い：L比は売上比、労働分配率（Health Check）は粗利比。両者は異なる観点の指標で共存する。

### 5つの経営指標（Health Check）

ベンチマーク設定で目標値（%）を管理する指標。FLR比サマリーと重複する F比・L比・R比 も追跡対象に含め、目標値 vs 実績で警告表示する。

| 指標 | 計算式 | 良い方向 | 解釈 |
|------|--------|:-------:|------|
| **F比**（原価率） | 原価合計 ÷ 税引き後総売上 | ↓ | 仕入れ・在庫管理の効率 |
| **L比**（人件費率） | 人件費 ÷ 税引き後総売上 | ↓ | 労働コストの売上占有率 |
| **R比**（家賃比率） | 家賃 ÷ 税引き後総売上 | ↓ | 固定賃料の売上占有率 |
| 営業利益率 | 営業利益 ÷ 税引き後総売上 | ↑ | 販管費まで含めた事業全体の収益性 |
| 労働分配率 | 人件費 ÷ 粗利 | ↓ | 粗利のうち人件費比率。50%超は要注意 |

各項目について目標値を設定でき、実績割れで警告表示。粗利率・原価率は 2026-05-18 に除外（FLR比で代替）。

### 3ヶ月平均・年次集計のクセ

| モード | 各金額 | 比率（粗利率・労働分配率など） |
|--------|--------|----------------------------|
| 月次 | 当月実績 | 当月金額で計算 |
| 3ヶ月平均 | 直近3ヶ月の単純平均（データなし月は除外） | **平均後の金額で再計算** |
| 年次（12ヶ月） | 12ヶ月合算（データなし月は0扱い） | **合算後の金額で再計算** |

> 比率を月次の単純平均で出すと売上規模の小さな月の異常値に引きずられるため、**金額を先に平均/合算してから再計算**する設計。

---

## 4. 月次に入力するもの／設定で変えるもの

### 毎月入力する数字

#### CSV インポートモード（通常運用）

```
Step 0: 年・月選択
Step 1: Airメイト CSV + Airレジ CSV アップロード（3店舗 × 各1ボックス）
Step 2: 売上プレビュー確認（割引前/後・物販・前月キャッシュ参照日数）
Step 3: HRMOS シフト CSV アップロード【任意・通常ここで自動化】
          vangvieng_shifts_YYYYMM.csv を1ファイルアップロード
          → 画面A・B の枠数を自動算出・反映
Step 4（画面A）: バイト枠数 確認・手動調整（3店舗 × 6h/7.5h）
Step 5（画面B）: りょーさん枠数 確認・手動調整（3店舗 × 6h/7.5h）【任意】
Step 6（画面C）: 全店バイト給与＋交通費合計 手入力【月1マス・必須】
Step 7: 確認・保存
```

**シフト CSV を使わない場合**：Step 3 をスキップ → 画面A/B で直接手入力（既存値は保持）。

#### 人件費の算出式

```
店舗人件費 = 店舗別固定給合計（pe_store_settings_revisions.fixed_salary_total）
           + 全店バイト給与＋交通費総額 × 当店バイト重みつき枠数 ÷ 全店合計

重みつき枠数 = 6.0 × 6h枠数 + 7.5 × 7.5h枠数

社長代替コスト（参考・PL非計上）
  = ryo_hourly_rate × (6.0 × ryoSlots6h + 7.5 × ryoSlots7_5h)
```

**枠数の自動算出ルール（HRMOS シフト CSV から）**:
- **バイト枠**：`role = 'part_time'` のスタッフが埋めた全枠（中番6h含む）
- **りょーさん枠**：店舗の営業日において早番・遅番が誰にも埋められていない枠
  - 中番は りょーさん判定対象外
  - 馬場2号店の遅番は土日祝なら 7.5h に補正
  - オールイン枠は 早番7.5h + 遅番6h（土日祝は7.5h）に分解計上
- **固定給メンバー**（立花・木村・中道・塚本）と **社長（ryo）** はバイト枠から除外

これ以外はすべて自動。

### 自動で揃う数字

| 数字 | 取得元 |
|------|--------|
| 提供フレーバー原価・炭原価・ジュース原価 | 在庫システムの月次集計 |
| 物販フレーバー原価 | 物販売上 × 10/11 × 89% |
| 家賃・光熱費・雑費 | 店舗設定値 |
| 決済手数料 | 税引き後総売上 × 料率 |
| 役員報酬・借入返済（全社のみ） | 全社設定値 |

### 設定で固定している値（2026-05-25時点）

**家賃（月額）**

| 店舗 | 月額 |
|------|-----:|
| 馬場本店 | ¥132,000 |
| 中野店 | ¥330,000 |
| 馬場2号店 | ¥206,000 |
| **3店舗合計** | **¥668,000** |

**全店共通**

| 項目 | 値 |
|------|-----:|
| 光熱費（月額） | ¥40,000 |
| 雑費（月額） | ¥13,000 |
| 決済手数料率 | 2.5%（税引き後総売上に対して） |

**見直しタイミング**：契約変更や実態とのズレが大きくなった時点で設定画面から更新。毎月触る性質のものではありません。

---

## Related

- [[V-PEACH/notes/V-PEACH_requirements]] — 要件定義
- [[V-PEACH/notes/V-PEACH_architecture]] — システム構成

---

# Appendix — 開発者・保守担当者向け技術仕様

> ここから先はアプリケーション保守のための技術詳細です。経営判断のためにPLを読む方は不要です。

## A1. データ入力元の対応表

| 数値 | 入力元 | 備考 |
|------|--------|------|
| `service_sales` | Airメイト CSV から自動算出（割引後） | 提供売上（税込） |
| `merchandise_sales` | Airメイト CSV から自動算出 | 物販売上（税込）。空欄=0 |
| `part_time_slots_6h/7_5h` | **HRMOS シフト CSV → `calcSlotsFromShifts` で自動算出 → 画面A で確認・修正** / シフト CSV 未使用時は画面A で直接手入力 | バイトが埋めた枠数（role='part_time'）。重みつき按分の分子 |
| `ryo_slots_6h/7_5h` | **HRMOS シフト CSV → 「埋まっていない早/遅番」を自動算出 → 画面B で確認・修正** / シフト CSV 未使用時は画面B で直接手入力（任意） | 社長が埋めた枠数（推定）。機会費用参考用・PL非計上 |
| `total_variable_payroll` | InputApp 画面C（月次手入力・必須）→ `pe_monthly_company_records` | 全店バイト給与＋交通費総額。HRMOS 給与画面の合計額を1マス入力 |
| `fixed_salary_total` | `pe_store_settings_revisions`（設定値・各店舗固定給合計） | 人件費按分の固定給元 |
| `ryo_hourly_rate` | `pe_company_settings_revisions`（設定値・社長代替時給） | 既定 ¥1,300/h |
| `fixed_rent` | `pe_store_settings`（設定値固定） | 月次入力なし |
| `fixed_utilities` | `pe_store_settings`（設定値固定） | 月次入力なし |
| `fixed_sundries` | `pe_store_settings`（設定値固定） | 月次入力なし |
| `payment_fee_rate` | `pe_store_settings`（設定値） | デフォルト 2.5%。決済手数料 = totalSalesAfterTax × rate |
| `total_consumption_g` / `merch_count` | V-MINT `flavor_brand_sales`（自動） | 提供フレーバー原価の提供分算出に使用 |
| `charcoal_nyanco_flat_serve + charcoal_kingco_flat_serve` | V-MINT `cost_reports`（自動） | 炭消費kg |
| `drink_orders.amount` | V-MINT `drink_orders`（自動） | ジュース原価 |
| `price_flavor_per_g` | V-MINT `cost_price_masters`（参照） | 期間キーで有効な最新価格 |
| `price_charcoal_per_kg` | V-MINT `cost_price_masters`（参照） | 同上 |
| `exec_remuneration` | `pe_company_settings`（設定） | 全社集計時のみ・営業利益から差し引き |
| `debt_repayment` | `pe_company_settings`（設定） | 全社集計時のみ・営業利益から差し引き |

## A2. 計算フロー（`finance.js` `calcPL`）

```
【売上】
  totalSales           = service_sales + merchandise_sales   （税込み総売上）
  consumptionTax       = totalSales / 11                     （消費税）
  totalSalesAfterTax   = totalSales × (10/11)               （税引き後総売上）

【原価】
  flavorServeG         = Σ MAX(0, total_consumption_g - merch_count × grams_per_pack)
  flavorCost           = flavorServeG × price_flavor_per_g   （提供フレーバー原価）
  charcoalCost         = (charcoal_nyanco_flat_serve + charcoal_kingco_flat_serve) × price_charcoal_per_kg
  drinkCost            = Σ drink_orders.amount
  merchandiseFlavorCost = merchandise_sales × (10/11) × 0.89  （物販フレーバー原価・税抜換算後89%固定）
  costTotal            = flavorCost + charcoalCost + drinkCost + merchandiseFlavorCost

【粗利】
  grossProfit          = totalSalesAfterTax - costTotal

【人件費（全社共通変動費 × 店舗枠数按分 + 固定給）】
  pe_monthly_company_records の period_key 行がない月は PL 計算対象外（データなし扱い）
  storeWeightedSlots = 6.0 × part_time_slots_6h + 7.5 × part_time_slots_7_5h
  totalWeightedSlots = 全店舗の storeWeightedSlots 合計
  laborFixed         = fixed_salary_total                （店舗設定・担当メンバー固定給）
  laborVariable      = totalVariablePayroll × storeWeightedSlots / totalWeightedSlots
  laborCost          = laborFixed + laborVariable
  ryoOpportunityCost = ryoHourlyRate × (6.0 × ryo_slots_6h + 7.5 × ryo_slots_7_5h)  （参考・PL非計上）

【販管費（店舗帰属コストのみ）】
  rent                 = pe_store_settings.fixed_rent
  paymentFee           = totalSalesAfterTax × payment_fee_rate  （売上連動）
  utilities            = pe_store_settings.fixed_utilities
  sundries             = pe_store_settings.fixed_sundries
  sgaTotal             = rent + laborCost + paymentFee + utilities + sundries

【利益】
  laborRate            = laborCost / grossProfit  （grossProfit > 0 のとき）
  operatingProfit      = grossProfit - sgaTotal

【全社調整（全社集計時のみ）】
  execRemuneration     = pe_company_settings.exec_remuneration
  debtRepayment        = pe_company_settings.debt_repayment
  netCashFlow          = operatingProfit - execRemuneration - debtRepayment

【FLR比（totalSalesAfterTax > 0 のみ）】
  fRatio               = costTotal / totalSalesAfterTax
  lRatio               = laborCost / totalSalesAfterTax   （売上ベース・laborRate とは別）
  rRatio               = rent / totalSalesAfterTax
```

## A3. 集計関数

| 関数 | 挙動 |
|------|------|
| `calcRolling3MonthAvg` | 直近3ヶ月の各指標を単純平均。null月は除外（有効月数で割る） |
| `calcAnnualSum` | 12ヶ月の各指標を合算。データなし月は 0 扱い |
| 両方共通 | `laborRate` / `fRatio` / `lRatio` / `rRatio` は平均/合算後の金額から再計算（月次の平均ではない） |

## A4. ベンチマーク設定（healthHighlights）

2026-05-18 改修。FLR比をベンチマーク追跡対象に追加し、粗利率・原価率を除外して5指標に統一。

| key | 表示名 | 計算式 | 良い方向 |
|-----|--------|--------|---------|
| `f_ratio` | F比（原価率） | `costTotal / totalSalesAfterTax` | ↓ 低いほど良い |
| `l_ratio` | L比（人件費率） | `laborCost / totalSalesAfterTax` | ↓ 低いほど良い |
| `r_ratio` | R比（家賃比率） | `rent / totalSalesAfterTax` | ↓ 低いほど良い |
| `operating_profit_margin` | 営業利益率 | `operatingProfit / totalSalesAfterTax` | ↑ 高いほど良い |
| `labor_rate` | 労働分配率 | `laborCost / grossProfit` | ↓ 低いほど良い |

> 設定画面から目標値（%）を入力 → DB保存時に `/100` して小数値に変換。読み出し時もそのまま比較。

## A5. FLR比サマリー

`PLApp.vue` のHealth Check直上に常時表示（`v-if` なし）。データなし（`plResult = null`）時は `displayPL` のフォールバックで各値が `null` となり「—」表示。

| フィールド | 計算元 | UI表示名 |
|-----------|--------|---------|
| `fRatio` | `calcPL()` / 全社集計分岐 | F比（原価率） |
| `lRatio` | `calcPL()` / 全社集計分岐 | L比（人件費率） |
| `rRatio` | `calcPL()` / 全社集計分岐 | R比（家賃比率） |

## A6. HRMOS シフト CSV 取込パイプライン

月次入力 CSV モードで `vangvieng_shifts_YYYYMM.csv` を Step 3 にアップロードすると、以下のパイプラインで `pe_monthly_records` の枠数列が自動算出される。

```
vangvieng_shifts_YYYYMM.csv（Shift_JIS）
  ↓ readShiftJisFile() → parseHrmosShiftsCsv()  [csvImporter.js]
  ↓ [{ staffId, date, segmentId }, ...]  raw行配列
  ↓ calcSlotsFromShifts(rows, staffsById, segmentsById, holidaySet, targetPeriodKey)
    [shiftImporter.js]
    1. 各行を「店舗×日付×シフトタイプ」に正規化
       - is_payroll_target=false（倉庫業務/営業中/特殊枠）はスキップ
       - allin（オールイン）→ 早番7.5h + 遅番(6h or 土日祝馬場2号店7.5h) に分解
       - 馬場2号店の遅番は土日祝 → 7.5h に補正
    2. 「埋まっていない早番/遅番」をりょーさん枠として算出
       （店舗の営業日 = その店舗にレコードが1件以上ある日。中番は対象外）
    3. バイト枠を集計（role='part_time' のみ。fixed_salary・owner_ryo は除外）
  ↓ { slots: { baba_main: { pt6h, pt7_5h, ryo6h, ryo7_5h }, ... }, warnings, diagnostics }
  ↓ InputApp.vue が laborSlots に反映（画面A/B に表示・編集可能）
  ↓ 保存時に pe_monthly_records.part_time_slots_* / ryo_slots_* に upsert
```

**マスタ依存**：`pe_hrmos_staffs`（role 判定）/ `pe_hrmos_segments`（店舗・シフトタイプ・按分対象判定）/ `pe_jp_holidays`（土日祝判定）。マスタ未登録時はエラー表示し保存不可。

**祝日データ**：`fetchJpHolidaysCached()` [jpHolidaysClient.js] が holidays-jp API → `pe_jp_holidays` キャッシュから取得。30日経過でバックグラウンド更新。

**フォールバック**：シフト CSV をアップロードしなかった場合は Step 3 をスキップし、画面A/B で従来どおり手入力。計算式・保存先は変わらない。

## A7. 参照ソース

- `src/utils/finance.js`（`calcPL` 本体）
- `src/utils/shiftImporter.js`（`calcSlotsFromShifts`・シフト CSV 計算ロジック）
- `src/utils/jpHolidaysClient.js`（祝日キャッシュ）
- `src/utils/csvImporter.js`（`parseHrmosShiftsCsv` ほか CSV 解析）
- `src/components/apps/PLApp.vue`（PL画面）
- `src/components/apps/InputApp.vue`（月次入力フロー）
- `src/components/apps/SettingsApp.vue`（HRMOS マスタ管理・祝日マスタ）

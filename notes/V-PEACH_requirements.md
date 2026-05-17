---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — Requirements

## Summary
- 現場データ（V-MINT 2.0）と財務データを結合し、「次の一手（投資・是正）」を導き出す戦略的経営ダッシュボード
- 月次・年次PLの簡便な作成・確認と、投資判断の根拠提示が主目的
- 対象ユーザー：店舗オーナー / 経営層
- 対象拠点：馬場本店 / 中野店 / 馬場2号店（全店舗総計 + 各店個別でPL表示）

## 財務ロジック定義

### PL構造

```
税込み総売上                    service_sales + merchandise_sales
  ├ 税込み提供売上              InputApp 月次手入力
  └ 税込み物販売上              InputApp 月次手入力
  − 消費税（× 1/11）
──────────────────────────────
税引き後総売上（× 10/11）

【原価】
  − 提供フレーバー原価          V-MINT（提供消費g × price_flavor_per_g）
  − 炭原価                      V-MINT（炭消費kg × price_charcoal_per_kg）
  − ジュース原価                V-MINT（drink_orders.amount）
  − 物販フレーバー原価          merchandise_sales × 89%（固定）
──────────────────────────────
粗利

【販管費】
  − 家賃                        pe_store_settings.fixed_rent（設定値固定）
  − 人件費                      InputApp 月次手入力（必須）
  − 決済手数料                  totalSalesAfterTax × payment_fee_rate（売上連動）
  − 光熱費                      pe_store_settings.fixed_utilities（設定値固定）
  − 雑費                        pe_store_settings.fixed_sundries（設定値固定）
  − 役員報酬                    pe_company_settings（全社集計時のみ）
──────────────────────────────
営業利益

  − 借入返済                    pe_company_settings（全社集計時のみ）
══════════════════════════════
純現金収支（会社手残り）        （全社集計時のみ）
```

### 指標一覧

| 指標 | 計算式 | 分母基準 |
|------|--------|---------|
| 税込み総売上 | `service_sales + merchandise_sales` | — |
| 消費税 | `totalSales × (1/11)` | — |
| 税引き後総売上 | `totalSales × (10/11)` | — |
| 物販フレーバー原価 | `merchandise_sales × 0.89` | — |
| 原価合計 | `flavorCost + charcoalCost + drinkCost + merchandiseFlavorCost` | — |
| 粗利 | `totalSalesAfterTax − costTotal` | — |
| 販管費合計 | `rent + laborCost + paymentFee + utilities + sundries + execRemuneration` | — |
| 営業利益 | `grossProfit − sgaTotal` | — |
| 純現金収支 | `operatingProfit − debtRepayment` | 全社のみ |
| 粗利率 | `grossProfit / totalSalesAfterTax` | 税引き後総売上 |
| 原価率 | `costTotal / totalSalesAfterTax` | 税引き後総売上 |
| 労働分配率 | `laborCost / grossProfit`（grossProfit > 0 のみ） | — |
| 営業利益率 | `operatingProfit / totalSalesAfterTax` | 税引き後総売上 |

## 月次入力項目

InputApp.vue で毎月入力する項目（**3項目のみ**）：

| 項目 | 必須 | 備考 |
|------|------|------|
| 提供売上（税込） | ✅ | 旧 `total_sales` から分離 |
| 物販売上（税込） | 任意 | 空欄 = 0 扱い |
| 人件費 | ✅ | |

家賃・光熱費・雑費は `pe_store_settings` の設定値を強制適用（月次入力なし）。
決済手数料は `totalSalesAfterTax × payment_fee_rate` で自動計算。
役員報酬・借入返済は設定モード → 会社共通費から一括設定。全社集計PLにのみ反映。

## モード別仕様

ポータルトップから以下3モードを選択する。デザインは V-MINT 2.0 を踏襲。

### (1) PLモード（分析・投資判断画面）

**フィルター（画面上部で切り替え）**
- 期間：月次 / 3ヶ月平均 / 年次
- 拠点：全店舗 / 馬場本店 / 中野店 / 馬場2号店

**ビジュアルPL**
- 左側に経費・利益、右側に収益を配置した対照表
- Health Highlight：設定した目標値（数値 or %）に対し、超過=RED・余剰=GREEN で表示

**トレンドチャート（折れ線）**

| 期間モード | 表示範囲 |
|-----------|---------|
| 月次 | 参照月が含まれる1年分（例：2026年5月参照 → 2026年1〜12月） |
| 3ヶ月平均 | 月次と同様の年範囲で、各月の直近3ヶ月平均値をプロット |
| 年次 | 年度別の推移（2026年・2027年・2028年…） |

### (2) 月次入力モード（データ投入画面）

V-MINT 2.0 の原価計算モードUIを参考にしたステップ入力：

- Step 1：総売上入力（前月実績をプレースホルダに表示）
- Step 2：各経費入力（設定で固定済みのものは自動入力、微調整のみ）
- Step 3：人件費・その他費用の入力
- バリデーション：異常値入力時アラート

### (3) 設定モード（マスター管理画面）

以下2つのサブモードで構成：

- **店舗設定**：家賃・光熱費・雑費（固定額）・決済手数料率（%）を店舗ごとに設定
- **会社共通費**：役員報酬・借入返済を全社共通で設定（全社集計PLにのみ反映）
- **目標値（Benchmark）設定**：各指標の目標を% で設定。労働分配率・粗利率・営業利益率・原価率

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/CHANGELOG_DEV]]
- [[V-PEACH/notes/V-PEACH_architecture]]

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
| 労働分配率 | `laborCost / grossProfit`（grossProfit > 0 のみ） | 粗利 |
| 営業利益率 | `operatingProfit / totalSalesAfterTax` | 税引き後総売上 |
| **F比** | `costTotal / totalSalesAfterTax` | 税引き後総売上 |
| **L比** | `laborCost / totalSalesAfterTax` | 税引き後総売上 |
| **R比** | `rent / totalSalesAfterTax` | 税引き後総売上 |

> FLR比はHealth Checkとは独立したサマリーセクション（PLの中段）に常時表示。L比は売上ベース（※ベンチマークの「労働分配率」は粗利ベースで別計算）。

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

**シングルページ構成**（フィルター + PL表示を1画面に統合）

**フィルター（画面上部で切り替え）**
- 期間：月次 / 3ヶ月平均 / 年次
- 拠点：全店舗 / 馬場本店 / 中野店 / 馬場2号店

**ビジュアルPL**
- 売上→原価→粗利→販管費→営業利益の縦積み構造
- **FLR比サマリー**（Health Check の上）：F比・L比・R比を横並び3カードで常時表示。データなし時はハイフン
- Health Highlight：設定した目標値（%）に対し、超過=RED・余剰=GREEN で表示

**トレンドチャート（折れ線）**

| 期間モード | 表示範囲 |
|-----------|---------|
| 月次 | 参照月が含まれる直近12ヶ月 |
| 3ヶ月平均 | 直近12ヶ月の各月直近3ヶ月平均値をプロット |
| 年次 | 指定年の12ヶ月分 |

チャートは全PL項目＋FLR比を表示可能。カテゴリー別ボタン（売上・原価・利益・FLR比・販管費）をタップしてエクスパンド、指標ごとにON/OFFを切替。初期表示は「税込総売上・F比・L比・R比・会社手残り」のみ。Y軸は二重軸（左：金額万円、右：%）。

### (2) 月次入力モード（データ投入画面）

全3店舗を連続入力できる一括フロー：

- Step 1：期間選択（YYYY年MM月）
- Step 2：各店舗の 3 項目入力（提供売上・物販売上・人件費）を連続入力。V-MINT 集計期間（start_date / end_date）を参照表示
- Step 3：確認・保存（3店舗 upsert）
- バリデーション：提供売上・人件費は必須。未入力では次ステップに進めない

### (3) 設定モード（マスター管理画面）

サブモードは3種。いずれも **`effective_from`（YYYYMM）付き改定履歴** で管理し、PL 計算時は期間に応じた有効値を自動選択する。

| サブモード | 内容 |
|-----------|------|
| **店舗別固定費** | 家賃・光熱費・雑費（固定額）・決済手数料率（%）を店舗ごとに管理。1店舗表示＋ピルセレクター方式で店舗切替 |
| **全社共通費** | 役員報酬・借入返済を全社共通で管理（全社集計PLにのみ反映） |
| **ベンチマーク設定** | 4指標（労働分配率・粗利率・営業利益率・原価率）の目標値（%）を1行に集約して管理 |

**改定履歴 UI の共通動作**
- 「現在適用中」（最新行）と「改定履歴」（過去行一覧）を2段表示
- 「新規改定を追加」フォームから `effective_from` + 設定値を入力して追加
- 現在適用中レコードは **2件以上ある場合のみ**削除ボタンを表示（1件だけの場合は削除不可）

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/CHANGELOG_DEV]]
- [[V-PEACH/notes/V-PEACH_architecture]]

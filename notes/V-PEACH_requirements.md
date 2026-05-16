---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — Requirements

## Summary
- 現場データ（V-MINT 2.0）と財務データを結合し、「次の一手（投資・是正）」を導き出す戦略的経営ダッシュボード
- 月次・年次PLの簡便な作成・確認と、投資判断の根拠提示が主目的
- 対象ユーザー：店舗オーナー / 経営者
- 対象拠点：馬場本店 / 中野店 / 馬場2号店（全店舗総計 + 各店個別でPL表示）

## 財務ロジック定義

| 指標 | 計算式 | データソース |
|------|--------|------------|
| 物販売上 | 物販販売数量 × pe_merchandise_price_masters.price_per_unit | V-MINT `flavor_brand_sales.merch_count + merch_count_secondary` |
| 提供売上 | MAX(0, 総売上 − 物販売上) | 計算値 |
| 物販売益 | 物販売上 × physical_profit_margin（デフォルト10%） | pe_store_settings.physical_profit_margin |
| フレーバー変動費 | 提供消費g × price_flavor_per_g | V-MINT cost_price_masters |
| 炭変動費 | 炭消費kg × price_charcoal_per_kg | V-MINT cost_price_masters |
| ジュース変動費 | drink_orders.amount の合計 | V-MINT drink_orders |
| 変動費合計 | フレーバー + 炭 + ジュース | 計算値 |
| 粗利 | 総売上 − 変動費合計 ⚠️ | 計算値（※詳細は finance-spec 参照） |
| 労働分配率 | 人件費 / 粗利（粗利>0 のときのみ） | 計算値 |
| 固定費合計 | 家賃 + 人件費 + 決済手数料 + 光熱費 + 雑費 | pe_monthly_records（NULL時は pe_store_settings フォールバック） |
| 営業利益 | 粗利 − 固定費合計 | 計算値 |
| 最終会社手残り | 営業利益 + 物販売益 − 役員報酬 − 借入返済（全社集計時のみ） | pe_company_settings |

> ⚠️ **粗利の計算基準について検討中**: 現行実装では `粗利 = 総売上（物販含む） − 変動費`。物販の仕入原価が変動費に含まれないため、粗利に物販仕入原価が混入している。→ [[V-PEACH/notes/V-PEACH_finance-spec]] 参照

## 月次入力項目

InputApp.vue で毎月入力する項目：

| 項目 | 必須 | NULL時のフォールバック |
|------|------|----------------------|
| 総売上 | ✅ | なし |
| 人件費 | ✅ | なし |
| 家賃 | 任意 | pe_store_settings.fixed_rent |
| 決済手数料 | 任意 | pe_store_settings.fixed_payment_fee |
| 光熱費 | 任意 | pe_store_settings.fixed_utilities |
| 雑費 | 任意 | pe_store_settings.fixed_sundries |

> 役員報酬・借入返済は月次入力から削除済み。設定モード → 会社共通費から一括設定。全社集計PLにのみ反映される。

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

- **定数・定率設定**：入力簡便化のため固定するインプット指標（家賃・光熱費・雑費・物販利益率など）を店舗ごとに設定
- **目標値（Benchmark）設定**：各経費項目の目標を数値（円）または割合（%）で設定。人件費率・原価率・利益率など

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/CHANGELOG_DEV]]
- [[V-PEACH/notes/V-PEACH_architecture]]

---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — Requirements

## 正式名称
- **V-PEACH** = **VANGVIENG Profit and Expense Analysis for Corporate Health**
- ブランド表記：略称（V-PEACH）を主、正式名称を副として PIN 認証画面・ヘッダー左上ロゴに併記する

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

InputApp.vue の月次入力は **CSV インポートのみ**。各店舗の Airメイト + Airレジ CSV で売上を、HRMOS シフト CSV で枠数を自動算出する。当月のバイト給与＋交通費総額のみ手入力。

### CSV インポートフロー（通常運用）

| 項目 | 入力方法 | 必須 |
|------|---------|------|
| 提供売上（税込） | Airメイト + Airレジ CSV から自動算出（割引後） | ✅（再編集時は DB 値で代用可） |
| 物販売上（税込） | Airメイト CSV から自動算出 | ✅（再編集時は DB 値で代用可） |
| バイト枠数（6h / 7.5h） | HRMOS シフト CSV から自動算出（プレビューのみ） | ✅（再編集時は DB 値で代用可） |
| りょーさん枠数（6h / 7.5h） | HRMOS シフト CSV から自動算出（プレビューのみ・参考値用） | 同上 |
| バイト給与+交通費総額 | 全社合計額を手入力 | ✅ |

> **再編集モード**：対象月を選んだ時点で全店の `pe_monthly_records` が揃っていれば「再編集モード」として自動認識。CSV 未アップロードの店舗は DB 既存値をそのまま使用する。新規月は CSV 必須（売上・シフトとも）。

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

| 期間モード | 表示範囲 | ラベル | タイトル |
|-----------|---------|--------|--------|
| 月次 | 参照月が属する年の**1〜12月** | 1月〜12月 | 月次推移（YYYY年） |
| 3ヶ月平均 | 参照月が属する年の**1〜12月**（平均値PL自体は参照月含む直近3ヶ月の平均） | 1月〜12月 | 月次推移（YYYY年） |
| 年次 | 選択年を終点に**直近最大12年**（最小開始年 2026） | 2026年〜YYYY年 | 年次推移（直近12年） |

チャートは全PL項目＋FLR比を表示可能。カテゴリー別ボタン（売上・原価・利益・FLR比・販管費）をタップしてエクスパンド、指標ごとにON/OFFを切替。初期表示は「税込総売上・F比・L比・R比・会社手残り」のみ。Y軸は二重軸（左：金額万円、右：%）。

### (2) 月次入力モード（データ投入画面）

**Step 0：対象月選択**
- 年・月を選択すると「開始する」ボタン下に全店舗の V-MINT 集計期間カードを自動表示（`cost_reports.start_date / end_date`・日数）

**CSV インポートフロー（6 ステップ）**
- Step 1：売上 CSV アップロード。1つの一括アップロードボタンで最大6ファイル（3店舗 × Airメイト/Airレジ）をまとめて選択する。ファイル名に「馬場本店」「中野店」「馬場2号店」のいずれかを含めることで店舗を自動判定し、ヘッダー内容（「カテゴリー」「売上合計」vs「集計期間」「割引額」）で Airメイト/Airレジを自動振り分け。振り分け結果は店舗別ステータス表示で確認。誤アップロードは「削除」ボタンでスロット単体クリア。
  - Airレジは「当月暦月全体」指定。前月最終盤は `pe_daily_sales_cache` から自動取得
  - Airメイトは各店舗の V-MINT 集計期間を指定
  - 店舗名が検出できないファイルはグローバル警告として上部に表示
  - **再編集モード**：全店の既存月次レコードが揃っていれば CSV 未アップロードでも DB 既存値で進行可。バナーで明示。
- Step 2：売上プレビュー（店舗別・割引前/後・割引総額・前月キャッシュ参照日数・ソース表示「CSV / DB既存値」）。**読み取り専用**。
- Step 3：HRMOS シフト CSV 取込。「シフトCSVを選択」ボタン（Step 1 と同スタイル）から `vangvieng_shifts_YYYYMM.csv` をアップロードすると各店舗の枠数（バイト・りょーさん）を自動算出。選択後はファイル名と「削除」ボタンを表示。取込結果・エラー・状態はステータスカードに分離表示。新規月は必須・再編集モードは DB 既存値で代用可（全店舗の枠数サマリーをバナー内に表示）。
- Step 4：人件費プレビュー（画面 A・B 統合）。バイト枠・りょーさん枠の 6h / 7.5h 枠数と重みつき枠数を **読み取り専用** で表示。ソース（シフトCSV / DB既存値）をバナーで明示。
- Step 5：当月の全店バイト給与＋交通費合計を**手入力**（CSV 化不可なため現行通り）。
- Step 6：最終確認画面。
- 保存：`pe_monthly_records` upsert（売上 + 枠数）+ `pe_monthly_company_records` upsert（総額）+ `pe_daily_sales_cache` upsert（CSV あり店舗のみ）+ 古いキャッシュ削除（CSV を新たに取り込んだ店舗のみ）

### (3) 設定モード（マスター管理画面）

サブモードは3種。いずれも **`effective_from`（YYYYMM）付き改定履歴** で管理し、PL 計算時は期間に応じた有効値を自動選択する。

| サブモード | 内容 |
|-----------|------|
| **店舗別固定費** | 家賃・光熱費・雑費（固定額）・決済手数料率（%）を店舗ごとに管理。1店舗表示＋ピルセレクター方式で店舗切替 |
| **全社共通費** | 役員報酬・借入返済を全社共通で管理（全社集計PLにのみ反映） |
| **ベンチマーク設定** | 5指標（F比・L比・R比・営業利益率・労働分配率）の目標値（%）を1行に集約して管理（粗利率・原価率は除外） |

**改定履歴 UI の共通動作**
- 「現在適用中」（最新行）と「改定履歴」（過去行一覧）を2段表示
- 「新規改定を追加」フォームから `effective_from` + 設定値を入力して追加
- 現在適用中レコードは **2件以上ある場合のみ**削除ボタンを表示（1件だけの場合は削除不可）

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/CHANGELOG_DEV]]
- [[V-PEACH/notes/V-PEACH_architecture]]

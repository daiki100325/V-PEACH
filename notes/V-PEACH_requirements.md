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
- 対象拠点：`stores` テーブルで管理する稼働中の全 `shop` 店舗（全店舗総計 + 各店個別でPL表示）。店舗の追加・休止・閉店は V-PEACH 設定「店舗管理」で一元管理する

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
- 拠点：全店舗 + 稼働中の各店舗（`is_active=true` の `shop` 行）。「休止店舗も表示」トグル ON で休止店舗も「（休止）」印付きで追加表示

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
| **店舗管理** | 店舗の追加ウィザード（3ステップ一発確定）・名称変更・休止/再開・表示順並べ替え。`store_key` は作成時のみ設定可（以後ロック）。V-PEACH が店舗マスタの単一情報源（V-MINT は読み取り専用） |
| **店舗別固定費** | 家賃・光熱費・雑費（固定額）・決済手数料率（%）を店舗ごとに管理。1店舗表示＋ピルセレクター方式で店舗切替 |
| **全社共通費** | 役員報酬・借入返済を全社共通で管理（全社集計PLにのみ反映） |
| **ベンチマーク設定** | 5指標（F比・L比・R比・営業利益率・労働分配率）の目標値（%）を1行に集約して管理（粗利率・原価率は除外） |

**改定履歴 UI の共通動作**
- 「現在適用中」（最新行）と「改定履歴」（過去行一覧）を2段表示
- 「新規改定を追加」フォームから `effective_from` + 設定値を入力して追加
- 現在適用中レコードは **2件以上ある場合のみ**削除ボタンを表示（1件だけの場合は削除不可）

**店舗管理（R5 単一情報源・R6〜R8）**

- **単一情報源**: `stores` テーブルの CRUD は V-PEACH `SettingsApp` に集約。V-MINT は参照のみ（書き込み口なし）
- **一覧・編集**: `store_type='shop'` の行のみ表示（`office` は除外）。名称インライン編集・休止/再開（確認ダイアログ付き）・↑↓ 表示順並べ替え
- **閉店（休止化）**: `is_active=false` + `closed_at=操作日` の論理削除。物理削除なし
  - 閉店月まで：PL 集計・人件費按分分母に含む
  - 閉店翌月以降：PL 集計・人件費按分分母から明示除外（`storeFilters.isStoreOpenForPeriod`）
- **`store_key`**: 作成時のみ入力可（正規表現 `^[a-z][a-z0-9_]{1,29}$`）。作成後は変更不可（ロック）。`name`（表示名）は後から編集可
- **新店舗追加ウィザード（一発確定・途中保存なし）**:
  - Step 1: 表示名 / `store_key` / 適用開始月（YYYYMM）
  - Step 2: 固定費 5 項目（家賃・光熱費・雑費・決済手数料率・固定給合計）— 全項目必須・非負
  - Step 3: シフト枠時間ルール（早番 / 中番 / 遅番 × 平日 / 土日祝 の 6 マス・6h / 7.5h）
  - 確定時に `create_store_atomic` RPC で `stores`・`pe_store_settings`（現行値）・`pe_store_settings_revisions`（初期世代）・`pe_store_shift_rules` 6 行を単一トランザクションで一括 insert。失敗時ロールバック（半端な店舗を残さない）
- **シフト枠時間ルール（R8）**: `pe_store_shift_rules`（店舗 × シフト種別 × 日種別・`effective_from` 世代管理）でデータ化。旧来の馬場2号店ハードコードを一般化
- **休止店舗表示トグル（R3）**: `app_ui_settings.show_inactive_stores`（DB 共有・シングルトン）を V-MINT と共同参照。PL セレクタで「（休止）」印付き追加表示

> Source: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]] §2（R1〜R8）・§4-4

### 認可状況モード（2026-06-15 新設）

財務省に認可された**パイプたばこ銘柄**を Supabase で一元管理する。従来 Google スプレッドシートで属人管理し、財務省 PDF を手動転記していたものを置換。**「製造たばこの区分」が「パイプたばこ」の行のみ**対象（紙巻・葉巻等は捨象）。

- **サブモード「閲覧」**: `pe_approval_items` の一覧。**右下 FAB（絞り込み）をタップでスライドアップ・パネル**（IORI 参照）が開き、ブランド絞り込み（**複数選択チェックボックス・OR 検索**＝`.in('brand', [...])`）・銘柄名の部分一致検索（`ilike`）・**並び替え**（名前 昇順/降順・認可日 昇順/降順）を操作。行展開で価格変更履歴（`pe_approval_price_history`）。**全件取得**（PostgREST の 1 リクエスト 1000 行上限を `.range()` の分割取得で回避）。DOM 負荷対策で **200 件ずつ「もっと見る」(+300)** の段階表示。アクティブな条件があると FAB にリング表示。
- **最終更新日時の常時表示**: ヘッダー右に「最終更新日時: YYYY-MM-DD HH:MM」を常時表示（閲覧・更新どちらのサブモードでも見える）。`getApprovalLastUpdated()` が `pe_approval_items.updated_at` と `pe_approval_price_history.created_at` の新しい方を返す。更新確定後に自動で再取得。運用上「その日までの未反映分を全部反映」するため、どの月日まで反映済みかを一目で確認できる（reqs §1）。
- **サブモード「更新」**: 財務省 PDF（新規認可 / 変更認可をトグルで選択・**複数ファイル可**）をアップロード → Edge Function `parse-approval-pdf`（Gemini）でパイプたばこ行のみ構造化抽出（複数PDFは逐次解析・進捗 n/N 表示・PDF間の同名同重量を重複除去）→ **プレビュー（手修正・行削除可）** → 確定で DB 反映。新規挿入時はブランドを既存 DB の正式表記へ統一（`normalizeBrand`＋既存表記スナップ）。
  - **新フォーマット対応（2026-04-17 以降）**: 財務省 PDF が「ブランド名」と「銘柄名」の列を分離。①セル結合列（ブランド名・製造国）で空欄になった行は直前の値を引き継ぐ（Gemini プロンプト＋フロントのファイル単位キャリーフォワードの二重防御）。②`product_name` は既存 DB 命名（"ブランド名 銘柄名"）に合わせ **スマート前置**で復元：銘柄名がブランド名で始まっていなければ `ブランド名 + 半角スペース + 銘柄名`、既に含むなら二重化しない（reqs §2）。
  - **認可日のファイル名プレフィル**: アップロード PDF のファイル名先頭 `YYYYMMDD`（例 `20260417_kouriteika.pdf`）を `YYYY-MM-DD` に変換し、新規認可の `approval_date` / 変更認可の `changed_on` の初期値にセット（手入力の手間を削減・手修正可）（reqs §3）。
  - 新規認可: 各行を新規銘柄として INSERT。**重複判定は「銘柄名（正規化）＋容量（重量g）」の両方一致時のみ**『重複（追加不要）』とし、同名でも容量が違えば別商品として新規追加（reqs §4）。
  - 変更認可: 抽出行を既存銘柄に正規化キーでマッチング（銘柄名＋重量g 一致を優先、名前が一意なら容量差を無視して紐付け）。マッチ行は現行価格を更新し履歴を追加。未マッチ行は手動リンク（同ブランド候補から選択）または削除。
- **データモデル**: 正規化2テーブル（銘柄マスタ + 価格履歴）。`current_price` 導出規則は CSV 由来データで「小売定価 ?? pair1価格（日付なし＝現行）?? null」。
- **PDF 抽出の前提**: 財務省 PDF はテキスト層が壊れている（`Crypt` filter／カスタムフォント）ため LLM 方式を採用。詳細は [[V-PEACH/DECISIONS]] ADR-20260615-01。
- **運用前提**: Edge Function に Supabase secret `GEMINI_API_KEY` の設定が必要。

> Source: [[V-PEACH/DECISIONS]] ADR-20260615-01 ／ `src/components/apps/ApprovalApp.vue`・`supabase/functions/parse-approval-pdf/`

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/CHANGELOG_DEV]]
- [[V-PEACH/notes/V-PEACH_architecture]]

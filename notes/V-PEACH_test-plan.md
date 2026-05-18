---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — テスト計画

> 作成日: 2026-05-17（Phase 7 テストケース追加: 2026-05-18）
> 対象: Phase 0〜7 完了後の一通り機能（設定 → CSV インポート / 月次入力 → PL分析）  
> 前提: Supabase の `pe_*` テーブルはマイグレーション済みだが **レコードが空** の状態から開始

## 1. 目的とスコープ

| 項目 | 内容 |
|------|------|
| **目的** | 本番相当環境で「設定 → 入力（CSV / 手入力） → PL表示」が一連で動くことを確認し、Phase 5〜7 改修後の計算ロジックを検証する |
| **対象** | PIN認証、ポータル、設定モード、月次入力モード（CSV インポート / 手入力）、PLモード（月次 / 3ヶ月平均 / 年次、全社・店舗別） |
| **対象外** | 自動単体テスト（未整備）、パフォーマンス負荷試験、RLS ポリシー詳細監査、Cloudflare 本番デプロイ手順そのもの |

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
-- pe_* テーブル存在確認
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'pe_%'
ORDER BY table_name;

-- Phase 5 改修後スキーマ確認（pe_monthly_records）
SELECT column_name FROM information_schema.columns
WHERE table_name = 'pe_monthly_records'
ORDER BY ordinal_position;
-- 期待: service_sales, merchandise_sales, labor_cost（rent/payment_fee 等は無い）

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
[Phase A] 店舗固定費（pe_store_settings）
    ↓
[Phase B] 全社共通費（pe_company_settings）
    ↓
[Phase C] ベンチマーク（pe_benchmarks）※任意だが Health Check 検証に推奨
    ↓
[Phase D] 月次実績（pe_monthly_records）— SQL 一括 or UI 入力
    ↓
[Phase E] PL 画面で集計・表示・チャート確認
```

### 3.1 マスタデータ（Phase A〜C）

#### 店舗固定費（実運用値ベース）

Source: [[V-PEACH/notes/V-PEACH_finance-spec]] §4

| 店舗 | `fixed_rent` | `fixed_utilities` | `fixed_sundries` | `payment_fee_rate` |
|------|-------------:|------------------:|-----------------:|-------------------:|
| 馬場本店 | 132,000 | 40,000 | 13,000 | 0.025 |
| 中野店 | 330,000 | 40,000 | 13,000 | 0.025 |
| 馬場2号店 | 206,000 | 40,000 | 13,000 | 0.025 |

#### 全社共通費（検証用サンプル）

| 項目 | 値 |
|------|---:|
| `exec_remuneration` | 550,000 |
| `debt_repayment` | 1,000,000 |

#### ベンチマーク（Health Check 用・5指標）

| キー | 目標（UI 入力 %） | DB 保存値 | 良い方向 |
|------|------------------:|----------:|---------|
| `f_ratio` | 25 | 0.25 | 実績 ≤ 目標 |
| `l_ratio` | 35 | 0.35 | 実績 ≤ 目標 |
| `r_ratio` | 15 | 0.15 | 実績 ≤ 目標 |
| `operating_profit_margin` | 25 | 0.25 | 実績 ≥ 目標 |
| `labor_rate` | 50 | 0.50 | 実績 ≤ 目標 |

### 3.2 月次実績（Phase D）

**テスト期間**: `202601`〜`202603`（3ヶ月分）を基本セット。年次・3ヶ月平均・トレンドチャート検証に使用。

#### パターン設計

| 目的 | 内容 |
|------|------|
| 店舗差 | 3 店舗で売上規模・人件費を変える |
| 物販あり/なし | 馬場2号店は `merchandise_sales = 0` で物販原価 0 を確認 |
| トレンド | 202601→202603 で提供売上を段階的に増加 |
| 全社集計 | 3 店舗合算が finance-spec サンプルに近い月を 1 つ用意 |

#### 月次データ一覧（税込・円）

| period_key | 店舗 | service_sales | merchandise_sales | labor_cost | 備考 |
|-----------:|------|-------------:|------------------:|-----------:|------|
| 202601 | 馬場本店 | 2,000,000 | 100,000 | 600,000 | 単店計算検証の基準月 |
| 202601 | 中野店 | 2,500,000 | 150,000 | 750,000 | |
| 202601 | 馬場2号店 | 1,800,000 | 0 | 550,000 | 物販なし |
| 202602 | 馬場本店 | 2,100,000 | 120,000 | 620,000 | 前月比プレースホルダ確認用 |
| 202602 | 中野店 | 2,600,000 | 160,000 | 760,000 | |
| 202602 | 馬場2号店 | 1,900,000 | 0 | 560,000 | |
| 202603 | 馬場本店 | 2,200,000 | 130,000 | 640,000 | 3ヶ月平均・年次用 |
| 202603 | 中野店 | 2,700,000 | 170,000 | 780,000 | |
| 202603 | 馬場2号店 | 2,000,000 | 50,000 | 570,000 | 物販少量 |

#### 全社サンプル照合用（202603 合算イメージ）

finance-spec §2 の 1 店舗相当サンプル（提供 650 万 + 物販 50 万 + 人件費 200 万）に近づけるため、**202603 の 3 店舗合計**が次に近いことを目安とする（変動費は V-MINT 依存のため営業利益までは完全一致しない場合あり）:

- 提供売上合計: 6,900,000
- 物販売上合計: 350,000
- 人件費合計: 1,990,000

### 3.3 SQL 一括投入スクリプト

Supabase SQL Editor で実行。`ON CONFLICT` により再実行可能。

```sql
-- ── Phase A: 店舗固定費 ──────────────────────────────────────
INSERT INTO pe_store_settings (store_id, fixed_rent, fixed_utilities, fixed_sundries, payment_fee_rate)
SELECT id, v.rent, v.util, v.sund, v.rate
FROM stores s
JOIN (VALUES
  ('baba_main', 132000, 40000, 13000, 0.025),
  ('nakano',    330000, 40000, 13000, 0.025),
  ('baba_2nd',  206000, 40000, 13000, 0.025)
) AS v(key, rent, util, sund, rate) ON s.store_key = v.key
ON CONFLICT (store_id) DO UPDATE SET
  fixed_rent = EXCLUDED.fixed_rent,
  fixed_utilities = EXCLUDED.fixed_utilities,
  fixed_sundries = EXCLUDED.fixed_sundries,
  payment_fee_rate = EXCLUDED.payment_fee_rate;

-- ── Phase B: 全社共通費 ──────────────────────────────────────
INSERT INTO pe_company_settings (id, exec_remuneration, debt_repayment)
VALUES (1, 550000, 1000000)
ON CONFLICT (id) DO UPDATE SET
  exec_remuneration = EXCLUDED.exec_remuneration,
  debt_repayment = EXCLUDED.debt_repayment;

-- ── Phase C: ベンチマーク（フラット・シングルトン形式）──────────
INSERT INTO pe_benchmarks (id, f_ratio, l_ratio, r_ratio, operating_profit_margin, labor_rate)
VALUES (1, 0.25, 0.35, 0.15, 0.25, 0.50)
ON CONFLICT (id) DO UPDATE SET
  f_ratio = EXCLUDED.f_ratio,
  l_ratio = EXCLUDED.l_ratio,
  r_ratio = EXCLUDED.r_ratio,
  operating_profit_margin = EXCLUDED.operating_profit_margin,
  labor_rate = EXCLUDED.labor_rate;

-- ── Phase D: 月次実績 ────────────────────────────────────────
INSERT INTO pe_monthly_records (store_id, period_key, service_sales, merchandise_sales, labor_cost)
SELECT s.id, v.pk, v.svc, v.merch, v.labor
FROM stores s
JOIN (VALUES
  ('baba_main', 202601, 2000000, 100000,  600000),
  ('baba_main', 202602, 2100000, 120000,  620000),
  ('baba_main', 202603, 2200000, 130000,  640000),
  ('nakano',    202601, 2500000, 150000,  750000),
  ('nakano',    202602, 2600000, 160000,  760000),
  ('nakano',    202603, 2700000, 170000,  780000),
  ('baba_2nd',  202601, 1800000, 0,       550000),
  ('baba_2nd',  202602, 1900000, 0,       560000),
  ('baba_2nd',  202603, 2000000, 50000,   570000)
) AS v(key, pk, svc, merch, labor) ON s.store_key = v.key
ON CONFLICT (store_id, period_key) DO UPDATE SET
  service_sales = EXCLUDED.service_sales,
  merchandise_sales = EXCLUDED.merchandise_sales,
  labor_cost = EXCLUDED.labor_cost,
  updated_at = now();

-- 投入確認
SELECT s.store_key, r.period_key, r.service_sales, r.merchandise_sales, r.labor_cost
FROM pe_monthly_records r
JOIN stores s ON s.id = r.store_id
ORDER BY r.period_key, s.store_key;
```

### 3.4 UI 経由での投入（回帰テスト用）

SQL 投入後、**設定モード・月次入力モードの CRUD 自体**を別途 UI で確認する。

| 操作 | 手順 | 期待 |
|------|------|------|
| 設定読込 | 設定 → 店舗別固定費 → 馬場本店 | SQL 投入値が表示される |
| 設定更新 | 家賃を +1,000 変更して保存 → 再読込 | 永続化される |
| 月次新規 | 入力 → 202604・馬場本店 → 3 項目入力 → 保存 | `pe_monthly_records` に 1 行追加 |
| 月次更新 | 同月を再入力して金額変更 | upsert で上書き |
| 前月表示 | 202604 入力 Step1 | 202603 の提供売上がプレースホルダ / 前月実績に表示 |

---

## 4. 期待値（計算検証）

### 4.1 馬場本店・202601・V-MINT 変動費 = 0 の場合

入力: `service_sales=2,000,000`, `merchandise_sales=100,000`, `labor_cost=600,000`  
設定: 家賃 132,000 / 光熱 40,000 / 雑費 13,000 / 手数料率 2.5%

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

店舗別 PL では **役員報酬・借入返済・純現金収支は表示されない**（全社のみ）。

### 4.2 全店舗合計・202603・V-MINT 変動費 = 0 の場合（参考）

| 項目 | 3 店舗合算 | 期待（概算） |
|------|----------:|-------------:|
| 税込み総売上 | 6,900,000 + 350,000 | 7,250,000 |
| 税引き後総売上 | × 10/11 | 6,590,909 |
| 人件費 | | 1,990,000 |
| 家賃 | 132k+330k+206k | 668,000 |
| 役員報酬（全社のみ） | | 550,000 |
| 借入返済（全社のみ） | | 1,000,000 |

営業利益・純現金収支は物販原価・決済手数料・光熱雑費を含めた上で PL 画面の表示値と突合する。

### 4.3 finance-spec 完全サンプル（V-MINT あり・1 店舗相当）

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

### 5.1 設定モード

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| SET-01 | 店舗固定費 | 設定 → 店舗別固定費を開く | ピルセレクターが表示され、馬場本店の「現在適用中」行が自動選択 | |
| SET-02 | 店舗固定費 | ピルで中野店・馬場2号店に切替 | 店舗ごとの改定履歴が切り替わる | |
| SET-03 | 店舗固定費 | 現在適用中の値を確認 | §3.1 の値（家賃・光熱費・雑費・手数料率）が表示 | |
| SET-04 | 改定追加 | 新規改定フォームに `effective_from=202506` + 新値を入力して追加 | `pe_store_settings_revisions` に 1 行追加。直後に「現在適用中」が更新 | |
| SET-05 | 改定削除 | 現在適用中が 2 件以上のとき削除ボタンを押す | 最新行が削除され、直前行が現在適用中になる | |
| SET-06 | 削除不可 | 現在適用中が 1 件のとき | 削除ボタンが非表示 | |
| SET-07 | 全社共通費 | 役員報酬・借入返済の現在適用中を読込 | 550,000 / 1,000,000 が表示 | |
| SET-08 | ベンチマーク | 現在適用中を読込 | 5 指標（F比・L比・R比・営業利益率・労働分配率）の % 値が表示 | |
| SET-09 | ベンチマーク | 新規改定追加後、PLモードで別の期間を表示 | 期間に応じた目標値が Health Highlight に反映 | |

### 5.2 月次入力モード（手入力）

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| INP-00 | Step 0 プレビュー | 年・月を両方選択 | 「開始する」ボタン下に全店舗の集計期間カードが自動表示される（cost_reports あり月） | |
| INP-00b | Step 0 プレビュー未入力 | cost_reports なし月を選択 | 各店舗に「未入力」と表示される | |
| INP-01 | フロー | 入力モードを開く → 手入力タブを選択 | 期間選択（YYYY年MM月）が表示される | |
| INP-02 | バリデーション | 提供売上・人件費未入力で次へ | 進めない（`canNext` false） | |
| INP-03 | 物販任意 | 物販空欄で保存 | `merchandise_sales = 0` として保存 | |
| INP-04 | 新規保存 | 202604 を選択し 3 店舗入力 → 保存 | DB に 3 行追加（3店舗分） | |
| INP-05 | 更新 | 同月を再入力して変更 | upsert で上書き | |
| INP-06 | V-MINT期間（各店舗ヘッダー） | 入力 Step の店舗ヘッダー | `start_date`〜`end_date` が表示される（cost_reports あり月） | |
| INP-07 | 全店舗一括 | 3 店舗分を連続入力して保存 | 1 回の操作で 3 店舗 upsert される | |
| INP-08 | 中断 | 入力途中でポータル戻り | 確認ダイアログが出る | |

### 5.2b 月次入力モード（CSV インポート）

> 前提：`pe_daily_sales_cache` に 2025年12月分のキャッシュが投入済みであること（§3 SEED参照）

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| CSV-01 | モード切替 | Step 0 でデフォルトタブを確認 | 「CSV インポート」タブが選択済み | |
| CSV-02 | ファイルアップロード | 3店舗 × Airメイト/Airレジ CSV を各スロットにアップロード | 6スロットが埋まり「次へ」が活性化する | |
| CSV-03 | 店舗自動検出 | 正しい店舗名を含むファイル名の CSV をアップロード | 各スロットの店舗キーが自動検出される | |
| CSV-04 | プレビュー確認 | CSV アップロード → 次へ | 店舗別に提供売上（割引後）・物販売上・割引総額・前月キャッシュ参照日数が表示される | |
| CSV-05 | 人件費入力 | プレビュー画面で各店舗の人件費を入力 | 入力必須バリデーションが効く | |
| CSV-06 | 保存 | 確認 → 保存 | `pe_monthly_records` に 3 行 upsert。`pe_daily_sales_cache` に当月分追加。古いキャッシュ削除 | |
| CSV-07 | 前月キャッシュ欠落 | キャッシュなし状態でインポート実行 | 警告ダイアログが表示される（前月最終盤のデータが取得できない旨） | |
| CSV-08 | CSV パースエラー | 不正な CSV（ヘッダー欠落等）をアップロード | 該当店舗スロットにエラー表示、先に進めない | |

### 5.3 PLモード — 月次

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| PLM-01 | 店舗別 | 馬場本店 / 202601 / 月次 | §4.1 の主要数値と一致（±1 円許容） | |
| PLM-02 | 店舗別 | 馬場2号店 / 202601 / 月次 | 物販 0、物販原価 0 | |
| PLM-03 | 全社 | 全店舗合計 / 202603 / 月次 | 3 店舗合算。役員報酬・借入・**純現金収支**行が表示 | |
| PLM-04 | 全社 | 店舗別 PL | 役員報酬・純現金収支が **非表示** | |
| PLM-05 | 未入力 | データのない月を選択 | 「月次データがありません」バナー、数値は — | |
| PLM-06 | 構造 | PL 各セクション | 売上（提供/物販/消費税）→ 原価 → 粗利 → 販管費 → 営業利益 | |

### 5.4 PLモード — 3ヶ月平均・年次

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| PLR-01 | 3ヶ月平均 | 馬場本店 / 202603 / 3ヶ月平均 | 202601〜03 の単純平均（有効月のみ） | |
| PLR-02 | 3ヶ月平均 | 労働分配率 | 平均後の粗利・人件費から再計算（月次率の平均ではない） | |
| PLA-01 | 年次 | 全店舗 / 2026 / 年次 | 202601〜12 の合算（未入力月は 0） | |
| PLA-02 | 年次 | 参照年のみ選択 UI | 月選択が非表示 | |

### 5.5 PLモード — トレンド・Health Check

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| PLT-01 | チャート | 月次 PL 表示後 | 折れ線チャートが表示（データ点 ≥ 1） | |
| PLT-02 | チャート | 期間モード切替 | 月次 / 3ヶ月平均でプロットが変わる | |
| PLH-01 | Health | ベンチマーク設定後、202601 馬場本店 | 5 指標（F比・L比・R比・営業利益率・労働分配率）に実績%と OK/NG 色 | |
| PLH-02 | Health | ベンチマーク未設定 | 「設定でベンチマーク目標値を設定できます」表示 | |

### 5.6 エッジ・異常系

| ID | 区分 | 手順 | 期待結果 | 結果 |
|----|------|------|----------|------|
| EDG-01 | 粗利ゼロ | 原価 ≈ 売上となる入力（テスト用 1 ヶ月） | 労働分配率が —（null） | |
| EDG-02 | ネットワーク | Supabase 切断状態で PL 表示 | エラーアラート、クラッシュしない | |
| EDG-03 | 再読込 | PL 表示中に条件変更 | フィルター画面に戻り再集計できる | |

---

## 6. 推奨実施順序（チェックリスト）

```
□ 環境準備（§2）
□ DB スキーマ・店舗マスタ確認（§2.3）
□ V-MINT cost_reports 有無確認（§2.4）
□ SQL で Phase A〜D 投入（§3.3）
□ 投入確認クエリで 9 行の月次データを確認
□ COM-01〜04 認証・ナビ
□ SET-01〜05 設定モード（UI で読込一致確認）
□ INP-01〜08 月次入力・手入力（UI CRUD）
□ CSV-01〜08 月次入力・CSV インポート
□ PLM-01〜06 月次 PL（§4 と突合）
□ PLR-01〜02 / PLA-01〜02 集計モード
□ PLT-01〜02 / PLH-01〜02 チャート・Health
□ EDG-01〜03 エッジ
□ （任意）finance-spec 完全サンプル月で §4.3
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
| **必須** | §5 の COM / SET / INP / PLM をすべて ✅（EDG-02 は環境都合で ⏭ 可） |
| **必須** | 馬場本店 202601 の営業利益が §4.1 と ±1 円以内（V-MINT=0 前提） |
| **必須** | 全社 202603 で純現金収支行が表示され、役員報酬・借入が差し引かれる |
| **推奨** | PLR / PLA / PLT / PLH も ✅ |
| **推奨** | V-MINT データあり月で変動費 3 項目が 0 以外 |

---

## Related

- [[V-PEACH/notes/V-PEACH_requirements]] — 機能要件
- [[V-PEACH/notes/V-PEACH_finance-spec]] — PL 読み方・計算サンプル
- [[V-PEACH/notes/V-PEACH_architecture]] — DB・API 構成
- [[V-PEACH/notes/V-PEACH_release-plan]] — フェーズ完了状況
- [[V-PEACH/TROUBLESHOOTING]]

---
tags: [project/project-slug, type/note]
parent: [[PROJECT/notes/_index]]
---

#  V-PEACH 要件定義書（草稿）

## 1. プロダクトの核（Core Objective）

「現場の数字を、経営の意思決定に変える」。

単なる過去の記録ではなく、V-MINT 2.0の現場データと財務データを結合し、不足する指標を入力したうえで、**「次の一手（投資・是正）」を導き出すための戦略的コックピット**を構築する。

---

## 2. 財務ロジック定義（Formula Architecture）

入力の手間を最小化しつつ、V-MINT 2.0とのデータ整合性を保つための計算式を定義する。

- **提供売上 =** 総売上（手入力） - 物販売上（自動算出）
    
- **物販売上 =** $\sum (\text{各ブランド販売数} \times \text{設定された定価})$
    
    - _※V-MINT 2.0の原価計算モードから `brand_sales_qty` を集計_
        
- **物販売益 =** 物販売上 $\times$ 設定された利益率（デフォルト10%）
    
- **変動費 =** フレーバー + 炭 + ジュース
- **固定費** = 家賃 + 人件費 + その他
	- **その他** = 決済手数料 + 光熱費 + 雑費    
    - _※これらは入力画面での入力、Supabaseの既存テーブルからの引用、または設定の定額/定率から算出_
        
- **粗利 =** 総売上 - 変動費
    
- **労働分配率 =** 人件費 / 粗利
    
- **最終会社手残り =** 営業利益 + 物販売益 - (役員報酬 + 借入返済)
    

---

## 3. モード別詳細仕様

### (1) PLモード（分析・投資判断画面）

- **フィルター機能:** 「月次」「3ヶ月平均（Moving Average）」「年次」を瞬時に切り替え。
    
- **ビジュアルPL:**
    
    - 左側に「経費・利益」、右側に「収益」の対照表。
        
    - **Health Highlight:** 設定した目標値（数値 or %）に対し、超過は「RED（デバッグ対象）」、余剰は「GREEN（投資可能）」で表示。
        
- **トレンドチャート:**
    
    - 指定した期間（月次なら当該年度の12ヶ月分、年次なら年度別）の推移を折れ線で表示。
        
    - 人件費率の推移と、営業利益率の相関を可視化。
        

### (2) 月次入力モード（データ投入画面）

- **UI/UX:** V-MINT 2.0の原価計算を踏襲したステップ入力。
    
    - Step 1: 総売上入力（前月の実績をプレースホルダに表示）
        
    - Step 2: 各経費の入力（設定で固定しているものは自動入力済み、微調整のみ）
        
    - Step 3: 人件費・その他費用の入力
        
- **バリデーション:** 異常に大きな数値が入力された場合、アラートを出す。
    

### (3) 設定モード（マスター管理画面）

- **インプット定数設定:** 家賃、光熱費、役員報酬、借入返済額、物販売益率のデフォルト値を店舗ごとに設定。
    
- **目標値（Benchmark）設定:**
    
    - 人件費率（目標30%など）、原価率、利益率の目標。
        
    - 数値（円）または割合（%）を選択可能にする。
        

---

## 4. テクニカル・アーキテクチャ

- **Frontend:** Vue 3 (Vite) + Tailwind CSS + Chart.js / Recharts（推移グラフ用）
    
- **Backend:** Supabase (PostgreSQL) ※V-MINT 2.0と同一プロジェクト。
    
- **Infra:** Cloudflare Pages
    
- **Data Integration:**
    
    - V-MINT 2.0の `brand_inventory_logs` や `sales_reports` テーブルを直接参照するViewをPostgreSQL側で作ることで、フロント側のロジックを軽量化。
        
- **Version Control:** Git (Monorepo または Separate Repo)
    

---

## 5. データベース拡張案（New Tables）

既存のSupabaseに以下のテーブルを追加するよ。

SQL

```
-- 月次実績データ
CREATE TABLE pe_monthly_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id uuid REFERENCES stores(id),
  period_key char(7), -- YYYY-MM
  total_sales numeric,
  labor_cost numeric,
  shisha_sales_actual numeric, -- 自動計算後の結果をスナップショット保存
  other_costs_actual jsonb -- 決済手数料などの内訳
);

-- 店舗別デフォルト設定
CREATE TABLE pe_store_settings (
  store_id uuid PRIMARY KEY REFERENCES stores(id),
  fixed_rent numeric,
  fixed_utilities numeric,
  fixed_sundries numeric,
  exec_remuneration numeric,
  debt_repayment numeric,
  physical_profit_margin numeric DEFAULT 0.1
);

-- 目標値（ベンチマーク）
CREATE TABLE pe_benchmarks (
  store_id uuid REFERENCES stores(id),
  item_name text, -- 'labor_rate', 'cost_rate' etc
  target_value numeric,
  is_percentage boolean DEFAULT true
);
```

---


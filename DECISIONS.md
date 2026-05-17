# DECISIONS

## ADR-20260515-01: Supabase共用・pe_プレフィックスで分離
- Status: Accepted
- Date: 2026-05-15
- Owners: daiki100325

### Context
- V-MINT 2.0と同一Supabaseプロジェクトを使用する
- 既存テーブル（stores, cost_reports, flavor_brand_sales等）をV-PEACHから参照したい

### Decision
- Supabaseプロジェクトを新規作成せず、V-MINT 2.0と共用する
- V-PEACH固有テーブルはすべて `pe_` プレフィックスで分離する

### Alternatives
- Option A: 専用Supabaseプロジェクトを作成する → 既存データの参照が困難になるため却下
- Option B: 同一テーブルを直接使用する → スキーマ汚染リスクがあるため却下

### Consequences
- Positive: V-MINTの在庫・原価データをViewで直接参照可能
- Negative: プロジェクト廃止時にテーブルの整理が必要

### Links
- Related note: [[V-PEACH/notes/V-PEACH_architecture]]

## ADR-20260515-02: 役員報酬・借入返済を全社共通費として分離
- Status: Accepted
- Date: 2026-05-15
- Owners: daiki100325

### Context
- 月次入力項目に役員報酬・借入返済が含まれる
- 3店舗それぞれに持たせると全社PLで3倍計上になる

### Decision
- `pe_company_settings` テーブルに全社共通費（役員報酬・借入返済）を分離
- 店舗別PLには含めず、全社集計時のみ差し引く

### Consequences
- Positive: 全社PLの最終手残り計算が正確になる
- Negative: 入力モードで「全社設定」という概念を理解する必要がある

### Links
- Related note: [[V-PEACH/notes/V-PEACH_requirements]]

## ADR-20260517-01: 役員報酬を販管費から切り出し、営業利益後の全社調整に移動

- Status: Accepted
- Date: 2026-05-17
- Owners: daiki100325

### Context
- 役員報酬を販管費（sgaTotal）に含めていたため、店舗別の営業利益が比較できなかった
- 役員報酬は会社全体に対して発生する費用であり、店舗単独のパフォーマンスに帰属させるべきでない
- 借入返済は既に全社調整として営業利益後に差し引いていたが、役員報酬の扱いと不一致だった

### Decision
- 役員報酬（`exec_remuneration`）を `sgaTotal` から除外し、`debtRepayment` と同様に営業利益後の全社調整として差し引く
- `netCashFlow = operatingProfit - execRemuneration - debtRepayment`
- 店舗別PL: 販管費5項目（家賃・人件費・決済手数料・光熱費・雑費）で営業利益を算出
- 全社合算PL: 営業利益から役員報酬・借入返済を差し引いて純現金収支を算出

### Alternatives
- 現行維持（役員報酬を販管費に含める）→ 店舗間の営業利益比較が不正確なため却下
- 役員報酬を店舗ごとに按分 → 按分基準の根拠が薄く、管理コストに対して価値がないため却下

### Consequences
- Positive: 店舗単独の営業利益が純粋な運営パフォーマンスを反映する
- Positive: 役員報酬・借入返済が「会社全体の調整」として視覚的・論理的に整理される
- Negative: DB・API変更なし（pe_company_settings の構造はそのまま）

### Links
- Related note: [[V-PEACH/notes/V-PEACH_finance-spec]]

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

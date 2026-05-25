# DECISIONS

## ADR-20260525-01: HRMOS シフト CSV 取込で画面A/B を自動化
- Status: Accepted
- Date: 2026-05-25
- Owners: daiki100325

### Context
- 月次入力の画面A（バイト枠数）・画面B（りょーさん枠数）は 3店舗×6h/7.5h = 12 マスの手入力が必要で、最も負荷が高いステップだった
- HRMOS は月次シフト raw CSV（`vangvieng_shifts_YYYYMM.csv`）を出力可能で、1ファイルで店舗×日付×従業員×勤務区分の情報が揃う

### Decision
- 月次入力 CSV モードに「Step 2: シフト CSV アップロード」を挿入し、HRMOS シフト CSV から画面A/B の枠数を自動算出
- スタッフマスタ（固定給/バイト/社長のロール）・勤務区分マスタ（店舗・シフトタイプ・既定時間・按分対象）は Supabase（`pe_hrmos_staffs` / `pe_hrmos_segments`）に永続化し、初回投入後は HRMOS マスタ変更時のみ更新
- 画面A/B は残置し、シフト CSV をスキップした月や自動算出後の編集に使う
- 画面C（給与＋交通費総額）は手入力維持

### Alternatives
- 給与 CSV から総額自動入力：HRMOS から該当 CSV が確実に得られる確証がないため不採用
- 時給マスタ × 枠数で総額算出：実給与（賞与・交通費含む）との差異が大きく不採用

### Consequences
- Positive: 入力工数が 12+ マス → ファイル1個に圧縮。誤入力リスクも低減
- Negative: HRMOS マスタの整合性管理が新たに必要（自動判定不可レコードは設定 UI で手動上書き）

### Links
- Plan: [[V-PEACH/notes/V-PEACH_shifts-csv-import-plan]]
- Migration: `supabase/DB_MIGRATION_hrmos_masters_20260525.sql`

## ADR-20260525-02: 祝日マスタは holidays-jp + Supabase キャッシュ方式
- Status: Accepted
- Date: 2026-05-25
- Owners: daiki100325

### Context
- 馬場2号店遅番の土日祝補正（6h → 7.5h）に祝日判定が必要
- オーナー要望：「追加コストかからず、実装上ムリがないなら自動化」

### Decision
- データソース：`https://holidays-jp.github.io/api/v1/date.json`（無料・認証不要・CORS 許可済み・過去〜翌年祝日を網羅）
- Supabase `pe_jp_holidays` にキャッシュ + `pe_jp_holidays_meta` で取得状況を記録
- 月次入力フローの先頭で `refreshHolidaysIfStale()`：当年データ欠落 or 30日経過時に再取得
- 失敗時はキャッシュにフォールバック、UI に警告
- 設定モードに「いま再取得する」ボタン、PortalMenu に年初カバレッジバナー（自動 fetch を試行し失敗時のみ警告表示）

### Alternatives
- 手動 SEED：年初の祝日改正対応漏れリスクあり
- 有料 API：追加コストが発生

### Consequences
- Positive: ほぼゼロ運用コストで祝日対応。GitHub Pages 障害時もキャッシュで継続
- Negative: 個人運用 API への依存（mitigation: Supabase キャッシュ + UI 再取得）

### Links
- Plan: [[V-PEACH/notes/V-PEACH_shifts-csv-import-plan]] §3.4
- Client: `src/utils/jpHolidaysClient.js`

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

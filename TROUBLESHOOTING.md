# TROUBLESHOOTING

## Case: 月次入力「開始する」を押しても画面遷移しない
- Date: 2026-05-21
- Severity: High
- Owner: daiki

### Symptoms
- 月次入力モード（手入力／CSV インポート両方）で対象月を選択して「開始する」を押下しても、ローディング（「集計期間を取得中...」「データを読み込み中...」）が表示・消失したあと画面が遷移しない（step=0 の対象月選択画面のまま）
- ブラウザの DevTools Console に `Could not find the table 'public.pe_monthly_company_records' in the schema cache` のエラーが出る
- 既存の alert ダイアログが出るはずだが、状況によってはブラウザの popup ブロックや見落としで気付けないことがある

### Cause
- `DB_MIGRATION_labor_cost_20260520.sql`（人件費計算ロジック移行マイグレーション）が Supabase に未適用で、`pe_monthly_company_records` テーブルが存在しない
- `InputApp.startCsvEntry()` / `startManualEntry()` の冒頭で `getMonthlyCompanyRecord(periodKey)` を呼び、ここで例外が throw されるため `this.step = 1` まで到達せず画面遷移できない

### Fix
- Supabase Dashboard → SQL Editor で `V-PEACH/supabase/DB_MIGRATION_labor_cost_20260520.sql` の中身を実行
- 反映直後はスキーマキャッシュが古いことがあるので、Dashboard の Database → Tables で `pe_monthly_company_records` が表示されるのを確認し、ブラウザをハードリロード

### Prevention
- 新規テーブル参照を追加する PR は、`supabase/DB_MIGRATION_*.sql` を必ずセットでコミットし、`CHANGELOG_DEV.md` に「Supabase 側で SQL 実行が必要」を明記する
- フロントで新テーブル参照を追加する変更を加える前に、ローカル Supabase で migration を流して動作確認する

### Links
- Dev log: [[V-PEACH/CHANGELOG_DEV]]
- Migration: `supabase/DB_MIGRATION_labor_cost_20260520.sql`

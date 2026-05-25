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

---

## Case: シフト CSV 取込の集計数値が手カウントと合わない
- Date: 2026-05-25
- Severity: Info（パース処理のバグではなく CSV データ起因）
- Owner: daiki

### Symptoms
- `vangvieng_shifts_202601.csv` を取込んだ結果が、スタッフ共有シフト表の手カウントと一致しない
  - 馬場本店: バイト6h 26（期待 28）、りょー6h 1（期待 0）
  - 馬場2号店: バイト6h 18（期待 19）、りょー6h 1（期待 0）

### Cause
**パース処理・計算ロジックは正しい。** HRMOS エクスポート CSV とシフト表の正本データに 3 件のズレが存在した：

| 日付 | 店舗 | 内容 | アプリへの影響 |
|------|------|------|--------------|
| 1/22 遅番 | 馬場本店 | CSV に中道雄耶（`fixed_salary`）が登録。シフト表ではバイトが担当 | バイト6h が 1 件カウントされない |
| 1/23 遅番 | 馬場本店 | CSV にエントリなし。シフト表ではバイトが出勤 | バイト6h -1、りょー6h が 1 件余分にカウント |
| 1/26 遅番 | 馬場2号店 | CSV にエントリなし。シフト表ではバイトが出勤 | バイト6h -1、りょー6h が 1 件余分にカウント |

### Resolution
調査の結果、**パース処理・CSV データともに正しかった**。手カウントの元になったシフト表に未登録の変更（後から修正されたシフト）が含まれており、CSV が実態を正確に反映していた。インポート結果も実態と一致しており、バグは存在しなかった。

### Prevention
- 集計結果に疑問があるときは、まず「シフト表が最終確定版か」を確認する。シフト変更後に手カウントの元になったシフト表が更新されていない場合、CSV 側が正しいことがある。

### Links
- Dev log: [[V-PEACH/CHANGELOG_DEV]]
- Importer: `src/utils/shiftImporter.js`, `src/utils/csvImporter.js`

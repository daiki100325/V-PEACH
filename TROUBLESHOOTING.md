# TROUBLESHOOTING

## Case: 変更認可PDFの取込が必ず失敗（"Edge Function returned a non-2xx status code" / 150s タイムアウト）
- Date: 2026-06-16
- Severity: High
- Owner: daiki

### Symptoms
- 「認可状況 > 更新」で**変更認可PDF**をアップロード → フロントに `抽出に失敗しました。20260520_kouriteikahenkou.pdf: Edge Function returned a non-2xx status code`。
- 新規認可の小さいPDFは数秒で成功するのに、変更認可だけ毎回失敗。Edge Function ログは **502(106s) / 504(150s) / 546(150s) / たまに 200(116s)** と長時間張り付き。
- 「令和対応(v12)の前は動いていた（変更日が2008年になる以外）」という体感。

### Cause（実測で確定。v12プロンプトもPDFもモデルも無罪）
- フロントの "Edge Function returned a non-2xx status code" は **supabase-js の汎用エラー文**で、真因（502/504/546）を隠す。`get_logs(edge-function)` で実ステータスを見るのが第一歩。
- 真因は **共用 `GEMINI_API_KEY`（IORIと同一）のレート制限 ＋ お人好しすぎる retry/fallback** の合わせ技:
  1. 主軸 `gemini-3.1-flash-lite` が一瞬 **429**（分あたり RPM を IORI と競合）
  2. retry待機（旧: 最大60s×3・予算90s）で時間を溶かす
  3. フォールバック先 **`gemini-2.5-flash` が共用キーで 503『high demand』のまま 81秒ハング**（単一呼び出しで150sに到達）＋ **RPD 20 即枯渇で 429**
  4. 合計が Edge Function の **150s ハード上限**を突破 → 504/546/502
- **切り分けの決め手**: 実物PDF（1ページ・4行）を flash-lite 単体に直接投げると **2.4〜10秒で正常抽出**。`gemini-2.5-flash` 単体は **81.3秒で503**（ローカル probe で実測）→ フォールバック先が主犯と判明。`90s待機 + 26s(3.5-flash) ≒ 116s` がログの 116914ms(200) と一致。

### 二次原因: degenerate 暴走（数字が MAX_TOKENS まで伸びて JSON 破綻 → 502）
- タイムアウト対策後、変更認可PDFで **502「Gemini 応答の JSON 解析に失敗」**（raw に `price_before:5000000000…` と数字が延々）。`finishReason=MAX_TOKENS`・出力 16369 トークン＝上限まで暴走。
- **引き金は ROW_SCHEMA の `description`**（実測）。`変更前/変更後` のような言い換えだと flash-lite が price_after 列を取りこぼし、かつ数字を暴走出力（6回中5回）。**PDFの列見出しに一致**させた `現行小売定価/変更小売定価` にすると **6/6 正常**（2〜3秒・price_before=5000・price_after=5600）。
- 併せて **プロンプトの冗長さ**も誤読/暴走を誘発。簡潔化で安定。**thinking 有効化は逆効果**（degenerate を誘発するため不採用）。

### Fix（採用＝コード防御＋プロンプト/スキーマ簡潔化・課金なし・Edge Function v13→v16）
- **タイムアウト対策（v13）**: ①フォールバックから `gemini-2.5-flash` を除外（既定 `GEMINI_MODEL_FALLBACKS=gemini-3.5-flash` の1枚）。②各呼び出しに `AbortController`（`PER_CALL_TIMEOUT_MS=45s`・残り時間クランプ）で503ハングを中断。③`HARD_DEADLINE_MS=120s` で150s前に502＋案内。④retry `3→1`・backoff上限 `60s→10s`・待機予算 `90s→20s`。⑤`maxOutputTokens 65536→16384`。
- **精度・安定対策（v14〜v16）**: ⑥`buildPrompt` を大幅簡潔化。⑦変更認可に『現行小売定価』=price_before /『変更小売定価』=price_after の列対応を明記。⑧**ROW_SCHEMA description を PDF 列見出しに一致**（暴走の根治）。
- **最終検証（v16）**: 変更認可PDFを本番で3回連続 200・2.5〜4.4秒・全項目正解。新規も 200・25行正常。

### Prevention / 切り分け手順
- フロントの非2xxエラーは文言で判断せず、必ず **`get_logs(edge-function)` で実ステータス（502/504/546）と実行時間**を確認。**150s張り付き＝タイムアウト**、`MAX_TOKENS`＋JSON破綻＝**degenerate暴走**、即429＝クォータ。
- ローカル再現が最速: 実物PDFを base64 化し Edge Function と同一 payload で各モデルを個別計測（時間・`finishReason`・`candidatesTokenCount`）。暴走は出力トークン爆発、ハングは長時間後の503で判別。
- **抽出フィールドの description は『ソース文書の見出し語』に揃える**（言い換えると誤読/暴走を招く）。プロンプトは簡潔に保つ。`gemini-2.5-flash` を安易にフォールバックへ戻さない（503ハング常習・RPD20）。thinking は抽出用途では安易に有効化しない。

### Links
- Source: `supabase/functions/parse-approval-pdf/index.ts`（v13: AbortController・HARD_DEADLINE・2.5-flash除外／v16: プロンプト＋ROW_SCHEMA 列見出し一致）
- Related: [[V-PEACH/DECISIONS]] ADR-20260615-02, 下記「Gemini 無料枠の枯渇」ケース

## Case: 認可状況の PDF 取込が 429 / 502 になる（Gemini 無料枠の枯渇）
- Date: 2026-06-15
- Severity: Medium
- Owner: daiki

### Symptoms
- 「更新」タブで PDF をアップロード → `POST .../parse-approval-pdf 502 (Bad Gateway)`。本文は `Gemini エラー (429)（全モデルがレート制限/高負荷で失敗しました…）`。
- 時間を空けても（40分以上）再発。「200成功 → 数分後に 429」も発生。

### Cause
- Gemini の **無料枠（free tier）クォータ超過**。502 本文 `detail` に決定的な証拠：
  ```
  Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count,
  limit: 0, model: gemini-2.5-pro
  ```
- 認可 PDF は**入力トークンが重い**ため、無料枠の入力トークン量をすぐ消費する。
- **`gemini-2.5-pro` は無料枠 `limit: 0`**＝無料では一切使えない。→ `GEMINI_MODEL_FALLBACKS` に 2.5-pro を入れても free キーでは無意味。
- retry+backoff・フォールバック（[[V-PEACH/DECISIONS]] ADR-20260615-02）は一過性の分あたり 429 には有効だが、**無料枠そのものの枯渇は構造的問題**で吸収できない。

### Fix（採用＝課金なし）
- **主軸モデルを無料枠 RPD が突出して大きい `gemini-3.1-flash-lite`（RPD 500）に変更**（v10）。旧主軸 `gemini-2.5-flash` は RPD 20 しかなく枯渇していた。実測で 429 解消・7秒・精度十分。Google AI Studio 無料枠 RPD: 3.1-flash-lite=500 / 各 flash=20 / 3.1-pro=0 / gemma=1.5K(PDF不可)。
- フォールバックは無料で使えるフル flash のみ（`gemini-3.5-flash,gemini-2.5-flash`）。**`gemini-3.1-pro` は無料枠 0、`gemma` は PDF/構造化非対応のため不可**。
- 別解（不採用）: GCP プロジェクトで課金有効化すれば無料枠上限が撤廃され 2.5-pro も解禁できる（コスト僅少）。今回は「追加課金しない方針」のため主軸モデル変更で対応。

### Prevention / 切り分け手順
- 502 の **レスポンス本文 `detail`** に Gemini の生エラー（quota metric・`limit`・`retryDelay`）が入る。まずここを見る（`error` だけでなく `detail` を確認）。
- 検証時の連打に注意：1リクエストでも内部 retry で複数回 API を叩く。検証は最小限に。
- `model` フィールドでどのモデルが成功したか確認できる（フォールバック発火の判定に使う）。

### Links
- Source: `supabase/functions/parse-approval-pdf/index.ts`（v9: 失敗詳細を `console.error` 出力）
- Related: [[V-PEACH/DECISIONS]] ADR-20260615-02, [[V-PEACH/notes/V-PEACH_architecture]]

## Case: flavors テーブルの行が外部キー制約で削除できない
- Date: 2026-06-11
- Severity: Low
- Owner: daiki

### Symptoms
- Supabase Table Editor で `flavors` テーブルの行（例: id=310 "Twist"）を削除しようとすると以下のエラーで弾かれる
  ```
  Unable to delete row as it is currently referenced by a foreign key constraint
  from the table `inventory_logs`
  DETAIL: Key (id)=(310) is still referenced from table inventory_logs.
  ```

### Cause
- `inventory_logs.flavor_id` → `flavors.id` の外部キー制約 `inventory_logs_flavor_id_fkey` に `ON DELETE` 挙動が未設定（デフォルト `NO ACTION`）だったため、`flavors` 側を先に削除しようとすると制約違反になる

### Fix
- 外部キー制約を一度 DROP して、`ON DELETE CASCADE` 付きで再作成する

```sql
ALTER TABLE inventory_logs
  DROP CONSTRAINT IF EXISTS inventory_logs_flavor_id_fkey;

ALTER TABLE inventory_logs
  ADD CONSTRAINT inventory_logs_flavor_id_fkey
    FOREIGN KEY (flavor_id)
    REFERENCES flavors (id)
    ON DELETE CASCADE;
```

- この変更により `flavors` のレコードを削除すると、それを参照する `inventory_logs` の行も自動で削除される
- Migration: `V-MINT2.0/supabase/migrations/20260611_inventory_logs_fk_on_delete_cascade.sql`

### 確認クエリ
```sql
-- confdeltype が 'c'（CASCADE）になっていれば成功
SELECT conname, confdeltype
FROM pg_constraint
WHERE conname = 'inventory_logs_flavor_id_fkey';
```

### 教訓
- テスト用レコードを後から削除する可能性があるテーブル間の FK は、作成時に `ON DELETE CASCADE`（または `SET NULL`）を明示しておく
- Supabase Table Editor のエラーメッセージにある制約名（`inventory_logs_flavor_id_fkey`）を手がかりに `pg_constraint` を確認すると原因が特定しやすい

---

## Case: トレンドチャートの指標トグルがチャートに反映されない（デフォルト指標は出るが切替不可）
- Date: 2026-06-01
- Severity: High
- Owner: daiki

### Symptoms
- カテゴリ展開後、個別指標ボタンを押してもトレンドチャートの表示指標が切り替わらない。初期表示のデフォルト指標（税込総売上・F比・L比・R比・会社手残り）は正しく描画される

### Cause
- `PLTrendChart.vue` で Chart.js インスタンスを `chart: null` として `data()` に宣言していたため、`new Chart(...)` の戻り値が Vue 3 のリアクティブ Proxy にラップされていた
- Chart.js は内部で多数の参照同一性比較（`===`）や自己参照を持つ。Proxy 経由だと raw オブジェクトと Proxy の同一性が崩れ、`chart.update()` がデータセット変更を再描画に反映できない
- マウント時はコンストラクタが同期的に初回描画するため、デフォルト指標だけは表示され「出るのに切り替わらない」状態になっていた

### Fix
- `init()` で `this.chart = markRaw(new Chart(...))` とし、インスタンスをリアクティブ化対象外にする（`import { markRaw } from 'vue'`）
- Files: `src/components/PLTrendChart.vue`

### 教訓
- Chart.js / Leaflet / 各種 Web SDK など**外部ライブラリの可変インスタンスを `data()` に保持しない**。保持する場合は必ず `markRaw()` でラップする（または `data()` に宣言せず非リアクティブなインスタンスフィールドとして持つ）。初回描画は動くため、テストで「更新が効かない」症状として後から顕在化しやすい

## Case: トレンドチャートのカテゴリトグルボタンが反応しない（展開しない）
- Date: 2026-06-01
- Severity: High
- Owner: daiki

### Symptoms
- PL モードのトレンドチャートで「売上」等のカテゴリボタンを押しても展開エリアが開かない。ボタンが完全に無反応に見える（PLT-05 の回帰）

### Cause
- `PLTrendChart.vue` で `visibleMetrics` を `Set` から `Array` に移行した際、展開エリアの指標ボタン `:style`（34行目）だけ `visibleMetrics.has(m.key)` が取りこぼされていた
- カテゴリボタンのクリック自体は `expandedCategory` をセットできているが、続く再レンダリングで `v-if="expandedCategory"` の展開エリアを描画する瞬間、Array に存在しない `.has()` を呼んで `TypeError: visibleMetrics.has is not a function` が発生 → Vue の render が中断され DOM 更新が反映されず、結果「ボタンが反応しない」ように見えた

### Fix
- 34行目の `visibleMetrics.has(m.key)` を `visibleMetrics.includes(m.key)` に置換（30行目の class バインドは既に `.includes()` 済みだった）
- Files: `src/components/PLTrendChart.vue`

### 教訓
- `Set`→`Array` のようなデータ型移行では、テンプレート内の `.has()` / `.add()` / `.delete()` 等の Set 専用メソッドを grep で洗い出して全置換する。class バインドだけ直して style バインドを見落とすと部分的に壊れる

## Case: 祝日マスタ「いま再取得する」がネットワーク切断時に「取得中...」で止まる
- Date: 2026-05-30
- Severity: Medium
- Owner: daiki

### Symptoms
- 設定 → 祝日マスタ → 「いま再取得する」をネットワーク切断状態で押すと、ボタンが「取得中...」のまま無限に止まり、失敗表示が出ない

### Cause
- `fetchHolidaysFromApi()` の `fetch()` にタイムアウトがなく、ネットワーク切断時は OS の TCP タイムアウト（数分〜無限）まで待ち続けるため `finally` ブロックに到達しない

### Root cause (deeper)
ネットワーク断時に複数の場所で連鎖的に例外が発生していた:
1. `fetchHolidaysFromApi()` がタイムアウトなく無限待機
2. `forceRefreshHolidays()` の catch 内で `updateJpHolidaysMeta()`（Supabase）が断で失敗 → 例外が外へ
3. `onRefreshHolidays()` で `reloadHolidays()`（Supabase 再読込）が alert 判定より前に走り、これも断で失敗 → alert に到達せず

### Fix
1. `fetchHolidaysFromApi()` に `AbortController` + 10秒タイムアウト
2. `forceRefreshHolidays()` / `refreshHolidaysIfStale()` の catch 内の `updateJpHolidaysMeta()` を try/catch で囲み失敗を飲み込む
3. `onRefreshHolidays()` で alert を `reloadHolidays()` より前に移動し、reload 失敗も `.catch(() => {})` で飲み込む。さらに想定外例外用の保険として外側 catch も追加
- Files: `src/utils/jpHolidaysClient.js`, `src/components/apps/SettingsApp.vue`

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

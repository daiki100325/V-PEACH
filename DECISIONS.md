# DECISIONS

## ADR-20260615-01: 認可状況モードの PDF 抽出は Gemini Edge Function、データは正規化2テーブル
- Status: Accepted
- Date: 2026-06-15
- Owners: daiki100325

### Context
- 認可済みパイプたばこ銘柄を Google スプレッドシートで属人管理しており、財務省が随時公表する PDF（新規認可・変更認可）を手動転記していた。Supabase 一元管理 + アプリからの閲覧/更新が必要。
- 財務省 PDF はテキスト層が壊れている：`pdftotext` で `Unknown filter 'Crypt'`、かつカスタムフォントでグリフずれ（`Casdagli`→`&DVGDJOL`、`mm`→`PP`）。決定論的テキスト抽出（pdf.js 等）は非現実的。
- CSV は変更履歴が可変長ペア（変更日・変更前定価 ×N）で繰り返す形。

### Decision
- **PDF 抽出 = Gemini（Edge Function `parse-approval-pdf`）**。PDF を `inline_data`（`application/pdf`）でネイティブ入力し、`responseSchema` 付きで「製造たばこの区分＝パイプたばこの行のみ」を構造化 JSON 抽出。API キーは Edge Function secret `GEMINI_API_KEY` で秘匿（フロント非露出）。Anthropic 鍵管理を避ける方針（Erika ADR-20260507-01）と IOA の Gemini 運用に倣う。
- **更新フロー = 抽出 → プレビュー（手修正可）→ 確定**。LLM 誤抽出の安全弁。変更認可は `(brand, product_name, package_size)` 正規化キーで既存銘柄にマッチング、未マッチは手動リンク or 削除。
- **データ = 正規化2テーブル**：`pe_approval_items`（銘柄マスタ・現行価格）+ `pe_approval_price_history`（変更履歴）。ブランド絞り込み・銘柄検索・履歴表示に最適。
- **初期投入**：既存 CSV を `scripts/seed_approval_items.mjs` で整形し supabase-js で bulk insert（items=5526 / history=1659）。`current_price` = 小売定価 ?? pair1価格（日付なし＝現行）?? null。

### Alternatives
- pdf.js 決定論パース → テキスト層が壊れており却下。
- Claude API → 鍵管理コスト + 従量課金。Gemini 無料枠中心の IOA 実績を優先。
- 単一テーブル + JSONB 履歴 → 履歴クエリ・集計が弱く却下。
- 即時自動反映 → 誤抽出がそのまま本番に入るため却下（プレビュー必須）。

### Consequences
- Positive: 財務省 PDF の表レイアウト変化にも頑健。手動転記を廃止。履歴を正規化で保持。
- Negative: Edge Function に `GEMINI_API_KEY` 設定が必要（未設定だと更新サブモードが動かない）。LLM 抽出はコスト（微小・月数回）とレイテンシを伴う。変更認可のマッチングは表記揺れで未マッチが出る（手動リンクで吸収）。

### Links
- Related note: [[V-PEACH/notes/V-PEACH_requirements]], [[V-PEACH/notes/V-PEACH_architecture]]
- Source: `supabase/functions/parse-approval-pdf/index.ts`, `supabase/DB_MIGRATION_approval_status_20260615.sql`, `scripts/seed_approval_items.mjs`

## ADR-20260611-01: マルチストア改修期間中の Supabase 操作を MCP 経由に切替（Claude Code 直接実行）
- Status: Accepted
- Date: 2026-06-11
- Owners: daiki100325
- Scope: V-MINT2.0 / V-PEACH 共有 Supabase プロジェクト・マルチストア改修期間（§6 P1〜P7）

### Context
- マルチストア改修は SQL 実行量が大きい（P1 DDL／SEED・P2 行ベース新 RPC `*_v2` の作成と 4 店舗差分検証・P4 `create_store_atomic` 定義・P7 旧ピボット RPC `DROP`）
- 現状は Claude Code が生成した SQL を つーくん が Supabase Studio で 1 本ずつ手作業実行 — 生成 → 実行 → 結果検証のループが分断され、転記ミス・実行漏れ・実行順序ミスのリスクが高い
- 特に P2 の差分検証は反復実行が多く、手作業ではコスト過大

### Decision
- 公式 `@supabase/mcp-server-supabase` を `C:\Obsidian Vault\.mcp.json` に登録し、Claude Code が Supabase に直接 SQL／RPC を実行できる体制に切替
- 接続先は V-MINT2.0／V-PEACH 共有プロジェクト（プレビュー・本番で共有・§5-2-3）
- 運用ルール（3 階層）:
  - **読み取り**（`SELECT`／`EXPLAIN`／スキーマ参照）= Claude Code が自由実行
  - **書き込み**（`CREATE`／`ALTER ADD`／`INSERT`／`UPDATE`／`CREATE FUNCTION`）= SQL を提示 → つーくん 承認 → 実行
  - **破壊的**（`DROP`／`TRUNCATE`／WHERE なし `DELETE`／`ALTER DROP COLUMN`）= 上記に加え対象件数 SELECT・FK 参照元の明示・ロールバック手順をセットで提示してから承認・実行
- PAT は環境変数経由で `.mcp.json` に渡し、`.mcp.json` 自体は `.gitignore` でリポジトリに含めない

### Alternatives
- **A. 現状維持（つーくん手作業実行）**: 安全性は最大だが、検証ループの分断と反復実行コストが本改修の規模に対して大きすぎる。却下
- **B. MCP 接続するがすべての操作を承認制**: 読み取りまで都度承認すると Claude Code 側の探索的調査コストが上がりすぎる。読み取りは自由・書き込みから承認、の階層化を採用
- **C. 別の開発専用 Supabase プロジェクトを切る**: 本番分離で安全性は上がるが、`stores` を含む実データなしでは P2 の差分検証が成立しない（既存 4 店舗の旧 RPC 出力との JSON 差分ゼロ確認が目的）。コストに対して得るものが少ない。却下
- **D. Supabase CLI でローカル migration を回す**: ローカル開発に閉じれば安全だが、本番 DB 反映のステップは結局必要で工程は減らない。Studio 手作業を CLI に置き換えるだけになる。MCP の生成 → 即実行ループ性を取る方が改修の主目的に合う

### Consequences
- **Positive**:
  - SQL 生成 → 実行 → 結果検証が 1 ループで完結。P2 の反復差分検証コストが大きく下がる
  - 実行漏れ・転記ミスのリスクが排除される
  - SQL ファイル（`supabase/migrations/`）と DB 状態の同期を Claude Code が一貫管理できる
- **Negative**:
  - Claude Code が本番共有 DB に書き込める状態となる — §5-3-4 の承認手順を必ず通すこと、`.mcp.json` の PAT 管理を厳格にすること（環境変数化＋`.gitignore`）が運用前提
  - PAT が漏れると本番 DB に対する書き込み権限が露出する。PAT のスコープ最小化（プロジェクト単位）と Bitwarden 保管を徹底
  - MCP サーバーの ライブラリ更新を追う必要あり（`@supabase/mcp-server-supabase` を npx 経由なので最新は自動で取れるが、破壊的変更時の手当てが必要）
- **Operational guardrail**:
  - P7（旧 RPC `DROP`）は §6 の go-live（P6）完了が前提条件
  - 本 ADR の運用ルールは改修期間（P1〜P7）限定。go-live 後の通常運用で MCP を残すかは別途判断

### Links
- 本書 §5-3「Supabase MCP の活用」: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan#5-3]]
- §5-2-3 共有 DB リスク: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan#5-2-3]]
- §8-1 決定ログ 項目 9（再掲）

## ADR-20260529-01: `labor_cost` フォールバック廃止・`pe_monthly_company_records` 必須化
- Status: Accepted
- Date: 2026-05-29
- Owners: daiki100325

### Context
- 人件費新方式（全社共通変動費 × 枠数按分 + 固定給）の導入時、`pe_monthly_company_records` 行がない旧月向けに `pe_monthly_records.labor_cost` をフォールバックとして残していた
- 202601〜202603 の全月データ投入完了後、フォールバックが実際には一度も発動しないことが判明

### Decision
- `pe_monthly_records.labor_cost` カラムを DROP
- `calcPL` の `else` 分岐（`record.labor_cost` 直接参照）を除去
- `PLApp.vue` で `companyRec` が null の月は `return null`（データなし扱い）
- テスト計画・仕様書からレガシーフォールバック記述を削除

### Alternatives
- フォールバック維持: 旧月参照を保険として残す案。しかし運用上 `pe_monthly_company_records` を毎月必須入力するため、フォールバックが発動するケースが存在しない。コード分岐だけ増えるデメリットが上回ると判断

### Consequences
- Positive: コードパスが1本化。`laborParams` が常に non-null なため型安全性向上
- Negative: `pe_monthly_company_records` のない月は PL 計算不可（運用上の問題なし）
- DB: `ALTER TABLE pe_monthly_records DROP COLUMN labor_cost;` を Supabase で実行要

### Links
- Migration: 下記 SQL を Supabase SQL Editor で実行

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

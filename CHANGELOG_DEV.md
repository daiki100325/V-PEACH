# CHANGELOG_DEV

## 2026-06-15（認可状況: PDFの和暦日付を西暦へ正しく変換）
- What: Edge Function **v12**。変更認可の `changed_on` が `2008-06-01` になる不具合を修正。財務省PDFの日付は**和暦（元号）表記**で、`8.6.1`（令和8年6月1日）を Gemini が2008年と誤変換していた。
  - プロンプトに「日付は必ず和暦→西暦に変換（令和 = 2018+N・例『8.6.1』→2026-06-01／平成 = 1988+N）」を明記。`approval_date`・`changed_on` 双方に適用（ROW_SCHEMA の説明も「西暦」と明示）。
- Why: 令和8年が2008年扱いになり、変更日が18年ずれていた。
- Files: `supabase/functions/parse-approval-pdf/index.ts`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-06-15（認可状況: 主軸モデルを gemini-3.1-flash-lite に変更＝429 解消／7秒に高速化）
- What: Edge Function **v10**。Gemini 主軸モデルを `gemini-2.5-flash`（RPD 20）→ **`gemini-3.1-flash-lite`（RPD 500）** に変更。
  - 無料枠 RPD: 3.1-flash-lite=500 / 2.5・3・3.5-flash=各20 / 3.1-pro=0(無料不可) / gemma=1.5K(ただしPDF・responseSchema非対応で使用不可)。RPD 20 では重いPDFで即枯れていた。
  - フォールバック既定を `gemini-3.5-flash,gemini-2.5-flash`（フル flash・各 RPD 20 の独立枠）に。`thinkingConfig` 付与条件を `/flash/i` に拡大。**4xx でも次モデルへフォールバック**（PDF/schema 対応差を考慮）。
  - 実測: 3.1-flash-lite で `20260417_kouriteika.pdf`（25行）を **7.1秒**で抽出・製造国/ブランド/価格すべて正確（旧 2.5-flash は ~40〜61s）。
- Why: 429 の真因は無料枠の枯渇で、主軸の RPD が低すぎた（[[V-PEACH/TROUBLESHOOTING]]）。課金しない方針のため、無料枠 RPD が突出して大きい 3.1-flash-lite を主軸に据えるのが最適解。
- Files: `supabase/functions/parse-approval-pdf/index.ts`, `DECISIONS.md`(ADR-02 改訂), `notes/V-PEACH_architecture.md`, `TROUBLESHOOTING.md`
- Related: [[V-PEACH/DECISIONS]] ADR-20260615-02, [[V-PEACH/TROUBLESHOOTING]]
- 運用: 既存の Edge Function secret `GEMINI_MODEL_FALLBACKS`（旧値 `gemini-2.0-flash,gemini-2.5-pro` は無料枠0/未提供で不適）は**削除**してコード既定に委ねるか、`gemini-3.5-flash,gemini-2.5-flash` に更新する。`GEMINI_MODEL` は未設定で可（既定が 3.1-flash-lite）。

## 2026-06-15（認可状況: 429 の原因を特定＝Gemini 無料枠の枯渇／失敗詳細をログ出力）
- What: 502/429 の原因を確定。Edge Function **v9** で失敗時に `console.error` で Gemini 生エラーを出力（観測性向上）。
  - 502 本文 `detail` に決定的証拠: `Quota exceeded for metric: ...free_tier_input_token_count, limit: 0, model: gemini-2.5-pro`。
  - **Gemini 無料枠（入力トークン）の枯渇**が原因。認可 PDF は入力トークンが重く無料枠をすぐ消費。**2.5-pro は無料枠 limit:0＝無料では使用不可**。
- Why: retry/fallback でも 429 が解消しなかったため根本原因を切り分け。無料枠の構造的上限はコードでは吸収不可と判明。
- 結論/対応: **恒久解決はキーの GCP プロジェクトで課金（従量課金）有効化**（無料枠上限撤廃・2.5-pro 解禁・コスト僅少）。詳細は [[V-PEACH/TROUBLESHOOTING]]「Gemini 無料枠の枯渇」。
- Files: `supabase/functions/parse-approval-pdf/index.ts`（console.error 追加）, `TROUBLESHOOTING.md`
- Related: [[V-PEACH/TROUBLESHOOTING]], [[V-PEACH/DECISIONS]] ADR-20260615-02

## 2026-06-15（認可状況: 429 が断続発生するため retry 予算を強化＋全体待機予算ガードを追加）
- What: 共用 `GEMINI_API_KEY`（IORI と同一）で 429（分あたり TPM）が断続発生する実態を踏まえ、`parse-approval-pdf` の耐性を強化（Edge Function **v7** デプロイ）。
  - **同一モデルの retry を 2→3 回**、**backoff 上限を 30s→60s**（分あたり枠は最大60sで回復するため）。
  - **全体待機予算 `GLOBAL_BUDGET_MS=90s` を新設**。待機後にこの予算を超える場合は再試行・モデル切替を行わず打ち切る（フォールバック有効時に「3モデル×リトライ×待機」で Edge Function の ~150s 制限を超えないための安全ガード）。`callGeminiModel` に `deadline` を渡して各 `sleep` 前にチェック。
- Why: 40分空けても 429、かつ「200成功→直後429」のパターンを実測。日次枯渇ではなく**分あたり TPM＋共用キー競合**が原因と判明（[[V-PEACH/DECISIONS]] ADR-20260615-02 に追記）。フォールバック（B案）併用時の暴走防止も必要だった。
- Files: `supabase/functions/parse-approval-pdf/index.ts`, `DECISIONS.md`(ADR-20260615-02 追記), `notes/V-PEACH_architecture.md`
- Related: [[V-PEACH/DECISIONS]] ADR-20260615-02
- 運用: フォールバックを使う場合は Edge Function secret `GEMINI_MODEL_FALLBACKS=gemini-2.0-flash,gemini-2.5-pro` を設定（既定 OFF）。恒久解決は V-PEACH 専用 API キーへの差替（IORI との競合解消）。

## 2026-06-15（認可状況: parse-approval-pdf に retry+backoff＋控えめモデルフォールバックを追加）
- What: Edge Function `parse-approval-pdf` に Gemini の **429/503/5xx 耐性**を追加（Edge Function **v6** デプロイ）。
  - **同一モデルで retry+backoff**（最大2回・`retryDelay`/`Please retry in Xs` をパース・既定5s/上限30s）。
  - **モデルフォールバック（env 駆動・既定 OFF）**: `GEMINI_MODEL_FALLBACKS`（カンマ区切り）が空なら主軸 `gemini-2.5-flash` のみ。設定時のみ順に切替。**PDF入力＋responseSchema 対応モデルのみ**許容（gemma 等テキスト専用は不可）。
  - `thinkingConfig` は 2.5-flash 系のみ付与（pro は無効化不可・2.0 は非搭載で 400 回避）。全滅時はレート制限を示す日本語ヒント付き 502。応答 `model` に成功モデル名を返す。
- Why: 共用 `GEMINI_API_KEY`（IORI と同一）の無料枠で PDF 取込時に 429/503 が頻発。精度最優先（主軸モデル固定）のまま可用性を上げるため。IOA `erika-cloud/src/gemini.js` の多段フォールバックを V-PEACH の抽出用途に合わせて安全化。
- Files: `supabase/functions/parse-approval-pdf/index.ts`, `notes/V-PEACH_architecture.md`, `DECISIONS.md`(ADR-20260615-02)
- Related: [[V-PEACH/DECISIONS]] ADR-20260615-02, [[V-PEACH/notes/V-PEACH_architecture]]
- 運用: フォールバックを使う場合は Edge Function secret `GEMINI_MODEL_FALLBACKS` に例 `gemini-2.0-flash,gemini-2.5-pro` を設定（既定は未設定＝OFF）。

## 2026-06-15（認可状況: 新フォーマットで製造国が空欄になる不具合を修正）
- What: 新フォーマット PDF の取込で **製造国（`origin_country`）だけが空欄**になる不具合を修正。原因は、財務省の新フォーマットでは左側グルーピング列のうち **ブランド名だけでなく製造国も同一ブランド内でセル結合**されており、2行目以降が空欄で返るため。ブランド名にしか入れていなかったキャリーフォワード補完を製造国にも適用した。
  - `parse-approval-pdf/index.ts`: プロンプトのセル結合補完指示を「ブランド名・製造国など左側グルーピング列」に一般化（brand も origin_country も直前行の値を引き継ぐよう明記）。Edge Function **v5** をデプロイ。
  - `ApprovalUpdate.vue`: ファイル単位キャリーフォワードに `lastOrigin` を追加し、空欄の `origin_country` を直前行の値で補完（ブランド名と同じ二重防御）。
- Why: 製造国がセル結合で 2 行目以降空欄になり、ブランド名の補完だけでは取りこぼしていたため。
- Files: `supabase/functions/parse-approval-pdf/index.ts`, `src/components/apps/approval/ApprovalUpdate.vue`, `notes/V-PEACH_architecture.md`, `notes/V-PEACH_requirements.md`, `notes/V-PEACH_how-to-use.md`
- Related: [[V-PEACH/notes/V-PEACH_approval-update-reqs]], [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-06-15（認可状況: 最終更新日時表示・新PDFフォーマット対応・認可日プレフィル・重複判定厳密化）
- What: `notes/V-PEACH_approval-update-reqs.md` の4要件を実装。
  - **§1 最終更新日時の常時表示**: `api.js` に `getApprovalLastUpdated()` を新設（`pe_approval_items.updated_at` と `pe_approval_price_history.created_at` の新しい方を返す）。`ApprovalApp.vue` のヘッダー右に「最終更新日時: YYYY-MM-DD HH:MM」を常時表示し、更新確定後（`@updated` イベント）に自動再取得。
  - **§2 新フォーマット（2026-04-17以降）対応**: 財務省PDFがブランド名と銘柄名の列を分離した件に対応。①ブランド名列のセル結合で空欄になる行を**直前ブランドで補完**（Edge Function プロンプト＋`ApprovalUpdate.vue` のファイル単位キャリーフォワードの二重防御）。②`product_name` を**スマート前置**で復元（`buildProductName`）：銘柄名がブランド名で始まらなければ `ブランド名+空白+銘柄名`、既に含むなら前置しない（旧フォーマットでの二重化防止）。重複キー算出も前置後の完全名称で行い別ブランド同名銘柄の誤統合を防止。
  - **§3 認可日のファイル名プレフィル**: `dateFromFilename` でファイル名先頭 `YYYYMMDD` を `YYYY-MM-DD` 化し、新規の `approval_date`／変更の `changed_on` 初期値にセット（手修正可）。
  - **§4 重複判定の厳密化**: 新規認可の重複判定を「銘柄名（NFKC正規化）＋容量（重量g）」の両方一致時のみに変更。同名でも容量違いは別商品として新規追加。変更認可のマッチング（名前一意なら容量差無視）は従来どおり維持。
- Why: ①どの月日まで反映済みか一目で把握したい、②財務省PDFの新フォーマットでブランド名が欠落・銘柄名が不完全になる、③認可日の手入力が手間、④同名・容量違いを別商品として扱いたい、という運用要望。
- Files: `src/api.js`（getApprovalLastUpdated）, `src/components/apps/ApprovalApp.vue`（最終更新日時表示）, `src/components/apps/approval/ApprovalUpdate.vue`（buildProductName・dateFromFilename・キャリーフォワード・重複判定）, `supabase/functions/parse-approval-pdf/index.ts`（新フォーマット用プロンプト）, `notes/V-PEACH_requirements.md`
- Related: [[V-PEACH/notes/V-PEACH_approval-update-reqs]], [[V-PEACH/notes/V-PEACH_requirements]], [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]
- 運用: Edge Function `parse-approval-pdf` のプロンプト変更は**再デプロイが必要**（`supabase functions deploy parse-approval-pdf`）。未デプロイでもフロントの `buildProductName`＋キャリーフォワードが保険として機能する。

## 2026-06-15（認可状況: ブランド絞り込みの複数選択・OR検索対応）
- What: 認可状況の閲覧モードで、ブランドを複数選択してOR検索できるように改修。
  - `ApprovalBrowse.vue`: ブランド選択 UI を単一の `<select>` から、チェックボックスのリスト（スクロール領域 `max-h-40`）に変更し、配列で複数のブランドを持てるように修正。
  - `api.js`: `getApprovalItems` の `brand` 引数が配列を受け取れるようにし、配列の場合は `.in('brand', brand)` を使って OR 検索（複数条件マッチ）するよう修正。
- Why: 単一ブランドしか選択できない仕様だと、複数の関連ブランドを同時に確認したい時に不便だったため。
- Files: `src/components/apps/approval/ApprovalBrowse.vue`, `src/api.js`

## 2026-06-15（認可状況: 新規ブランドのDB表記統一＋複数PDFアップロード対応）
- What: ①**新規認可の挿入時にブランドを DB の正式表記へ統一**。`insertApprovalItems` が既存ブランドの「正規化キー→正式表記」マップ（`getApprovalBrands`）を作り、挿入ブランドを `normalizeBrand` 後に既存表記へスナップ（表記揺れの再発防止）。※変更認可は既存行の `item_id` を更新するだけなので元々 DB 表記のまま。②**更新サブモードを複数PDFアップロードに対応**。`<input multiple>` + 逐次解析（Gemini を同時多発させずレート制限に配慮）＋進捗表示（n/N）＋PDF間の重複（同名・同重量）除去。1ファイル失敗しても成功分でプレビュー続行（警告表示）。
- Why: 新規ブランドが既存と微妙に違う表記で入るのを防ぎたい／複数の認可PDFをまとめて取り込みたいという要望。
- Files: `src/api.js`（insertApprovalItems 正式表記スナップ）, `src/components/apps/approval/ApprovalUpdate.vue`（files[] 逐次解析・進捗・重複除去）
- Related: [[V-PEACH/notes/V-PEACH_requirements]], [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-06-15（認可状況: Edge Function 高速化＋変更認可マッチング堅牢化・E2E検証）
- What: ①`GEMINI_API_KEY` 設定後に E2E 検証。新規認可PDF→3行(11.7s)・変更認可PDF→108行 抽出を確認。②変更認可（108品目）が **Edge Function 150s タイムアウト**になったため、Gemini の **thinking 無効化**（`thinkingConfig.thinkingBudget=0`）＋ `maxOutputTokens=65536` で **39.5s に短縮**（v3 デプロイ）。③変更認可のマッチングを堅牢化：ブランドの大小・granularity やソース間の容器表記揺れ（DB`ﾊﾟｳﾁ` vs PDF`箱`）に依存しないよう、**銘柄名(NFKC正規化)＋重量(g数値)** で突合する方式へ変更。容器名一致では 62/108 だったマッチが **重量ベースで 108/108 自動マッチ**に改善（実データ検証）。
- Why: 100品目超の変更認可で生成が 150s を超えてタイムアウトしていた。また brand 正規化（UPPERCASE）後は `.eq('brand', ...)` の候補取得が大小不一致で全外れになり、容器表記の食い違いも相まって手動リンクだらけになっていた。
- Files: `supabase/functions/parse-approval-pdf/index.ts`（thinking 無効化・maxOutputTokens）, `src/components/apps/approval/ApprovalUpdate.vue`（全件ロード＋name(NFKC)+weight マッチング・手動リンク候補）
- Related: [[V-PEACH/notes/V-PEACH_architecture]], [[V-PEACH/DECISIONS]] ADR-20260615-01
- 運用: Edge Function secret `GEMINI_API_KEY` 設定済み（IOA と共用）。

## 2026-06-15（認可状況: 閲覧の表示上限を撤廃・全件対応）
- What: 閲覧の表示上限 500 を撤廃。`getApprovalItems` を `.range()` の **1000 件ずつ分割取得**に変更し、PostgREST の 1 リクエスト 1000 行固定キャップ（`.limit(6000)` でも 1000 しか返らないことを実測）を回避して全件（5526）取得可能に。閲覧 UI は DOM 負荷対策で **200 件初期表示＋「もっと見る」(+300)** の段階描画にした。
- Why: つーくんから表示上限拡張の要望。単純な limit 増では PostgREST のキャップに阻まれるため分割取得が必要だった。
- Files: `src/api.js`（getApprovalItems 分割取得）, `src/components/apps/approval/ApprovalBrowse.vue`（renderLimit 段階表示）, `notes/V-PEACH_requirements`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-06-15（認可状況: ブランド一覧バグ修正＋表記正規化）
- What: ①ブランド絞り込みが **26件しか出ない**バグを修正。原因は `getApprovalBrands` の `.select('brand')` が PostgREST 行上限（1000）で頭打ちになり distinct が欠けていたこと。サーバー側 DISTINCT の RPC `get_approval_brands` を新設して全件取得に変更。②ブランド表記揺れ（大文字小文字・空白）を統合：全ブランドを **UPPERCASE＋空白正規化** し、`Azure hookah tobacco Black` 等のライン違いを `AZURE HOOKAH TOBACCO` に統合（distinct 133→**119**）。新規 PDF 取込・再seed でも崩れないよう `api.js normalizeBrand` / seed に正規化を焼き込み。
- Why: 上限で大半のブランドが欠落していた。加えて同一ブランドが大小・空白差で別扱いになりフィルタが冗長だった。
- Files: `src/api.js`（`get_approval_brands` RPC 利用・`normalizeBrand`・insert 正規化）, `scripts/seed_approval_items.mjs`（normalizeBrand）, `supabase/DB_MIGRATION_approval_status_20260615.sql`（RPC＋正規化 UPDATE 記録）
- Related: [[V-PEACH/DECISIONS]] ADR-20260615-01

## 2026-06-15（認可状況モード UI 改善）
- What: ①閲覧の絞り込み/検索を**右下 FAB ＋スライドアップ・パネル**（IORI 参照）へ移設し、**並び替え**（名前 昇順/降順・認可日 昇順/降順）を追加（`getApprovalItems` に `sortKey`/`sortDir` 追加）。②トップメニューのカード順を **認可状況 → 設定**（設定を常に最後）に変更。③認可状況カードの色を `brand`（オレンジ＝月次入力と同系）から **indigo** に変更し差別化（ヘッダーアクセント・モード内タブ/ボタンも indigo 統一）。
- Why: 絞り込み UI の常時占有を避けモバイルで操作しやすく、並び替えニーズに対応。月次入力カードと色が被って区別しづらかったため。
- Files: `src/components/apps/approval/ApprovalBrowse.vue`, `src/api.js`（getApprovalItems 並び替え）, `src/components/PortalMenu.vue`（順序・色）, `src/components/common/AppHeader.vue`（accent）, `src/components/apps/ApprovalApp.vue`, `src/components/apps/approval/ApprovalUpdate.vue`（indigo 統一）
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-06-15
- What: 新モード **「認可状況」**（サブモード 閲覧 / 更新）を新設。財務省に認可されたパイプたばこ銘柄を Supabase で一元管理し、閲覧（ブランド絞り込み・銘柄名 ilike 検索・価格履歴展開）と更新（財務省 PDF アップロード → Gemini で構造化抽出 → プレビュー編集 → 確定で DB 反映）を可能にした。新規 DB 2 テーブル（`pe_approval_items` / `pe_approval_price_history`）+ Edge Function `parse-approval-pdf`（Gemini・PDF ネイティブ入力）+ 既存 Google スプレッド CSV を初期投入（items=5526 / history=1659）。**「製造たばこの区分」が「パイプたばこ」の行のみ**対象（他区分は捨象）。
- Why: 認可済み銘柄が Google スプレッドシートで属人管理されており、財務省 PDF（新規・変更）の手動転記が負担・ミス源だった。財務省 PDF はテキスト層が壊れている（`Crypt` filter／カスタムフォントで文字化け）ため決定論パース不可 → Gemini に PDF を直接読ませる方式を採用。
- Files: `supabase/DB_MIGRATION_approval_status_20260615.sql`（記録）, `supabase/functions/parse-approval-pdf/index.ts`, `scripts/seed_approval_items.mjs`, `src/api.js`（認可状況 API 群）, `src/components/apps/ApprovalApp.vue`, `src/components/apps/approval/ApprovalBrowse.vue`, `src/components/apps/approval/ApprovalUpdate.vue`, `src/App.vue`, `src/components/PortalMenu.vue`, `src/components/common/AppHeader.vue`
- Related: [[V-PEACH/notes/V-PEACH_requirements]], [[V-PEACH/notes/V-PEACH_architecture]], [[V-PEACH/notes/V-PEACH_supabase-er-diagram]], [[V-PEACH/DECISIONS]]（ADR-20260615-01）
- ⚠ 運用前提: Edge Function 動作には Supabase の Edge Function secret `GEMINI_API_KEY` の設定が必要。

## 2026-06-14
- What: go-live 完了に伴い `multi-store` ブランチを削除し `main` 一本運用へ復帰した旨を scaling-plan §5-1-7 に追記（実作業: ff マージ→本番反映→`git branch -d multi-store`）
- Why: 本改修専用の二系統ブランチ運用が役目を終えたため、発端ドキュメントに完了を明記
- Files: `notes/V-PEACH_multi-store-scaling-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]], [[_Global/notes/Global_git-syncthing-policy]]

## 2026-06-14
- What: 設定 > 店舗管理「新店舗を追加」ボタンの「＋」二重表示を解消 — SVG プラスアイコンとテキスト先頭の全角「＋」が重複していたため、テキスト側の「＋」を削除し SVG アイコンのみ残した
- Why: アイコンとテキストで＋が二重に出て視覚的に違和感があったため
- Files: `src/components/apps/SettingsApp.vue`
- Related: [[V-PEACH/notes/_index]]

## 2026-06-13
- What: **マルチストア改修 P6 本番反映（go-live）完了** — `multi-store` HEAD（`3361cfc`）から本番ブランチへ直接 subtree push。V-PEACH→`main`（`cd5733f..7d8ac49`、fast-forward）。同時に V-MINT2.0→`v2`（`e0a00c9..905df89`）も実施。両 diverge なし。保険ブランチ（v3/v2）経由でなく直接 push したのは go-live 直前バグ修正が保険ブランチ未反映のため（プラン §5-2-4 が許容する `subtree push 本番` 方式）。Cloudflare 本番ビルド → **本番スモーク PASS**（V-PEACH PL 直近月売上/営業利益が従来どおり・V-MINT 在庫1モード 4店舗表示・コンソール赤エラーなし）。**P6 ✅ クローズ＝P1〜P6 完了で go-live 達成**。残は P7（レガシー除去・§6-2）のみ
- Why: §6-4 localhost 目視確認 全項目 PASS を受け、go-live（§5-2-4）を実行するため
- Files: なし（デプロイ操作のみ）。帳票: `notes/V-PEACH_multi-store-scaling-plan.md`（§6 表 P6・§6-1 P6・§6-4・冒頭サマリー）
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-13
- What: **P6 目視確認（§6-4）全項目 PASS** — localhost dev サーバー（V-MINT :5173 / V-PEACH :5174）で実施。V-MINT で2バグ発見→即修正（①実施日 mm/dd/yyyy 表示→`color:transparent` + Vue オーバーレイで yyyy/mm/dd 固定、② `requestCurrentStoreName` Vue warn → RequestApp watch→emit 追加）。V-PEACH は初回全項目 PASS。集計期間チップが合計選択時に非表示なのは仕様どおりと確認。**残は本番マージ（§5-2-4）のみ**
- Why: P6 go-live 直前の最終スモーク（§6-4）実施のため
- Files: `V-MINT2.0/src/components/apps/InventoryApp.vue`, `V-MINT2.0/src/components/apps/TransferApp.vue`, `V-MINT2.0/src/components/apps/RequestApp.vue`, `V-MINT2.0/src/App.vue`, `notes/V-PEACH_multi-store-scaling-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-13
- What: **基本ドキュメントのマルチストア改修（Phase 13）反映漏れを一括是正**（ドキュメントのみ）。`history`＝Phase 13 を「計画中」→「P1〜P5 完了・go-live 直前」へ（現況ノート・節見出し・進捗サマリー・タイムラインに実装実績を追記）。`architecture`＝`stores` 4列追加・`pe_store_shift_rules`/`app_ui_settings`・`create_store_atomic` RPC・RPC v2 行ベース化を DB 設計に追加、ディレクトリ節に `storeFilters.js`・`shiftImporter` ルール参照化・`SettingsApp` 店舗管理 GUI・P1/P4 マイグレを反映。`supabase-er-diagram`＝`pe_store_shift_rules`/`app_ui_settings` の「予定/未参照」記述を実装済みへ更新＋P4 マイグレを履歴表に追加。`finance-spec`＝`calcSlotsFromShifts` シグネチャ更新・馬場2号店補正を `pe_store_shift_rules` データ化として記述。`release-plan`＝Phase 13 ロードマップを go-live 直前ステータスへ。**`requirements`/`how-to-use` は P4 で既に反映済み・無修正**
- Why: マルチストア改修 P1〜P5 完了に対し、`scaling-plan`/`code-review` 以外の基本文書がコード現況に追従しておらず stale だったため（つーくん依頼の文書点検）。V-CHART/notes も点検 → official-forms/release-plan/requirements とも 06-11 UI 変更（変更実施年月日・申請者情報/日付出力セクション・範囲指定一括適用）に同期済みで**更新漏れなし**と確認
- Files: `notes/V-PEACH_history.md`, `notes/V-PEACH_architecture.md`, `notes/V-PEACH_supabase-er-diagram.md`, `notes/V-PEACH_finance-spec.md`, `notes/V-PEACH_release-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]], [[V-PEACH/notes/V-PEACH_multi-store-code-review]]

## 2026-06-13
- What: マルチストア改修 **P6 go-live 直前コードレビュー 一巡完了** — `multi-store` vs `main`（26 ファイル・+2913 行）の実差分を高リスク順にレビュー。**ブロッカー級バグはゼロ＝go-live 可能な品質**と判定。確認: storePLs 添字整合（`aggStores` 単一基準）・閉店除外の二重防御・`create_store_atomic` のアトミック性／サーバ側バリデーション・`payment_fee_rate` の %⇄小数往復一貫・書き込み境界のホワイトリスト・RPC v2 の `jsonb_object_agg` 動的キー化。観察事項4件（手数料率の上限なし／名寄せ対象に office 含む／getStores 失敗時の縮退／新店舗の stock JSON キー）はいずれも低重要度・任意対応
- Why: 前回セッションがトークンリミットで途絶したコードレビューを、実コードを正本に再実行して go-live 判定を確定するため（multi-store-scaling-plan §6 P6）。結果を耐久ドキュメント化し再途絶に備えた
- Files: `notes/V-PEACH_multi-store-code-review.md`（新規）, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-code-review]], [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-13
- What: マルチストア改修 **P0 完了・P6 前半（本番マージ直前まで）** — `multi-store` ブランチから保険ブランチへ初回 subtree push（V-PEACH `v2` 新規生成・本番 `main` 無傷）。Cloudflare プレビュー `https://v2.v-peach.pages.dev/` の稼働確認済み（push 前に vite build PASS）。本番マージ（`v2→main`）と本番スモークは未実施＝つーくん GO 待ち
- Why: P4×P5 完了を受け go-live 準備を本番反映直前まで進めるため（multi-store-scaling-plan §5-2／§6 P0・P6）
- Files: なし（デプロイ操作のみ。`notes/V-PEACH_multi-store-scaling-plan.md` の進捗帳票を更新）
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-13
- What: マルチストア改修 **P4・P5 完了** — §6-3 統合 e2e 全手順 PASS。①ウィザードでテスト店作成→`create_store_atomic` のアトミック性を SQL 確認（4テーブル 1+1+1+6 行・入力値完全一致）②両アプリ全モードにリロードのみで反映（P4 条件）③休止化→トグル両アプリ連動（`app_ui_settings` 共有）→「（休止）」付き過去 PL 閲覧→閉店翌月の集計・按分除外（P5 条件）④後片付け＝テストデータ 9 行を §5-3-4 承認フローで DELETE・残骸ゼロ・トグル OFF 復帰。仕様確認: 新店舗は作成直後から全モード表示（開店日カラムなし・適用開始月は設定世代のみ）・月次レコード無き月は PL 早期 return で集計影響ゼロ
- Why: P4「GUI から店舗追加→全モード自動反映」・P5「休止店舗の決算閲覧・按分非混入」の完了条件を実機で検証するため（multi-store-scaling-plan §6-3）。次フェーズは P6（go-live）
- Files: なし（検証のみ。`notes/V-PEACH_multi-store-scaling-plan.md` の進捗帳票を更新。e2e 中に発見した集計期間チップの修正は同日別エントリ）
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-13
- What: マルチストア改修 **P5 微修正（e2e フィードバック）** — PL 画面「各店舗の集計期間」プレビューを休止トグル連動に。`fetchCostPeriodPreview` の取得項目に `isActive` を追加し、新 computed `visibleCostPeriodPreview`（`showInactiveStores || isActive !== false`）でチップを出し分け。トグル ON 時は「（休止）」印付き表示（セレクタ・PL列と同一ルール）。集計データ自体は閉店月まで対象のまま（表示のみの変更）
- Why: P4×P5 統合 e2e（§6-3 手順4）でつーくんが発見 — テスト店休止後、他は全て非表示になるのに集計期間チップだけ閉店月（6月）に残った。`isStoreOpenForPeriod`（閉店月まで営業扱い）のみでフィルタしておりトグルを見ていなかったため、`displayColumns` と同じトグル連動に統一
- Files: `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-13
- What: マルチストア改修 **P4 残のドキュメント同期** — `notes/V-PEACH_requirements.md`（対象拠点の動的化・PL拠点フィルター・設定モードに「店舗管理」サブモード追記＋R5〜R8 要件の詳細節新設）と `notes/V-PEACH_how-to-use.md`（1-3 に休止店舗トグルの使い方・2-6「店舗管理」節新設＝一覧操作/追加ウィザード3ステップ/休止トグル/閉店集計ルール）を実装済み機能に同期。コード変更なし
- Why: P4 完了条件のうち「`requirements`/`how-to-use` ドキュメント同期」を消化（multi-store-scaling-plan §6-1 P4）。残は P4×P5 統合 e2e（§6-3）のみ
- Files: `notes/V-PEACH_requirements.md`, `notes/V-PEACH_how-to-use.md`, `notes/V-PEACH_multi-store-scaling-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]
- 補足: §5-4 体制（Sonnet サブエージェントがドラフト → Fable レビューで2点修正＝①`create_store_atomic` の insert 対象に `pe_store_settings_revisions` を追記 ②V-PEACH PL トグルは常時表示（「休止店舗存在時のみ出現」は V-MINT ダッシュボード側の仕様）と訂正）

## 2026-06-12
- What: マルチストア改修 **P5 最終** — `csvImporter.js` の店舗名寄せを動的化。`detectStoreKeyFromFilename`・`decideHrmosSegmentClassification`・`parseHrmosSegmentsCsv` のハードコード（`STORE_NAME_JP` / `STORE_KEY_FROM_FILENAME_EN` 固定マップ・`SEGMENT_STORE_PATTERNS` 固定パターン）を削除し、呼び出し元から `stores` リストを引数で渡す動的解決に置き換え。InputApp は `this.stores`（App.vue が DB から取得済みの店舗リスト）を渡す。SettingsApp は `this.hmStoresDb`（同 getStores() 結果）を第3引数として追加。警告メッセージも `this.stores.map(s => s.name).join('・')` で動的化。
- Why: 店舗追加・名称変更が SettingsApp GUI から可能になったのに、CSV 名寄せのハードコードが残っていた。新店舗を追加するたびに csvImporter.js を手修正する必要があるため、stores テーブル由来の動的解決に統一（multi-store-scaling-plan §6 P5）。
- Files: `src/utils/csvImporter.js`, `src/components/apps/InputApp.vue`, `src/components/apps/SettingsApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-12
- What: マルチストア改修 **P5** — `PLApp` に休止店舗対応を実装。(1) 未定義だった `loadStoreContext()`（`getStores()` から `store_type==='shop'` 全行を `{key,name,isActive,closed_at}` に map して `allStores` へ・`getAppUiSettings()` で `showInactiveStores` 初期化・各々失敗時は console.error で握りつぶし現状継続）と `onToggleShowInactive(checked)`（楽観更新→`updateAppUiSettings`・失敗時 alert＋ロールバック・トグルOFFで選択中店舗が選択肢から消える場合は `'all'` に戻す整合処理）を追加。(2) PL の全店舗合計・店舗別PL一覧（`storePLs`）の集計母集団を `this.stores`（active のみ）から `aggStores`（休止含む全 shop）へ変更し、`prefetchPeriods`／`loadMonthlyPLCore`／rolling3・annual の `storePLs` 添字／`fetchCostPeriodPreview` を aggStores 基準に統一（displayColumns と添字一致）。(3) 集計ループと**人件費按分の分母**（`totalWeightedSlots`）に `isStoreOpenForPeriod(store, periodKey)` を適用し、閉店翌月以降の店舗を除外
- Why: 休止店舗を選択UIから既定で隠しつつ過去PLはトグルで閲覧可能にし、閉店翌月以降は集計・按分分母から正しく除外するため（multi-store-scaling-plan §6 P5）。現行4店舗は全て is_active=true・closed_at=NULL のため画面・数値は完全一致（回帰ゼロ）
- Files: `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]
- 補足（按分分母の調査）: 人件費按分の分母は `loadMonthlyPLCore` 内 `totalWeightedSlots`＝各店 `pe_monthly_records`（実シフトデータ）の重みつき枠数合計。閉店翌月以降は通常その月のレコードが存在せず自然に 0 になるが、過去データ残骸で分母が膨らみ他店の変動費按分が歪むのを防ぐ安全弁として明示的に `isStoreOpenForPeriod` で除外。`App.vue` は既に `is_active` で props.stores を絞っており、InputApp/SettingsApp の他セレクタに休止店舗が混ざる箇所はなし（SettingsApp 店舗管理セクションは仕様通り休止も表示）

## 2026-06-12
- What: マルチストア改修 **P3 完了** — 画面スモーク全項目 PASS（PL 店舗切替・シフトCSV取込〔馬場2号店 遅番土日祝=7.5h 補正の維持確認含む〕・店舗管理セクション一覧/名称編集/並べ替え・追加ウィザードの Step バリデーション）。コード変更なし（検証のみ）。ウィザード最終確定→両アプリ反映の e2e は P4 残タスクとして未実施（共有 DB のため実店舗作成はタイミングを別途判断）
- Why: P3 フロント動的化の完了条件「4 店舗で全モード回帰なし」を満たしたため（multi-store-scaling-plan §6 P3）
- Files: なし（`notes/V-PEACH_multi-store-scaling-plan.md` の進捗帳票を更新）
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-12
- What: マルチストア改修 **P4 後半** — 新店舗追加ウィザード実装完了。`SettingsApp` の「＋ 新店舗を追加」ボタンを有効化し、3ステップのモーダルウィザード（Step1: 基本情報・Step2: 固定費設定・Step3: シフトルール＋サマリー）を追加。`api.js` に `createStoreAtomic()` ラッパー（`create_store_atomic` RPC 呼び出し）を追加。各ステップにクライアント側バリデーション（store_key 正規表現・全項目必須・非負）、Step3 で入力内容サマリー表示・確認ダイアログ（`smConfirm` 流用）を経て一発確定。成功時は店舗一覧リロード＋ウィザード閉じ。失敗時はサーバーエラーをStep3内に表示し入力保持
- Why: 新店舗追加の一連フローを UI 完結させる（R6/R7 要件。multi-store-scaling-plan §4-4 / §6 P4 後半）
- Files: `src/api.js`, `src/components/apps/SettingsApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-11
- What: マルチストア改修 **P4 前半** — `SettingsApp` に「店舗管理」セクションを新設（subMode `store-mgmt`）。shop 店舗の一覧（休止含む・display_order 順）／名称インライン編集（Enter保存・Escキャンセル）／休止・再開トグル（確認ダイアログ必須・休止で `closed_at`=当日・再開でクリア）／↑↓並べ替え（隣接 swap・office とは入れ替え不可）／`store_key` ロック表示。`api.js` に `updateStore(id, fields)` 追加（name/is_active/display_order/closed_at ホワイトリスト方式・store_key/store_type は更新経路なし）。新店舗追加ボタンは disabled プレースホルダー（P4 後半のウィザードで実装）
- Why: 店舗マスタの単一窓口を V-PEACH に集約（R5）。休止は論理削除で過去データ保持（R2/R3）（multi-store-scaling-plan §4-4 / §6 P4）
- Files: `src/components/apps/SettingsApp.vue`, `src/api.js`（`multi-store` ブランチ）
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-11
- What: マルチストア改修 **P4 前半** — `create_store_atomic` RPC を Supabase MCP（migration `multi_store_p4_create_store_atomic`）で適用。`stores`＋`pe_store_settings`（現行値）＋`pe_store_settings_revisions`（初期世代）＋`pe_store_shift_rules`（6行）を単一トランザクションで一括 insert・失敗時全体ロールバック。store_key 正規表現／固定費5項目必須／シフト6パターン必須のサーバ側バリデーション付き。検証: 成功パスを BEGIN→ROLLBACK で実行し残骸ゼロ確認・重複キー／ルール不足の拒否も確認
- Why: P4 新店舗追加ウィザード（一発確定）の前提。「stores だけある半端な店舗」を構造的に作らせない（multi-store-scaling-plan §4-4 / §7）
- Files: `supabase/DB_MIGRATION_multi_store_p4_create_store_atomic_20260611.sql`, `notes/V-PEACH_supabase-er-diagram.md`, `notes/V-PEACH_multi-store-scaling-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]], [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]

## 2026-06-11
- What: マルチストア改修 **P3** — `App.vue` の店舗リスト直書き（`baba`/`nakano`/`baba_2nd`）を撤廃し、`getStores()` から `store_type==='shop'` かつ `is_active` の行を取得して動的生成（`loadStores()`）。UI キーを DB `store_key`（`baba_main`）に統一し、取得失敗時は現行3店舗の固定フォールバックで継続。休止店舗の表示トグルは P5 で対応
- Why: 店舗増減を `stores` マスタ1か所の登録で V-PEACH 全モード（PL／入力／設定）に反映させる（multi-store-scaling-plan §4-3 / §6 P3）
- Files: `src/App.vue`（`multi-store` ブランチ）
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-11
- What: マルチストア改修 **P3** — `shiftImporter.js` の店舗ハードコード撤廃・`pe_store_shift_rules` 参照化。(1) `STORE_KEYS=['baba_main','nakano','baba_2nd']` 固定配列と `ryoSlots`/`ptSlots` 固定オブジェクトを撤廃し、集計対象店舗を呼び出し側から `storeKeys`（active な shop 店舗）で受け取る動的生成へ。(2) 「馬場2号店の遅番×土日祝=7.5h」ハードコード補正を撤廃し、シフト枠時間（shift_type×day_type×store）を `pe_store_shift_rules` から取得・対象月の世代を `effective_from<=periodKey` の最新で選択（`getActiveStoreSettings` と同方式）。shiftImporter は DB 非依存の純関数を維持し、ルールは呼び出し側で取得して引数で渡す。(3) `src/api.js` に読み取り専用 `getStoreShiftRules()`（stores と FK join で store_key 解決・全世代返却）を追加。(4) InputApp の `formatShiftsResultForUi`・`onUploadShiftsCsv` のハードコード店舗キーを stores プロップ／`result.slots` 由来に動的化（レガシー `baba`→`baba_main` 正規化シムは保持）。SEED が現行ハードコードを忠実再現のため既存3店舗の計算結果は不変（回帰ゼロ）
- Why: マルチストア（4店舗目以降）対応。店舗固有ロジックの最終ハードコード源を撤廃（multi-store-scaling-plan §6 P3）
- Files: `src/utils/shiftImporter.js`, `src/api.js`, `src/components/apps/InputApp.vue`（`multi-store` ブランチ）, `notes/V-PEACH_multi-store-scaling-plan.md`, `notes/V-PEACH_supabase-er-diagram.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]], [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]

## 2026-06-11
- What: `inventory_logs_flavor_id_fkey`（`inventory_logs.flavor_id` → `flavors.id`）に `ON DELETE CASCADE` を追加。既存制約を DROP → `CASCADE` 付きで再作成
- Why: テスト用に作成したフレーバー（AL FAKHER Twist, id=310）を `flavors` テーブルから削除しようとしたところ、FK 制約の `ON DELETE` 挙動が未設定（`NO ACTION`）で削除不可だった
- Files: `supabase/migrations/20260611_inventory_logs_fk_on_delete_cascade.sql`（V-MINT2.0 側に格納）
- Related: [[V-PEACH/TROUBLESHOOTING]], [[V-MINT2.0/CHANGELOG_DEV]]

## 2026-06-11
- What: マルチストア改修 **P3 着手** — `getStores()` を拡張（新4列 `is_active`/`display_order`/`store_type`/`closed_at` 取得・`display_order` 順）。office 含む全行返却で `is_active` 絞り込みは呼び出し側責務（休止トグルは P5）。既存呼び出し（SettingsApp / InputApp の HRMOS 系）は ID→キー解決のみで並び順非依存のため挙動不変。vite build 確認済み
- Why: P3（フロント動的化）全タスクの起点となる基礎 API 整備（multi-store-scaling-plan §4-3 / §6 P3）
- Files: `src/api.js`（`multi-store` ブランチ）, `notes/V-PEACH_multi-store-scaling-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]], [[V-MINT2.0/CHANGELOG_DEV]]

## 2026-06-11
- What: マルチストア改修 **P2（RPC 行ベース化）完了**に伴い計画帳票を更新（§6 P2 ✅・全期間 202512〜202606 差分ゼロ検証 PASS・フロント切替済み）。あわせて計画に **§5-4 サブエージェント活用**（Fable=戦略・レビュー・コミット・DB 書き込み／Sonnet・Opus=自己完結な実装・調査。DB 書き込み・commit はサブエージェント禁止）を新設し決定ログ 10 に追記。P2 が §5-4 体制の初運用（Sonnet 草案 → Fable レビュー・適用・検証）
- Why: 進捗正本の同期と、改修期間中のトークン節約・レビュー品質維持の体制明文化
- Files: `notes/V-PEACH_multi-store-scaling-plan.md`
- Related: [[V-MINT2.0/CHANGELOG_DEV]], [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-11
- What: マルチストア改修 **P1（DB マイグレーション）完了**＋**§5-1 ローカルブランチ運用開始**。(1) `stores` に `is_active` / `display_order` / `store_type`（CHECK 制約付き）/ `closed_at` を追加し既存 4 店舗を SEED（office は `store_type='office'`・`display_order` 0→3）、(2) `pe_store_shift_rules`（店舗別シフト枠時間・`effective_from` 世代管理）と `app_ui_settings`（両アプリ共有 UI 状態シングルトン）を新設し RLS（anon 全許可）＋初期 SEED 18 行投入、(3) Supabase MCP の migration `multi_store_p1_stores_shift_rules_app_ui_settings` で適用し既存 RPC 4 本（`fetch_stock_overview` 等）の正常応答を確認（additive のみ・既存動作不変）、(4) `multi-store` ローカルブランチ作成＋`/vmint-deploy`・`/vpeach-deploy` 冒頭にブランチガード追加、(5) シフト枠既定値は計画書表記（早番6h/中番7.5h）が実態と逆だったため `pe_hrmos_segments` 実データ準拠（**早番7.5h/中番6h/遅番6h・馬場2号店のみ遅番×土日祝7.5h**）で投入し、計画書 §4-1 と ER 図の表記も訂正
- Why: 店舗増減 GUI 対応（multi-store-scaling-plan §6 P1）。additive のみで既存 4 店舗を壊さず、P3 フロント動的化・P4 店舗管理 GUI の DB 土台を先行整備するため
- Files: `notes/V-PEACH_multi-store-scaling-plan.md`, `notes/V-PEACH_supabase-er-diagram.md`, `notes/V-PEACH_architecture.md`, `supabase/DB_MIGRATION_multi_store_p1_20260611.sql`（`multi-store` ブランチ）, `.claude/commands/vmint-deploy.md` / `vpeach-deploy.md`（未追跡運用のため git 管理外）
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]], [[V-PEACH/notes/V-PEACH_supabase-er-diagram]], [[V-MINT2.0/CHANGELOG_DEV]]

## 2026-06-11
- What: Supabase の `pe_monthly_company_records` で無効だった RLS を有効化し、他の pe_* テーブルと同一の `anon_all` ポリシー（anon ロールに ALL 許可・USING/WITH CHECK とも `true`）を付与。MCP 経由のマイグレーション `enable_rls_stg_and_pe_monthly_company` で適用（V-MINT2.0 側 `stg_*` 4テーブルも同マイグレーションに同梱）
- Why: Supabase の advisor が RLS 無効を critical 指摘。アプリは URL 社外秘＋PIN 認証で保護する運用のため、他テーブルと同じく anon フルアクセスのポリシー付き RLS に統一し、挙動を変えずに無防備状態（ポリシー層の完全素通し）だけ解消する
- Files: （DB マイグレーションのみ・コード変更なし）
- Related: [[V-MINT2.0/CHANGELOG_DEV]]

## 2026-06-11
- What: `notes/V-PEACH_multi-store-scaling-plan.md` を**全面再構成**。後付け追加だった「ローカル分離運用」「Supabase MCP 活用」を本書の構造に統合し、§5「開発・運用環境（本改修中の作業基盤）」を新設して §5-1 ローカル ブランチ運用（旧 §6-5）／§5-2 デプロイ ブランチ戦略（旧 §6-1〜6-4）／§5-3 Supabase MCP の活用（新規）を並列化。旧 §5「実装フェーズ」は §6 へ繰り下げ、本文中のすべての §-参照を新番号体系に追従更新。§5-3 では MCP 活用の目的・前提・セットアップ手順・運用ルール（読み取り自由／書き込み承認／破壊的二重確認）・タスクチェックリスト・進捗表を §6 フェーズ表と同等の粒度で記述。§7 リスク欄に MCP 経由実行のリスクを追加、§8-1 決定ログに項目 9（MCP 活用）を追記、ヘッダー ステータス行も三点併記に更新
- Why: マルチストア改修中の SQL 実行を Claude Code が MCP 経由で直接行い、つーくんの Supabase Studio 手作業をなくす方針を正本に明文化するため。同時に、後半 2 要素（ローカル分離・MCP）が「個別論点」として浮いている書きぶりを、前半（要件・影響範囲・採用アーキテクチャ）と同じ「要素単位の章立て」に揃え、全体を通して一貫した構造化に戻す
- Files: `notes/V-PEACH_multi-store-scaling-plan.md`, `CHANGELOG_DEV.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]], [[V-PEACH/DECISIONS]]

## 2026-06-11
- What: `notes/V-PEACH_multi-store-scaling-plan.md` に §6-5「ローカル分離運用」を追記。obsidian-vault に `multi-store` トピック ブランチを切り、マルチストア改修コミットは push せず、既存版へのバグフィックスだけ `main` から `/vmint-deploy`・`/vpeach-deploy` で本番へ送る運用方針を確定。誤爆防止策（デプロイ コマンド先頭のブランチ ガード）と他案比較（worktree / cherry-pick / 履歴フィルタ）も記録。ヘッダー ステータス行と §8-1 決定ログ（項目 8）にも反映（※同日後の全面再構成により §6-5 → §5-1 に再配置）
- Why: マルチストア改修は変更が広範でデグレ リスクが高く、当面ローカルで進めたい。一方で既に本番稼働中のバージョンの不具合は随時 push したい — `git subtree push` が HEAD のサブツリー履歴全部を送る性質上、両者を同一ブランチに混在させると安全に分離できないため、ブランチ運用で物理的に分ける方針を正本に明文化する
- Files: `notes/V-PEACH_multi-store-scaling-plan.md`, `CHANGELOG_DEV.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-02
- What: PIN認証・ヘッダーから日本語ラベル「経営ダッシュボード」を削除。正式名称テキストを uppercase + `tracking-[0.1em]`（ヘッダー）/ `tracking-[0.15em]`（PIN画面）スタイルに変更し、略称・正式名称のデザインを洗練
- Why: 不要なカテゴリ説明テキストを排除し、略称（V-PEACH）と英語正式名称の組み合わせをよりクリーンなタイポグラフィで表現するため
- Files: `src/components/common/AppHeader.vue`, `src/components/common/PinAuth.vue`
- Related: [[V-PEACH/CHANGELOG_DEV]]

- What: V-PEACH の正式名称（**VANGVIENG Profit and Expense Analysis for Corporate Health**）を PIN 認証 UI とヘッダー左上ロゴに併記。基本ドキュメント（`notes/_index.md` / `notes/V-PEACH_requirements.md`）冒頭にも「正式名称」セクションを新設。モバイルファースト配慮として正式名称は極小フォント（`text-[9px]` ヘッダー / `text-[10px]` PIN 画面）＋ `tracking-tight` ＋ 1行（ヘッダーは `whitespace-nowrap` + `text-ellipsis`、PIN 画面は手動 `<br>` で2行）で組み込み、略称（V-PEACH）の主役配置と既存サブタイトル（経営ダッシュボード）を維持
- Why: 略称ベースのブランディングに正式名称（バックロニム）を可視化し、新規ユーザー・関係者が略称の意味を一目で把握できるようにするため。狭いヘッダー領域でも視認性を損なわないよう、文字サイズ・トラッキング・折返し制御で UX を保つ
- Files: `src/components/common/PinAuth.vue`, `src/components/common/AppHeader.vue`, `notes/_index.md`, `notes/V-PEACH_requirements.md`
- Related: [[V-PEACH/notes/_index]], [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-06-01
- What: Phase 0〜12 完了・**正式リリース（本番稼働開始）を各帳票に明記**。`notes/V-PEACH_history.md`（概要に現況バナー・Phase 12 見出しを「正式リリース」化・🎉正式リリース小節追加・タイムライン更新）、`notes/V-PEACH_release-plan.md`（現在のステータスを「正式リリース済み」に・本番デプロイ完了明記・今後のロードマップに Phase 13 追加）、`notes/_index.md`（現在のステータスに正式リリースバナー・Phase 12 行に🎉追記）を更新
- Why: Phase 12 までの完了と正式リリース済みであることを開発史・リリース計画・ハブの各帳票で明確にするため
- Files: `notes/V-PEACH_history.md`, `notes/V-PEACH_release-plan.md`, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_history]], [[V-PEACH/notes/V-PEACH_release-plan]]

## 2026-06-01
- What: `notes/V-PEACH_history.md` に「§8-2 今後の発展計画」を新設し、店舗増減 GUI 対応を **Phase 13（計画中・実装は 2026-06-02 以降）** として記録。背景課題（3層ハードコード・二重保守）・確定設計（DB/RPC/フロント/GUI）・運用方針（論理削除・保険ブランチ v3/v2）を要約し正本へリンク。タイムライン（§13）にも 2026-06-01 Phase 13 計画確定エントリを追加
- Why: この大規模改修を開発史の「今後の発展計画」として残し、多店舗スケール対応の位置づけ（V-MINT/V-PEACH 共用 Supabase の強みをスケール要件に活かす）を明文化するため
- Files: `notes/V-PEACH_history.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-01
- What: `notes/V-PEACH_multi-store-scaling-plan.md` を**進捗追跡帳票化**。§5 実装フェーズ表に「状態（⬜/🟡/✅/⏸️）・完了日」列と凡例を追加し、§5-1 にフェーズ内タスクのチェックリストを新設。さらに**レガシー除去フェーズ P7（§5-2）を追加** — 別名並走で残した旧ピボット RPC・移行シム・キー正規化・不要カラムを go-live 後に破壊的撤去。共有 DB ゆえ「P7 は必ず P6（go-live）後」の順序根拠を明記。P0 は A 案（事前作成せず初回 push で v3/v2 自動生成）に更新。§8-1 決定ログに 6（レガシー除去）・7（進捗帳票化）を追記
- Why: 本書をそのまま実装の進捗管理に使えるようにするため。後方互換で残す要素を確実に最後に掃除する工程を計画に組み込み、消し忘れ・本番破壊を防ぐ
- Files: `notes/V-PEACH_multi-store-scaling-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-01
- What: `notes/V-PEACH_multi-store-scaling-plan.md` を「方向性比較」から**実装計画書**に全面リライト。選択肢比較を畳んで採用アーキテクチャ（§4: DB/RPC/フロント/GUI 確定設計）を本文化し、実装フェーズを P0〜P6 に再編。**Git デプロイ保険ブランチ戦略（§6）を新設**: 本改修は V-MINT を `v3`・V-PEACH を `v2` ブランチに subtree push し、本番ブランチ（V-MINT=v2 / V-PEACH=main）= Cloudflare 本番ビルドから切り離してユーザー即時展開を回避。go-live は v3→v2 / v2→main マージ。却下案は §8-2 付録に退避
- What: ⚠️ Supabase はプレビュー・本番で同一プロジェクト共有のため DB マイグレーション（P1）は本番にも即時反映される点を最重要リスクとして明記。P1 は additive 限定・RPC（P2）は別名並走で後方互換を死守する方針を本文化
- Why: 方針が全確定し、このドキュメントをそのまま実装の正本として使うため。大規模改修につき本番への即時反映を避ける運用上の保険が必要
- Files: `notes/V-PEACH_multi-store-scaling-plan.md`, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]], [[V-MINT2.0/notes/V-MINT2.0_supabase-er-diagram]]

## 2026-06-01
- What: 店舗増減の GUI 対応の方向性を検討し `notes/V-PEACH_multi-store-scaling-plan.md` を新規作成（コード未着手・検討段階）。現状の店舗ハードコードを DB/RPC/フロントの3層で棚卸しし、評価軸（実装容易さ・GUI完結度）で複数案を比較・推奨案とフェーズ案を提示
- Why: 新店舗オープン時に Supabase RPC のピボット定義からフロントの店舗キー直アクセスまで広範囲改修が必要で、店舗事業のスケールに追従できないため。閉店は論理削除（休止フラグ）+ 休止店舗表示トグル方針を確定（ヒアリング 2026-06-01）
- Files: `notes/V-PEACH_multi-store-scaling-plan.md`, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]], [[V-MINT2.0/notes/V-MINT2.0_supabase-er-diagram]]

## 2026-06-01
- What: 店舗増減 GUI 対応の残課題を全確定（§8 を決定事項化）。①休止トグル状態は DB 共有（`app_ui_settings` 中立シングルトン・両アプリ連動）②`pe_store_shift_rules` は `effective_from` 改定履歴付き③閉店店舗は `closed_at` 以降を集計・按分から明示除外④追加フローは一発確定のみ（下書きなし・理想は `create_store_atomic` RPC で一括 insert）。DDL 案・フェーズ P1〜P5・リスク欄も追従更新
- Why: 実装フェーズ（P1 DB マイグレーション）へ進める状態にするため。ヒアリング最終回答を仕様へ反映
- Files: `notes/V-PEACH_multi-store-scaling-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-01
- What: 店舗増減 GUI 対応の方向性を確定（推奨案を全採用）。ドキュメントに R5〜R8 と確定事項を追記。①店舗マスタの単一情報源を **V-PEACH に集約**（`stores` 共有のためアプリ間同期コード不要・店舗管理 GUI は V-PEACH `SettingsApp`）②`store_key` 手入力＋作成時ロック ③シフト枠時間ルールを `pe_store_shift_rules`（店舗×シフト種別×日種別で6h/7.5h）として一般化し馬場2号店ハードコードを撤廃 ④新店舗の初期設定（固定費・シフトルール）を追加ウィザードで必須化 ⑤休止店舗トグルは全社一括。`office` は `store_type` でシステム行として分離
- Why: V-MINT/V-PEACH で店舗設定を二重に持つ負担を解消するため。各店固有情報を多く持つ V-PEACH を正とし、片側登録で両アプリ反映できる構成に整理（ヒアリング回答反映）
- Files: `notes/V-PEACH_multi-store-scaling-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]

## 2026-06-01
- What: PLTrendChart で指標トグルがチャートに反映されない不具合を修正。Chart.js インスタンスを `markRaw()` でラップしてリアクティブ化を防止
- Why: `chart` を `data()` に宣言していたため Chart.js インスタンスが Vue の Proxy に包まれ、`chart.update()` 時の内部参照同一性比較（`===`）が壊れてデータセット変更が再描画に反映されなかった。マウント時の初回描画（コンストラクタ）は動くため「デフォルト指標は出るがトグルが効かない」状態だった（トグル機能導入の `fe77e7d` から潜在。先行の `Set`→`Array` 修正は別問題で根本原因ではなかった）
- Files: `src/components/PLTrendChart.vue`
- Related: [[V-PEACH_test-plan]], [[V-PEACH/TROUBLESHOOTING]]

## 2026-06-01
- What: PLTrendChart のカテゴリトグルが反応しない不具合を修正（`Set`→`Array` 移行の取りこぼし）。展開エリアの指標ボタン `:style` に残っていた `visibleMetrics.has(m.key)` を `visibleMetrics.includes(m.key)` に置換
- Why: `visibleMetrics` は Array 化済みだが34行目だけ Set メソッド `.has()` が残存。「売上」等のカテゴリボタンを押して展開エリアを描画する瞬間に `TypeError: visibleMetrics.has is not a function` が発生し、Vue の再レンダリングが失敗してボタンが無反応に見えていた（PLT-05 回帰）
- Files: `src/components/PLTrendChart.vue`
- Related: [[V-PEACH_test-plan]], [[V-PEACH/TROUBLESHOOTING]]

## 2026-06-01
- What: PLTrendChart のカテゴリトグル不具合修正 — `visibleMetrics` を `Set` から `Array` に変更し Vue 3 リアクティビティを確保
- Why: `Set.has()` の computed 内依存追跡が Vue 3 Options API で不安定なため、`Array.includes()` + `splice/push` に置換
- Files: `src/components/PLTrendChart.vue`

## 2026-06-01
- What: 固定給初期値 SEED（`SEED_fixed_salaries_20260520.sql`）とベンチマーク目標値の Supabase 投入完了を `notes/V-PEACH_release-plan.md`「現在のステータス」と `notes/_index.md` Weekly Review（Risks / Next Actions）に反映。「オーナー確認後に投入が必要」記載を「✅ 投入済み / 登録済み」に更新
- Why: 2 つともオーナー確認が終わって Supabase に投入済みとなったため、Phase 12 期間中の残タスクから外して現状に合わせる
- Files: `notes/V-PEACH_release-plan.md`, `notes/_index.md`

## 2026-06-01
- What: `notes/V-PEACH_release-plan.md` を `V-PEACH_history.md` の Phase 番号体系（0/1/2/3/4/5/6/7-1〜7-4/8/9/10/11/12）に合わせて全面再構成。「Phase 5+」「Phase 7-5」「無番号で散在していたベンチマーク改修・Step 0 集計期間プレビュー・PLApp N+1 削減・HRMOS UI/UX 改修」を所属 Phase に統合し、「現在のステータス」も Phase 11 完了 / Phase 12 進行中の現状に同期
- What: `notes/V-PEACH_architecture.md` と `notes/V-PEACH_supabase-er-diagram.md` の SQL ファイル一覧・テーブル追加タイミング欄を新 Phase 体系に揃える（Phase 5+ → Phase 5、ベンチマーク再設計の Phase 7 → Phase 6、HRMOS 取込 → Phase 10、人件費新方式 → Phase 8）
- What: `notes/_index.md` の「現在のステータス」を Phase 単位に再集約（標題に散在していたベンチマーク改修・Step 0 プレビュー・PLApp N+1 削減を所属 Phase の括弧内に折り畳む）
- Why: history.md を正史としていたが、release-plan.md と一部 notes が旧 Phase 体系（Phase 5+ / Phase 7 でのベンチマーク改修 / 7-5 単独項目）のままで、進捗の俯瞰や CHANGELOG との対応取りに齟齬があったため
- Files: `notes/V-PEACH_release-plan.md`, `notes/V-PEACH_architecture.md`, `notes/V-PEACH_supabase-er-diagram.md`, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_history]]

## 2026-06-01
- What: 人件費プレビュー（Step 4）りょーさん枠テーブルに全店合計フッターを追加。「全店合計: XXX.X h ／ 代替コスト: ¥YYYY（¥1,300/h）」を表示。時給は `pe_company_settings.ryo_hourly_rate` をstartCsvEntry時に取得して使用。各店舗行の「代替コスト参考: X h」表記を「重みつき枠数 = X h」に修正（バイト行と統一）
- Why: バイト枠には全店合計フッターがあるのにりょーさん枠には合計も代替コスト総計もなく、参考情報として不十分だった
- Files: `src/components/apps/InputApp.vue`
- Related: [[V-PEACH_test-plan]]

## 2026-06-01
- What: シフトCSVアップロード（Step 3）のUIを売上CSV（Step 1）に統一。ボタンをヘッダーカード内の全幅スタイルに変更、ボタンテキストを「シフトCSVを選択」に統一、ファイル名をボタン直下に表示、状態表示を独立したステータスカードに分離。シフトCSVに削除ボタンを追加（`clearShiftsCsv` メソッド新設）。再編集モードの「DB既存値を使用中」バナーに全店舗の枠数サマリー（バイト/りょーさん × 6h/7.5h）を追加
- Why: Step 1 と Step 3 のUIが異なることがノイズになっていた。削除ボタン・既存値サマリーは売上CSVとの操作感を揃えるため
- Files: `src/components/apps/InputApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-06-01
- What: 売上CSVアップロードを「店舗別ボックス」から「6ファイル一括選択」に変更。ファイル名に「馬場本店」「中野店」「馬場2号店」を含めると店舗が自動判定され、ヘッダー構造との組み合わせでAirメイト/Airレジを6帳票まとめて振り分け可能に
- Why: 毎月6ファイルを店舗ごとに3往復アップロードするのが繁雑。ファイル名で店舗名を管理すれば1操作で完結できる
- Files: `src/utils/csvImporter.js`（detectStoreKeyFromFilename日本語対応）, `src/components/StoreCsvUpload.vue`（表示専用化）, `src/components/apps/InputApp.vue`（一括アップロードボタン・handleBulkFilesUpload追加）
- Related: [[V-PEACH_test-plan]]

## 2026-05-30
- What: テスト計画の §5.2 / §5.2b を「§5.2 月次入力モード（Step 0〜6）」に統合。INP-11（給与総額入力）を CSV-08 に集約し、重複テスト項目を除去。セクション6チェックリスト・セクション8完了基準も同期更新
- Why: 手入力モード廃止により INP-11 と CSV-08 が同一 Step 5 を二重テストしていたため整理
- Files: `notes/V-PEACH_test-plan.md`
- Related: [[V-PEACH_test-plan]]

## 2026-05-30
- What: 月次入力の人件費フローを CSV 専用化。シフト CSV 取込を必須化し、画面A（バイト枠）・画面B（りょーさん枠）の手入力を廃止して 1 枚の読み取り専用「人件費プレビュー」に統合。Step 構成を 7 → 6 ステップに削減（売上CSV → 売上プレビュー → シフトCSV → 人件費プレビュー → 総額入力 → 確認）。当月の人件費＋交通費総額のみ現行通り手入力を維持
- What: 売上・シフトとも「既存月の再編集モード」を追加。全店の `pe_monthly_records` が揃った月を選ぶと自動認識し、CSV 未アップロードでも DB 既存値で進行可能に。各 CSV ステップに「DB既存値を使用中」インラインバナーを表示。新規月は CSV 必須を維持
- What: `submitCsv()` を DB 値フォールバック対応に変更。CSV 未アップロード店舗は `pe_daily_sales_cache` の upsert と古いキャッシュ削除をスキップ
- Why: 売上は CSV 一本化済みだったが、人件費枠数は手入力のままで HRMOS シフト CSV は任意扱い。実運用では毎月 CSV 取込しているため任意性は不要で、誤入力リスクを減らすために読み取り専用プレビューに統合。再編集時は CSV を持っていないケースが多いため、既存月のみ DB 値で進行できる救済策を追加
- Files: `src/components/apps/InputApp.vue`, `notes/V-PEACH_requirements.md`, `notes/V-PEACH_history.md`, `notes/V-PEACH_release-plan.md`, `notes/V-PEACH_how-to-use.md`, `notes/V-PEACH_test-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-30
- What: 月次入力の手入力モードを完全廃止。売上入力を CSV インポートに一本化。`InputApp.vue` から `startManualEntry()`・`submitManual()`・`inputMode` ウォッチャー・手入力 UI・`storeData` を削除。テスト計画の INP 項目を整理（手入力専用 INP-01〜05/07 を削除、残存 INP は Step 0 と人件費画面のみ）。設計ドキュメント（finance-spec・requirements・architecture・history・release-plan・supabase-er-diagram）の手入力モード記述を一掃
- Why: 売上データは Airメイト/Airレジ CSV から取得する運用に統一したため。手入力は手順が多くエラーリスクが高く、今後使用しない
- Files: `src/components/apps/InputApp.vue`, `notes/V-PEACH_test-plan.md`, `notes/V-PEACH_finance-spec.md`, `notes/V-PEACH_requirements.md`, `notes/V-PEACH_architecture.md`, `notes/V-PEACH_history.md`, `notes/V-PEACH_release-plan.md`, `notes/V-PEACH_supabase-er-diagram.md`

- What: 祝日マスタ「いま再取得する」のネットワーク断耐性を3段階で修正。①10秒タイムアウト ②catch 内のメタ更新失敗を飲み込み ③`onRefreshHolidays()` で alert を `reloadHolidays()` より前に移動し reload 失敗も飲み込み
- Why: 断時に複数の Supabase 呼び出しが連鎖失敗し alert に到達しなかった（SET-15 で発見）
- Files: `src/utils/jpHolidaysClient.js`, `src/components/apps/SettingsApp.vue`, `TROUBLESHOOTING.md`

## 2026-05-29
- What: `labor_cost` フォールバック方式を廃止。`pe_monthly_company_records` 行がない月は PL 計算対象外（データなし）として扱うよう変更
- Why: 全月 `pe_monthly_company_records` を必須入力する運用方針に統一したため。レガシーフォールバックはコードの分岐を増やすだけで今後使われない
- Files: `src/utils/finance.js`, `src/components/apps/PLApp.vue`, `notes/V-PEACH_architecture.md`, `notes/V-PEACH_finance-spec.md`, `notes/V-PEACH_test-plan.md`
- Related: [[V-PEACH/DECISIONS]]

## 2026-05-28
- What: `notes/V-PEACH_history.md` を更新。V-MINT 2.0 リリース後の主なアップデート（4.6 節）を追加（管理者画面拡張・単位原価マスタ参照型刷新・RLS 有効化・原価計算 UX 改善）し、移行ロードマップ全体像を 4.7 にリナンバー。Phase 番号が未付与だった 2026-05-21 以降の3項目（人件費新方式・CSV アップロード UI 統合・HRMOS シフト CSV 取込）を Phase 8 / 9 / 10 として整理し、タイムラインも揃えた
- Why: V-MINT2.0 側の文書同期に合わせて V-PEACH 側でも整合を取り、V-PEACH 開発期間中に並行していた V-MINT 2.0 の改善も追跡できるようにするため。後半 Phase が無番号のままだと進捗の俯瞰がしにくかったため
- Files: `notes/V-PEACH_history.md`

## 2026-05-26
- What: 経営PL「全店舗合計」のレスポンシブ表示を全面刷新。`plRowClass`/`plLabelClass`/`plValueClass`/`plProfitColor` 共通メソッドに集約。カードの `overflow-hidden` を除去しヘッダー/最終行に個別 `rounded-t-2xl`/`rounded-b-2xl` を付与（sticky が親 `overflow-hidden` でブロックされる問題を解消）。モバイルは項目列 `w-[120px] sticky`＋拠点列 `w-[88px]`、デスクトップは `md:flex-1` で項目列が広がり右側を目一杯使用
- Why: 1) stickyが効いていなかった 2) デスクトップで左側に空白ができていた 3) モバイルで列間が広すぎた
- Files: `src/components/apps/PLApp.vue`

- What: 経営PL「全店舗合計」の拠点別列表示を改善。スクロール時に項目名を `position:sticky;left:0` で左固定。全社調整セクションをスクロールエリア外に移動し常時表示
- Why: 右スクロール時に項目名が流れる・全社調整が常時見えないとの指摘
- Files: `src/components/apps/PLApp.vue`

- What: 経営PL「全店舗合計」表示に拠点別列を追加。売上・原価・販管費の各セクションに全店舗合計・馬場本店・中野店・馬場2号店の4列を並列表示。モバイルは横スクロール対応
- Why: 全社合計だけでは拠点別の数値が見えず、内訳確認のたびに拠点を切り替える必要があったため
- Files: `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-26
- What: `notes/_index.md` の「現行・更新対象」に `V-PEACH_how-to-use` への内部リンクを追記
- Why: 操作マニュアルが一覧から抜け落ちており、Hub から辿れない状態だったため
- Files: `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_how-to-use]]

- What: `notes/V-PEACH_supabase-er-diagram.md` を現行仕様（13テーブル）に全面更新。Mermaid ER 図を大幅拡張し、改定履歴テーブル群・`pe_monthly_company_records`・`pe_daily_sales_cache`・HRMOS マスタ4テーブルを追加。各テーブルの詳細 Notes も最新カラム構成に同期
- Why: 旧 ER 図は 4テーブル（フォールバック系のみ）しか図示しておらず、2026-05-20〜25 に追加された9テーブルが一切反映されていなかったため
- Files: `notes/V-PEACH_supabase-er-diagram.md`
- Related: [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]

- What: `notes/V-PEACH_history.md` §13 タイムラインの 2026-05-16 エントリを Phase 0〜4 完了として更新。Phase 2〜4（月次入力・PL・Health Check・トレンドチャート）が同日中に完了していた実態を反映
- Why: 直前の更新で Phase 0〜1 のみ記載されており、Phase 2〜4 の完了日が欠落していたため
- Files: `notes/V-PEACH_history.md`
- Related: [[V-PEACH/notes/V-PEACH_history]]

- What: `notes/V-PEACH_history.md` §13 タイムラインを修正。2/20完成はフェーズ1のみ（フェーズ1〜2ではない）、完成後は馬場2号店限定で現場テスト、2/20〜3/23の間に社長→中野店店長→棚卸担当者2名への提案・ヒアリング実施、3/23リリースでフェーズ2〜3を一気完了という実際の流れに補正
- Why: 前回更新でフェーズ区分と日程が不正確だったため、実際の開発・提案プロセスに沿って訂正
- Files: `notes/V-PEACH_history.md`
- Related: [[V-PEACH/notes/V-PEACH_history]]

- What: `notes/V-PEACH_history.md` §13 タイムラインを実際の開発日程（2026/2/15〜5/25）に修正し、§14 に「異例の開発スピードを支えた4つの要因」を追加（実務者兼開発・社長直轄裁量・AI駆動開発・戦略コンサル知識基盤）
- Why: 推定日程だったタイムラインを実績ベースの日付に正確化し、V-MINTプロトタイプ〜V-PEACH完成までの3.5ヶ月という開発スピードの背景を記録・継承するため
- Files: `notes/V-PEACH_history.md`
- Related: [[V-PEACH/notes/V-PEACH_history]]

## 2026-05-25
- What: `notes/V-PEACH_test-plan.md` を現行仕様に全面同期。Phase 範囲を HRMOS シフト CSV 取込まで拡張、DB 前提確認 SQL に `pe_hrmos_*`/`pe_jp_holidays*`/`pe_*_revisions`/`fixed_salary_total`/`ryo_hourly_rate` 確認を追加。テストデータ SQL を revisions テーブル + 人件費新方式列に対応させ、202603 を新方式 PL 検証用パターンに更新。テストケースに COM-05/06（祝日バナー）・SET-10〜15（HRMOS マスタ/祝日マスタ）・INP-00（対象月自動セット）・CSV-01〜12（売上→プレビュー→シフトCSV→画面A/B/C→確認の Step 1〜7 構造）・PLM-00（デフォルト参照月）・PLM-01b/07/08（新方式 PL・集計期間バッジ・FLR比）・PLT-05（カテゴリトグル）・EDG-04（枠数全0新方式）を追加。§4.2 に新方式人件費の期待値計算を新設
- Why: 2026-05-18 の同期以降に「人件費新方式の PL 統合（5/21）」「PLApp N+1 削減（5/21）」「CSV モード UI 6→3 統合・旧 labor_cost 撤去（5/22-23）」「対象月自動セット・PL デフォルト最新月・CSV モードステップ順変更（5/25）」「HRMOS シフト CSV 取込基盤一式（5/25）」と大規模改修が続き、test-plan が旧 Phase 7 ベースのままで実装と乖離していたため
- Files: `notes/V-PEACH_test-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_release-plan]], [[V-PEACH/notes/V-PEACH_shifts-csv-import-plan]], [[V-PEACH/notes/V-PEACH_labor-cost-plan]], [[V-PEACH/notes/V-PEACH_finance-spec]]

## 2026-05-25
- What: `V-PEACH/notes/V-PEACH_history.md` を新規作成。V-MINT 無印〜2.0 の全開発史を包含しつつ、Supabase 移行が V-PEACH 早期実現に果たした役割と、経営ダッシュボードとしての意義を詳述
- Why: V-MINT の棚卸し実績がどのように経営判断へ昇華したかを一本の文書で記録・継承するため
- Files: `notes/V-PEACH_history.md`, `notes/_index.md`
- Related: [[V-MINT2.0/notes/V-MINT2.0_history]], [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-25
- What: 経営PL画面のデフォルト参照月を当月から「月次入力が完了済みの最新月」へ変更。`created()` フックで `getLatestPeriodKey()` を呼び出し、取得できた場合は `selectedYear/Month` を上書き（取得失敗時は当月にフォールバック）
- Why: 当月分が未入力の状態でページを開くと空のPLが表示されており、実際に確認したいのは直近の完了済み月であるため
- Files: `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/CHANGELOG_DEV]]

## 2026-05-25
- What: 月次入力CSVモードのステップ表示を全6画面に統一（1/6〜6/6）。人件費A/B/Cにインジケーターを追加（CSVモード限定）、既存1/3〜3/3を1/6〜3/6に修正
- Why: 最初の3画面にしかステップ番号がなく、残りの人件費入力画面で現在位置が分からなかった
- Files: `src/components/apps/InputApp.vue`
- Related: [[V-PEACH/CHANGELOG_DEV]]

## 2026-05-25
- What: 月次入力トップ画面で対象月を自動セット。`getLatestPeriodKey()`（`pe_monthly_company_records` 降順1件）で最新記録月を取得し、その翌月を `selectedYear/Month` に初期値として設定
- Why: 毎月同じ月を手動で選び直す手間を省くため
- Files: `src/api.js`, `src/components/apps/InputApp.vue`
- Related: [[V-PEACH/CHANGELOG_DEV]]

## 2026-05-25
- What: 月次入力CSVモードのステップ順を修正（売上CSV → 売上プレビュー → シフトCSV → 人件費A/B/C → 確認）。シフトCSVファイル選択後に「選択されていません」のままになるUIバグを修正（`shiftsCsvFileName` を別途保持して表示）
- Why: 以前の順番（売上CSV → シフトCSV → 売上プレビュー）はプレビューの前にシフト取込があり違和感があった。ファイル名表示は `event.target.value = ''`（同一ファイル再選択許容）がネイティブUIをリセットしてしまっていたため
- Files: `src/components/apps/InputApp.vue`
- Related: [[V-PEACH/CHANGELOG_DEV]]

## 2026-05-25
- What: シフト CSV 集計ズレの原因調査。パース処理・CSV データともに正しく、手カウント元のシフト表に未登録変更があったことが判明。バグなし・状況終了
- Why: バイト6h・りょー6h の数値が手カウントと合わないと報告があったため
- Files: なし（コード変更なし）
- Related: [[V-PEACH/TROUBLESHOOTING]]

## 2026-05-25
- What: `detectCsvKindFromHeader` の勤務区分判定を修正。`略称` → `並び順` カラムで判定（実際の HRMOS エクスポートに `略称` 列が存在せず `表示名` / `並び順` 形式だった）
- Why: 設定画面の勤務区分 CSV アップロードで「ヘッダー判定失敗」エラーが出て取込不可だったため
- Files: `src/utils/csvImporter.js`
- Related: [[V-PEACH/TROUBLESHOOTING]]

## 2026-05-25
- What: HRMOS シフト CSV 取込基盤を実装。マイグレーション（`pe_hrmos_staffs` / `pe_hrmos_segments` / `pe_jp_holidays` / `pe_jp_holidays_meta`）、`api.js` への CRUD 追加、`utils/jpHolidaysClient.js`（holidays-jp API + Supabase キャッシュ + 強制再取得）、`utils/shiftImporter.js`（シフト計算：店舗×日付×シフトタイプの fillMap、オーラス分解、馬場2号店遅番の土日祝補正、りょーさん枠＝早番/遅番の埋まらない枠、バイト枠＝固定給・社長除外）、`csvImporter.js` 拡張（HRMOS スタッフ／勤務区分／シフト CSV のヘッダ判定＋パース＋ロール・店舗・シフトタイプ自動判定）、`SettingsApp.vue` に「HRMOS マスタ管理」「祝日マスタ」セクション追加（CSV取込・既存上書き保持・ロール／按分対象の手動上書き・再取得 UI）、`InputApp.vue` の CSV モードに Step 2「シフト CSV アップロード」を挿入（任意・スキップ可・既存画面A/B 編集可）、`PortalMenu.vue` に年初祝日カバレッジバナー（自動 fetch + 失敗時のみ警告）
- Why: 月次入力の画面A/B 12マス手入力を `vangvieng_shifts_YYYYMM.csv` 1ファイルアップロードで自動化するため。実装は §9 のフェーズ1〜8 までを一括で実施し、フェーズ9（検証）はオーナー手動で2026年1〜4月 CSV を順次取込確認する想定。実データ確認の結果、計画書の店舗名表記「馬場地区基本店／2号店」「オールイン」「[短縮稼働]」は実際の HRMOS 上では「高田馬場本店／2号店」「オーラス」「[短縮営業]」だったため、両方の表記を許容する判定ロジックで実装
- Files: `supabase/DB_MIGRATION_hrmos_masters_20260525.sql`, `src/api.js`, `src/utils/jpHolidaysClient.js`, `src/utils/shiftImporter.js`, `src/utils/csvImporter.js`, `src/components/apps/SettingsApp.vue`, `src/components/apps/InputApp.vue`, `src/components/PortalMenu.vue`, `notes/V-PEACH_shifts-csv-import-plan.md`, `DECISIONS.md`, `notes/V-PEACH_architecture.md`, `notes/V-PEACH_supabase-er-diagram.md`, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_shifts-csv-import-plan]], [[V-PEACH/notes/V-PEACH_labor-cost-plan]], [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-24
- What: HRMOS シフト CSV 1ファイル取込計画書の Open Questions 5項目をオーナー確認結果で確定。設計判断確定事項セクションに置換し、祝日マスタを外部 API + Supabase キャッシュ方式に変更（holidays-jp 採用）
- Why: ① 給与＋交通費総額（画面C）は手入力維持、② オールイン枠は早番7.5h+遅番6hに分解計上、③ 中番バイト枠は按分に含める、④ 短縮稼働など特殊枠は現状発生しないので無視、⑤ 祝日マスタは追加コスト・認証不要・CORS 許可済みの holidays-jp API を Supabase にキャッシュして自動更新、UI で再取得可、年初に翌年祝日カバレッジを PortalMenu でチェックしてアラート表示。これに伴い `pe_jp_holidays` / `pe_jp_holidays_meta` テーブル設計、`jpHolidaysClient.js` の新規追加、PortalMenu への年初バナー追加を計画に反映
- Files: `notes/V-PEACH_shifts-csv-import-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_shifts-csv-import-plan]]

## 2026-05-24
- What: HRMOS シフト CSV 1ファイル取込で人件費入力画面A/B を自動化する実装計画書を作成
- Why: 現状は月次入力で 3店舗×バイト/りょーさん×6h/7.5h = 12 マス + 給与総額1マスの手入力が必要。HRMOS が出力する `vangvieng_shifts_YYYYMM.csv` 1ファイルをアップロードするだけで画面A/B が自動算出されるパイプライン設計をまとめた。マスタ（スタッフ/勤務区分）は Supabase に保持し、初回投入後は HRMOS マスタ変更時のみ更新。固定給4名・りょーさん・バイトのロール判定、店舗判定（勤務区分名のプレフィックス）、土日祝日の馬場2号店遅番 7.5h 補正、店舗営業日判定（fillMap にレコードがある日）まで詳細化。Open Questions として給与総額の取り扱い（A:現状維持/B:給与CSV/C:時給マスタ）・オールイン枠・中番按分・短縮稼働枠・祝日マスタ運用の5点を明記
- Files: `notes/V-PEACH_shifts-csv-import-plan.md`, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_shifts-csv-import-plan]], [[V-PEACH/notes/V-PEACH_labor-cost-plan]]

## 2026-05-24
- What: 2025年12月分日別売上をキャッシュテーブル投入用 SQL を生成（3店舗×25日＝75レコード）
- Why: システム稼働開始は2026年1月だが、事業月度2026年1月の集計期間が12月を含むため、フロントのCSVインポートを経由せず Supabase SQL Editor で直接投入できる形に整形
- Files: `csv/done/SEED_daily_sales_cache_202512.sql`

## 2026-05-23
- What: 月次入力 CSV モード Step 2 プレビュー画面に残っていた旧 `labor_cost` 直接入力欄（店舗ごと1ボックス × 3店舗）を撤去。さらに CSV モードで step 6（最終確認）に到達してもテンプレートが存在せず空白画面になっていたバグを修正し、Manual モードと同等の確認画面（売上・バイト枠・りょーさん枠・全店給与＋交通費合計）を追加
- Why: 5/21 に人件費新方式（重みつき枠按分）への移行を完了したが、CSV モード Step 2 のテンプレートだけが旧仕様のまま残り、ユーザーから「枠数入力ではなく単純な人件費入力ボックスが表示される」と指摘された。`canNext` のコメント（line 428）には「旧人件費欄削除済み」と書かれていたが実態の template は未削除で、入力値も `submitCsv` で参照されない完全な dead code 状態だった
- Files: `src/components/apps/InputApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_labor-cost-plan]]

## 2026-05-22
- What: notes/ を現行仕様に同期（人件費新方式・CSV UI統合・PLApp N+1削減の3件を反映）
- Why: 2026-05-18 以降の実装変更（5/21 人件費新方式PL統合・N+1削減、5/22 CSV 6→3ボックス）が全 notes に未反映だったため
- Files: `notes/_index.md`, `notes/V-PEACH_requirements.md`, `notes/V-PEACH_architecture.md`, `notes/V-PEACH_finance-spec.md`, `notes/V-PEACH_next-actions.md`, `notes/V-PEACH_release-plan.md`, `notes/V-PEACH_supabase-er-diagram.md`, `notes/V-PEACH_test-plan.md`, `notes/V-PEACH_labor-cost-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_labor-cost-plan]]

## 2026-05-22
- What: 月次入力CSVモードの Step1 アップロードUIを6ボックス→3ボックス（店舗ごと1ボックス）に統合。`<input type="file" multiple>` で当該店舗の商品別売上CSV（Airメイト）と日別売上CSV（Airレジ）を同時選択できるようにし、ヘッダー内容（「カテゴリー」「売上合計」 vs 「集計期間」「割引額」）から自動で種別判定→該当スロットへ振り分け。再選択は追加マージ方式（既存スロットは未指定なら温存・指定があれば後勝ちで上書き）、同種重複や種別不明CSVは黄バッジ警告で表示。商品別/日別の各行に「削除」ボタンを追加し、誤アップロード時に当該スロットのみクリア可能に（警告メッセージも同時クリア）
- Why: 毎月のCSVアップロード工数を半減させるため。3店舗 × 2種類 = 6回のファイル選択が、3店舗 × 1回 = 3回で済む。ファイル名規約（`airmate_xxx` / `売上集計_xxx`）に依存せずヘッダーで判別するため、命名揺れにも強い。誤アップロードのリカバリ（片方だけやり直す等）も1クリックで可能
- Files: `src/utils/csvImporter.js`, `src/components/StoreCsvUpload.vue`（新規）, `src/components/apps/InputApp.vue`, `src/components/FileSlot.vue`（削除）
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-21
- What: PLApp の N+1 リクエストを大幅削減。`prefetchPeriods(periodKeys)` を新設し、`pe_monthly_company_records` と全店 `pe_monthly_records` を**期間範囲ぶん1バッチ**でまとめて取得。`loadMonthlyPLCore` は事前取得済みデータを受け取る形に変更し、内部での `getMonthlyCompanyRecord` / `Promise.all(getMonthlyRecord × 3店舗)` / `getActiveCompanySettings` の重複呼び出しを排除。`loadPL` 上位で `getActiveBenchmarks` と `getActiveCompanySettings` も並列1回取得に統合。さらに当該月の全店レコードが揃って null の場合は `getCostPriceForPeriod` / `getActiveStoreSettings` / `getCostReportForPE` も呼ばないよう早期 return を導入。`loadMonthlyPL` / `loadRolling3PL` / `loadTrendForPeriod` / `loadAnnualPL` は `loadPL` 本体に統合
- Why: 前タスク（人件費新方式の PL 統合）で `loadMonthlyPLCore` 内に各種 prefetch を追加した結果、トレンド12ヶ月計算で 195+ 並列リクエストが Supabase に投げられ、ブラウザの同時接続上限と Supabase の rate limit が干渉して `pe_benchmarks_revisions` を含む一部リクエストが `ERR_TIMED_OUT` になり PL 表示が分単位で停止していた
- Files: `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_labor-cost-plan]]

## 2026-05-21
- What: 人件費計算ロジック新方式（重みつき枠按分方式）の PL 側統合を完成。`PLApp.loadMonthlyPLCore` で `pe_monthly_company_records` の当月行と全店 `pe_monthly_records` を取得し `laborParams = { totalVariablePayroll, totalWeightedSlots, ryoHourlyRate }` を構築。`calcPL` に渡し、PL ⑬人件費の下に「固定給／変動費按分」サブ行と「※ りょーさん代替コスト（参考・PL非計上）」を表示。3ヶ月平均・年次集計では `laborFixed/laborVariable/ryoOpportunityCost` を「全行 null なら結果も null」とする集計関数 `aggregateKey` を導入し、旧式月のみの場合に内訳が ¥0 で表示される齟齬を防止
- Why: 月次入力モードの3画面（バイト枠数・りょーさん枠数・給与＋交通費総額）と設定の `fixed_salary_total`/`ryo_hourly_rate` は実装済みだったが、PL 側は常に `record.labor_cost` のレガシーフォールバックで動作しており、InputApp で入力した枠数が PL に反映されていなかった
- Files: `src/utils/finance.js`, `src/components/apps/PLApp.vue`, `TROUBLESHOOTING.md`
- Related: [[V-PEACH/notes/V-PEACH_labor-cost-plan]]

## 2026-05-21
- What: 月次入力モードで「開始する」を押しても画面遷移しないバグの原因（`DB_MIGRATION_labor_cost_20260520.sql` 未適用で `pe_monthly_company_records` テーブルが存在しないこと）を `TROUBLESHOOTING.md` に記録
- Why: 月次入力フローの冒頭で `getMonthlyCompanyRecord` が落ち `step=1` に遷移できない事象。再発防止のため migration セット忘れに対する運用ルールも追記
- Files: `TROUBLESHOOTING.md`

## 2026-05-20
- What: 人件費計算ロジック実装計画ドキュメント新規作成（中野店店長壁打ち最終方針＝重みつき枠按分方式の実装手順・データモデル・UI 仕様を整理）
- Why: 月次PL／月次入力／設定3モードを横断する変更のため、着手前に DB マイグレーション・API・UI・PL 表示・移行戦略を一気通貫で固める必要があった
- Files: `notes/V-PEACH_labor-cost-plan.md`, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_labor-cost-plan]], [[V-PEACH/notes/V-PEACH_next-actions]]

## 2026-05-19
- What: next-actions に人件費計算ロジック設計タスクを追加（簡易計算方式の検討・社長代替シフトの機会損失/将来コスト可視化）
- Why: 個別積み上げ計算は工数過大。かつ社長シフトの費用 0 計上が実態を歪めているため、設計を先行整理
- Files: `notes/V-PEACH_next-actions.md`

## 2026-05-19
- What: 経営PL（月次）のフィルターパネル下段に各店舗の集計期間バッジを追加。年月確定時に自動取得・表示
- Why: PLを開く前に各店舗のV-MINT集計期間が確認できるようにする（月次入力画面と同じ情報を経営PLでも）
- Files: `src/components/apps/PLApp.vue`

## 2026-05-19
- What: 経営PL画面の表示順序変更 — FLR比を最上部（データなしバナーの直後）に移動
- Why: FLRは最重要KPIのため、スクロールせず即視認できる位置に置く運用要望
- Files: `src/components/apps/PLApp.vue`

## 2026-05-18
- What: notes/ を現行仕様に同期（Phase 7 反映・CSV インポートモード追記・5指標修正）
- Why: requirements / architecture / release-plan / next-actions / sales-import-plan / test-plan / finance-spec が Phase 7-4 完了前の記述で止まっていたため
- Files: `notes/V-PEACH_requirements.md`, `notes/V-PEACH_architecture.md`, `notes/V-PEACH_release-plan.md`, `notes/V-PEACH_next-actions.md`, `notes/V-PEACH_sales-import-plan.md`, `notes/V-PEACH_test-plan.md`, `notes/V-PEACH_finance-spec.md`

## 2026-05-18
- What: 売上CSV取り込みのファイル名による店舗キー検証アラートを撤廃。任意のファイル名でアップロード可能に
- Why: Airメイト/Airレジ からダウンロードしたCSVをリネームせずそのまま使えるようにする運用要望
- Files: `src/components/apps/InputApp.vue`

## 2026-05-18
- What: 売上CSV取り込み Phase 7-3〜7-4 実装。InputApp Step 0 に「CSV インポート / 手入力」タブ切替を追加（デフォルト=CSV）。CSV インポートフローを実装：6ファイル一括アップロード → 前月キャッシュ + 当月CSV から事業月度範囲の割引総額を算出 → プレビュー（割引前/後・前月キャッシュ参照日数・既存値の上書き警告・人件費入力）→ 保存（`pe_daily_sales_cache` upsert + `pe_monthly_records` upsert + 古いキャッシュ自動削除）。Shift-JIS は `TextDecoder` でブラウザ完結、CSVパーサは自前実装で papaparse 不要。ファイル名から店舗キー・期間を自動検出。前月キャッシュ欠落時は確認ダイアログで警告
- Why: Phase 7-2 で DB 基盤が整ったため、毎月「6ファイルアップロードだけで `service_sales` / `merchandise_sales` が事業月度ベースで自動計算 + upsert」されるUI/ロジックを完成させる
- Files: `src/utils/csvImporter.js`（新規）, `src/components/FileSlot.vue`（新規）, `src/components/apps/InputApp.vue`（大幅改修）, `src/api.js`（`getDailySalesInRange` / `upsertDailySalesCache` / `deleteOldDailySalesCache` 追加）
- Related: [[V-PEACH/notes/V-PEACH_sales-import-plan]]

## 2026-05-18
- What: 売上CSV取り込み Phase 7-1/7-2 着手。`pe_daily_sales_cache` テーブル作成マイグレーション + 2025年12月分の SEED SQL（3店舗 × 25日 = 75行）を作成。CSV から PowerShell で SEED 自動生成。仕様書のスキーマ齟齬（`pe_stores` → `stores`、uuid → bigint、割引額の符号正規化）を修正
- Why: Phase 7-3（フロント実装）に進む前に、DB スキーマと初回データ投入を確定。実 CSV を読んで Shift-JIS / カラム構造 / 割引額が負値である点などを確認
- Files: `supabase/DB_MIGRATION_daily_sales_cache_20260518.sql`（新規）, `supabase/SEED_daily_sales_cache_202512.sql`（新規）, `notes/V-PEACH_sales-import-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_sales-import-plan]]

## 2026-05-18
- What: 売上CSV取り込み検討資料を改訂。事業月度が前月最終盤を含む特性を踏まえ、Airレジ日別売上を `pe_daily_sales_cache` テーブルにキャッシュし当月CSVだけで運用する方針に変更。インポート時に自動削除（当月度 start_date より古いレコード）、初回（2025年12月分）は SQL 直接投入で対応
- Why: 単純運用だと毎月「前月+当月」の2ヶ月分 CSV が必要で手順が倍化するため、前月分を DB に保持して再利用する設計に転換
- Files: `notes/V-PEACH_sales-import-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]

## 2026-05-18
- What: 月次入力 Step 0（対象月選択画面）に V-MINT 集計期間プレビューを追加。「開始する」ボタン下に全店舗の集計期間（start_date〜end_date・日数）を独立カードで表示。対象月確定時（periodKey watch）に自動フェッチ
- Why: 月次入力を始める前に V-MINT の棚卸し集計期間が確認できるようにする。別カードで視覚的に分離（メインカードとは異なる情報ブロック）
- Files: `src/components/apps/InputApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-18
- What: 売上データ自動取り込み（Airメイト/Airレジ CSV）の検討資料を notes に新規追加
- Why: 月次入力の手作業をなくし、事業月度ベースで CSV インポートだけで売上記録が完了する仕組みを設計するため、要件・計算ロジック・UI フロー・Open Questions を整理
- Files: `notes/V-PEACH_sales-import-plan.md`（新規）, `notes/_index.md`
- Related: [[V-PEACH/notes/V-PEACH_requirements]], [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]

## 2026-05-18
- What: 全金額入力ボックスにブラー時カンマ桁区切り表示を追加（`CurrencyInput.vue` 共通コンポーネント化）
- Why: 100万単位の数字で桁間違いが起こりやすいため、フォーカスを外した瞬間にカンマ区切り表示する
- Files: `src/components/CurrencyInput.vue`（新規）, `src/components/apps/InputApp.vue`, `src/components/apps/SettingsApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-18
- What: `pe_benchmarks` を EAV形式からフラット・シングルトン形式に再設計し、`pe_company_settings` と同パターンに統一
- Why: `pe_benchmarks_revisions` と列構成を揃え保守性向上。`store_id` / `item_name` / `target_value` の EAV 方式を廃止し、フォールバック層として明確に位置づける
- Files: `src/api.js`, `supabase/DB_MIGRATION_benchmarks_restructure_20260518.sql`, `supabase/SEED_benchmarks_defaults_20260518.sql`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-18
- What: ベンチマーク設定の追跡指標を F比・L比・R比・営業利益率・労働分配率の5指標に変更（粗利率・原価率を除外）
- Why: FLR比はすでに PL 画面で可視化済みのため、ベンチマーク目標管理もそれに揃える
- Files: `src/components/apps/SettingsApp.vue`, `src/components/apps/PLApp.vue`, `supabase/DB_MIGRATION_benchmarks_flr_20260518.sql`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-17
- What: 経営PLにFLR比サマリーセクション追加・月次推移チャートをカテゴリー別全指標トグル対応に改修
- Why: FLR比（F比=原価率、L比=人件費/売上、R比=家賃/売上）の可視化要望。トレンドチャートは全PL項目＋FLR比を表示可能にし、カテゴリー別エクスパンドで指標ON/OFF制御。二重Y軸（左:金額、右:%）採用
- Files: `src/utils/finance.js`, `src/components/PLTrendChart.vue`, `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-17
- What: `notes/` 配下5ファイルを現行仕様（Phase 5+ 改修）に同期
- Why: 設定バージョン管理テーブル・UI改修・RLS有効化・全店舗一括入力フローが実装済みだったが notes に未反映だった
- Files: `notes/V-PEACH_architecture.md`, `notes/V-PEACH_supabase-er-diagram.md`, `notes/V-PEACH_requirements.md`, `notes/V-PEACH_release-plan.md`, `notes/V-PEACH_test-plan.md`
- Related: [[V-PEACH/notes/V-PEACH_architecture]], [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]

## 2026-05-17
- What: 全テーブルで RLS を有効化（Option A: anon 全許可ポリシー）
- Why: Supabase の「RLS has not been enabled」警告を解消。URL非公開・信頼ユーザー前提のため anon 全許可とし既存動作を維持
- Files: `supabase/DB_MIGRATION_enable_rls_20260517.sql`

## 2026-05-17
- What: 設定画面の「現在適用中」レコードを削除可能に変更（店舗別固定費・全社共通費・ベンチマーク目標値、2件以上ある場合のみ削除ボタン表示）
- Why: 最新レコードは従来削除不可だったが、誤登録修正のため削除できるよう要望。削除後は次の最新レコードが自動的に適用される
- Files: `src/components/apps/SettingsApp.vue`

## 2026-05-17
- What: pe_store_settings デフォルト値の流し込みSQL作成（フォールバック用）
- Why: pe_store_settings_revisions が未適用の期間にフォールバックした際、固定費が0にならないようデフォルト値を設定するため
- Files: `supabase/SEED_store_settings_defaults.sql`

## 2026-05-17
- What: 設定「店舗別固定費」を1店舗表示+セレクターバー方式に変更（全店舗一覧表示→ピル切替UI）
- Why: 全3店舗を縦に並べると1店舗あたりのコンテンツ量が多くスクロールが深くなるため、PLモードと同様の横並びセレクターで店舗をシームレスに切り替える方式へ変更
- Files: `src/components/apps/SettingsApp.vue`

## 2026-05-17
- What: 設定3種をバージョン管理化（effective_from ベースの改定履歴 + 現在適用中表示 + 新規改定フォーム）
- Why: V-MINT2.0の単位原価マスタと同様に、設定値を月単位の有効日付付きで改定履歴管理できるようにするため
- Files: `src/components/apps/SettingsApp.vue`, `src/api.js`, `src/components/apps/PLApp.vue`, `supabase/DB_MIGRATION_versioned_settings.sql`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-17
- What: 設定「店舗別固定費」を全店舗一覧表示に変更（店舗選択ドロップダウン廃止）
- Why: 月次入力と同様に、店舗を選ばず1画面で全3店舗の固定費を確認・編集できるよう改善
- Files: `src/components/apps/SettingsApp.vue`

## 2026-05-17
- What: 経営PL をシングルページ化・月次入力を全店舗一括フロー化・集計期間表示追加
- Why: (1) PL はフィルター選択→PL表示の2ステップだったが1画面にまとめてUX改善。(2) 月次入力は店舗ごとに開始が必要だったが全3店舗分を連続入力できるよう変更。(3) V-MINTの集計期間（cost_reports.start_date/end_date）を入力画面に表示
- Files: `src/components/apps/PLApp.vue`, `src/components/apps/InputApp.vue`, `src/api.js`, `src/App.vue`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-17
- What: `V-PEACH_supabase-er-diagram.md` — Supabase ER 図（`pe_*` 4 テーブル + V-MINT 読み取り参照・Migration 履歴）
- Why: V-MINT2.0 と同様に DB 構造と共用関係を一覧できる正本を用意するため
- Files: `notes/V-PEACH_supabase-er-diagram.md`, `notes/_index.md`, `notes/V-PEACH_architecture.md`
- Related: [[V-PEACH/notes/V-PEACH_supabase-er-diagram]], [[V-MINT2.0/notes/V-MINT2.0_supabase-er-diagram]]

## 2026-05-17
- What: `V-PEACH_test-plan.md` — 空 DB 向けテスト計画（マスタ/月次の SQL 投入・期待値・テストケース一覧）
- Why: Phase 0〜5 完了後の一通り動作確認手順を文書化するため
- Files: `notes/V-PEACH_test-plan.md`, `notes/_index.md`
- Related: [[V-PEACH_test-plan]]

## 2026-05-17
- What: `V-PEACH_finance-spec.md` — §1 Mermaid削除・番号振り直し、数値セル列を右揃えに統一
- Why: 利益フロー図は不要／表の金額・比率・演算列の桁揃えを揃えるため
- Files: `notes/V-PEACH_finance-spec.md`
- Related: [[V-PEACH/notes/V-PEACH_finance-spec]]

## 2026-05-17
- What: Phase 5 — 売上・原価体系改修（提供/物販売上分離・消費税ライン・原価89%固定化・販管費再定義）
- Why: 旧来の `total_sales` 一本建てでは物販原価が未計上のまま粗利が過大評価されていた問題を解消
- Files: `src/utils/finance.js`, `src/api.js`, `src/components/apps/InputApp.vue`, `src/components/apps/PLApp.vue`, `src/components/apps/SettingsApp.vue`, `src/components/apps/PLTrendChart.vue`, `DB_MIGRATION.sql`
- Changes:
  - `pe_monthly_records`: `total_sales` → `service_sales` リネーム + `merchandise_sales` 追加、`rent/payment_fee/utilities/sundries` 廃止
  - `pe_store_settings`: `physical_profit_margin`/`fixed_payment_fee` 廃止 → `payment_fee_rate` 追加
  - `pe_merchandise_price_masters` テーブル・`pe_merchandise_sales_view` ビュー廃止
  - `calcPL()`: 消費税分離（× 10/11）・物販フレーバー原価 89% 固定・販管費 SGA 構造・`netCashFlow` を返す
  - InputApp.vue: 入力項目を提供売上/物販売上/人件費の3項目に絞り込み
  - PLApp.vue: 原価/販管費の大カテゴリー表示、ベンチマーク分母を `totalSalesAfterTax` に統一
- Related: [[V-PEACH/notes/V-PEACH_revision-plan]]

## 2026-05-16
- What: Phase 4 — トレンドチャートを月次・3ヶ月平均モードでも表示
- Why: 月次・3ヶ月平均モードでは年次モードと異なるデータ構造のため専用ロジックが必要だった
- Files: `src/components/apps/PLTrendChart.vue`, `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_release-plan]]

## 2026-05-16
- What: UI・ドキュメントの表記を「経営コックピット」から「経営ダッシュボード」に統一
- Why: プロダクト名称の表記揺れを解消
- Files: `index.html`, `src/components/common/PinAuth.vue`, `src/components/common/AppHeader.vue`, `notes/_index.md`, `notes/V-PEACH_requirements.md`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-15
- What: Phase 0 — プロジェクトスキャフォールド作成
- Why: V-MINT 2.0と同一スタック（Vue3/Vite/Tailwind/Supabase）でV-PEACHを独立リポジトリとして構築
- Files: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `.env.local`, `.gitignore`, `src/main.js`, `src/style.css`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-16
- What: Phase 1 — Supabase SQL Editor でマイグレーション実行完了
- Why: stores.id が bigint のため store_id を uuid→bigint に修正して再実行
- Files: `DB_MIGRATION.sql`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-15
- What: Phase 1 — DB_MIGRATION.sql 作成
- Why: V-MINT 2.0と同一Supabaseプロジェクトに `pe_` プレフィックスで5テーブル＋1Viewを追加
- Files: `DB_MIGRATION.sql`
- Related: [[V-PEACH/notes/V-PEACH_architecture]]

## 2026-05-15
- What: Phase 2 — 共通コンポーネント・APIレイヤー・財務ロジック実装
- Why: V-MINT 2.0のUIパターンを踏襲しつつV-PEACH固有のPL計算ロジックを分離
- Files: `src/api.js`, `src/utils/finance.js`, `src/utils/periods.js`, `src/App.vue`, `src/components/PortalMenu.vue`, `src/components/common/*`
- Related: [[V-PEACH/notes/V-PEACH_requirements]]

## 2026-05-15
- What: Phase 3 — 月次入力モード・設定モード・PLモード（基本）実装
- Why: 月次入力→設定→PL確認の3モードを骨格レベルで動作可能な状態にする
- Files: `src/components/apps/InputApp.vue`, `src/components/apps/SettingsApp.vue`, `src/components/apps/PLApp.vue`
- Related: [[V-PEACH/notes/V-PEACH_release-plan]]

## 2026-05-15
- What: GitHubリポジトリ作成・subtree push・Cloudflare Pages接続・初回デプロイ完了
- Why: obsidian-vaultモノレポから `git subtree push --prefix=V-PEACH V-PEACH main` で独立リポジトリに分離
- Files: リモート `V-PEACH` → `https://github.com/daiki100325/V-PEACH.git`
- Related: [[V-PEACH/DECISIONS]]

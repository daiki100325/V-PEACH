# CHANGELOG_DEV

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
- Related: [[V-PEACH/notes/V-PEACH_test-plan]]

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

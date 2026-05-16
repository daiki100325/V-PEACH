# CHANGELOG_DEV

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

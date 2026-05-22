---
tags: [project/v-peach, type/hub]
---

# V-PEACH Hub

## Overview
- Goal: 現場データ（V-MINT 2.0）と財務データを結合した戦略的経営ダッシュボードの構築
- Scope: 月次・年次PLの作成・分析・投資判断支援（Vue3 + Supabase + Cloudflare Pages）
- Owner: Vangvieng
- Repo: [daiki100325/V-PEACH](https://github.com/daiki100325/V-PEACH)

## 現在のステータス（2026-05-22）
- Phase 0（セットアップ）: ✅ 完了
- Phase 1（DBマイグレーション）: ✅ 完了（2026-05-16）
- Phase 2（月次入力・設定モード）: ✅ 完了
- Phase 3（PLモード基本）: ✅ 完了
- Phase 4（トレンドチャート・3ヶ月平均・年次集計・ヘルスチェック）: ✅ 完了
- Phase 5（売上・原価体系改修）: ✅ 完了（2026-05-17）
- Phase 6（FLR比表示・トレンドチャート全指標化）: ✅ 完了（2026-05-17）
- ベンチマーク指標改修（4→5指標・フラット化）: ✅ 完了（2026-05-18）
- 月次入力 Step 0 V-MINT 集計期間プレビュー: ✅ 完了（2026-05-18）
- Phase 7-1〜7-4（Airメイト/Airレジ CSV 自動取込）: ✅ 完了（2026-05-18）
- 人件費新方式（重みつき枠按分・PL統合）: ✅ 完了（2026-05-21）
- PLApp N+1 削減（prefetchPeriods 一括取得）: ✅ 完了（2026-05-21）
- CSV アップロード UI 統合（6→3ボックス・ヘッダー自動判定）: ✅ 完了（2026-05-22）

## Key Links
- Decisions: [[V-PEACH/DECISIONS]]
- Dev Log: [[V-PEACH/CHANGELOG_DEV]]
- Troubleshooting: [[V-PEACH/TROUBLESHOOTING]]

## Notes
- [[V-PEACH/notes/V-PEACH_requirements]]
- [[V-PEACH/notes/V-PEACH_architecture]]
- [[V-PEACH/notes/V-PEACH_supabase-er-diagram]] — Supabase ER 図（pe_* + V-MINT 参照）
- [[V-PEACH/notes/V-PEACH_finance-spec]]
- [[V-PEACH/notes/V-PEACH_test-plan]] — テスト計画・テストデータ投入手順
- [[V-PEACH/notes/old/V-PEACH_revision-plan]] ✅ 完了
- [[V-PEACH/notes/V-PEACH_release-plan]]
- [[V-PEACH/notes/V-PEACH_next-actions]] — 次のアクション（ベンチマーク見直し・UI変更検討）
- [[V-PEACH/notes/V-PEACH_labor-cost-plan]] — 人件費計算ロジック実装計画（重みつき枠按分方式・PL/月次入力/設定）
- [[V-PEACH/notes/V-PEACH_sales-import-plan]] — 売上データ自動取り込み（Airメイト/Airレジ CSV）検討資料

## Weekly Review
- Wins:
  - 人件費新方式（重みつき枠按分）を全レイヤーで完成。DB migration・API・finance.js 計算関数・InputApp 3 画面（A/B/C）・PLApp 内訳表示・レガシーフォールバックまで一気通貫
  - PLApp の N+1 を大幅削減。`prefetchPeriods` によるバッチ取得で 195+ 並列 → 数リクエストに圧縮、タイムアウト問題解消
  - CSV アップロード UI を 6 ボックス → 3 ボックス（店舗ごと 1 ボックス）に統合。`<input multiple>` + ヘッダー内容自動判定で工数半減、ファイル名規約依存を解消
- Risks:
  - 固定給初期値 SEED（`SEED_fixed_salaries_20260520.sql`）はオーナー確認後に別途投入が必要
  - テストデータ未投入のため人件費新方式・チャート・Health Check は dev 環境での実動確認が残タスク
- Next Actions:
  - [[V-PEACH/notes/V-PEACH_test-plan]] に沿ってテストデータ投入・動作確認（人件費新方式含む）
  - ベンチマーク目標値をオーナーと確認して Supabase に登録
  - 固定給初期値をオーナーに確認して SEED 投入
  - 不具合は TROUBLESHOOTING / CHANGELOG_DEV に記録

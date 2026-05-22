---
tags: [project/v-peach, type/hub]
---

# V-PEACH Hub

## Overview
- Goal: 現場データ（V-MINT 2.0）と財務データを結合した戦略的経営ダッシュボードの構築
- Scope: 月次・年次PLの作成・分析・投資判断支援（Vue3 + Supabase + Cloudflare Pages）
- Owner: Vangvieng
- Repo: [daiki100325/V-PEACH](https://github.com/daiki100325/V-PEACH)

## 現在のステータス（2026-05-18）
- Phase 0（セットアップ）: ✅ 完了
- Phase 1（DBマイグレーション）: ✅ 完了（2026-05-16）
- Phase 2（月次入力・設定モード）: ✅ 完了
- Phase 3（PLモード基本）: ✅ 完了
- Phase 4（トレンドチャート・3ヶ月平均・年次集計・ヘルスチェック）: ✅ 完了
- Phase 5（売上・原価体系改修）: ✅ 完了（2026-05-17）
- Phase 6（FLR比表示・トレンドチャート全指標化）: ✅ 完了（2026-05-17）
- ベンチマーク指標改修（4→5指標・フラット化）: ✅ 完了（2026-05-18）
- 月次入力 Step 0 V-MINT 集計期間プレビュー: ✅ 完了（2026-05-18）

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
  - Phase 6 完了。FLR比サマリーセクション（F比・L比・R比）追加、月次推移チャートを全PL項目＋FLR比のカテゴリー別トグル対応に全面改修
  - ベンチマーク指標を F比・L比・R比・営業利益率・労働分配率の5指標に刷新（粗利率・原価率を除外）。`pe_benchmarks` をフラット・シングルトン形式に再設計
  - 月次入力 Step 0 に V-MINT 集計期間プレビューカードを追加。対象月選択後にすべての店舗の集計期間を入力開始前に確認可能
- Risks:
  - テストデータ未投入のため、FLR比・チャート表示・ベンチマーク Health Check はデータ投入後の実動確認が必要
- Next Actions:
  - [[V-PEACH/notes/V-PEACH_test-plan]] に沿ってテストデータ投入・動作確認
  - ベンチマーク目標値をオーナーと確認して Supabase に登録
  - 不具合は TROUBLESHOOTING / CHANGELOG_DEV に記録

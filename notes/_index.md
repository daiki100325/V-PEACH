---
tags: [project/v-peach, type/hub]
---

# V-PEACH Hub

## Overview
- Goal: 現場データ（V-MINT 2.0）と財務データを結合した戦略的経営ダッシュボードの構築
- Scope: 月次・年次PLの作成・分析・投資判断支援（Vue3 + Supabase + Cloudflare Pages）
- Owner: Vangvieng
- Repo: [daiki100325/V-PEACH](https://github.com/daiki100325/V-PEACH)

## 現在のステータス（2026-05-17）
- Phase 0（セットアップ）: ✅ 完了
- Phase 1（DBマイグレーション）: ✅ 完了（2026-05-16）
- Phase 2（月次入力・設定モード）: ✅ 完了
- Phase 3（PLモード基本）: ✅ 完了
- Phase 4（トレンドチャート・3ヶ月平均・年次集計・ヘルスチェック）: ✅ 完了
- Phase 5（売上・原価体系改修）: ✅ 完了（2026-05-17）

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

## Weekly Review
- Wins:
  - Phase 5 改修完了。提供/物販売上分離・消費税ライン・原価89%固定化・売上連動決済手数料が本番稼働
- Risks:
  - 既存テストデータは旧カラム（total_sales等）で入力されているため数値確認が必要
- Next Actions:
  - [[V-PEACH/notes/V-PEACH_test-plan]] に沿ってテストデータ投入・動作確認
  - 不具合は TROUBLESHOOTING / CHANGELOG_DEV に記録

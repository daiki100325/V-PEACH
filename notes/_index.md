---
tags: [project/v-peach, type/hub]
---

# V-PEACH Hub

## Overview
- Goal: 現場データ（V-MINT 2.0）と財務データを結合した戦略的経営コックピットの構築
- Scope: 月次・年次PLの作成・分析・投資判断支援（Vue3 + Supabase + Cloudflare Pages）
- Owner: Vangvieng
- Repo: [daiki100325/V-PEACH](https://github.com/daiki100325/V-PEACH)

## 現在のステータス（2026-05-15）
- Phase 0（セットアップ）: ✅ 完了
- Phase 1（DBマイグレーション）: ✅ 完了（2026-05-16）
- Phase 2（月次入力・設定モード）: ✅ 完了
- Phase 3（PLモード基本）: ✅ 完了
- Phase 4（トレンドチャート・ベンチマーク）: 🔲 未着手

## Key Links
- Decisions: [[V-PEACH/DECISIONS]]
- Dev Log: [[V-PEACH/CHANGELOG_DEV]]
- Troubleshooting: [[V-PEACH/TROUBLESHOOTING]]

## Notes
- [[V-PEACH/notes/V-PEACH_requirements]]
- [[V-PEACH/notes/V-PEACH_architecture]]
- [[V-PEACH/notes/V-PEACH_release-plan]]

## Weekly Review
- Wins:
- Risks:
- Next Actions:
  1. `npm install` → `npm run dev` でローカル動作確認
  2. 設定モードで各店舗の固定費・物販販売値を初期設定
  3. 月次入力モードでテストデータ投入
  4. Phase 4（トレンドチャート）着手

---
tags: [project/v-peach, type/hub]
---

# V-PEACH Hub

## Overview
- Goal: 現場データ（V-MINT 2.0）と財務データを結合した戦略的経営ダッシュボードの構築
- Scope: 月次・年次PLの作成・分析・投資判断支援（Vue3 + Supabase + Cloudflare Pages）
- Owner: Vangvieng
- Repo: [daiki100325/V-PEACH](https://github.com/daiki100325/V-PEACH)

## 現在のステータス（2026-06-01）
> 🎉 **Phase 0〜12 を全完了し、2026-06-01 に正式リリース・本番稼働開始。** 次は Phase 13（多店舗スケール対応・計画確定／実装は 6/2 以降）。
- Phase 0（セットアップ）: ✅ 完了
- Phase 1（DBマイグレーション）: ✅ 完了（2026-05-16）
- Phase 2（月次入力・設定モード）: ✅ 完了
- Phase 3（PLモード基本）: ✅ 完了
- Phase 4（トレンドチャート・3ヶ月平均・年次集計・ヘルスチェック）: ✅ 完了
- Phase 5（売上・原価体系改修＋設定バージョン管理＋RLS）: ✅ 完了（2026-05-17）
- Phase 6（FLR比表示・トレンドチャート全指標化・ベンチマーク5指標フラット化・月次入力 Step 0 集計期間プレビュー）: ✅ 完了（2026-05-17〜18）
- Phase 7-1〜7-4（Airメイト/Airレジ CSV 自動取込）: ✅ 完了（2026-05-18）
- Phase 8（人件費新方式・重みつき枠按分・PL統合・PLApp N+1 削減）: ✅ 完了（2026-05-21）
- Phase 9（CSV アップロード UI 統合・6→3ボックス・ヘッダー自動判定）: ✅ 完了（2026-05-22）
- Phase 10（HRMOS シフト CSV 取込・祝日マスタ・PortalMenu バナー・トレンドチャート仕様改修）: ✅ 完了（2026-05-25）
- Phase 11（月次入力フロー CSV 専用化・再編集モード・labor_cost フォールバック廃止）: ✅ 完了（2026-05-30）
- Phase 12（UI/UX 最終調整・リリース前テスト）: ✅ 完了 → 🎉 正式リリース（2026-06-01）
  - 売上 CSV 一括アップロード（6ファイル同時・ファイル名で店舗自動判定）✅
  - シフト CSV UI を Step 1 と統一・削除ボタン追加 ✅
  - 人件費プレビュー Step 4 りょーさん全店合計・代替コスト総計フッター追加 ✅
  - トレンドチャート指標トグル不具合修正（markRaw 化・`.has()`→`.includes()`）✅
  - 正式リリース前テスト一巡クリア（test-plan 全件 done）→ デプロイ ✅

## Key Links
- Decisions: [[V-PEACH/DECISIONS]]
- Dev Log: [[V-PEACH/CHANGELOG_DEV]]
- Troubleshooting: [[V-PEACH/TROUBLESHOOTING]]

## Notes（現行・更新対象）

- [[V-PEACH/notes/V-PEACH_history]] — V-MINT 誕生からシーシャ経営ダッシュボード完成までの全開発史
- [[V-PEACH/notes/V-PEACH_requirements]] — 要件定義・財務ロジック・モード別仕様
- [[V-PEACH/notes/V-PEACH_architecture]] — スタック・DB設計・財務ロジック・デプロイフロー
- [[V-PEACH/notes/V-PEACH_supabase-er-diagram]] — Supabase ER 図（pe_* + V-MINT 参照）
- [[V-PEACH/notes/V-PEACH_finance-spec]] — 財務計算仕様詳細
- [[V-PEACH_test-plan]] — テスト計画・テストデータ投入手順
- [[V-PEACH/notes/V-PEACH_release-plan]] — リリース・検証手順
- [[V-PEACH/notes/V-PEACH_how-to-use]] — 操作マニュアル（月次作業・随時作業の手順）
- [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]] — 店舗増減の GUI 対応 **実装計画**（V-MINT/V-PEACH 共通・確定/着手前・保険ブランチ v3/v2）

## Notes（アーカイブ・`old/` 配下）

> 以下のファイルは実装完了に伴い `notes/old/` へ移動済み。  
> **実装変更による更新は不要。** 設計経緯の参照用としてのみ保持する。

- [[V-PEACH/notes/old/V-PEACH_revision-plan]] ✅ 完了 — 売上・原価体系改修（Phase 5）の実装計画
- [[V-PEACH/notes/old/V-PEACH_labor-cost-plan]] ✅ 完了 — 人件費新方式（重みつき枠按分）の実装計画
- [[V-PEACH/notes/old/V-PEACH_shifts-csv-import-plan]] ✅ 完了 — HRMOS シフト CSV 取込の実装計画
- [[V-PEACH/notes/old/V-PEACH_sales-import-plan]] ✅ 完了 — Airメイト/Airレジ CSV 自動取込の検討資料
- [[V-PEACH/notes/old/V-PEACH_next-actions]] ✅ 完了 — 完了済みネクストアクション一覧（2026-05-25時点）

## Weekly Review
- Wins:
  - 人件費新方式（重みつき枠按分）を全レイヤーで完成。DB migration・API・finance.js 計算関数・InputApp 3 画面（A/B/C）・PLApp 内訳表示・レガシーフォールバックまで一気通貫
  - PLApp の N+1 を大幅削減。`prefetchPeriods` によるバッチ取得で 195+ 並列 → 数リクエストに圧縮、タイムアウト問題解消
  - CSV アップロード UI を 6 ボックス → 3 ボックス（店舗ごと 1 ボックス）に統合。`<input multiple>` + ヘッダー内容自動判定で工数半減、ファイル名規約依存を解消
  - リリース前テストを一巡クリア。トレンドチャートのトグル不具合（markRaw 化）を最後に解消し、test-plan 全件 done で本番デプロイへ
- Risks:
  - 大きな残課題なし。スキップ項目（SET-15 alert 非表示 / PLT-02 3ヶ月平均チャートは月次生値 / EDG-02 ネットワーク断）は既知・許容済み
- Next Actions:
  - 本番デプロイ後のスモーク再確認（PIN + 1 店舗 PL）
  - 不具合は TROUBLESHOOTING / CHANGELOG_DEV に記録

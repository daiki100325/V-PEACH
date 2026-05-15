---
tags: [project/v-peach, type/note]
parent: [[V-PEACH/notes/_index]]
---

# V-PEACH — Release Plan

## Summary
- 3フェーズ構成。設定→入力→分析の順に積み上げてリリース
- 各フェーズ完了でそれ単体として使える状態にする

## フェーズ構成

### Phase 1：基盤 & 設定モード
- Supabase テーブル作成（`pe_monthly_records` / `pe_store_settings` / `pe_benchmarks`）
- V-MINT 2.0 連携View の作成
- 設定モードUI：家賃・光熱費・役員報酬・借入返済・物販利益率・目標値の入力

### Phase 2：月次入力モード
- Step 入力UI（総売上 → 経費 → 人件費）
- 設定値からの自動入力・プレースホルダ（前月実績）
- バリデーション（異常値アラート）
- Supabase への保存

### Phase 3：PLモード（分析・可視化）
- ビジュアルPL（収益 vs 経費・利益の対照表）
- Health Highlight（RED/GREEN判定）
- トレンドチャート（Chart.js）：月次・3ヶ月移動平均・年次フィルター
- 人件費率と営業利益率の相関表示

## Details
- バージョン管理：V-MINT 2.0 と同一モノレポ or 別リポジトリは Phase 1 着手前に決定
- デプロイ：Cloudflare Pages（V-MINT 2.0 と同様の subtree push 運用を想定）

## Related
- [[V-PEACH/DECISIONS]]
- [[V-PEACH/CHANGELOG_DEV]]
- [[V-PEACH/notes/V-PEACH_requirements]]
- [[V-PEACH/notes/V-PEACH_architecture]]

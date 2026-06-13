---
tags:
  - project/v-peach
  - project/v-mint2
  - type/note
  - type/review
parent:
  - - V-PEACH/notes/_index
---

# マルチストア改修 コードレビュー（P6 go-live 直前）

> ステータス: **レビュー一巡完了（2026-06-13）** / レビュア: ERIKA（Fable）
> 対象差分: `multi-store` vs `main`（26 ファイル・+2913 / -242 行）
> 結論: **ブロッカー級のバグなし。go-live 可能な品質。** 下記の「観察事項」は低重要度（任意対応）。
> Source: [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]（§6 P6）

## 1. レビュー範囲と方法

前回セッションがトークンリミットで途絶したため、`multi-store` の実装差分を高リスク順に再レビューした（会話履歴ではなく実コードを正本とした）。重点的に読んだのは以下のロジック密度が高いファイル:

| ファイル | 観点 |
|---------|------|
| `V-PEACH/src/utils/storeFilters.js` | 閉店翌月以降の集計除外ロジック |
| `V-PEACH/supabase/...create_store_atomic...sql` | 追加トランザクションのアトミック性・バリデーション |
| `V-PEACH/src/utils/csvImporter.js` | 店舗名寄せの動的化（誤マッチ防止） |
| `V-PEACH/src/utils/shiftImporter.js` | シフト枠ルール世代選択・按分枠集計 |
| `V-PEACH/src/components/apps/PLApp.vue` | storePLs 添字整合・按分分母の休止除外 |
| `V-PEACH/src/components/apps/SettingsApp.vue` | 追加ウィザード・%換算・店舗管理 CRUD |
| `V-PEACH/src/api.js` | updateStore/UI設定のホワイトリスト・createStoreAtomic |
| `V-MINT2.0/src/utils/storeDisplay.js` | 配色・名前の動的化 |
| `V-MINT2.0/supabase/rpc_v2.sql` | jsonb_object_agg 動的キー化（構造確認） |

## 2. 良かった点（設計の妥当性確認）

- **storePLs の添字整合**: `aggStores`（休止含む全 shop）を単一の母集団基準に統一し、`prefetchPeriods` / `loadMonthlyPLCore` / `displayColumns` の全てが同じ添字で整列。月次・3ヶ月平均・年次の全モードで一貫（`PLApp.vue`）。
- **閉店除外の二重防御**: 按分分母（`totalWeightedSlots`）と対象レコード（`targetRecords`）の両方に `isStoreOpenForPeriod` を適用。「実シフトデータ由来で自然ゼロ＋過去残骸への明示除外」の安全弁併用が堅実。
- **アトミック性**: `create_store_atomic` は plpgsql 単一トランザクション。store_key 正規表現・固定費5項目必須・シフト6パターン必須・重複キー拒否をサーバ側で網羅。半端な店舗は構造的に作れない。
- **% 換算の往復一貫**: `payment_fee_rate` は UI で %（2.5）→ 保存時 `/100`（0.025）→ 表示時 `×100`（2.50%）。ウィザード・改訂追加・サマリーで換算が揃っている。
- **書き込み境界のホワイトリスト**: `updateStore`（name/is_active/display_order/closed_at のみ）・`updateAppUiSettings`（show_inactive_stores のみ）で store_key/store_type 等のシステム項目を構造的に保護。
- **名寄せの誤マッチ防止**: `detectStoreKeyFromFilename` / `decideHrmosSegmentClassification` が店舗名を長い順でチェック（「馬場2号店」が「馬場本店」に誤マッチしない）。
- **RPC 行ベース化**: `jsonb_object_agg(store_key, value)` で店舗数非依存。P2 で旧 CASE 版と全期間差分ゼロ実証済み。

## 3. 既知のトレードオフ（バグではない・計画で承認済み）

| 事象 | 影響 | 記録 |
|------|------|------|
| `smSwap` が update 2 回（隣接 display_order 入替）。部分失敗で UI/DB が一時乖離 | 再読込で復旧。office(0) とは構造上入れ替わらない | plan §6-1 P4 で承認済み |
| `getStores` はマウント時取得。編集結果が他画面に即時反映されない | 画面再読込で反映 | plan §6-1 P4 で承認済み |
| 新店舗は作成直後から全モードに出現（stores に開店日カラムなし） | 月次レコードが無い月は PL 早期 return で固定費・按分とも影響ゼロ | plan §6 P4 e2e で確認済み |

## 4. 観察事項（低重要度・任意対応・go-live ブロッカーではない）

1. **`create_store_atomic` の `payment_fee_rate` に上限なし**
   非負チェックのみで上限がない。ウィザードは % 入力を `/100` するため誤って `50`（=50%）等を入れても通る。管理者専用・確認ダイアログありのため実害は極小。気になるなら RPC で `payment_fee_rate <= 1`（または妥当上限）の sanity check を足す余地あり。

2. **名寄せ対象に office が含まれる**
   `detectStoreKeyFromFilename` / segment 分類は office を含む全 stores を走査する。売上 CSV のファイル名に office 名が偶然含まれると office にマッチしうる（実運用では発生しにくい）。気になるなら shop 限定に絞る余地あり。

3. **`PLApp.loadStoreContext` 失敗時のフォールバック**
   `getStores` 失敗時は `props.stores`（active のみ）で継続するため、その縮退モードでは休止店舗がトグル ON でも出ない。発火条件は「PLApp マウント時の getStores だけが失敗」というピンポイントで、`console.error` で可視化済み・画面リロードで即復帰。実害極小だが残課題として記録（直すならリトライ or バナー表示）。

## 4-1. 確認の結果クリアになった項目（記録用）

- **`jsonb_object_agg` と stock ゼロ店舗 → 設計で解決済み**
  RPC v2 3 関数はいずれも `period_stock` / `current_period_stock` CTE が「stores 全行 × 有効フレーバーの直積」を保証する構造（`rpc_v2.sql` L159-161・L591-592 のコメント＋ `left join stores s on s.id = ps.store_id` で確認）。新店舗を追加しても直積で行が湧き、`store_key` が JSON キーに必ず出現（在庫ゼロなら値 0）。`s.store_key` が NULL にならないため `jsonb_object_agg` のエラーも起きない。**新店舗追加で RPC 改修ゼロ＝マルチストア設計目標が機能**。当初は e2e 挙動からの推測で観察事項に挙げたが、実コードで断定し降格。

## 5. go-live 判定

- **コード品質: 合格。** §4 の観察事項 3 件は **つーくん確認の上で全件スルー判断（2026-06-13）**＝本番マージのブロッカーなし。
  - #1 手数料率上限なし → スルー（管理者専用・実害極小）
  - #2 名寄せに office 含む → スルー（実運用で発生しにくい）
  - #3 getStores 失敗時の縮退 → スルー（リロードで即復帰するため）
- §4-1（jsonb_object_agg）は設計で解決済み＝対応不要。
- 残作業は plan §6-1 P6 のとおり: **§6-4 のプレビュー目視確認（つーくん）→ V-MINT `v3→v2` / V-PEACH `v2→main` マージ → 本番スモーク**。

## Related
- [[V-PEACH/notes/V-PEACH_multi-store-scaling-plan]]
- [[V-PEACH/DECISIONS]]

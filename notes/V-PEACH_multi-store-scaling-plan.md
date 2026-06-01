---
tags:
  - project/v-peach
  - project/v-mint2
  - type/note
  - type/plan
parent:
  - - V-PEACH/notes/_index
---

# 店舗増減の GUI 対応 — 実装計画（V-PEACH / V-MINT2.0）

> ステータス: **実装計画（確定・着手前）** / 作成 2026-06-01
> 進捗: **P0〜P7 すべて ⬜ 未着手**（2026-06-01 時点）。最新は §5 進捗帳票を参照。
> 対象: V-MINT2.0・V-PEACH 両アプリ（`stores` テーブル共有のため一体で実装）
> ゴール: 新店舗オープン／既存店舗の閉店を、つーくん（管理者）が **GUI からできる限り完結** して扱えるようにする。SQL 手作業ゼロ・1 か所登録で両アプリ反映。
> 進め方: 本ドキュメントを正本とし、§5 のフェーズ順に実装する。各フェーズの着手・完了で §5 の状態列とチェックリストを更新し、`CHANGELOG_DEV.md` にも記録する。

## 1. 背景・目的

現行は新店舗が増えると Supabase（RPC のピボット定義）からフロント（店舗キーのハードコード）まで**広範囲の改修**が必要で、店舗事業のスケールに追従できない。今後の出店・閉店に備え、店舗マスタの増減を構造的に吸収できる設計へ移行する。

本改修は **DB・RPC・フロント・GUI の 4 層** に及ぶ大規模改修のため、本番への即時反映を避け、**専用デプロイブランチ**で進める（§6）。

## 2. 確定要件（R1〜R8）

| # | 項目 | 決定 |
|---|------|------|
| R1 | 操作者 | **つーくん（管理者）のみ**。店舗の追加は管理者が GUI から入力。過剰なガードは不要だが、最低限の確認ダイアログは付ける |
| R2 | 閉店時の扱い | **論理削除（休止フラグ）をベース**。物理削除はしない。過去の月次／PL／棚卸し／在庫データは全て保持 |
| R3 | 過去履歴の閲覧 | 休止店舗は基本は各モードで非表示。決算等に備え **「休止店舗も表示」トグル**で表示切替。粒度は **全社一括**。状態は **DB 共有**（両アプリ連動） |
| R4 | スコープ | **両アプリ同時**。`stores` は共有マスタ |
| R5 | 店舗マスタの単一情報源 | **V-PEACH を正（single source of truth）**。店舗 CRUD・各店固有設定は **V-PEACH `SettingsApp` に集約**。V-MINT は `stores` を読むだけ（CRUD なし）。`stores` 共有のため **アプリ間同期コードは不要** |
| R6 | `store_key` | **手入力＋作成時のみ編集可（以後ロック）**。英数字キー。表示名 `name` は後から編集可 |
| R7 | 新店舗の初期設定 | **必須化**。固定費・シフトルールの入力を完了しないと確定できない。**一発確定のみ**（途中保存・下書きなし） |
| R8 | シフト枠時間ルール | 馬場2号店の遅番補正のような店舗固有ロジックを **V-PEACH 設定として一般化**。各店 × シフト種別（早番／中番／遅番）× 日種別（平日／土日祝）で **6h / 7.5h** を設定可能。**改定履歴（`effective_from`）あり** |

### 2-1. 「二重設定」を作らない（R5 の核心）

`stores` は V-MINT2.0・V-PEACH が共用する同一 Supabase プロジェクトの 1 テーブル。現状の二重感は「両アプリが**別々に店舗リストをハードコード**している」ことに由来し、DB が二重なわけではない。両アプリを `getStores()`（共有 `stores` 参照）に動的化すれば、**店舗を 1 か所で登録するだけで両アプリに反映**される。同期処理は実装不要。

> **`office`（事務所）の扱い:** `office` は V-MINT のみが使う `stores` 行で、V-PEACH の店舗リストには元々存在しない。店舗マスタ管理は **`store_type='shop'` を対象**とし、`office` は編集不可のシステム行として別管理。新規追加店舗は常に `shop`。

## 3. 影響範囲（変更対象の棚卸し）

店舗の概念が **3 層** にハードコードされている。実装時はこの一覧を潰し込む。

### 3-1. DB レイヤー（追加のみ・後方互換）
- `stores` は `id` / `store_key` / `name` を持つ通常マスタ。行追加自体は容易。
- 不足: 休止状態・表示順・店舗種別・閉店日。→ §4-1 で列追加。
- シフトルール・共有トグルの新テーブルを追加。→ §4-1。

### 3-2. Supabase RPC レイヤー（最大の難所）
`supabase/rpc.sql` の集計関数が **`store_key` を CASE 文でピボット**して返している。店舗が増えるたび SQL 手書きが必要。

```sql
-- fetch_stock_overview / fetch_dashboard_stock_overview など
'office',     coalesce(max(case when s.store_key = 'office'     then ps.current_stock end), 0),
'baba_main',  coalesce(max(case when s.store_key = 'baba_main'  then ps.current_stock end), 0),
'nakano',     coalesce(max(case when s.store_key = 'nakano'     then ps.current_stock end), 0),
'baba_2nd',   coalesce(max(case when s.store_key = 'baba_2nd'   then ps.current_stock end), 0)
```

`fetch_request_inventory_data`（RETURNS TABLE）は **店舗別カラムが型定義に固定**（最難所）:

```sql
officeStock numeric, babaMainStock numeric, nakanoStock numeric, baba2ndStock numeric, ...
```

該当箇所（`rpc.sql`）: 在庫概要 JSON ピボット（L117-120 / L313-322）、消費量ピボット（L319-322）、RETURNS TABLE 固定カラム（L508-510, L664-667）。

### 3-3. フロントレイヤー（散在・地味に重い）
店舗キーが「リスト」だけでなく **オブジェクトのプロパティ名** や **色・名前マップ**、**店舗固有ロジック** として散らばっている。

| 種類 | 箇所（例） |
|------|-----------|
| 店舗リスト直書き | `V-MINT2.0/src/App.vue:250-254`、`TransferApp.vue:582-586`、`V-PEACH/src/App.vue:112-114`、`RequestApp.vue:28-30` |
| キー正規化（`baba`→`baba_main`） | `V-MINT2.0/src/api.js:16`、`V-PEACH/src/api.js:13`、`TransferApp.vue:817` |
| **stock をプロパティ名で直アクセス** | `item.stock.office` / `.baba_main` / `.nakano` / `.baba_2nd`（`RequestApp.vue:273,355,403`、`TransferApp.vue:838-841`、`api.js:706-731`） |
| 色マップ | `RequestApp.vue:419`（`{ office: 'bg-slate-400', baba_main: 'bg-red-500', ... }`） |
| 名前マップ | `RequestApp.vue:338`、`TransferApp.vue:823`（`{ office:'事務所', baba_main:'馬場本店', ... }`） |
| office 特例分岐 | `App.vue:300,302,492,554`、`CostApp.vue:533`、`DashboardApp.vue` 各所、`InventoryApp.vue` 各所 |
| CSV 名寄せ（日本語→キー） | `V-PEACH/src/utils/csvImporter.js:154-163, 268-272` |
| 店舗固有の業務ロジック | `V-PEACH/src/utils/shiftImporter.js`（`STORE_KEYS` 固定・**馬場2号店の遅番補正**・`ryoSlots`/`ptSlots` の店舗キー固定オブジェクト） |

> **示唆:** 「店舗リストを動的化」だけでは不十分。`stock.baba_main` のような**キー直アクセスを辞書（map）アクセスに置き換える**フロント刷新が工数の大半を占める。

## 4. 採用アーキテクチャ（確定設計）

選択肢の比較は完了済み。以下を**確定設計**として実装する（却下案の要旨は §8 付録）。

### 4-1. DB 設計

**(a) `stores` への列追加（additive・既存動作不変）**
- `is_active boolean DEFAULT true` — 休止フラグ（R2/R3）
- `display_order int` — 表示順（GUI で並べ替え）
- `store_type text DEFAULT 'shop'` — `shop` / `office`。暗黙の `key==='office'` 比較を撲滅（R5・§7）
- `closed_at date` — 閉店日。集計の明示除外に使用（R3）

`store_key` は **作成時のみ入力可・以後不変（イミュータブル）**（R6）。既存トランザクション・`pe_*` の FK 整合のため、リネーム不可。

**(b) `pe_store_shift_rules`（店舗別シフト枠時間・改定履歴付き／R8）**

```sql
CREATE TABLE pe_store_shift_rules (
  id             bigserial PRIMARY KEY,
  store_id       bigint  NOT NULL REFERENCES stores(id),
  effective_from int     NOT NULL,           -- YYYYMM
  shift_type     text    NOT NULL,           -- 'early'(早番) / 'middle'(中番) / 'late'(遅番)
  day_type       text    NOT NULL,           -- 'weekday'(平日) / 'holiday'(土日祝)
  hours          numeric NOT NULL,           -- 6.0 / 7.5
  note           text,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (store_id, effective_from, shift_type, day_type)
);
```
> シフト計算時は `effective_from <= periodKey` の最新世代を採用（`getActiveStoreSettings` と同方式）。既定値は現行標準（早番6h / 中番7.5h / 遅番6h、馬場2号店のみ遅番・土日祝=7.5h）を初期世代として SEED 再現。`shiftImporter.js` はこのテーブル参照に置換しハードコードを撤廃。

**(c) `app_ui_settings`（両アプリ共有 UI 状態・シングルトン／R3）**

```sql
CREATE TABLE app_ui_settings (
  id                  integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  show_inactive_stores boolean NOT NULL DEFAULT false
);
```
> `pe_` ではなく中立名前空間。V-MINT ダッシュボード・V-PEACH PL の「休止店舗も表示」トグルがこの 1 行を読み書きし、全社一括で連動。RLS は他テーブル同様 anon 全許可。

### 4-2. RPC 設計（行ベース化）

ピボット（固定キー）をやめ、**店舗数に依存しない形**へ再設計する。
- JSON 返却関数: `jsonb_object_agg(store_key, value)` で `{ [store_key]: value }` の動的キー JSON を返す。
- RETURNS TABLE 固定カラム関数: 店舗別カラムをやめ、**`store_key, value` の行集合**を返す形へ再設計（フロントで `reduce` して辞書化）。
- これにより RPC・フロント双方が店舗数非依存になり、以後の店舗追加で **RPC 改修ゼロ**。

> **移行は別名並走で安全に。** 新形式 RPC を `*_v2` 等の別名で並走させ、既存 4 店舗で旧出力と JSON 差分ゼロを確認してから切替える（§5 P2）。

### 4-3. フロント設計（動的化＋辞書アクセス）

- 店舗リスト: `getStores()`（`is_active` / `display_order` / `store_type` 取得）を起点に描画。`App.vue`・`TransferApp.vue` 等の直書き配列を撤廃。
- stock 直アクセス: `stock.baba_main` → `stock[storeKey]` / `stores.map(...)` のループへ刷新。
- 色・名前マップ: 固定マップを廃し、`stores.name` と動的カラーパレット（`display_order` 由来等）に。
- `office` 特例: 暗黙の `key==='office'` を `store_type==='office'` 判定へ統一。
- `shiftImporter.js`: `STORE_KEYS` 固定配列・`ryoSlots`/`ptSlots` の固定オブジェクトを `getStores()` 由来の動的生成へ。馬場2号店補正は `pe_store_shift_rules` 参照に一般化。
- `csvImporter.js`: 日本語→キーの名寄せを `stores.name` 由来へ動的化。

### 4-4. GUI 設計（V-PEACH `SettingsApp` に集約／R5）

- 置き場所: **V-PEACH `SettingsApp.vue`** に「店舗管理」セクションを新設。店舗マスタの単一窓口。V-MINT `AdminApp.vue` には CRUD を置かない。
- 一覧・編集機能: 名称編集 / `is_active` トグル / `display_order` 並べ替え / 確認ダイアログ。
- **新店舗追加ウィザード（必須入力・一発確定／R6・R7）**:
  1. `name` / `store_key`（英数字バリデーション・キーは以後ロック・`store_type='shop'` 固定）
  2. `pe_store_settings`（家賃・光熱・雑費・決済手数料率・固定給合計）
  3. `pe_store_shift_rules`（早番/中番/遅番 × 平日/土日祝 の 6h/7.5h。既定プリセットから調整）
  - **途中保存・下書きなし**。全項目入力後に `stores` 行＋上記設定を**一括 upsert**。理想はサーバ側トランザクション RPC `create_store_atomic` に集約し、失敗時は何も残さない（半端な店舗を作らない）。
- 休止店舗の表示トグル（R3・全社一括）: V-MINT ダッシュボード・V-PEACH PL に単一トグル。状態は `app_ui_settings.show_inactive_stores`（DB 共有）に永続化し両アプリ連動。

## 5. 実装フェーズ（進捗帳票）

> **ステータス凡例:** ⬜ 未着手 ／ 🟡 進行中 ／ ✅ 完了 ／ ⏸️ 保留・ブロック
> 各フェーズ完了時に本表の状態・完了日を更新し、`CHANGELOG_DEV.md` にも記録する。詳細タスクは §5-1 のチェックリストで追う。

| Phase | 状態 | 完了日 | 内容 | 完了条件 |
|-------|:----:|:------:|------|---------|
| **P0** | ⬜ | — | **デプロイブランチ準備（§6）**。A 案採用につき事前作成はせず、**P1 の初回 subtree push 時に V-MINT `v3` / V-PEACH `v2` を自動生成**。以後この改修の push 先を本番ブランチから切り離す | 両ブランチが生成され、Cloudflare で非本番（プレビュー）扱いと確認 |
| **P1** | ⬜ | — | DB: `stores` に `is_active` / `display_order` / `store_type` / `closed_at` 追加。`pe_store_shift_rules`・`app_ui_settings` 新設＋既定値 SEED。既存 4 店舗を移行（`office` は `store_type='office'`） | マイグレーション適用・既存動作不変（後方互換） |
| **P2** | ⬜ | — | RPC を 4-2（行ベース）へ再設計。**新形式を別名並走させ 4 店舗で旧出力と差分ゼロを検証**してから切替 | 既存 RPC 利用箇所が全て新形式で同値 |
| **P3** | ⬜ | — | フロント: `getStores()` 起点で店舗リスト・stock 辞書アクセス・色／名前マップを両アプリで動的化。`office` 特例を `store_type` 分岐へ。`shiftImporter` を `pe_store_shift_rules` 参照に刷新 | 4 店舗で全モード回帰なし |
| **P4** | ⬜ | — | V-PEACH `SettingsApp` に店舗管理 GUI（追加ウィザード＝マスタ＋固定費＋シフトルール必須入力・一発確定で一括 upsert／`create_store_atomic` RPC・休止トグル・並べ替え・キー作成時ロック） | GUI から店舗追加→V-MINT 含む全モードに自動反映 |
| **P5** | ⬜ | — | 休止店舗の全社一括表示トグル（`app_ui_settings` 連動）。`closed_at` 以降を集計から**明示除外**（按分分母含む）。`csvImporter` を `stores.name` 由来へ動的化 | 休止店舗の過去 PL/在庫が決算時に閲覧可・按分に休止店舗が混ざらない |
| **P6** | ⬜ | — | **本番反映（go-live）**。全テスト完了後に V-MINT `v3→v2`、V-PEACH `v2→main` をマージ（§6-4） | 本番 URL に反映・スモーク確認完了 |
| **P7** | ⬜ | — | **レガシー除去（go-live 後）**。別名並走で残した旧ピボット RPC・移行用シム・不要カラムを破壊的マイグレーションで撤去（§5-2） | 旧要素を全削除・本番回帰なし・ドキュメント最終同期 |

> **検証戦略:** P2 が最大の回帰リスク。新形式 RPC を別名関数で並走させ、既存 4 店舗で旧出力と JSON 差分ゼロを確認してから切替えるのが安全。
> **P7 の順序根拠:** Supabase は本番・プレビュー共有（§6-3）。go-live（P6）までは本番フロントが旧 RPC を使うため、レガシー除去は **必ず P6 の後**。先に消すと本番が壊れる。

### 5-1. フェーズ内タスクチェックリスト

進捗はこのチェックボックスで管理する（着手時 🟡 / 完了時 ✅ を §5 表へ反映）。

**P0 — ブランチ準備（A 案）**
- [ ] P1 の初回 push で V-MINT `v3` が生成されることを確認
- [ ] P1 の初回 push で V-PEACH `v2` が生成されることを確認
- [ ] Cloudflare で v3 / v2 が非本番（プレビュー）として扱われることを確認

**P1 — DB マイグレーション**
- [ ] `stores` 列追加（`is_active` / `display_order` / `store_type` / `closed_at`）
- [ ] `pe_store_shift_rules` 作成
- [ ] `app_ui_settings` 作成 ＋ RLS（anon 全許可）
- [ ] SEED: 既存 4 店舗の `display_order` / `store_type`（`office` は `office`）
- [ ] SEED: `pe_store_shift_rules` 既定値（標準＋馬場2号店 遅番・土日祝=7.5h）
- [ ] 既存動作の回帰（両アプリ起動・PL / 在庫表示が不変）
- [ ] ドキュメント同期（両 `supabase-er-diagram` / `architecture`）

**P2 — RPC 行ベース化**
- [ ] 行ベース新関数を別名（`*_v2`）で作成（在庫概要 / 消費量 / request inventory）
- [ ] 旧→新の出力差分ゼロ検証（4 店舗・全 period）
- [ ] フロントの呼び出しを新関数へ切替（旧関数は残置）
- [ ] ドキュメント同期（`supabase-er-diagram` の RPC 節）

**P3 — フロント動的化**
- [ ] `getStores()` 拡張（`is_active` / `display_order` / `store_type`）
- [ ] 店舗リスト直書き撤廃（`App.vue`×2 / `TransferApp` / `RequestApp`）
- [ ] stock 辞書アクセス化（`RequestApp` / `TransferApp` / `api.js`）
- [ ] 色・名前マップの動的化
- [ ] `office` 特例 → `store_type==='office'` 判定へ統一
- [ ] `shiftImporter` を `pe_store_shift_rules` 参照に刷新（馬場2号店ハードコード撤廃）
- [ ] 4 店舗で全モード回帰

**P4 — 店舗管理 GUI（V-PEACH SettingsApp）**
- [ ] 店舗管理セクション（一覧 / 名称編集 / `is_active` トグル / 並べ替え / 確認ダイアログ）
- [ ] 追加ウィザード（`name`+`key` / 固定費 / シフトルールを必須入力）
- [ ] `create_store_atomic` RPC（一括 insert・失敗時ロールバック）
- [ ] `store_key` 作成時ロック・英数字バリデーション
- [ ] GUI 追加 → V-MINT 含む両アプリ反映の e2e 確認
- [ ] ドキュメント同期（`requirements` / `how-to-use`）

**P5 — 休止表示トグル・閉店除外**
- [ ] `app_ui_settings` 連動トグル（V-MINT ダッシュボード / V-PEACH PL）
- [ ] `closed_at` 以降を集計から明示除外（PL / 在庫 / 按分分母）
- [ ] `csvImporter` の名寄せを `stores.name` 由来へ動的化
- [ ] 休止店舗の決算閲覧 e2e 確認

**P6 — 本番反映（go-live）**
- [ ] `test-plan` 全件 done を確認
- [ ] V-MINT `v3 → v2` マージ
- [ ] V-PEACH `v2 → main` マージ
- [ ] 本番スモーク（PIN + 1 店舗 PL + 在庫 1 モード）

**P7 — レガシー除去（go-live 後）** → §5-2
- [ ] 旧ピボット RPC 関数を `DROP`
- [ ] 別名（`*_v2`）を正式名へリネーム／統一
- [ ] キー正規化（`baba`→`baba_main`）の要否判断・整理
- [ ] 不要カラム・移行用シムの撤去
- [ ] 破壊的後片付けマイグレーション適用・本番回帰
- [ ] ER 図 / `architecture` notes の最終同期

### 5-2. P7 レガシー除去の対象（go-live 後にのみ実施）

後方互換のために P1〜P5 で残置した要素を、本番が新実装に切り替わった後（P6 完了後）にまとめて撤去する。

| 対象 | 残置理由（互換） | 除去内容 |
|------|----------------|---------|
| 旧ピボット RPC（`fetch_stock_overview` 等の CASE 版） | go-live まで本番フロントが使用 | 新 `*_v2` へ完全移行後に `DROP FUNCTION` |
| RPC 別名 `*_v2` | 並走検証用の暫定名 | 正式名へリネーム（または旧名を置換）し命名を一本化 |
| キー正規化 `baba`→`baba_main` | UI キーと DB `store_key` の歴史的不一致 | 整理可能か判断（リスク高なら据え置き可・要記録） |
| 移行用シム・暫定フォールバック | 切替期間の保険 | 不要分を削除 |

> **鉄則:** P7 は破壊的変更を含むため、**P6（go-live）とスモーク確認の完了を前提条件**とする。共有 DB ゆえ、本番フロントが旧 RPC を参照しなくなったことを確認してから着手する。

## 6. Git ブランチ / デプロイ戦略（本改修の保険）

大規模改修ゆえ、**本番ユーザーに即時展開されない**よう専用デプロイブランチを使う。

### 6-1. 現行（本番）
| アプリ | remote | 本番ブランチ | デプロイ |
|--------|--------|------------|---------|
| V-MINT2.0 | `V-MINT`（daiki100325/V-MINT） | **`v2`** | `git subtree push --prefix=V-MINT2.0 V-MINT v2` |
| V-PEACH | `V-PEACH`（daiki100325/V-PEACH） | **`main`** | `git subtree push --prefix=V-PEACH V-PEACH main` |

Cloudflare Pages は **本番ブランチをビルド**して本番 URL に出す。

### 6-2. 本改修中（保険ブランチ）
| アプリ | 改修用ブランチ | デプロイコマンド |
|--------|--------------|----------------|
| V-MINT2.0 | **`v3`** | `git subtree push --prefix=V-MINT2.0 V-MINT v3` |
| V-PEACH | **`v2`** | `git subtree push --prefix=V-PEACH V-PEACH v2` |

- 本番ブランチ（V-MINT=`v2` / V-PEACH=`main`）ではないため、Cloudflare では **プレビューデプロイ**扱い。**本番 URL は無傷**（＝保険）。
- diverge で push 拒否時のみ（force-with-lease 経由）:
  ```bash
  # V-MINT
  git -C "C:\Obsidian Vault" subtree split --prefix=V-MINT2.0 HEAD -b vmint-deploy
  git -C "C:\Obsidian Vault" push --force-with-lease V-MINT vmint-deploy:v3
  git -C "C:\Obsidian Vault" branch -D vmint-deploy
  # V-PEACH
  git -C "C:\Obsidian Vault" subtree split --prefix=V-PEACH HEAD -b vpeach-deploy
  git -C "C:\Obsidian Vault" push --force-with-lease V-PEACH vpeach-deploy:v2
  git -C "C:\Obsidian Vault" branch -D vpeach-deploy
  ```
- **`/vmint-deploy`・`/vpeach-deploy` スキルは本番ブランチ（v2 / main）を叩く**ので、本改修中は使わず、上記の **v3 / v2 を明示したコマンドを直接実行**する（誤って本番反映しないため）。
- obsidian-vault（`origin/main`）への通常コミットは従来通り。ブランチ分離は **subtree push 先のみ**。

### 6-3. ⚠️ 最重要: Supabase は本番・プレビューで共有
Cloudflare のプレビューと本番は **同一 Supabase プロジェクトを参照**する。よって **DB マイグレーション（P1）は本番にも即時反映される**。プレビューだから安全、ではない。
- → P1 は **additive（列追加・新テーブルのみ）で既存 4 店舗が壊れないこと**を厳守。`DROP` / 破壊的変更は go-live まで行わない。
- → RPC（P2）も**別名並走**で旧関数を残し、本番フロント（v2/main）が壊れないようにする。
- → 既存フロント（本番）と新フロント（プレビュー）が**同じ DB を同時に読む**期間がある前提で、後方互換を設計する。

### 6-4. 本番反映（go-live・P6）
検証完了後にブランチを本番へマージ:
```bash
# V-MINT: v3 → v2（本番）
git -C "C:\Obsidian Vault" push V-MINT V-MINT/v3:v2   # もしくは subtree push --prefix=V-MINT2.0 V-MINT v2
# V-PEACH: v2 → main（本番）
git -C "C:\Obsidian Vault" push V-PEACH V-PEACH/v2:main
```
> 反映後のスモーク（PIN + 1 店舗 PL / 在庫 1 モード）で確認。不要になった RPC 旧関数等の破壊的後片付けは **P7（§5-2）** で別マイグレーションとして実施する。

## 7. リスク・留意点

- **DB 共有の即時反映（§6-3）**: プレビュー≠DB分離。P1/P2 は後方互換必須。破壊的変更は go-live 後。
- **`store_key` の不変性**: 一度発行したキーは変更不可。GUI のキー入力は作成時のみ・以後ロック。`name` は自由に編集可。
- **`office` の特殊性**: `store_type`（`office` / `shop`）で明示分類し、暗黙の `key==='office'` 比較を撲滅。店舗マスタ管理（V-PEACH）は `shop` のみ対象。
- **単一情報源（V-PEACH）の前提**: 店舗 CRUD は V-PEACH のみ。V-MINT 側で `stores` を書く経路を作らない（書き込み口の一本化）。
- **追加フローのアトミック性（一発確定）**: 複数テーブルへ書くため、確定時の一括処理で「`stores` だけある半端な店舗」を絶対に生まない。理想は `create_store_atomic` RPC で一括 insert・失敗時ロールバック。
- **RPC 並走検証コスト**: B2 切替は出力形式が変わる。フロント追従と同時にやると切り分けが難しい。関数並走＋差分検証を必須に。
- **閉店店舗の集計除外（明示除外）**: `closed_at` 以降は PL・在庫・人件費按分の対象から明示除外。特に `pe_monthly_company_records` の按分分母に休止店舗の枠数が混ざらないことを検証。
- **YAGNI**: 色のフル メタ化は現規模では過剰。辞書アクセス化＋シフトルールのデータ化で十分スケールする。

## 8. 決定事項ログ・付録

### 8-1. 決定事項（2026-06-01 で全確定）
1. ✅ 休止トグルの状態 → **DB 共有**（`app_ui_settings` 中立シングルトン・両アプリ連動）
2. ✅ `pe_store_shift_rules` → **改定履歴あり**（`effective_from` 世代管理）
3. ✅ 閉店店舗 → **明示除外**（`closed_at` 以降を集計・按分から除外）
4. ✅ 追加フロー → **一発確定のみ**（途中保存・下書きなし・一括 upsert）
5. ✅ デプロイ → **V-MINT=`v3` / V-PEACH=`v2` の保険ブランチ**で進め、go-live で本番へマージ（ブランチ事前作成はせず A 案 = 初回 push で自動生成）
6. ✅ レガシー除去 → **go-live 後の P7（§5-2）** で旧ピボット RPC・移行シムを破壊的に撤去（共有 DB ゆえ本番切替後に限定）
7. ✅ 進捗管理 → 本書を**帳票化**（§5 状態列＋§5-1 チェックリスト）。各フェーズ着手・完了で更新

### 8-2. 付録: 却下案の要旨（記録用）
- **RPC B1（ピボット維持＋手順書）**: 実装ゼロだが店舗追加のたび SQL 手作業が残り、スケール目的に反するため却下。
- **RPC B3（動的 SQL / crosstab）**: 型不定・デバッグ難。行ベース化（4-2）の方が素直なため却下。
- **フロント C3（色・特例のフルメタ化）**: 4-5 店舗規模ではオーバーキル。辞書アクセス化＋シフトルールのデータ化で十分。
- **GUI を V-MINT `AdminApp` に置く案**: 各店固有情報を多く持つのは V-PEACH のため、V-PEACH 集約の方が二重設定を生まない（R5）。

## Related
- [[V-PEACH/notes/V-PEACH_architecture]]
- [[V-PEACH/notes/V-PEACH_supabase-er-diagram]]
- [[V-MINT2.0/notes/V-MINT2.0_supabase-er-diagram]]
- [[V-PEACH/DECISIONS]]

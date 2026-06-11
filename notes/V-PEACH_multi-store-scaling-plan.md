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

> ステータス: **実装計画（確定・着手前）** / 作成 2026-06-01 / 最終更新 2026-06-11
> 進捗: **P1・P2 ✅ 完了（2026-06-11）**／P0 ⏸️ 保留（初回 subtree push 時に実施）／**P3 🟡 実装完了・回帰スモーク待ち**（2026-06-11 全実装タスク完了。§5-4 体制で Sonnet×2＋Opus×1 サブエージェント並列実装 → Fable レビュー・ビルド検証。残はつーくんの画面スモークのみ）／P4〜P7 ⬜ 未着手。最新は §6 進捗帳票を参照。
> 開発・運用方針（2026-06-11 追加）: 本改修は **当面 obsidian-vault ローカル `multi-store` ブランチでのみ進め**（§5-1）、既存版（V-MINT `v2` / V-PEACH `main`）へのバグフィックスは `main` ブランチから従来どおり `/vmint-deploy`・`/vpeach-deploy` で対応する（§5-2）。Supabase 上の SQL 実行は **Supabase MCP 経由で Claude Code が直接実行**する運用に切替え、つーくんの手作業実行をなくす（§5-3）。
> 対象: V-MINT2.0・V-PEACH 両アプリ（`stores` テーブル共有のため一体で実装）
> ゴール: 新店舗オープン／既存店舗の閉店を、つーくん（管理者）が **GUI からできる限り完結** して扱えるようにする。SQL 手作業ゼロ・1 か所登録で両アプリ反映。
> 進め方: 本ドキュメントを正本とし、§6 のフェーズ順に実装する。各フェーズの着手・完了で §6 の状態列とチェックリストを更新し、`CHANGELOG_DEV.md` にも記録する。

## 1. 背景・目的

現行は新店舗が増えると Supabase（RPC のピボット定義）からフロント（店舗キーのハードコード）まで**広範囲の改修**が必要で、店舗事業のスケールに追従できない。今後の出店・閉店に備え、店舗マスタの増減を構造的に吸収できる設計へ移行する。

本改修は **DB・RPC・フロント・GUI の 4 層** に及ぶ大規模改修のため、本番への即時反映を避け、**専用デプロイブランチ**で進める（§5-2）。

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
> シフト計算時は `effective_from <= periodKey` の最新世代を採用（`getActiveStoreSettings` と同方式）。既定値は現行標準（**早番7.5h / 中番6h / 遅番6h**、馬場2号店のみ遅番・土日祝=7.5h。※当初の「早番6h/中番7.5h」表記は実態と逆だったため `pe_hrmos_segments` 実データ・`shiftImporter.js` 準拠に訂正）を初期世代 `effective_from=202512` として SEED 再現済み（P1）。`shiftImporter.js` はこのテーブル参照に置換しハードコードを撤廃（P3）。

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

> **移行は別名並走で安全に。** 新形式 RPC を `*_v2` 等の別名で並走させ、既存 4 店舗で旧出力と JSON 差分ゼロを確認してから切替える（§6 P2）。

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

## 5. 開発・運用環境（本改修中の作業基盤）

本改修は規模が大きく、通常運用と並行して安全に進めるための作業基盤を **4 点で定義**する。**(1) ローカル ブランチでマルチストア改修コミットを既存版と物理的に分離**（§5-1）、**(2) 本番リポジトリへの subtree push 先を保険ブランチに切り替えて本番 URL を無傷に保つ**（§5-2）、**(3) Supabase 上の SQL 実行を MCP 経由で Claude Code に直接行わせ、つーくんの手作業実行をなくす**（§5-3）、**(4) 実装・調査をモデル別サブエージェントへ委譲し、メインスレッド（Fable）は戦略・レビュー・コミット・DB 書き込みに徹してトークンを節約する**（§5-4）。§6 の実装フェーズはこの環境で進める。

### 5-1. ローカル ブランチ運用（multi-store / main 分離）

#### 5-1-1. 問題の構造

現行 `/vmint-deploy`・`/vpeach-deploy` は内部で `git subtree push --prefix=... HEAD ...` を実行する。`subtree push` は **HEAD のサブツリー履歴を丸ごと分割して送る** ため、同じ obsidian-vault `main` 上にマルチストア改修コミットとバグフィックス コミットが混在していると、バグフィックスを push するつもりが**マルチストア改修も巻き込んで本番（V-MINT `v2` / V-PEACH `main`）に飛ぶ**。「特定コミットだけ除外して subtree push」を毎回手作業でやるのは非現実的。

要件を整理:
- (A) マルチストア改修は **当面 obsidian-vault ローカルにのみ存在**。`origin/main`（obsidian-vault GitHub）にも、本番リポジトリ（V-MINT/V-PEACH）にも、保険ブランチ（V-MINT `v3` / V-PEACH `v2`）にも **一切 push しない**
- (B) 既に本番（V-MINT `v2` / V-PEACH `main`）にデプロイ済みのバージョンに対するバグフィックスは、いつでも本番へ push できる
- (C) ブランチ操作のコストは小さく、Obsidian Vault 全体（IOA / Erika / LIFE 等の他プロジェクト）の作業も止めない

#### 5-1-2. 採用方針: obsidian-vault に `multi-store` トピックブランチを切る

```
obsidian-vault
  main         …… 既存版の保守用。バグフィックス・他プロジェクト作業もここ。push 先 origin/main、subtree push 元
  multi-store  …… マルチストア改修専用。push 禁止（ローカル限定）
```

**運用ルール（タスク種別ごと）:**

| やること | ブランチ | コミット | デプロイ |
|----------|---------|----------|---------|
| V-MINT/V-PEACH の既存版バグフィックス | `main` | OK | `/vmint-deploy` or `/vpeach-deploy` |
| 他プロジェクト（IOA 等）の作業 | `main` | OK（従来通り）| 各 deploy スキル |
| マルチストア改修（DB マイグレーション / RPC / フロント刷新等） | `multi-store` | OK | **push しない**（ローカルのみ） |
| マルチストア改修ブランチへバグフィックスを取り込む | `multi-store` | `git merge main` で随時 | — |

**ポイント:**
- `main` には**マルチストア改修コミットを一切入れない**ことだけ徹底すれば、`/vmint-deploy`・`/vpeach-deploy` は従来通り安全に動く（HEAD = main の subtree push なのでマルチストア コミットは含まれない）。
- 逆方向（`multi-store` → `main` への merge）は go-live（P6）まで行わない。
- §5-2 の保険ブランチ（V-MINT `v3` / V-PEACH `v2`）への push は、ローカル検証が一巡してから手動で `git subtree push --prefix=V-MINT2.0 V-MINT v3` 等を打つ。**スラッシュ コマンドはこの期間使わない**。

#### 5-1-3. 具体手順

**初回セットアップ（1 回だけ）:**
```bash
git -C "C:\Obsidian Vault" checkout -b multi-store main
git -C "C:\Obsidian Vault" checkout main   # デフォルトは main に戻しておく
```

**マルチストア改修を進めるとき:**
```bash
git -C "C:\Obsidian Vault" checkout multi-store
# … 編集・コミット …
# push しない。ローカルのみ
```

**バグフィックスを本番へ反映するとき:**
```bash
git -C "C:\Obsidian Vault" checkout main
# … 編集・コミット …
# 通常通り /vmint-deploy または /vpeach-deploy
```

**マルチストア ブランチへバグフィックスを取り込む（任意のタイミング）:**
```bash
git -C "C:\Obsidian Vault" checkout multi-store
git -C "C:\Obsidian Vault" merge main
# コンフリクトを解消してコミット
```

#### 5-1-4. 誤爆防止策（推奨）

「`multi-store` ブランチにいるまま `/vpeach-deploy` を打つ」事故を防ぐため、以下のいずれかを入れておく:

1. **デプロイ スラッシュ コマンドの先頭にブランチ ガードを追加**（推奨）
   `.claude/commands/vmint-deploy.md` / `.claude/commands/vpeach-deploy.md` の手順 1 の前に「現在ブランチが `main` であることを確認、`main` 以外なら中止」を明文化する。実体は:
   ```bash
   git -C "C:\Obsidian Vault" rev-parse --abbrev-ref HEAD
   # 出力が main でなければ手順を中止し、ユーザーに通知
   ```

2. **`pre-push` フック**（保険）
   obsidian-vault `.git/hooks/pre-push` で、push 先 remote が `V-MINT` or `V-PEACH` のとき送信ブランチ名（`v2`/`main`）と現在ブランチが `main` でない場合は reject する。ただし `git subtree push` は内部で split → push のため、フックが期待通り発火しないケースがあるので確実性は (1) の方が高い。

3. **ローカル ブランチ名を派手にする**（補助）
   `multi-store` の代わりに `multi-store-DO-NOT-PUSH` のような視認性の高い名前にして、ターミナル プロンプトでうっかり押下を防ぐ。

#### 5-1-5. 他案との比較（記録用）

| 案 | 概要 | 採否 | 理由 |
|----|------|:----:|------|
| **A. トピック ブランチ分離（本採用）** | obsidian-vault に `multi-store` を切り、`main` ＝バグフィックス専用 | ✅ | git 基本操作だけで完結。デプロイは「main にいることだけ」確認すれば既存スキルがそのまま使える |
| B. `git worktree` 分離 | `C:\Obsidian Vault.multistore` を `multi-store` ブランチで worktree 化 | △ 併用可 | ブランチ切り替え不要で並行作業しやすい。ただし node_modules・`.env` の二重管理、Obsidian アプリは元 Vault しか開けない等の手間あり。**並行作業要求が強くなったら採用検討** |
| C. cherry-pick で release ブランチ構築 | 全部 `main` で作業、デプロイ時にバグフィックス コミットだけ `release/v-mint` 等に cherry-pick して subtree push | ❌ | コミット分類のミスで本番へマルチストア コミットが漏れるリスク高。継続運用コストが大きい |
| D. 履歴フィルタで subtree push 時にマルチストア コミットを除外 | `subtree split` + `rebase --onto` で都度フィルタ | ❌ | 操作が複雑・属人化、デプロイのたびに事故リスク |
| E. `main` 上に置いたまま subtree push の対象コミット範囲を毎回手動指定 | `git subtree push` は HEAD 固定で範囲指定不可。実質不可 | ❌ | そもそも git subtree の機能では実現できない |

#### 5-1-6. このブランチ運用と §5-2「デプロイ ブランチ戦略」の関係

両者は **直交する別レイヤー**:
- **§5-1（本節）= obsidian-vault 側のローカル ブランチ運用**。マルチストア コミットの混入を防ぐ
- **§5-2 = サブツリー push 先（本番リポジトリ側）のブランチ運用**。プレビュー扱いで本番 URL を無傷に保つ

整理すると:
- ローカル検証中（当面）: `multi-store` ブランチ ＋ **push なし**
- ローカル検証が一通り済んで Cloudflare プレビューで確認したくなったら: `multi-store` から `git subtree push --prefix=V-MINT2.0 V-MINT v3` / `git subtree push --prefix=V-PEACH V-PEACH v2` を**明示的に手打ち**
- go-live（P6）: `multi-store` を `main` にマージしてから本番ブランチ（V-MINT `v2` / V-PEACH `main`）へ反映

§5-2 の **`v3` / `v2` 保険ブランチへの push は当面しない**（ユーザー希望「暫くはローカルで改修」）ため、§6 の P0 タスク「初回 push で `v3` / `v2` 自動生成」は時期未定として保留扱いとする。

#### 5-1-7. タスクチェックリスト（ローカル ブランチ運用）

- [x] `multi-store` ブランチを作成（2026-06-11）
- [x] 既定ブランチが `main`、マルチストア作業は明示的に `multi-store` チェックアウト、を運用ルールとして本書 §5-1-2 で合意
- [x] `.claude/commands/vmint-deploy.md` / `vpeach-deploy.md` 冒頭に「現在ブランチが `main` か」ガードを追加（§5-1-4 案 1・2026-06-11。両ファイルは未追跡運用のため git 管理外のまま）
- [x] `multi-store` ブランチで初回コミット（P1 マイグレーション SQL `V-PEACH/supabase/DB_MIGRATION_multi_store_p1_20260611.sql`・2026-06-11）

### 5-2. デプロイ ブランチ戦略（保険ブランチ v3 / v2 → 本番）

#### 5-2-1. 現行（本番）

| アプリ | remote | 本番ブランチ | デプロイ |
|--------|--------|------------|---------|
| V-MINT2.0 | `V-MINT`（daiki100325/V-MINT） | **`v2`** | `git subtree push --prefix=V-MINT2.0 V-MINT v2` |
| V-PEACH | `V-PEACH`（daiki100325/V-PEACH） | **`main`** | `git subtree push --prefix=V-PEACH V-PEACH main` |

Cloudflare Pages は **本番ブランチをビルド**して本番 URL に出す。

#### 5-2-2. 本改修中（保険ブランチ）

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

#### 5-2-3. ⚠️ 最重要: Supabase は本番・プレビューで共有

Cloudflare のプレビューと本番は **同一 Supabase プロジェクトを参照**する。よって **DB マイグレーション（P1）は本番にも即時反映される**。プレビューだから安全、ではない。
- → P1 は **additive（列追加・新テーブルのみ）で既存 4 店舗が壊れないこと**を厳守。`DROP` / 破壊的変更は go-live まで行わない。
- → RPC（P2）も**別名並走**で旧関数を残し、本番フロント（v2/main）が壊れないようにする。
- → 既存フロント（本番）と新フロント（プレビュー）が**同じ DB を同時に読む**期間がある前提で、後方互換を設計する。
- → §5-3 の **Supabase MCP 経由実行**でも同じ前提が効く（MCP の実行先 = この共有プロジェクト）。破壊的 SQL は §5-3-4 の手順で承認後に限定。

#### 5-2-4. 本番反映（go-live・P6）

検証完了後にブランチを本番へマージ:
```bash
# V-MINT: v3 → v2（本番）
git -C "C:\Obsidian Vault" push V-MINT V-MINT/v3:v2   # もしくは subtree push --prefix=V-MINT2.0 V-MINT v2
# V-PEACH: v2 → main（本番）
git -C "C:\Obsidian Vault" push V-PEACH V-PEACH/v2:main
```
> 反映後のスモーク（PIN + 1 店舗 PL / 在庫 1 モード）で確認。不要になった RPC 旧関数等の破壊的後片付けは **P7（§6-2）** で別マイグレーションとして実施する。

### 5-3. Supabase MCP の活用（SQL 直接実行の自動化）

#### 5-3-1. 目的

本改修は Supabase 上で実行する SQL の量が多い: **P1**（DDL: `stores` 列追加・`pe_store_shift_rules` / `app_ui_settings` 新設・SEED）、**P2**（行ベース新 RPC `*_v2` の作成と 4 店舗での差分検証）、**P4**（`create_store_atomic` RPC・店舗追加トランザクション）、**P7**（旧ピボット RPC の `DROP` と別名 RPC のリネーム）。

現状は Claude Code が SQL を生成し、つーくん が Supabase Studio で 1 本ずつ手作業実行している。これにより:
- 所要時間が伸び、Claude Code 側の検証ループ（実行 → 結果確認 → 次の修正）が分断される
- 転記ミス・SQL 漏れ・実行順序ミスのリスクが発生する
- 差分検証（P2 の `*_v2` ↔ 旧 RPC の出力突合）など反復実行が多い検証で特に負担が大きい

**Supabase MCP を Claude Code に接続し、Claude Code が直接 SQL／RPC を実行**できる状態にする。つーくんの手作業実行工程をなくし、生成 → 実行 → 結果検証を 1 ループで回せるようにする。

#### 5-3-2. 前提・スコープ

- 接続先プロジェクト: V-MINT2.0・V-PEACH が共有する 1 つの Supabase プロジェクト（プレビュー・本番で共通／§5-2-3）
- ⚠️ **本プロジェクトはプレビュー・本番で共有**。MCP で実行する SQL は本番にも即時反映される — 破壊的操作には必ず人の確認を介在させる（§5-3-4）
- 必要ツール権限: 読み取り（`execute_sql` で `SELECT`）、書き込み（DDL/DML）、マイグレーション適用。プロジェクト管理（プロジェクト作成・削除）は不要
- 適用範囲: 本プラン §6 の P1〜P7 全フェーズで使用。GUI（V-PEACH `SettingsApp`）からの実運用 CRUD は MCP ではなく通常のフロント → PostgREST 経路で行う（MCP は **開発期間中の SQL 実行手段**であって、本番アプリのデータ経路ではない）

#### 5-3-3. セットアップ手順（つーくん側の準備）

1. **Supabase で Personal Access Token（PAT）を発行**
   - Supabase ダッシュボード → Account → Access Tokens → 新規作成（用途名: `claude-code-mcp` 等）
   - 表示された PAT を `Bitwarden`（または 1Password）の `Supabase / Claude Code MCP PAT` レコードに保管
2. **プロジェクト `ref`（プロジェクト ID）を確認**
   - Supabase ダッシュボード → 該当プロジェクト → Settings → General → Reference ID をコピー
3. **Claude Code に Supabase MCP サーバーを登録**
   - 設定ファイル: `C:\Obsidian Vault\.mcp.json`（リポジトリ ルートのプロジェクト共通 MCP 設定。既存 `.cursor/mcp.json` は Cursor 専用なので別物）
   - 公式実装: `@supabase/mcp-server-supabase`（npx 経由で実行）
   - 例（PAT は環境変数 `SUPABASE_ACCESS_TOKEN` 経由で渡す）:
     ```json
     {
       "mcpServers": {
         "supabase": {
           "command": "npx",
           "args": [
             "-y",
             "@supabase/mcp-server-supabase",
             "--project-ref=<プロジェクト ref>"
           ],
           "env": {
             "SUPABASE_ACCESS_TOKEN": "<PAT>"
           }
         }
       }
     }
     ```
   - `.mcp.json` は **obsidian-vault リポジトリにコミットしない**（`.gitignore` に追記。PAT を平文で保存するため）。代替として PAT を OS 環境変数（`$env:SUPABASE_ACCESS_TOKEN`）または Windows 資格情報マネージャー経由で読ませる構成も可
4. **Claude Code を再起動** → 起動時に MCP サーバーが立ち上がり、`mcp__supabase__execute_sql` 等のツールが利用可能になる
5. **接続テスト**（読み取り限定）
   - `select 1` → 1 行
   - `select count(*) from stores` → 既存 4 件
   - `select store_key, name from stores order by id` → office / baba_main / nakano / baba_2nd 確認
6. **書き込みテスト**（無害な additive・即取消）
   - `comment on table stores is 'multi-store scaling MCP test'` → 実行 → `comment on table stores is null` で取消
7. **ドキュメント同期**
   - `V-PEACH/notes/V-PEACH_architecture.md` の開発環境節に「Supabase 操作は MCP 経由で Claude Code が直接実行」を明記
   - `V-PEACH/CHANGELOG_DEV.md`・`V-MINT2.0/CHANGELOG_DEV.md` にセットアップ完了を記録

#### 5-3-4. 運用ルール（つーくん × Claude Code）

| 操作種別 | 例 | Claude Code の挙動 |
|---------|-----|-----------------|
| **読み取り**（参照のみ） | `SELECT` / `EXPLAIN` / スキーマ参照 | 自由実行・結果を要約して報告 |
| **書き込み（additive）** | `CREATE TABLE` / `ALTER TABLE ADD COLUMN` / `INSERT` / `UPDATE` / `CREATE FUNCTION` | SQL を提示 → つーくん 承認 → 実行 → 影響行数・エラーを報告 |
| **破壊的** | `DROP` / `TRUNCATE` / WHERE なし `DELETE` / `ALTER ... DROP COLUMN` | 上記に加え **(a) 対象行数 SELECT を先に実行・件数報告、(b) FK 参照元の明示、(c) ロールバック手順** をセットで提示してから承認・実行 |
| **マイグレーション一式** | P1/P2/P4/P7 の SQL 群 | SQL ファイルを `supabase/migrations/` 配下に保存しつつ MCP で実行 — DB（実体）とリポジトリ（ER 図・`architecture` notes）の同期を保つ |

破壊的 SQL は §5-2-3 の通り本番 DB に即時反映される。**P7（旧 RPC `DROP`）は go-live 完了（P6）後にのみ実行する**（順序ルール再掲）。

#### 5-3-5. タスクチェックリスト（MCP セットアップ）

- [x] Supabase PAT 発行・保管（つーくん・2026-06-11）
- [x] プロジェクト `ref` 確認（つーくん）
- [x] `C:\Obsidian Vault\.mcp.json` に `mcpServers.supabase` 追記（PAT は env 経由）
- [x] `.gitignore` に `.mcp.json` を追加（PAT 漏洩防止。未追跡であることを確認済み）
- [x] Claude Code 再起動 → MCP サーバー起動・ツール一覧確認（2026-06-11 接続確認済み）
- [x] 読み取り テスト（テーブル一覧 26 件・`stores` 4 件・キー名確認）
- [x] 書き込み テスト（`comment on table` の代わりに RLS 有効化マイグレーション `enable_rls_stg_and_pe_monthly_company` を実適用して確認）
- [x] 運用ルール（読み取り自由 / 書き込み承認 / 破壊的二重確認）を本書 §5-3-4 で合意
- [x] `notes/V-PEACH_architecture.md` に MCP 利用方針を反映（デプロイフロー節の直後・2026-06-11）
- [x] `V-PEACH/CHANGELOG_DEV.md`・`V-MINT2.0/CHANGELOG_DEV.md` にセットアップ完了を記録

#### 5-3-6. 進捗

> **ステータス凡例:** ⬜ 未着手 ／ 🟡 進行中 ／ ✅ 完了 ／ ⏸️ 保留・ブロック
> §6 の各フェーズで MCP を実行手段として使うときは、ここの状態行と §6 のチェックボックス両方を更新する。

| 項目 | 状態 | 完了日 | メモ |
|------|:----:|:------:|------|
| MCP セットアップ完了 | ✅ | 2026-06-11 | §5-3-5 チェックリスト 全 ✅ |
| P1 マイグレーション（DDL／SEED）を MCP 経由で実行 | ✅ | 2026-06-11 | migration `multi_store_p1_stores_shift_rules_app_ui_settings`。既存 RPC 4 本の正常応答確認済み |
| P2 行ベース新 RPC（`*_v2`）作成・差分検証 | ✅ | 2026-06-11 | migration `multi_store_p2_rpc_v2_parallel`。全期間（202512〜202606）×3関数で差分ゼロ PASS |
| P4 `create_store_atomic` RPC の定義 | ⬜ | — | §6 P4 と連動 |
| P7 旧ピボット RPC の `DROP`・別名リネーム | ⬜ | — | §6 P7 と連動。**P6 完了が前提条件**（§5-2-3／§5-3-4 破壊的） |

### 5-4. サブエージェント活用（モデル分担・トークン節約／2026-06-11 追加）

#### 5-4-1. 方針

実装フェーズでは Claude Code の Agent ツール（サブエージェント）を活用し、メインスレッド（Fable）は**戦略策定・タスク分解・成果物レビュー・コミット・DB 書き込み**に徹する。手数の多い実装・調査は安価なモデルのサブエージェントへ委譲し、メインスレッドのトークン消費を抑える（サブエージェントはファイル読込・試行錯誤を自分のコンテキストで消化し、結論と diff だけを返す）。

| 役割 | 担当 | 例 |
|------|------|-----|
| 戦略・タスク分解・レビュー・コミット・DB 書き込み | **Fable（メインスレッド）** | 仕様確定、diff レビュー、MCP 経由 SQL 実行、ドキュメント同期 |
| 自己完結な実装・調査 | **Sonnet サブエージェント** | P2 `*_v2` RPC 草案、P3 単一コンポーネントの辞書アクセス化 |
| 難度の高いリファクタ | **Opus サブエージェント** | `shiftImporter.js` の `pe_store_shift_rules` 参照化 |
| 広域検索・棚卸し | **Explore エージェント** | 店舗キー直書き箇所の網羅スキャン（§3-3 の潰し込み） |
| 重量級・高リスク実装 | **Fable（メインスレッド）** | `create_store_atomic` RPC、P2/P6 の切替判断 |

#### 5-4-2. ガードレール（必須）

1. **DB 書き込み禁止**: サブエージェントに MCP の書き込み（DDL/DML/マイグレーション適用）を実行させない。SQL 草案・検証クエリの**作成**まで。実行は §5-3-4 のルールに従い Fable が行う
2. **コミット禁止**: サブエージェントは編集のみ。`git commit` は Fable がレビュー後に実行する（ブランチ誤爆・未レビューコード混入の構造的防止）
3. **自己完結タスクで委譲**: サブエージェントは毎回コンテキストゼロで起動するため、対象ファイル・仕様・完了条件をプロンプトに明記する。数行の小修正は Fable が直接行う（起動固定コストの方が高い）

## 6. 実装フェーズ（進捗帳票）

> **ステータス凡例:** ⬜ 未着手 ／ 🟡 進行中 ／ ✅ 完了 ／ ⏸️ 保留・ブロック
> 各フェーズ完了時に本表の状態・完了日を更新し、`CHANGELOG_DEV.md` にも記録する。詳細タスクは §6-1 のチェックリストで追う。SQL 実行は §5-3 の MCP 経由を標準とする。

| Phase | 状態 | 完了日 | 内容 | 完了条件 |
|-------|:----:|:------:|------|---------|
| **P0** | ⏸️ | — | **デプロイブランチ準備（§5-2）**。A 案採用につき事前作成はせず、**P1 の初回 subtree push 時に V-MINT `v3` / V-PEACH `v2` を自動生成**。以後この改修の push 先を本番ブランチから切り離す | 両ブランチが生成され、Cloudflare で非本番（プレビュー）扱いと確認 |
| **P1** | ✅ | 2026-06-11 | DB: `stores` に `is_active` / `display_order` / `store_type` / `closed_at` 追加。`pe_store_shift_rules`・`app_ui_settings` 新設＋既定値 SEED。既存 4 店舗を移行（`office` は `store_type='office'`）。実行は §5-3 MCP 経由 | マイグレーション適用・既存動作不変（後方互換） |
| **P2** | ✅ | 2026-06-11 | RPC を 4-2（行ベース）へ再設計。**新形式を別名並走させ 4 店舗で旧出力と差分ゼロを検証**してから切替。検証クエリは MCP で反復実行（§5-3） | 既存 RPC 利用箇所が全て新形式で同値 |
| **P3** | 🟡 | — | フロント: `getStores()` 起点で店舗リスト・stock 辞書アクセス・色／名前マップを両アプリで動的化。`office` 特例を `store_type` 分岐へ。`shiftImporter` を `pe_store_shift_rules` 参照に刷新 | 4 店舗で全モード回帰なし |
| **P4** | ⬜ | — | V-PEACH `SettingsApp` に店舗管理 GUI（追加ウィザード＝マスタ＋固定費＋シフトルール必須入力・一発確定で一括 upsert／`create_store_atomic` RPC・休止トグル・並べ替え・キー作成時ロック） | GUI から店舗追加→V-MINT 含む全モードに自動反映 |
| **P5** | ⬜ | — | 休止店舗の全社一括表示トグル（`app_ui_settings` 連動）。`closed_at` 以降を集計から**明示除外**（按分分母含む）。`csvImporter` を `stores.name` 由来へ動的化 | 休止店舗の過去 PL/在庫が決算時に閲覧可・按分に休止店舗が混ざらない |
| **P6** | ⬜ | — | **本番反映（go-live）**。全テスト完了後に V-MINT `v3→v2`、V-PEACH `v2→main` をマージ（§5-2-4） | 本番 URL に反映・スモーク確認完了 |
| **P7** | ⬜ | — | **レガシー除去（go-live 後）**。別名並走で残した旧ピボット RPC・移行用シム・不要カラムを破壊的マイグレーションで撤去（§6-2）。実行は §5-3 MCP 経由（破壊的ルール適用） | 旧要素を全削除・本番回帰なし・ドキュメント最終同期 |

> **検証戦略:** P2 が最大の回帰リスク。新形式 RPC を別名関数で並走させ、既存 4 店舗で旧出力と JSON 差分ゼロを確認してから切替えるのが安全。
> **P7 の順序根拠:** Supabase は本番・プレビュー共有（§5-2-3）。go-live（P6）までは本番フロントが旧 RPC を使うため、レガシー除去は **必ず P6 の後**。先に消すと本番が壊れる。

### 6-1. フェーズ内タスクチェックリスト

進捗はこのチェックボックスで管理する（着手時 🟡 / 完了時 ✅ を §6 表へ反映）。

**P0 — ブランチ準備（A 案）**
- [ ] P1 の初回 push で V-MINT `v3` が生成されることを確認
- [ ] P1 の初回 push で V-PEACH `v2` が生成されることを確認
- [ ] Cloudflare で v3 / v2 が非本番（プレビュー）として扱われることを確認

**P1 — DB マイグレーション（実行は §5-3 MCP 経由）** — ✅ 2026-06-11 完了
- [x] `stores` 列追加（`is_active` / `display_order` / `store_type` / `closed_at`）＋ `store_type` CHECK 制約
- [x] `pe_store_shift_rules` 作成 ＋ RLS（anon 全許可）
- [x] `app_ui_settings` 作成 ＋ RLS（anon 全許可）＋ シングルトン行（`id=1`）投入
- [x] SEED: 既存 4 店舗の `display_order`（office 0 → baba_main 1 → nakano 2 → baba_2nd 3）/ `store_type`（`office` は `office`）
- [x] SEED: `pe_store_shift_rules` 既定値 18 行（早番7.5h / 中番6h / 遅番6h ＋ 馬場2号店 遅番・土日祝=7.5h、`effective_from=202512`）
- [x] 既存動作の回帰 — SQL/RPC レベルで確認済み（`fetch_stock_overview` 等 4 RPC が正常応答・additive のみで既存列不変）。アプリ画面のスモークはつーくん確認推奨
- [x] ドキュメント同期（両 `supabase-er-diagram` / `architecture`）

**P2 — RPC 行ベース化（実行・差分検証は §5-3 MCP 経由）** — ✅ 2026-06-11 完了（§5-4 体制の初運用: Sonnet 草案 → Fable レビュー・適用・検証・切替）
- [x] 行ベース新関数を別名（`*_v2`）で作成 — `fetch_transfer_flavors_v2` / `fetch_request_inventory_data_v2` / `fetch_dashboard_stock_overview_v2` の3関数（`jsonb_object_agg` で店舗キー動的化。dashboard は固定4カラム→`stocks jsonb`）。`fetch_stock_overview` ほか10関数はハードコードなしのため v2 不要と判定
- [x] 旧→新の出力差分ゼロ検証（4 店舗・全 period 202512〜202606）— 3関数×全期間で mismatch 0・全 PASS
- [x] フロントの呼び出しを新関数へ切替（`src/api.js` 3箇所・旧関数は残置・vite build 確認済み）
- [x] ドキュメント同期（`supabase-er-diagram` の RPC 節・`V-MINT2.0/DECISIONS` ADR-20260611-01 を Accepted 化）

**P3 — フロント動的化**
- [x] `getStores()` 拡張（2026-06-11）— 新4列（`is_active` / `display_order` / `store_type` / `closed_at`）取得・`display_order` 順・office 含む全行返却。V-PEACH は既存関数を拡張、V-MINT2.0 は新設（従来 getStores 自体が存在しなかった）。両アプリ vite build 確認済み
- [x] 店舗リスト直書き撤廃（`App.vue`×2 / `TransferApp` / `RequestApp`）✅ 2026-06-11 — 全リストを `getStores()`/`getStoresCached()` 由来へ。UI キー＝DB `store_key` に統一（旧 `'baba'` は `normalizeStoreKey` シム＋localStorage ドラフト移行で吸収）。取得失敗時は現行4店舗の固定フォールバックで継続
- [x] stock 辞書アクセス化（`RequestApp` / `TransferApp` / `api.js`）✅ 2026-06-11 — `item.stock.office` 等の直アクセスを店舗リスト駆動の `stock[store_key]` ループへ。`getDashboardStockOverview` の `storeStocks` は固定4キー詰め替えを廃止し DB store_key の動的パススルーに
- [x] 色・名前マップの動的化 ✅ 2026-06-11 — `V-MINT2.0/src/utils/storeDisplay.js` 新設（`storeBadgeColor`＝display_order 位置ベースのパレット・既存4店舗の配色維持／`storeNameByKey`＝stores.name 由来）。RequestApp/TransferApp の固定マップ撤廃
- [x] `office` 特例 → `store_type==='office'` 判定へ統一 ✅ 2026-06-11 — App.vue/CostApp/DashboardApp/InventoryApp/RequestApp に `isOfficeStore` 等の computed を導入し `key==='office'` リテラル比較を全廃（`store_type==='office'` の DB 値比較・シムのみ残置）
- [x] `shiftImporter` を `pe_store_shift_rules` 参照に刷新（馬場2号店ハードコード撤廃）✅ 2026-06-11（`getStoreShiftRules()` 追加・`STORE_KEYS` 撤廃・補正の世代ルール化・InputApp 追従。SEED が現行再現のため回帰ゼロ）
- [ ] 4 店舗で全モード回帰（実装は 2026-06-11 完了・両アプリ vite build PASS・店舗キー直書きの残骸ゼロを grep 確認済み。**つーくんの画面スモーク待ち**: V-MINT 棚卸し/移動/発注/ダッシュボード・V-PEACH PL/シフトCSV取込）

**P4 — 店舗管理 GUI（V-PEACH SettingsApp）**
- [ ] 店舗管理セクション（一覧 / 名称編集 / `is_active` トグル / 並べ替え / 確認ダイアログ）
- [ ] 追加ウィザード（`name`+`key` / 固定費 / シフトルールを必須入力）
- [ ] `create_store_atomic` RPC（一括 insert・失敗時ロールバック・§5-3 MCP 経由で定義）
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

**P7 — レガシー除去（go-live 後）** → §6-2
- [ ] 旧ピボット RPC 関数を `DROP`（§5-3 MCP 経由・破壊的ルール）
- [ ] 別名（`*_v2`）を正式名へリネーム／統一
- [ ] キー正規化（`baba`→`baba_main`）の要否判断・整理
- [ ] 不要カラム・移行用シムの撤去
- [ ] 破壊的後片付けマイグレーション適用・本番回帰
- [ ] ER 図 / `architecture` notes の最終同期

### 6-2. P7 レガシー除去の対象（go-live 後にのみ実施）

後方互換のために P1〜P5 で残置した要素を、本番が新実装に切り替わった後（P6 完了後）にまとめて撤去する。

| 対象 | 残置理由（互換） | 除去内容 |
|------|----------------|---------|
| 旧ピボット RPC（`fetch_stock_overview` 等の CASE 版） | go-live まで本番フロントが使用 | 新 `*_v2` へ完全移行後に `DROP FUNCTION` |
| RPC 別名 `*_v2` | 並走検証用の暫定名 | 正式名へリネーム（または旧名を置換）し命名を一本化 |
| キー正規化 `baba`→`baba_main` | UI キーと DB `store_key` の歴史的不一致 | 整理可能か判断（リスク高なら据え置き可・要記録） |
| 移行用シム・暫定フォールバック | 切替期間の保険 | 不要分を削除 |

> **鉄則:** P7 は破壊的変更を含むため、**P6（go-live）とスモーク確認の完了を前提条件**とする。共有 DB ゆえ、本番フロントが旧 RPC を参照しなくなったことを確認してから着手する。MCP 経由実行時は §5-3-4 の破壊的ルール（対象行数 SELECT・FK 影響・ロールバック手順）をセットで提示してから承認・実行する。

## 7. リスク・留意点

- **DB 共有の即時反映（§5-2-3）**: プレビュー≠DB分離。P1/P2 は後方互換必須。破壊的変更は go-live 後。
- **MCP 経由実行のリスク（§5-3）**: Claude Code が直接 DB に書ける状態となるため、破壊的 SQL は §5-3-4 の手順（対象件数 SELECT・FK 影響・ロールバック）を**セットで提示→承認→実行**を死守。読み取り自由・書き込み承認・破壊的二重確認のレイヤーを崩さない。
- **`store_key` の不変性**: 一度発行したキーは変更不可。GUI のキー入力は作成時のみ・以後ロック。`name` は自由に編集可。
- **`office` の特殊性**: `store_type`（`office` / `shop`）で明示分類し、暗黙の `key==='office'` 比較を撲滅。店舗マスタ管理（V-PEACH）は `shop` のみ対象。
- **単一情報源（V-PEACH）の前提**: 店舗 CRUD は V-PEACH のみ。V-MINT 側で `stores` を書く経路を作らない（書き込み口の一本化）。
- **追加フローのアトミック性（一発確定）**: 複数テーブルへ書くため、確定時の一括処理で「`stores` だけある半端な店舗」を絶対に生まない。理想は `create_store_atomic` RPC で一括 insert・失敗時ロールバック。
- **RPC 並走検証コスト**: P2 切替は出力形式が変わる。フロント追従と同時にやると切り分けが難しい。関数並走＋差分検証を必須に。MCP 経由で反復実行できる利点を活かす。
- **閉店店舗の集計除外（明示除外）**: `closed_at` 以降は PL・在庫・人件費按分の対象から明示除外。特に `pe_monthly_company_records` の按分分母に休止店舗の枠数が混ざらないことを検証。
- **ブランチ誤爆**: `multi-store` に居るまま `/vmint-deploy`・`/vpeach-deploy` を打つと、本番に未完成コードが飛ぶ。§5-1-4 のブランチ ガードを必ず先に入れる。
- **YAGNI**: 色のフル メタ化は現規模では過剰。辞書アクセス化＋シフトルールのデータ化で十分スケールする。

## 8. 決定事項ログ・付録

### 8-1. 決定事項（2026-06-01〜2026-06-11）

1. ✅ 休止トグルの状態 → **DB 共有**（`app_ui_settings` 中立シングルトン・両アプリ連動）
2. ✅ `pe_store_shift_rules` → **改定履歴あり**（`effective_from` 世代管理）
3. ✅ 閉店店舗 → **明示除外**（`closed_at` 以降を集計・按分から除外）
4. ✅ 追加フロー → **一発確定のみ**（途中保存・下書きなし・一括 upsert）
5. ✅ デプロイ → **V-MINT=`v3` / V-PEACH=`v2` の保険ブランチ**で進め、go-live で本番へマージ（ブランチ事前作成はせず A 案 = 初回 push で自動生成）
6. ✅ レガシー除去 → **go-live 後の P7（§6-2）** で旧ピボット RPC・移行シムを破壊的に撤去（共有 DB ゆえ本番切替後に限定）
7. ✅ 進捗管理 → 本書を**帳票化**（§6 状態列＋§6-1 チェックリスト）。各フェーズ着手・完了で更新
8. ✅ ローカル分離運用（2026-06-11 追加）→ obsidian-vault に `multi-store` トピック ブランチを切り、**マルチストア改修は push しない**。バグフィックスは `main` から従来どおりデプロイ。誤爆防止に `/vmint-deploy`・`/vpeach-deploy` へブランチ ガード（`main` 以外なら中止）を追加。詳細は §5-1
9. ✅ Supabase MCP 活用（2026-06-11 追加）→ Supabase 上の SQL／RPC は Claude Code が **Supabase MCP 経由で直接実行**する運用に切替え、つーくんの手作業実行をなくす。読み取り自由・書き込み承認・破壊的（DROP/TRUNCATE 等）は対象件数 SELECT＋FK 影響＋ロールバック手順をセットで承認後実行。`.mcp.json` は PAT を含むため `.gitignore` に追加。詳細は §5-3
10. ✅ サブエージェント活用（2026-06-11 追加）→ 実装フェーズは **Fable＝戦略・レビュー・コミット・DB 書き込み／Sonnet・Opus サブエージェント＝自己完結な実装・調査**の分担で進め、トークンを節約する。サブエージェントには DB 書き込みと `git commit` を禁止。詳細は §5-4

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

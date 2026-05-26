---
tags: [project/v-peach, type/plan, archived]
parent: [[V-PEACH/notes/_index]]
updated: 2026-05-25
status: archived — 実装完了（2026-05-25）。以降の実装変更による更新不要。参照専用。
---

# V-PEACH — HRMOS シフト CSV 1ファイル取込による人件費自動算出 実装計画

> **実装ステータス（2026-05-25）**：§9 のフェーズ1〜8（DB・API・祝日クライアント・CSV パーサ・計算ロジック・設定UI・月次入力UI・年初バナー）を完了。フェーズ9（2026年1〜4月 CSV 検証）はオーナーが実データで動作確認中。

> **実装時の仕様差分**（計画書の表記 → 実際の HRMOS 上の表記。判定ロジックは両方を許容済み）：
> - 店舗名：「馬場地区基本店」→「高田馬場本店」、「馬場地区2号店」→「高田馬場2号店」
> - 特殊シフト名：「オールイン」→「オーラス」、「[短縮稼働]」→「[短縮営業]」
> - `csvImporter.js` の `detectStoreFromSegmentName` / `detectShiftTypeFromSegmentName` が両表記を許容（`match` 配列に旧名・新名を両方登録）

> 既存「人件費新方式（重みつき枠按分）」の入力工数をさらに圧縮するため、HRMOS から出力される月次シフト raw CSV（`vangvieng_shifts_YYYYMM.csv`）の1ファイルアップロードで、画面A（バイト枠数）・画面B（りょーさん枠数）の入力をゼロにする。マスタ（スタッフ・勤務区分・祝日）は Supabase に保持し、初回投入後は HRMOS マスタ変更時のみ更新する。
> 既存の `labor-cost-plan.md` の計算式（重みつき枠按分・固定給按分・りょーさん機会費用）はそのまま再利用する。本計画は **「画面A/B の入力を自動化する取り込みパイプライン」** に範囲を限定する。
>
> **2026-05-24 オーナー確認済みの設計判断**（§11 参照）：
> 1. 給与＋交通費総額（画面C）→ **手入力維持**
> 2. オールイン枠 → **早番7.5h+遅番6hに分解計上**（現状ほぼ発生しない）
> 3. 中番バイト枠 → **按分に含める**（重みつき 6h）
> 4. 短縮稼働など特殊枠 → **現状発生しないので無視**（出現時は警告のみ）
> 5. 祝日マスタ → **外部 API（holidays-jp）+ Supabase キャッシュ + UI 再取得ボタン**（追加コスト・認証不要・CORS 許可済み）

---

## 1. 目的と前提

### 1.1 目的

| Before | After |
|--------|-------|
| 画面A・B：3店舗 × バイト/りょーさん × 6h/7.5h = 12 マス手入力 | shifts CSV 1ファイルアップロードで自動算出 |
| 画面C：給与＋交通費総額 1マス手入力 | **現状維持（オーナー確認済）** |

### 1.2 既存仕様の再確認

- 重みつき枠数 = `6.0 × slots6h + 7.5 × slots7_5h`
- 店舗人件費 = `fixed_salary_total + total_variable_payroll × storeWeightedSlots ÷ ΣweightedSlots`
- りょーさん代替コスト（参考） = `ryo_hourly_rate × (6.0 × ryoSlots6h + 7.5 × ryoSlots7_5h)`
- 永続化先：
  - `pe_monthly_records.part_time_slots_6h / 7_5h / ryo_slots_6h / 7_5h`（店舗×月）
  - `pe_monthly_company_records.total_variable_payroll`（月）

CSV 取込ロジックは **これらの数値を計算して既存テーブルに書き込むだけ**。下流（finance.js / PLApp / SettingsApp）は無改修。

### 1.3 取込対象 CSV のスキーマ

#### shifts（毎月アップロード）

```
拠点ID, 従業員ID, 日付, 勤務区分
7, 2, 2026-01-06, 85
7, 10, 2026-01-04, 83
…
```

- 文字コード：Shift_JIS（既存 `csvImporter.js` のデコード処理を流用可）
- ヘッダ：日本語固定
- レコード単位：「ある従業員がある日付に入った勤務区分」1行
- **欠落日 = 全店休** とは限らない。後述の店舗別休業日判定が必要
- 1/1〜1/3 は店休日（レコード全欠落）

#### staffs（マスタ・初回 + 変更時）

抜粋済み（§ vangvieng_staffs.csv）。必要列：
`従業員ID, 姓, 名, 入社日, 休職日_開始_, 退職日, 雇用形態, カレンダーパターンID`

#### segments（マスタ・初回 + 変更時）

抜粋済み（§ vangvieng_segments.csv）。必要列：
`勤務区分ID, 勤務区分名, 略称`

---

## 2. マスタ設計

### 2.1 スタッフマスタ `pe_hrmos_staffs`

```sql
CREATE TABLE pe_hrmos_staffs (
  hrmos_staff_id   integer PRIMARY KEY,         -- HRMOS 従業員ID
  display_name     text NOT NULL,               -- 姓名（例: "立花 弘行"）
  account_name     text,                        -- HRMOS ログインID（例: "vangvieng"）
  role             text NOT NULL,               -- 'fixed_salary' | 'part_time' | 'owner_ryo'
  default_store_id bigint REFERENCES stores(id),-- 所属店舗（参考・按分は勤務区分ID側で判定）
  joined_on        date,
  left_on          date,
  note             text,
  updated_at       timestamptz DEFAULT now()
);
```

- `role` の決定ルール：
  - `display_name` が **「立花 弘行」「木村 仁美」「中道 雄耶」「塚本 大己」** → `fixed_salary`
  - `account_name` が **`ryo`**（または姓名で別途指定）→ `owner_ryo`
  - その他 → `part_time`
- マスタ取り込み時に上記ルールで自動付与。新規スタッフが追加されたら既定 `part_time` で挿入し、ロール変更が必要なら設定 UI で修正。

### 2.2 勤務区分マスタ `pe_hrmos_segments`

```sql
CREATE TABLE pe_hrmos_segments (
  hrmos_segment_id integer PRIMARY KEY,         -- HRMOS 勤務区分ID（例: 81）
  segment_name     text NOT NULL,               -- "中野店 早番"
  store_id         bigint REFERENCES stores(id),-- 馬場本店/中野店/馬場2号店/NULL（按分対象外）
  shift_type       text NOT NULL,               -- 'early' | 'middle' | 'late' | 'allin' | 'misc'
  default_hours    numeric NOT NULL,            -- 7.5(早) / 6.0(中・遅) / 11.5(allin) / 0(misc)
  is_payroll_target boolean NOT NULL DEFAULT true,  -- 按分対象か（false=営業中/倉庫業務/特殊枠）
  note             text,
  updated_at       timestamptz DEFAULT now()
);
```

- 取り込み時の **店舗判定**（`segment_name` プレフィックスマッチ）：
  - `"馬場地区基本店"` → `baba_main`
  - `"中野店"` → `nakano`
  - `"馬場地区2号店"` → `baba_2nd`
  - `"倉庫業務" / "営業中"` → NULL、`is_payroll_target = false`
- **シフトタイプ判定**（`segment_name` サフィックスマッチ）：
  - `"早番"` 含む → `early`、`default_hours = 7.5`
  - `"中番"` 含む → `middle`、`default_hours = 6.0`
  - `"遅番"` 含む → `late`、`default_hours = 6.0`（馬場2号店土日祝は取込時に 7.5 へ補正）
  - `"オールイン"` 含む → `allin`、`default_hours = 11.5`（早番7.5h+遅番6hの分解計上）
  - 上記以外（`"[短縮稼働]"` プレフィックスなど）→ `misc`、`default_hours = 0`、`is_payroll_target = false`
- **特殊枠（`misc`）は自動判定不可として警告表示**。現状ほぼ発生しないため無視で運用。出現時は設定 UI で `shift_type` / `default_hours` / `is_payroll_target` を手動上書き可能。

### 2.3 マスタアップロード UI

設定モード（`SettingsApp.vue`）に **「HRMOS マスタ管理」セクション** を追加：

- `vangvieng_staffs.csv` アップロードボタン（既存スタッフは `hrmos_staff_id` で upsert）
- `vangvieng_segments.csv` アップロードボタン（同じく upsert）
- 取込結果プレビュー（新規追加 N 件 / 更新 M 件 / 自動判定不可 X 件）
- 自動判定不可レコード（店舗判定 NULL かつ判定が `misc` 等）は警告表示し、`store_id` / `shift_type` / `default_hours` を手動上書き可能

---

## 3. shifts CSV 取込ロジック

### 3.1 取込トリガー

`InputApp.vue` の月次入力フロー先頭に **新ステップ「シフト CSV 取込」** を追加：

```
[既存 CSV モード]
  Step 0: V-MINT 集計期間プレビュー
  Step 1: 売上 CSV アップロード（Airメイト/Airレジ）
  Step 1.5: ★ NEW: シフト CSV アップロード（vangvieng_shifts_YYYYMM.csv）
  Step 2: 売上プレビュー（人件費プレビュー追加）
  Step 3: 画面C（給与＋交通費総額）← 画面A/B はスキップ
  Step 4: 確認・保存

[既存 手入力モード]
  既存3画面はそのまま残置（フォールバック用）
```

- シフト CSV をアップロードしない場合は従来通り画面A/B 手入力にフォールバック
- アップロード後、自動算出された枠数は **画面A/B に反映してから確認**（編集可能）

### 3.2 計算手順（疑似コード）

```javascript
// 入力: shiftsCsv (raw CSV string), targetPeriodKey (YYYYMM)
// 出力: { [storeKey]: { pt6h, pt7_5h, ryo6h, ryo7_5h }, ... }

async function calcShiftsFromCsv(shiftsCsv, targetPeriodKey) {
  // 1. CSV パース（Shift_JIS デコード → 行配列）
  const rows = parseShiftsCsv(shiftsCsv);  // [{ staffId, date, segmentId }, ...]

  // 2. マスタ取得（祝日は外部 API → キャッシュフォールバック付き）
  const staffs   = await fetchHrmosStaffs();
  const segments = await fetchHrmosSegments();
  const holidays = await fetchJpHolidaysCached(targetPeriodKey);  // §3.4

  // 3. 各レコードを「店舗×日付×シフトタイプ」に正規化
  //    fillMap[storeId][date][shiftType] = { staffId, hours }
  //    オールインは early と late の両方を同時に埋めたとして登録
  const fillMap = {};
  for (const r of rows) {
    const seg = segments.get(r.segmentId);
    if (!seg || !seg.isPayrollTarget) continue;        // 倉庫業務/営業中/特殊枠はスキップ
    const staff = staffs.get(r.staffId);
    if (!staff) continue;                              // マスタ未登録は警告のうえスキップ

    const isWeekendHoliday = isWeekendOrHoliday(r.date, holidays);

    if (seg.shiftType === 'allin') {
      // オールイン → 早番7.5h + 遅番(6h or 土日祝の馬場2号店は7.5h) として分解
      setIfEmpty(fillMap, [seg.storeId, r.date, 'early'], { staffId: r.staffId, hours: 7.5 });
      const lateHours = (seg.storeId === BABA_2ND_ID && isWeekendHoliday) ? 7.5 : 6.0;
      setIfEmpty(fillMap, [seg.storeId, r.date, 'late'],  { staffId: r.staffId, hours: lateHours });
      continue;
    }

    // 通常枠
    let hours = seg.defaultHours;
    if (seg.storeId === BABA_2ND_ID
        && seg.shiftType === 'late'
        && isWeekendHoliday) {
      hours = 7.5;  // 馬場2号店遅番の土日祝補正
    }
    setIfEmpty(fillMap, [seg.storeId, r.date, seg.shiftType], { staffId: r.staffId, hours });
  }

  // 4. 「埋まっていない早番/遅番」 = りょーさん出勤枠
  //    判定対象日 = fillMap にその店舗のレコードが1件でもある日（= 店舗営業日）
  //    中番は判定対象外（仕様：埋まっていなくてもりょーさんとはみなさない）
  const ryoSlots = {};
  for (const storeId of [BABA_MAIN_ID, NAKANO_ID, BABA_2ND_ID]) {
    const datesWithRecord = unionOfDatesIn(fillMap[storeId]);
    for (const date of datesWithRecord) {
      const isWeekendHoliday = isWeekendOrHoliday(date, holidays);
      for (const shiftType of ['early', 'late']) {
        if (fillMap[storeId][date][shiftType]) continue;  // 既にバイト or 固定給 or ryo 自身が埋めた
        const hours = (storeId === BABA_2ND_ID && shiftType === 'late' && isWeekendHoliday)
                      ? 7.5
                      : (shiftType === 'early' ? 7.5 : 6.0);
        addRyoSlot(ryoSlots, storeId, hours);
      }
    }
  }

  // 5. バイト枠集計（固定給4名・りょーさんは除外。中番はバイトのみ按分に含める）
  const ptSlots = {};
  for (const storeId of [BABA_MAIN_ID, NAKANO_ID, BABA_2ND_ID]) {
    for (const date of Object.keys(fillMap[storeId] || {})) {
      for (const shiftType of ['early', 'middle', 'late']) {
        const fill = fillMap[storeId][date][shiftType];
        if (!fill) continue;
        const role = staffs.get(fill.staffId).role;
        if (role === 'part_time') {
          addPtSlot(ptSlots, storeId, fill.hours);  // 中番(6h)も含む
        }
        // fixed_salary / owner_ryo はバイト按分から除外
      }
    }
  }

  // 6. 結果フォーマット（storeKey → { pt6h, pt7_5h, ryo6h, ryo7_5h }）
  return formatResult(ptSlots, ryoSlots);
}
```

### 3.3 仕様確定事項のサマリ

- **中番**：りょーさん判定は **対象外**（埋まっていなくてもりょーさん枠とはみなさない）。バイト枠集計には **含める**（中番に入ったバイトの給与は `total_variable_payroll` に含まれているため、按分にも入れないと過小評価）
- **オールイン**（80/84/88）：早番7.5h + 遅番(6h or 7.5h) として **分解計上**。バイトが埋めることはないため事実上 `fixed_salary` の動作確認のみ
- **店舗営業日**：その店舗の `fillMap` にレコードが1件でもあれば営業日。1/1〜1/3 のような全欠落日は自然にりょーさん枠ゼロになる
- **特殊枠**（短縮稼働など）：`is_payroll_target = false` で集計から除外。出現時のみ設定 UI で対応

### 3.4 祝日マスタ — 外部 API + Supabase キャッシュ方式

**採用方針**：[holidays-jp](https://holidays-jp.github.io/) API（`https://holidays-jp.github.io/api/v1/date.json`）から全祝日を取得し、Supabase `pe_jp_holidays` にキャッシュ。失敗時はキャッシュにフォールバック。

#### なぜこの方式か（オーナー要望「追加コストかからず、実装上ムリがないなら自動化」への回答）

| 評価項目 | holidays-jp |
|---------|------------|
| 利用料金 | 無料 |
| 認証 | 不要 |
| CORS | 許可済み（ブラウザ直アクセス可） |
| 配信形式 | JSON（`{"2026-01-01": "元日", …}`） |
| データ範囲 | 過去〜翌年分まで網羅。年初の祝日改正にも反映される |
| 障害リスク | GitHub Pages 上の個人運用 → サービス停止リスクあり。Supabase キャッシュで吸収 |

→ **追加コストゼロ・実装も既存 fetch + Supabase upsert で完結。条件を満たすため採用**。

#### `pe_jp_holidays` キャッシュテーブル

```sql
CREATE TABLE pe_jp_holidays (
  holiday_date date PRIMARY KEY,
  holiday_name text NOT NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pe_jp_holidays_meta (
  id           integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_fetched_at  timestamptz,
  last_fetch_status text,        -- 'success' | 'failed'
  last_fetch_error  text
);
```

- 月次入力フロー（CSV モード Step 1.5）の冒頭で **`refreshHolidaysIfStale(targetPeriodKey)`** を呼ぶ
  - 対象月 YYYYMM の年が `pe_jp_holidays` に1件もない → 強制フェッチ
  - 最終取得から30日経過 → バックグラウンドフェッチ（失敗してもキャッシュ続行）
  - フェッチ成功 → 全件 upsert + meta 更新
  - フェッチ失敗 → meta に記録、キャッシュで続行（UI に警告表示）

#### 設定モード「祝日マスタ」セクション

```
[祝日マスタ（日本国民の祝日）]
  ┌─────────────────────────────────────────────────────────┐
  │ 最終取得: 2026-05-24 10:32 ✓ 成功                        │
  │ キャッシュ件数: 73件（2024〜2027）                       │
  │ データソース: holidays-jp.github.io                      │
  │                                                          │
  │ [いま再取得する]   [キャッシュ一覧を表示]                │
  │                                                          │
  │ ⚠ 1週間以上取得していません（年初の祝日改正に注意）       │  ← 30日以上経過時
  │ ✗ 前回取得失敗: ネットワークエラー（2026-01-02 03:00）   │  ← 失敗時のみ
  │   キャッシュデータで動作中。手動再取得を推奨します        │
  └─────────────────────────────────────────────────────────┘
```

#### 年初アラート

`PortalMenu.vue`（モード選択トップ）に **新年祝日チェック** を埋め込む：

- 表示時に「現在の年 + 翌年」の祝日が `pe_jp_holidays` にあるかチェック
- いずれかが欠けていれば「祝日マスタを更新してください」バナーを表示（設定モードへのリンク付き）
- 自動更新を試行し、成功すれば自動で消える

これにより：
- **通常運用**：完全自動（フェッチ → キャッシュ → 利用）
- **障害発生時**：キャッシュ継続 + UI で再取得促進
- **年初**：明示的にアラート → オーナー or 自動再取得で復旧

---

## 4. データモデル変更まとめ

### 4.1 新規テーブル

- `pe_hrmos_staffs`（§2.1）
- `pe_hrmos_segments`（§2.2）
- `pe_jp_holidays`（§3.4 キャッシュ）
- `pe_jp_holidays_meta`（§3.4 取得状況・シングルトン `id=1`）

### 4.2 既存テーブルへの影響

なし。`pe_monthly_records` / `pe_monthly_company_records` への書き込みは現状の画面A/B/C と同じ。

### 4.3 オプション：取込履歴

監査・再取込のために `pe_hrmos_shift_imports` を持つ案：

```sql
CREATE TABLE pe_hrmos_shift_imports (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_key    integer NOT NULL,
  filename      text,
  imported_at   timestamptz DEFAULT now(),
  row_count     integer,
  warnings      jsonb,
  raw_csv       text  -- 原本保存（容量小なので可）
);
```

→ 初回実装ではスキップ可。トラブル時の再現性確保で v2 検討。

### 4.4 マイグレーションファイル

`V-PEACH/supabase/DB_MIGRATION_hrmos_masters_20260524.sql`（仮）

1. `pe_hrmos_staffs` 作成
2. `pe_hrmos_segments` 作成
3. `pe_jp_holidays` / `pe_jp_holidays_meta` 作成
4. (オプション) `pe_hrmos_shift_imports` 作成
5. RLS 有効化（anon 全許可ポリシー、既存 `pe_*` と同パターン）

---

## 5. API 拡張（`src/api.js`）

| 関数 | 用途 |
|------|------|
| `getHrmosStaffs()` | スタッフマスタ全件取得 |
| `upsertHrmosStaffs(rows)` | マスタ CSV 取込時のバルク upsert |
| `updateHrmosStaffRole(staffId, role)` | 個別ロール上書き |
| `getHrmosSegments()` | 勤務区分マスタ全件取得 |
| `upsertHrmosSegments(rows)` | 同上 |
| `updateHrmosSegment(segmentId, fields)` | 自動判定不可レコードの手動上書き |
| `getJpHolidays(yearOrRange)` | キャッシュ参照 |
| `upsertJpHolidays(rows)` | API フェッチ成功時のバルク upsert |
| `getJpHolidaysMeta()` / `updateJpHolidaysMeta(payload)` | 最終取得状況の参照・更新 |
| `(optional) recordShiftImport(payload)` | 取込履歴の挿入 |

### 5.1 祝日 API クライアント（`src/utils/jpHolidaysClient.js` 新規）

```javascript
const HOLIDAYS_API = 'https://holidays-jp.github.io/api/v1/date.json';

export async function fetchHolidaysFromApi() {
  const res = await fetch(HOLIDAYS_API, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`祝日API HTTP ${res.status}`);
  const json = await res.json();
  return Object.entries(json).map(([date, name]) => ({
    holiday_date: date,
    holiday_name: name,
  }));
}

export async function refreshHolidaysIfStale(targetPeriodKey) {
  // §3.4 のロジック：年カバレッジチェック + 30日経過時バックグラウンド更新
}

export async function fetchJpHolidaysCached(targetPeriodKey) {
  await refreshHolidaysIfStale(targetPeriodKey);
  const rows = await getJpHolidays(/* yearRange */);
  return new Set(rows.map(r => r.holiday_date));
}
```

---

## 6. CSV パーサ拡張（`src/utils/csvImporter.js`）

既存の Airメイト/Airレジ 自動判定ロジックに加え、シフト/スタッフ/勤務区分の3種を識別：

| 判定ロジック | ヘッダの特徴 |
|---|---|
| シフト | 列数4 + `拠点ID,従業員ID,日付,勤務区分` |
| スタッフ | 列数 ≥30 + `従業員ID, 姓, 名, 入社日` |
| 勤務区分 | 列数 ≥40 + `勤務区分ID, 勤務区分名, 略称` |

文字コードは既存 Shift_JIS デコーダ流用。

---

## 7. UI 変更詳細

### 7.1 `SettingsApp.vue` — 新規セクション2つ

#### HRMOS マスタ管理

```
[HRMOS マスタ管理]
  ┌─────────────────────────────────────────────────────────┐
  │ スタッフマスタ  [vangvieng_staffs.csv をアップロード]    │
  │   現在登録: 17名（固定給 4 / バイト 12 / 社長 1）         │
  │   最終更新: 2026-05-24 14:32                              │
  │   [一覧を表示・ロール手動上書き]                          │
  │                                                          │
  │ 勤務区分マスタ  [vangvieng_segments.csv をアップロード]  │
  │   現在登録: 23区分（按分対象 12 / 対象外 11）            │
  │   ⚠ 自動判定不可: 0件                                    │
  │   [一覧を表示・手動上書き]                                │
  └─────────────────────────────────────────────────────────┘
```

#### 祝日マスタ（§3.4 詳述済み）

```
[祝日マスタ（日本国民の祝日）]
  最終取得 / キャッシュ件数 / 再取得ボタン / 警告バナー
```

### 7.2 `InputApp.vue` — シフト CSV ステップ追加

CSV モードの新ステップ：

```
[Step 1.5: シフトデータ取込]
  ┌─────────────────────────────────────────────────────────┐
  │  ☁ vangvieng_shifts_202605.csv をアップロード            │
  │                                                          │
  │  ✓ 取込完了                                              │
  │    馬場本店  バイト: 6h × 18 / 7.5h × 22                │
  │              りょーさん: 6h × 2 / 7.5h × 1               │
  │    中野店    バイト: 6h × 20 / 7.5h × 25                │
  │              りょーさん: 6h × 0 / 7.5h × 3               │
  │    馬場2号店 バイト: 6h × 15 / 7.5h × 28                │
  │              りょーさん: 6h × 1 / 7.5h × 0               │
  │                                                          │
  │  [編集する]（画面A/B に戻って手動調整）                  │
  │  [次へ]                                                  │
  └─────────────────────────────────────────────────────────┘
```

- 自動算出結果を確認 → そのまま次へ or 編集ボタンで画面A/B に戻る
- 画面A/B は手動編集ステップとして残置（自動取込しない月や、自動補正後の最終調整用）
- 画面C（給与＋交通費総額）は従来どおり手入力

### 7.3 `PortalMenu.vue` — 年初祝日チェックバナー

- マウント時に `pe_jp_holidays` から「現在の年 + 翌年」のカバレッジを確認
- 欠落があれば自動 fetch 試行、失敗時のみ警告バナーを表示

### 7.4 既存 InputApp 影響

- 既存 step 番号は1ずつシフト（CSV モードのみ）
- 手入力モードはステップ構成変更なし

---

## 8. 計算ロジック実装（`src/utils/shiftImporter.js` 新規）

新規ファイル `src/utils/shiftImporter.js` に `calcShiftsFromCsv` を分離。`csvImporter.js` 流の純粋関数として実装し、ユニットテストしやすくする。

| エクスポート関数 | 用途 |
|------------------|------|
| `parseShiftsCsv(text)` | Shift_JIS デコード → 行配列 |
| `calcSlotsFromShifts(rows, masters, holidays)` | §3.2 のコア計算（純粋関数） |
| `formatSlotsForUi(result)` | InputApp 表示用整形 |

依存：`pe_hrmos_staffs` / `pe_hrmos_segments` / `pe_jp_holidays` をフェッチして渡す側（呼び出し元）責務。

---

## 9. 実装ステップ（推奨順）

| # | フェーズ | 内容 | 完了基準 | 状態 |
|---|----------|------|----------|------|
| 1 | DB | `DB_MIGRATION_hrmos_masters_20260525.sql` 作成・適用 | 4 テーブル（staffs/segments/holidays/holidays_meta）＋RLS 有効 | ✅ 2026-05-25 |
| 2 | API | `api.js` にスタッフ/勤務区分/祝日 CRUD 関数を追加 | Supabase ダッシュボードで CRUD 動作 | ✅ 2026-05-25 |
| 3 | 祝日 API | `utils/jpHolidaysClient.js` 新規（fetch + キャッシュロジック） | holidays-jp から取得 → upsert 成功 | ✅ 2026-05-25 |
| 4 | CSV パーサ | `csvImporter.js` 拡張（3種判定） | スタッフ/区分/シフトを正しく分類 | ✅ 2026-05-25（勤務区分判定を `略称`→`並び順` に修正済み） |
| 5 | 計算ロジック | `shiftImporter.js` 新規（`calcSlotsFromShifts`） | 2026-01 CSV で期待値再現（§10 検証ケース） | ✅ 2026-05-25 |
| 6 | 設定 UI | `SettingsApp.vue` に HRMOS マスタ管理 + 祝日マスタセクション追加 | CSV アップロード可・手動上書き可・祝日再取得可 | ✅ 2026-05-25 |
| 7 | 月次入力 UI | `InputApp.vue` に Step 2（シフト CSV アップロード）追加・画面A/B 自動反映 | シフト CSV → 画面A/B 自動入力 → 保存まで通る | ✅ 2026-05-25 |
| 8 | 年初アラート | `PortalMenu.vue` に祝日カバレッジバナー追加 | 翌年祝日が無い状態で警告表示 → 自動 fetch で復旧 | ✅ 2026-05-25 |
| 9 | 検証 | 2026年1〜4月の CSV をすべて取り込み、画面A/B 自動値と手動算出値を一致確認 | 全月で誤差ゼロ（または既知ズレを文書化） | 🔄 オーナー実施中 |
| 10 | ドキュメント | `architecture` / `supabase-er-diagram` / `finance-spec` / `labor-cost-plan` / `_index` を更新 | doc-sync 規約遵守 | ✅ 2026-05-25 |
| 11 | 初期データ投入 | `staffs.csv` / `segments.csv` を本番 Supabase に投入 | UI から確認可能 | 🔄 マスタ CSV 取込はオーナー操作待ち |

> 1〜5 が基礎工事、6〜8 が UI 統合、9〜11 が仕上げ。

---

## 10. 検証ケース

### 10.1 単発仕様確認（手計算と一致するか）

- 2026-01-06 の馬場2号店：火曜 → 平日 → 遅番 6h
- 2026-01-10 の馬場2号店：土曜 → 遅番 7.5h
- 2026-01-12 の馬場2号店：月曜（成人の日・祝日）→ 遅番 7.5h
- 1/1〜1/3：全店レコードなし → りょーさん枠ゼロ

### 10.2 ロール判定

- 立花 弘行（vangvieng, ID 2）→ `fixed_salary` → バイト枠から除外
- 木村 仁美（pichan, ID 10）→ `fixed_salary` → 同上
- 中道 雄耶（ono, ID 15）→ `fixed_salary` → 同上
- 塚本 大己（daiki, ID 18）→ `fixed_salary` → 同上
- ryo（ID 8）→ `owner_ryo` → バイト枠から除外（りょーさん枠は別途「埋まっていない枠」で算出）
- 上記以外 → `part_time` → バイト枠としてカウント（中番含む）

### 10.3 りょーさん枠

- 中野店 2026-01-04（日曜）の早番にバイトが入っていない → りょーさん 7.5h 枠 1 つ計上
- ただし「店舗がそもそも営業していない日」（その店舗のレコード0件）は除外

### 10.4 集計妥当性

`(pt6h + pt7_5h + ryo6h + ryo7_5h)` の早番カウント = 営業日数（その店舗）に概ね一致するはず。乖離があれば複数枠重複の検知漏れを疑う。

### 10.5 祝日 API

- holidays-jp から `{"2026-01-01": "元日", "2026-01-12": "成人の日", …}` を取得し `pe_jp_holidays` に upsert
- 馬場2号店 2026-01-12 遅番の長さが 7.5h と判定される
- API ダウン時：`pe_jp_holidays` に既存データがあれば継続動作・meta に失敗記録

---

## 11. 設計判断確定事項（2026-05-24 オーナー確認済）

| # | 論点 | 決定 |
|---|------|------|
| 1 | 給与＋交通費総額（画面C）の取扱い | **手入力維持**。HRMOS 給与画面の総額を月初に1マス入力 |
| 2 | オールイン枠（80/84/88）の按分方法 | **早番7.5h + 遅番(6h or 7.5h) として分解計上**。バイトがオールインを埋めることはなく、現状ほぼ発生しない |
| 3 | 中番バイト枠の按分含否 | **按分に含める**（重みつき 6h）。中番給与は `total_variable_payroll` に含まれるため按分対象 |
| 4 | 短縮稼働など特殊枠 | **現状発生しないので無視**（`is_payroll_target = false`）。出現時は設定 UI で手動上書き可 |
| 5 | 祝日マスタ運用 | **外部 API（holidays-jp）+ Supabase キャッシュ + UI 再取得 + 年初アラート**。追加コスト・認証不要・CORS 許可済みのため自動化採用 |

---

## 12. 影響範囲・非影響

### 影響あり

- `src/api.js`（CRUD 追加）
- `src/utils/csvImporter.js`（CSV 種別判定追加）
- `src/utils/shiftImporter.js`（新規）
- `src/utils/jpHolidaysClient.js`（新規）
- `src/components/apps/SettingsApp.vue`（HRMOS マスタ + 祝日マスタの2セクション追加）
- `src/components/apps/InputApp.vue`（Step 1.5 追加・画面A/B 自動反映）
- `src/components/PortalMenu.vue`（年初祝日アラートバナー）
- `V-PEACH/supabase/DB_MIGRATION_hrmos_masters_20260524.sql`（新規）

### 影響なし

- `src/utils/finance.js`（計算式変更なし）
- `src/components/apps/PLApp.vue`（表示変更なし）
- `pe_monthly_records` / `pe_monthly_company_records`（スキーマ変更なし）

---

## 13. 次のステップ

設計判断は全て確定。実装開始の合図を待つ。実装着手時は §9 の順序で進め、各フェーズ完了ごとに doc-sync 規約に従って関連ドキュメントを更新する。

---

## Related

- [[V-PEACH/notes/V-PEACH_labor-cost-plan]] — 人件費新方式の計算式・既存実装スコープ
- [[V-PEACH/notes/V-PEACH_architecture]] — `pe_*` テーブル設計（マスタ追加時に更新）
- [[V-PEACH/notes/V-PEACH_supabase-er-diagram]] — ER 図（同上）
- [[V-PEACH/notes/V-PEACH_finance-spec]] — PL 各項目の仕様（無改修だが取込フロー追記）
- [[V-PEACH/notes/V-PEACH_next-actions]] — タスク全体
- [[V-PEACH/DECISIONS]] — 「HRMOS シフト CSV 取込で画面A/B を自動化」「祝日マスタは holidays-jp + キャッシュ方式」を ADR として追記予定

---
tags: [project/v-peach, type/plan, archived]
parent: [[V-PEACH/notes/_index]]
updated: 2026-05-23
status: archived — 実装完了（2026-05-25）。以降の実装変更による更新不要。参照専用。
---

# V-PEACH — 人件費計算ロジック実装計画

> **実装ステータス（2026-05-23 時点）**：§9 のステップ 1〜8・10 完了。残タスクは固定給初期値 SEED（オーナー確認待ち）・テストデータ検証。
> - ✓ DB migration `DB_MIGRATION_labor_cost_20260520.sql` 適用済み
> - ✓ API：`getMonthlyCompanyRecord` / `upsertMonthlyCompanyRecord` / `getMonthlyCompanyRecordsForYear`
> - ✓ finance.js：`calcWeightedSlots` / `calcStoreLaborCost` / `calcRyoOpportunityCost`、`calcPL` に `laborParams` 引数追加、`calcRolling3MonthAvg` / `calcAnnualSum` で `laborFixed`/`laborVariable`/`ryoOpportunityCost` の null 集約対応
> - ✓ SettingsApp：店舗別固定費に `fixed_salary_total`、全社共通費に `ryo_hourly_rate` 入力欄
> - ✓ InputApp：手入力／CSV 両モードで枠数入力3画面（A=バイト6h/7.5h・B=りょーさん6h/7.5h・C=全店給与+交通費合計）、旧 `labor_cost` 直接入力欄を撤去（2026-05-23 に CSV モード Step 2 プレビュー画面の残置分を最終撤去・CSV モード confirm step テンプレート欠落も併せて修正）
> - ✓ PLApp：⑬人件費に「固定給／変動費按分」サブ行 + 「※ りょーさん代替コスト（参考・PL非計上）」表示。`pe_monthly_company_records` の当月行有無で新方式／レガシーフォールバックを切り替え
> - ✓ ドキュメント同期完了（`architecture` / `supabase-er-diagram` / `finance-spec` / `requirements` / `release-plan` / `test-plan` / `next-actions` / `_index`）
> - ⏳ 固定給初期値 SEED（`SEED_fixed_salaries_20260520.sql` 未作成、オーナー確認待ち）
> - ⏳ §9-9 検証（仕様 §2.4 計算例の再現）

> 中野店店長壁打ち（[[V-PEACH/notes/V-PEACH_next-actions#6. 人件費計算ロジック設計（社長代替シフト含む）]]）で合意した「重みつき枠数による按分方式」の実装計画。
> 変更対象：**月次PL／月次入力／設定** の3モードすべて。

---

## 📋 エグゼクティブサマリー

### 何が変わるか

「店舗ごとに人件費を1セル手入力」している現行実装を廃止し、**シフト枠数の入力から自動算出**する方式に切り替える。固定給メンバーは担当店舗にまるごと計上、バイト給与＋交通費は全店総額を**重みつき枠数で按分**、社長（りょーさん）が埋めた枠は**バイト置換時の機会費用**として参考表示する。

### 計算の心臓部（1行）

```
店舗の人件費 = 担当店舗の固定給合計
            + (全店バイト給与＋交通費総額) × 当該店舗の重みつき枠数 ÷ 全店合計
重みつき枠数 = 6.0 × 6h枠数 + 7.5 × 7.5h枠数
```

### 毎月の入力（3画面に集約）

| 画面 | 入力内容 |
|---|---|
| **画面A** | 各店舗で **バイト** が埋めた 6h／7.5h 枠数（3店舗 × 2区分 = 6マス） |
| **画面B** | 各店舗で **りょーさん** が埋めた 6h／7.5h 枠数（同上） |
| **画面C** | 当月の全店バイト給与＋交通費の総額（1マス） |

> 給与明細の個別集計は不要。1枠 6h／7.5h の振り分けは入力者の運用判断（馬場2号店の土日早番は 7.5h）。

### 設定で1度だけ決める値

- **店舗ごとの固定給合計**：馬場本店＝おの、中野店＝ばな＋ぴー、馬場2号店＝つー の月報酬合計
- **社長代替時給**：りょーさんの機会費用計算用（既定 ¥1,300/h、やや高め推奨）

### 月次PLで見える形

```
⑬ 人件費        ¥563,000      ← つーの固定給 + 馬場2号店のバイト人件費按分
   ├ 固定給     ¥275,000
   └ 変動費按分 ¥288,000
   ※ りょーさん代替コスト（参考） ¥70,200   ← バイトに置き換えたら +¥70,200
```

### 仕様メモの計算例で動作確認

つー月報酬 ¥275,000、馬場2号店の重みつき枠 180h、全店合計 500h、バイト給与と交通費の全店総額 ¥80万とする
→ 馬場2号店 人件費 = ¥275,000 + ¥800,000 × 180 ÷ 500 = **¥563,000**
りょーさんが馬場2号店で埋めた重みつき枠 54h → 参考機会費用 = ¥1,300 × 54 = **¥70,200**

### 中野店店長に確認したい点（確認済み）

1. **入力工数の見立て**：月初に枠数を6+6マス＋総額1マス＝13マスの入力でいけるか？
2. **6h／7.5h の振り分け** はシフト表を見ながら入力者が判断する運用で問題ないか？
3. **固定給メンバーの月報酬額**（おの・ばな＋ぴー・つー）の初期値はオーナー確認待ち
4. **社長代替時給** ¥1,300/h で確定でよいか（やや高めにするならいくらか）

### 実装スコープ

DB マイグレーション → API → 計算ロジック → 設定UI → 月次入力UI → PL表示 → 過去月フォールバック → ドキュメント同期。詳細は §3 以降。

---

## 1. 目的

現状の手入力人件費（店舗ごとに1セル）を廃止し、以下を達成する：

1. **店舗ごとの人件費を、勤務枠の実態に応じて自動按分**して算出する
2. **固定給メンバー（おの／ばな・ぴー／つー）** は担当店舗にまるごと帰属させる
3. **社長（りょーさん）の代替コスト**（バイト置換時の機会費用）を参考値として月次PLに付記する
4. 入力工数は現実的に抑える（給与明細の個別集計を要求しない）

---

## 2. 計算式（要約）

### 2.1 店舗の人件費（PL ⑬ に計上）

```
storeLabor[s] = Σ fixedSalary[s]                            ← 担当店舗所属の固定給合計
              + totalVariablePayroll                         ← 当月の給与＋交通費の総額（全社）
                × weightedSlots[s] / Σ weightedSlots[s']    ← 当該店舗の重みつき枠数 / 全店舗合計
```

### 2.2 重みつき枠数

```
weightedSlots[s] = 6.0 × slots6h[s] + 7.5 × slots7_5h[s]
```

- `slots6h[s]` … 当該店舗で **バイトが埋めた** 6h 枠の数
- `slots7_5h[s]` … 当該店舗で **バイトが埋めた** 7.5h 枠の数

> 1枠の勤務時間は「全ての早番」「土日祝日の馬場2号店の早番」が 7.5h、それ以外（遅番ほか）が 6h。
> 単純な枠数では勤務時間差を吸収できないため、勤務時間を係数として重みづける。

### 2.3 社長代替コスト（参考値・PL に費用計上しない）

```
ryoOpportunityCost[s] = ryoHourlyRate                                ← 全社設定：機会費用用時給（既定 ¥1,300/h）
                      × (6.0 × ryoSlots6h[s] + 7.5 × ryoSlots7_5h[s])
```

PL の人件費行の下に **メモ書き**として表示し、「バイトに置き換えると人件費は +¥XX,XXX 増加する」ことを直感的に伝える。

### 2.4 計算例（仕様メモから転記・検証用）

- つーの月報酬：**¥275,000**（馬場2号店所属固定給）
- 馬場2号店のバイト重みつき枠数：6h × 25 + 7.5h × 4 = **180h**
- 全店舗バイト重みつき枠数合計：**500h**
- 全店バイト給与＋交通費総額：**¥800,000**
- → 馬場2号店人件費 = 275,000 + 800,000 × 180 ÷ 500 = **¥563,000**
- りょーさんが馬場2号店で埋めた重みつき枠：6h × 4 + 7.5h × 4 = **54h**
- → 付記する機会費用 = ¥1,300 × 54 = **¥70,200**

---

## 3. データモデル変更

### 3.1 月次実績（`pe_monthly_records`）

**列追加（店舗×期間ごと）**

| 列名 | 型 | 用途 |
|------|-----|------|
| `part_time_slots_6h` | numeric | バイトが埋めた 6h 枠数 |
| `part_time_slots_7_5h` | numeric | バイトが埋めた 7.5h 枠数 |
| `ryo_slots_6h` | numeric | 社長が埋めた 6h 枠数 |
| `ryo_slots_7_5h` | numeric | 社長が埋めた 7.5h 枠数 |

**列追加（期間ごと・store_id にひもづかない全社値）**

別テーブル `pe_monthly_company_records`（または `pe_monthly_records` の `store_id IS NULL` 行）を新設し、**全社単位の月次変動人件費総額**を保持する：

| 列名 | 型 | 用途 |
|------|-----|------|
| `period_key` | integer | YYYYMM（PK 兼） |
| `total_variable_payroll` | numeric | 当月のバイト給与＋交通費の総額（全社） |

> **採用案**：新テーブル `pe_monthly_company_records` を作る方が責任境界が明確。`pe_monthly_records` は店舗×月の粒度を維持する。

**廃止候補列**

- `pe_monthly_records.labor_cost`
  - 現行の単一手入力カラム。新方式では計算結果に置き換わるため**読み取り廃止**。
  - 互換性のため当面はカラム自体は残す（過去月の参照用）が、フロントは新方式で算出した値を優先表示する。

### 3.2 店舗別固定費（`pe_store_settings` / `pe_store_settings_revisions`）

**列追加**

| 列名 | 型 | 用途 |
|------|-----|------|
| `fixed_salary_total` | numeric | 当該店舗に所属する固定給メンバーの月報酬合計 |

> 固定給メンバーの帰属：馬場本店＝おの、中野店＝ばな＋ぴー、馬場2号店＝つー。
> 個別メンバー粒度ではなく **「店舗ごとの固定給合計」** として保持する（個別管理は要件外）。

### 3.3 全社共通費（`pe_company_settings` / `pe_company_settings_revisions`）

**列追加**

| 列名 | 型 | 既定値 | 用途 |
|------|-----|--------|------|
| `ryo_hourly_rate` | numeric | 1300 | 社長代替コスト計算用の時給（機会費用ベース・やや高めに設定） |

### 3.4 マイグレーションファイル

`V-PEACH/supabase/DB_MIGRATION_labor_cost_20260520.sql`（新規）

1. `pe_monthly_records` に枠数4列を ADD COLUMN（DEFAULT 0）
2. `pe_monthly_company_records` テーブル新規作成（`period_key` PK + `total_variable_payroll`）
3. `pe_store_settings` / `pe_store_settings_revisions` に `fixed_salary_total` を ADD COLUMN（DEFAULT 0）
4. `pe_company_settings` / `pe_company_settings_revisions` に `ryo_hourly_rate` を ADD COLUMN（DEFAULT 1300）
5. 既存行への初期値投入（既知のメンバー固定給を SEED）

`V-PEACH/supabase/SEED_fixed_salaries_20260520.sql`（新規・オーナー確認後）

- 馬場本店 / 中野店 / 馬場2号店 の `fixed_salary_total` 初期値投入
- 既存 `pe_store_settings_revisions` の最新行に対して投入（または新規 revision を切る）

---

## 4. 設定モード変更（`SettingsApp.vue`）

### 4.1 店舗別固定費フォーム

既存セクションに **「所属固定給月報酬」** 入力欄を追加：

```
[馬場本店]
  家賃           ¥132,000
  光熱費         ¥40,000
  雑費           ¥13,000
  決済手数料率   2.5 %
  所属固定給月報酬 ¥XXX,XXX   ← NEW （ヘルプ：おの の月報酬を入力）
```

中野店は「ばな＋ぴー の合算」、馬場2号店は「つー の月報酬」と注記。

### 4.2 全社共通費フォーム

```
役員報酬             ¥XXX,XXX
借入返済             ¥XXX,XXX
社長代替時給（参考） ¥1,300/h   ← NEW （ヘルプ：機会費用計算用。やや高めに設定）
```

### 4.3 改定履歴

既存の `_revisions` テーブル管理パターンに従い、`fixed_salary_total` ／ `ryo_hourly_rate` も `effective_from` 単位で履歴管理する。**現在適用中レコードの削除可否ルール**（2件以上ある場合のみ削除可）はそのまま適用。

---

## 5. 月次入力モード変更（`InputApp.vue`）

### 5.1 入力フォーム3画面構成（最終方針より）

月次入力フローに **Step「人件費入力」** を追加する。CSV インポートモード／手入力モード両方で共通。

#### 画面A：店舗ごとの「バイトが埋めた枠数」

3店舗 × 2区分（6h／7.5h）の **2 × 3 の 6 ボックス**：

```
              バイトが埋めた枠数
              ┌──────┬──────┐
              │ 6h枠 │7.5h枠│
┌────────────┼──────┼──────┤
│ 馬場本店   │  []  │  []  │
│ 中野店     │  []  │  []  │
│ 馬場2号店  │  []  │  []  │
└────────────┴──────┴──────┘
```

各セル右下に「重みつき枠数 = X.X h」をリアルタイム算出表示。

#### 画面B：店舗ごとの「りょーさん（社長）が埋めた枠数」

同じく 2 × 3 の 6 ボックス：

```
            りょーさんが埋めた枠数
              ┌──────┬──────┐
              │ 6h枠 │7.5h枠│
┌────────────┼──────┼──────┤
│ 馬場本店   │  []  │  []  │
│ 中野店     │  []  │  []  │
│ 馬場2号店  │  []  │  []  │
└────────────┴──────┴──────┘
```

注釈：「PL の人件費には計上されません。バイトに置き換えた場合の機会費用として参考表示します」。

#### 画面C：「給与と交通費の総額」

```
当月の全店バイト給与＋交通費合計  ¥[          ]
```

注釈：「店舗ごとに按分されます。給与明細・交通費精算の合計を入力してください」。

### 5.2 バリデーション

| 項目 | ルール |
|------|--------|
| 枠数 | 整数 ≥ 0（小数許可するかは追加検討） |
| 全店舗のバイト重みつき枠数合計 | 0 のとき総額按分を 0 で割らないようガード（全店 0 なら variable 部分は 0 円） |
| `total_variable_payroll` | 数値・¥0 以上 |
| 全店舗で枠数も総額もゼロ | 警告は出すが保存は許容（営業休止月など） |

### 5.3 既存「人件費」欄の扱い

- 手入力モードの `labor_cost` 直接入力フィールドは **撤去**
- 過去月（新方式が未入力）の表示は `labor_cost` レガシー値にフォールバック

---

## 6. PL 画面変更（`PLApp.vue`）

### 6.1 ⑬ 人件費行の表示

**店舗別 PL：**

```
⑬ 人件費        ¥563,000
   ├ 固定給     ¥275,000   （つー：馬場2号店所属）
   └ 変動費按分 ¥288,000   （重みつき枠数 180h / 全社 500h × ¥800,000）
   ※ りょーさん代替コスト（参考） ¥70,200
```

**全社合算 PL：**

```
⑬ 人件費        ¥1,XXX,XXX
   ├ 固定給合計 ¥XXX,XXX
   └ 変動費合計 ¥XXX,XXX  （= 全店総額 = 当月入力値）
   ※ りょーさん代替コスト（参考・全社） ¥XXX,XXX
```

### 6.2 フォールバック表示

新方式の入力がない過去月は、従来通り `labor_cost` を `⑬ 人件費` に表示し、内訳は出さない。判定は「`pe_monthly_company_records` にその `period_key` の行があるか」で行う。

### 6.3 影響を受ける指標

| 指標 | 影響 |
|------|------|
| L比（人件費率） | 新方式の `storeLabor` を分子に使う |
| 労働分配率 | 同上 |
| 営業利益 | `sgaTotal` に新方式 `storeLabor` を加算 |
| FLR比サマリー | 自動連動 |
| ベンチマーク Health Check | 自動連動 |
| 3ヶ月平均・年次集計 | 月次の `storeLabor` を平均/合算後、再計算（既存ロジック踏襲） |

---

## 7. 計算ロジック実装（`src/utils/finance.js`）

### 7.1 新関数

```javascript
// 重みつき枠数（1ストア・1区分）
export function calcWeightedSlots({ slots6h = 0, slots7_5h = 0 }) {
  return 6.0 * slots6h + 7.5 * slots7_5h;
}

// 店舗ごとの人件費
export function calcStoreLaborCost({
  fixedSalaryTotal,            // 店舗設定：固定給合計
  storeWeightedSlots,          // 当該店舗のバイト重みつき枠数
  totalWeightedSlots,          // 全店舗のバイト重みつき枠数合計
  totalVariablePayroll,        // 当月の給与＋交通費総額（全社）
}) {
  if (totalWeightedSlots <= 0) {
    return { fixed: fixedSalaryTotal, variable: 0, total: fixedSalaryTotal };
  }
  const variable = totalVariablePayroll * storeWeightedSlots / totalWeightedSlots;
  return {
    fixed: fixedSalaryTotal,
    variable,
    total: fixedSalaryTotal + variable,
  };
}

// 社長代替コスト（参考値）
export function calcRyoOpportunityCost({
  ryoSlots6h = 0,
  ryoSlots7_5h = 0,
  ryoHourlyRate = 1300,
}) {
  const ryoWeightedHours = 6.0 * ryoSlots6h + 7.5 * ryoSlots7_5h;
  return ryoHourlyRate * ryoWeightedHours;
}
```

### 7.2 `calcPL` の改修

- 引数に `monthlyCompanyRecord`（`total_variable_payroll`）と `allStoresMonthlyRecords`（全店分）を追加
- `laborCost` の算出を上記新関数に置き換え
- レガシーフォールバックを実装

### 7.3 全社集計の `calcPL`

`totalVariablePayroll` は全店分の `storeLabor.variable` 合計 = 当月入力値そのもの。固定給合計は全店 `fixedSalaryTotal` の和。

---

## 8. API 変更（`src/api.js`）

### 8.1 新規関数

| 関数 | 対象 | 用途 |
|------|------|------|
| `getMonthlyCompanyRecord(periodKey)` | `pe_monthly_company_records` | 全社月次（変動人件費総額） |
| `upsertMonthlyCompanyRecord(periodKey, payload)` | `pe_monthly_company_records` | 同上 upsert |
| `getMonthlyCompanyRecordsForYear(year)` | `pe_monthly_company_records` | 年次一括取得 |

### 8.2 既存関数の拡張

- `getMonthlyRecord` / `upsertMonthlyRecord`：新 4 列（`part_time_slots_6h/7_5h`、`ryo_slots_6h/7_5h`）を返す／受け取る
- `getActiveStoreSettings`：`fixed_salary_total` を含めて返す
- `getActiveCompanySettings`：`ryo_hourly_rate` を含めて返す

---

## 9. 実装ステップ（推奨順）

| # | フェーズ | 内容 | 完了基準 |
|---|----------|------|----------|
| 1 | DB | `DB_MIGRATION_labor_cost_20260520.sql` 作成・適用 | Supabase でカラム追加確認 |
| 2 | DB | SEED：固定給初期値・社長時給初期値投入 | 設定モードで初期値が見える |
| 3 | API | `api.js` 新規／拡張関数を実装 | 単体で CRUD 動作 |
| 4 | finance | `finance.js` に新関数を追加＋既存 `calcPL` 改修 | 仕様 §2.4 の計算例と一致 |
| 5 | 設定 | `SettingsApp.vue` に固定給・社長時給入力欄を追加 | 改定履歴含めて編集可 |
| 6 | 月次入力 | `InputApp.vue` に枠数入力3画面を追加・既存人件費欄を撤去 | CSV／手入力両モードで通る |
| 7 | PL | `PLApp.vue` で人件費行の内訳表示・参考メモ追加 | 店舗別／全社両方で表示 |
| 8 | 過去月 | レガシーフォールバック動作確認 | 旧データの PL がそのまま見える |
| 9 | 検証 | テストデータで仕様例（§2.4）を再現 | ¥563,000・¥70,200 が一致 |
| 10 | ドキュメント | `finance-spec` / `architecture` / `supabase-er-diagram` 更新、`DECISIONS` 追記 | doc-sync ルール遵守 |

> 1〜4 は API 層を整える基礎工事。5〜7 が UI 改修の本体。8〜10 が仕上げ。

---

## 10. オープン課題・確認事項

- [ ] **固定給メンバーの月報酬額（初期値）** をオーナーに確認して SEED に反映
  - 馬場本店：おの の月報酬 = ¥___
  - 中野店：ばな＋ぴー の合算月報酬 = ¥___
  - 馬場2号店：つー の月報酬 = ¥___（仕様メモでは ¥275,000 を例示）
- [ ] **社長代替時給の既定値** ¥1,300/h で確定でよいか（やや高めに設定するならいくらか）
- [ ] **馬場2号店の土日早番が 7.5h** になる扱い：入力者は何曜日かを意識せず「7.5h 枠の数」として入力でよいか、入力 UI で曜日選択を出すか（→ 当面は入力者の判断で 6h／7.5h を振り分ける運用、UI 拡張は将来検討）
- [ ] **個別メンバー粒度** で固定給を管理する必要があるか（離脱・追加時の運用簡便さ）。現状は店舗合計値で保持の方針
- [ ] **過去月（移行前）** は新方式に遡及入力するか、それともレガシーフォールバック表示のままにするか
- [ ] **小数枠数** を許容するか（例：早退で 0.5 枠など）。当面は整数のみで運用

---

## 11. 仕様の出典

- [[V-PEACH/notes/V-PEACH_next-actions#6. 人件費計算ロジック設計（社長代替シフト含む）]]（中野店店長壁打ち・最終方針）
- 計算式・前提条件・計算例：すべて上記から転記

## Related

- [[V-PEACH/notes/V-PEACH_finance-spec]] — PL 各項目の現行仕様（⑬ 人件費の章を本計画完了時に更新）
- [[V-PEACH/notes/V-PEACH_architecture]] — `pe_*` テーブル設計（マイグレーション後に更新）
- [[V-PEACH/notes/V-PEACH_supabase-er-diagram]] — ER 図（同上）
- [[V-PEACH_test-plan]] — テストデータ投入手順（§2.4 例を検証ケースに追加）
- [[V-PEACH/notes/V-PEACH_next-actions]] — タスク全体
- [[V-PEACH/DECISIONS]] — 「人件費を重みつき枠按分方式に移行」を ADR として追記予定

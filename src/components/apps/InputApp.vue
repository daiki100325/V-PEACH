<template>
    <main class="container mx-auto px-4 py-6 max-w-lg md:max-w-3xl flex-grow">

        <!-- Step 0: 対象月選択 + モード切替 -->
        <div v-if="step === 0" class="flex flex-col items-center pt-6 pb-20">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5 w-full max-w-md">
                <div class="text-center">
                    <h2 class="text-xl font-bold text-slate-800">月次データを入力</h2>
                    <p class="text-sm text-slate-400 mt-1">全{{ stores.length }}店舗分を一括入力します</p>
                </div>

                <!-- 対象月 -->
                <div class="space-y-2">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">対象月</label>
                    <div class="grid grid-cols-2 gap-3">
                        <select v-model="selectedYear"
                            class="appearance-none w-full bg-slate-50 border border-slate-200 text-base font-bold rounded-xl p-4 text-center focus:ring-2 focus:ring-brand-500"
                            :class="selectedYear ? 'text-slate-800' : 'text-slate-400'">
                            <option value="" disabled>年を選択</option>
                            <option v-for="y in years" :key="y.value" :value="y.value">{{ y.label }}</option>
                        </select>
                        <select v-model="selectedMonth"
                            class="appearance-none w-full bg-slate-50 border border-slate-200 text-base font-bold rounded-xl p-4 text-center focus:ring-2 focus:ring-brand-500"
                            :class="selectedMonth ? 'text-slate-800' : 'text-slate-400'">
                            <option value="" disabled>月を選択</option>
                            <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
                        </select>
                    </div>
                </div>

                <button
                    type="button"
                    @click="startEntry"
                    :disabled="!canStart"
                    class="w-full py-4 rounded-2xl text-base font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-brand-600 hover:bg-brand-700 text-white">
                    開始する
                </button>
            </div>

            <!-- 集計期間プレビューカード -->
            <div v-if="canStart" class="mt-3 w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">各店舗の集計期間（V-MINT）</p>
                <div v-if="loadingPreview" class="text-xs text-slate-400 text-center py-1">取得中...</div>
                <template v-else>
                    <div v-for="sd in costPeriodPreview" :key="sd.storeKey"
                        class="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                        <span class="font-semibold text-slate-700">{{ sd.storeName }}</span>
                        <span v-if="sd.costReport" class="text-teal-600">
                            {{ formatDate(sd.costReport.start_date) }} 〜 {{ formatDate(sd.costReport.end_date) }}（{{ dayCount(sd.costReport) }}日間）
                        </span>
                        <span v-else class="text-slate-400">未入力</span>
                    </div>
                </template>
            </div>
        </div>

        <!-- ───── 人件費プレビュー（画面A/B 統合・読み取り専用） ───── -->
        <div v-if="step === laborPreviewStep" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">人件費プレビュー</p>
                    <p class="text-xs font-bold text-slate-400">4 / {{ totalSteps }}</p>
                </div>
                <p class="text-base font-bold text-slate-800">枠数の確認 — {{ periodLabel }}</p>
                <p class="text-xs text-slate-500 mt-1.5">
                    バイト・りょーさんの枠数および重みつき枠数を確認します。値の修正が必要な場合は前のステップで CSV を再アップロードしてください。
                </p>
                <div v-if="laborSlotsSource === 'csv'" class="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-xs text-emerald-700">
                    <span class="font-bold">シフトCSV から算出</span>
                </div>
                <div v-else class="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700">
                    <span class="font-bold">DB既存値を使用中</span>（シフトCSV 未アップロード）
                </div>
            </div>

            <!-- バイト枠 -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <p class="text-xs font-bold text-slate-700">バイトが埋めた枠数</p>
                </div>
                <div class="grid grid-cols-3 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                    <div class="px-4 py-2">店舗</div>
                    <div class="px-3 py-2 text-center">6h 枠数</div>
                    <div class="px-3 py-2 text-center">7.5h 枠数</div>
                </div>
                <div v-for="s in stores" :key="s.key" class="grid grid-cols-3 border-b border-slate-50 last:border-0 items-center">
                    <div class="px-4 py-3 text-sm font-bold text-slate-700">{{ s.name }}</div>
                    <div class="px-3 py-3 text-sm text-slate-700 text-center">{{ laborSlots[s.key]?.pt6h ?? 0 }}</div>
                    <div class="px-3 py-3 text-sm text-slate-700 text-center">{{ laborSlots[s.key]?.pt7_5h ?? 0 }}</div>
                    <div class="col-span-3 px-4 pb-2.5 text-xs text-teal-600">
                        重みつき枠数 = {{ calcWeightedH(laborSlots[s.key]?.pt6h, laborSlots[s.key]?.pt7_5h).toFixed(1) }} h
                    </div>
                </div>
                <div class="px-4 py-3 bg-teal-50 border-t border-teal-100 text-xs text-teal-700 font-bold">
                    全店合計: {{ stores.reduce((sum, s) => sum + calcWeightedH(laborSlots[s.key]?.pt6h, laborSlots[s.key]?.pt7_5h), 0).toFixed(1) }} h
                </div>
            </div>

            <!-- りょーさん枠 -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <p class="text-xs font-bold text-slate-700">りょーさんが埋めた枠数</p>
                    <p class="text-xs text-slate-400 mt-0.5">PL の人件費には計上されません。バイトに置き換えた場合の機会費用として参考表示。</p>
                </div>
                <div class="grid grid-cols-3 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                    <div class="px-4 py-2">店舗</div>
                    <div class="px-3 py-2 text-center">6h 枠数</div>
                    <div class="px-3 py-2 text-center">7.5h 枠数</div>
                </div>
                <div v-for="s in stores" :key="s.key" class="grid grid-cols-3 border-b border-slate-50 last:border-0 items-center">
                    <div class="px-4 py-3 text-sm font-bold text-slate-700">{{ s.name }}</div>
                    <div class="px-3 py-3 text-sm text-slate-700 text-center">{{ laborSlots[s.key]?.ryo6h ?? 0 }}</div>
                    <div class="px-3 py-3 text-sm text-slate-700 text-center">{{ laborSlots[s.key]?.ryo7_5h ?? 0 }}</div>
                    <div class="col-span-3 px-4 pb-2.5 text-xs text-amber-600">
                        重みつき枠数 = {{ calcWeightedH(laborSlots[s.key]?.ryo6h, laborSlots[s.key]?.ryo7_5h).toFixed(1) }} h
                    </div>
                </div>
                <div class="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 font-bold">
                    全店合計: {{ ryoTotalWeightedH.toFixed(1) }} h &nbsp;／&nbsp; 代替コスト: ¥{{ Math.round(ryoTotalWeightedH * ryoHourlyRate).toLocaleString() }}（¥{{ ryoHourlyRate.toLocaleString() }}/h）
                </div>
            </div>
        </div>

        <!-- ───── Step 5: 給与・交通費総額（手入力） ───── -->
        <div v-if="step === laborStepC" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">人件費・交通費 総額入力</p>
                    <p class="text-xs font-bold text-slate-400">5 / {{ totalSteps }}</p>
                </div>
                <p class="text-base font-bold text-slate-800">バイト給与＋交通費の全社総額 — {{ periodLabel }}</p>
                <p class="text-xs text-slate-500 mt-1.5">給与明細・交通費精算の合計を入力してください。店舗ごとに重みつき枠数で按分されます。</p>
            </div>
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">全店バイト給与＋交通費合計 <span class="text-red-500">*</span></label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <CurrencyInput v-model="totalVariablePayroll"
                        placeholder="例: 800,000"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
            </div>
        </div>

        <!-- ───── CSV モード: Step 1 ファイルアップロード ───── -->
        <div v-if="step === 1" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">売上CSV アップロード</p>
                    <p class="text-xs font-bold text-slate-400">1 / {{ totalSteps }}</p>
                </div>
                <p class="text-base font-bold text-slate-800">{{ periodLabel }}</p>
                <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    ファイル名には<strong>「馬場本店」「中野店」「馬場2号店」</strong>のいずれかを含めてください。
                    Airレジ CSV は当月暦月を指定、Airメイト CSV は各店舗の集計期間を指定してください。
                </p>

                <!-- 一括アップロードボタン -->
                <label class="mt-4 flex items-center justify-center gap-2 bg-brand-50 border border-brand-200 rounded-xl py-3 px-4 cursor-pointer hover:bg-brand-100 transition-colors">
                    <input type="file" accept=".csv,text/csv" multiple class="hidden" ref="bulkCsvInput" @change="onBulkCsvChange" />
                    <span class="text-sm font-bold text-brand-700">CSVファイルをまとめて選択（最大6ファイル）</span>
                </label>

                <div v-if="isExistingMonth" class="mt-3 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 text-xs text-teal-700">
                    <span class="font-bold">再編集モード:</span> 全店の月次レコードが揃っているため、CSV 未アップロードの店舗は DB 既存値をそのまま使用します。
                </div>

                <!-- グローバル警告（店舗名未検出など） -->
                <ul v-if="globalCsvWarnings.length" class="mt-3 space-y-1">
                    <li v-for="(w, i) in globalCsvWarnings" :key="i"
                        class="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">⚠ {{ w }}</li>
                </ul>
            </div>

            <!-- 店舗別ステータス表示 -->
            <div v-for="store in stores" :key="store.key"
                class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 class="text-sm font-bold text-slate-700">{{ store.name }}</h3>
                    <span v-if="csvFiles[store.key]?.costReport" class="text-xs text-teal-600">
                        {{ formatDate(csvFiles[store.key].costReport.start_date) }} 〜 {{ formatDate(csvFiles[store.key].costReport.end_date) }}
                    </span>
                    <span v-else class="text-xs text-red-500 font-bold">V-MINT 未入力</span>
                </div>

                <div v-if="showExistingSalesBanner(store.key)"
                    class="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700">
                    <span class="font-bold">DB既存値を使用中:</span>
                    提供 ¥{{ Number(existingMonthlyRecords[store.key].service_sales || 0).toLocaleString() }} / 物販 ¥{{ Number(existingMonthlyRecords[store.key].merchandise_sales || 0).toLocaleString() }}
                    <span class="text-amber-600">（CSV をアップロードすれば上書きされます）</span>
                </div>

                <StoreCsvUpload
                    :airmate="csvFiles[store.key]?.airmate || {}"
                    :airregi="csvFiles[store.key]?.airregi || {}"
                    :airmate-info="airmateInfoLine(store.key)"
                    :airregi-info="airregiInfoLine(store.key)"
                    :warnings="csvFiles[store.key]?.warnings || []"
                    @clear="(kind) => handleClearSlot(store.key, kind)" />
            </div>

            <p class="text-xs text-slate-400 px-1">
                すべての店舗で CSV パース完了（または DB 既存値あり）になれば「次へ」でプレビューに進みます。
            </p>
        </div>

        <!-- ───── CSV モード: Step 3 シフト CSV アップロード ───── -->
        <div v-if="step === 3" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">シフトCSV 取込</p>
                    <p class="text-xs font-bold text-slate-400">3 / {{ totalSteps }}</p>
                </div>
                <p class="text-base font-bold text-slate-800">{{ periodLabel }} — HRMOS シフト CSV</p>
                <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    HRMOS から書き出した <code class="bg-slate-100 px-1 rounded">vangvieng_shifts_YYYYMM.csv</code> をアップロードすると、各店舗の枠数（バイト・りょーさん）を自動算出します。
                </p>

                <!-- ファイル選択ボタン -->
                <label class="mt-4 flex items-center justify-center gap-2 bg-brand-50 border border-brand-200 rounded-xl py-3 px-4 cursor-pointer hover:bg-brand-100 transition-colors">
                    <input type="file" accept=".csv" @change="onUploadShiftsCsv($event)"
                        ref="shiftFileInput" class="hidden" />
                    <span class="text-sm font-bold text-brand-700">シフトCSVを選択</span>
                </label>
                <div v-if="shiftsCsvFileName" class="mt-2 flex items-center justify-center gap-2">
                    <span class="text-xs text-slate-500">{{ shiftsCsvFileName }}</span>
                    <button type="button" @click="clearShiftsCsv"
                        class="text-xs text-slate-400 hover:text-red-500 font-bold px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                        aria-label="シフトCSVを削除">削除</button>
                </div>

                <div v-if="isExistingMonth" class="mt-3 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 text-xs text-teal-700">
                    <span class="font-bold">再編集モード:</span> CSV 未アップロードのままなら DB 既存値をそのまま使用します。
                </div>
                <div v-else class="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700">
                    <span class="font-bold">新規月:</span> シフト CSV のアップロードが必須です。
                </div>
            </div>

            <!-- ステータスカード -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2">
                <p v-if="shiftsCsvProcessing" class="text-xs text-slate-500">処理中...</p>
                <p v-else-if="shiftsCsvError" class="text-xs text-red-500">{{ shiftsCsvError }}</p>
                <div v-else-if="shiftsCsvResult" class="space-y-2">
                    <p class="text-xs text-emerald-600 font-bold">✓ 取込完了：人件費プレビューに反映されました</p>
                    <div v-for="r in formatShiftsResultForUi" :key="r.storeKey"
                        class="border border-slate-100 rounded-xl px-3 py-2 text-xs">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-slate-700">{{ r.storeName }}</span>
                            <span class="text-slate-400">営業 {{ r.openingDays }}日</span>
                        </div>
                        <div class="mt-1 text-slate-600">
                            バイト: 6h × {{ r.pt6h }} / 7.5h × {{ r.pt7_5h }}（合計 {{ r.ptWeighted.toFixed(1) }}h）<br>
                            りょーさん: 6h × {{ r.ryo6h }} / 7.5h × {{ r.ryo7_5h }}（合計 {{ r.ryoWeighted.toFixed(1) }}h）
                        </div>
                    </div>
                    <div v-if="shiftsCsvResult.warnings.length > 0"
                        class="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 space-y-1">
                        <p class="font-bold">⚠ 警告</p>
                        <ul class="list-disc list-inside">
                            <li v-for="(w, i) in shiftsCsvResult.warnings" :key="i">{{ w }}</li>
                        </ul>
                    </div>
                </div>
                <div v-else-if="isExistingMonth" class="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 space-y-1.5">
                    <p><span class="font-bold">DB既存値を使用中。</span>上書きしたい場合のみ CSV をアップロードしてください。</p>
                    <div v-for="s in stores" :key="s.key" class="text-amber-600">
                        <span class="font-bold">{{ s.name }}:</span>
                        バイト 6h×{{ laborSlots[s.key]?.pt6h ?? 0 }} / 7.5h×{{ laborSlots[s.key]?.pt7_5h ?? 0 }}、りょーさん 6h×{{ laborSlots[s.key]?.ryo6h ?? 0 }} / 7.5h×{{ laborSlots[s.key]?.ryo7_5h ?? 0 }}
                    </div>
                </div>
                <p v-else class="text-xs text-red-500">未アップロード（次へ進むには CSV が必要です）</p>
            </div>
        </div>

        <!-- ───── CSV モード: Step 2 売上プレビュー ───── -->
        <div v-if="step === 2" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">売上プレビュー</p>
                    <p class="text-xs font-bold text-slate-400">2 / {{ totalSteps }}</p>
                </div>
                <p class="text-base font-bold text-slate-800">{{ periodLabel }} — 計算結果確認</p>
                <p class="text-xs text-slate-500 mt-1.5">
                    内容に問題なければ「次へ」でシフトデータ取込に進んでください。
                </p>
            </div>

            <div v-for="sd in csvPreview" :key="sd.storeKey"
                class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 class="text-sm font-bold text-slate-700">{{ sd.storeName }}</h3>
                    <span class="text-xs text-teal-600">
                        {{ formatDate(sd.start_date) }} 〜 {{ formatDate(sd.end_date) }}
                    </span>
                </div>
                <div v-if="sd.source === 'db'" class="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700">
                    <span class="font-bold">DB既存値を使用中</span>（CSV 未アップロード）
                </div>
                <div class="divide-y divide-slate-50">
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">提供売上（割引後）</span>
                        <span class="font-bold text-brand-600">¥{{ Number(sd.service_sales).toLocaleString() }}</span>
                    </div>
                    <template v-if="sd.source === 'csv'">
                        <div class="flex justify-between py-1.5 text-xs">
                            <span class="text-slate-400">　元の提供売上</span>
                            <span class="text-slate-500">¥{{ Number(sd.raw_service_sales).toLocaleString() }}</span>
                        </div>
                        <div class="flex justify-between py-1.5 text-xs">
                            <span class="text-slate-400">　割引総額</span>
                            <span class="text-slate-500">−¥{{ Number(sd.total_discount).toLocaleString() }}</span>
                        </div>
                    </template>
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">物販売上</span>
                        <span class="font-bold text-slate-800">¥{{ Number(sd.merchandise_sales).toLocaleString() }}</span>
                    </div>
                    <div v-if="sd.source === 'csv'" class="flex justify-between py-1.5 text-xs">
                        <span class="text-slate-400">　前月キャッシュ参照</span>
                        <span class="text-slate-500">{{ sd.days_from_db }} 日 / 当月CSV {{ sd.days_from_csv }} 日</span>
                    </div>
                </div>
                <p v-if="sd.source === 'csv' && sd.existing" class="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    既存レコードあり: 提供 ¥{{ Number(sd.existing.service_sales || 0).toLocaleString() }} / 物販 ¥{{ Number(sd.existing.merchandise_sales || 0).toLocaleString() }} → 上書きされます
                </p>
            </div>
            <p class="text-xs text-slate-400 px-1">家賃・固定給・決済手数料・光熱費・雑費は設定値から自動適用されます</p>
        </div>

        <!-- ───── 確認画面（step 6） ───── -->
        <div v-if="step === confirmStep" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">最終確認</p>
                    <p class="text-xs font-bold text-slate-400">6 / {{ totalSteps }}</p>
                </div>
                <p class="text-base font-bold text-slate-800">{{ periodLabel }} — 保存内容の確認</p>
                <p class="text-xs text-slate-500 mt-1.5">この内容で保存します。</p>
            </div>
            <div v-for="sd in csvPreview" :key="sd.storeKey"
                class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <h3 class="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2">{{ sd.storeName }}</h3>
                <div class="divide-y divide-slate-50">
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">提供売上（割引後）</span>
                        <span class="font-bold text-slate-800">¥{{ Number(sd.service_sales || 0).toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">物販売上</span>
                        <span class="font-bold text-slate-800">¥{{ Number(sd.merchandise_sales || 0).toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">バイト枠（6h / 7.5h）</span>
                        <span class="font-bold text-slate-800">{{ laborSlots[sd.storeKey]?.pt6h ?? 0 }} / {{ laborSlots[sd.storeKey]?.pt7_5h ?? 0 }} 枠</span>
                    </div>
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">りょーさん枠（6h / 7.5h）</span>
                        <span class="font-bold text-slate-800">{{ laborSlots[sd.storeKey]?.ryo6h ?? 0 }} / {{ laborSlots[sd.storeKey]?.ryo7_5h ?? 0 }} 枠</span>
                    </div>
                </div>
            </div>
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex justify-between text-sm">
                    <span class="text-slate-500">全店バイト給与＋交通費合計</span>
                    <span class="font-bold text-slate-800">¥{{ Number(totalVariablePayroll || 0).toLocaleString() }}</span>
                </div>
            </div>
            <p class="text-xs text-slate-400 px-1">家賃・固定給・決済手数料・光熱費・雑費は設定値から自動適用されます</p>
        </div>

    </main>
</template>

<script>
import {
    getMonthlyRecord, upsertMonthlyRecord, getCostReportDates,
    getDailySalesInRange, upsertDailySalesCache, deleteOldDailySalesCache,
    getMonthlyCompanyRecord, upsertMonthlyCompanyRecord, getLatestPeriodKey,
    getCompanySettings
} from '../../api.js'
import { buildYearOptions, buildMonthOptions, composePeriodKey, formatPeriodLabel, getNextPeriodKey, parsePeriodKey } from '../../utils/periods.js'
import {
    readShiftJisFile, parseAirmateCsv, parseAirregiCsv,
    detectDateRangeFromFilename, calcDiscountTotalInPeriod, detectCsvKindFromHeader,
    detectStoreKeyFromFilename
} from '../../utils/csvImporter.js'
import { calcShiftsFromFile } from '../../utils/shiftImporter.js'
import { fetchJpHolidaysCached } from '../../utils/jpHolidaysClient.js'
import { getHrmosStaffs, getHrmosSegments, getStores, getStoreShiftRules } from '../../api.js'
import CurrencyInput from '../CurrencyInput.vue'
import StoreCsvUpload from '../StoreCsvUpload.vue'

export default {
    name: 'InputApp',
    components: { CurrencyInput, StoreCsvUpload },
    inject: { requestConfirm: { default: null } },
    props: {
        stores: { type: Array, default: () => [] }
    },
    emits: ['update:loading', 'update:loadingMessage', 'update:stepActive', 'update:currentStep', 'update:canNext', 'update:isLastStep', 'submitted'],
    data() {
        return {
            step: 0,
            selectedYear: '',
            selectedMonth: '',
            csvFiles: {},      // { storeKey: { airmate: {file, error, parsed}, airregi: {...}, costReport } }
            csvPreview: [],    // [{ storeKey, storeName, service_sales, merchandise_sales, total_discount, source: 'csv'|'db', ... }]
            costPeriodPreview: [],
            loadingPreview: false,
            years: buildYearOptions(),
            months: buildMonthOptions(),
            // 既存月の再編集モード（全店の月次レコードが揃っていれば true）
            isExistingMonth: false,
            existingMonthlyRecords: {},  // { storeKey: pe_monthly_records 行 } — DB値フォールバックの参照元
            // 人件費入力（画面A/B 統合プレビュー / 画面C 総額入力）
            laborSlots: {},    // { storeKey: { pt6h, pt7_5h, ryo6h, ryo7_5h } }
            laborSlotsSource: 'db',  // 'csv'（シフトCSV由来） or 'db'（既存DB値 or 新規ゼロ）
            totalVariablePayroll: null,
            // シフト CSV 取込（CSV モード Step 2）
            shiftsCsvFile: null,
            shiftsCsvResult: null,    // calcShiftsFromFile の戻り値
            shiftsCsvError: null,
            shiftsCsvProcessing: false,
            shiftsCsvFileName: null,
            globalCsvWarnings: [],    // 店舗名未検出ファイル等のまとめアップロード警告
            ryoHourlyRate: 1300
        }
    },
    computed: {
        canStart() {
            return !!(this.selectedYear && this.selectedMonth)
        },
        periodKey() {
            return composePeriodKey(this.selectedYear, this.selectedMonth)
        },
        periodLabel() {
            return formatPeriodLabel(this.periodKey)
        },
        laborPreviewStep() { return 4 },  // 旧 laborStepA / laborStepB を統合した読み取り専用プレビュー
        laborStepC() { return 5 },
        confirmStep() { return 6 },
        totalSteps() { return 6 },
        formatShiftsResultForUi() {
            if (!this.shiftsCsvResult) return []
            // P3: 店舗リストは stores プロップ（App.vue が store_type==='shop' かつ is_active を抽出済み）由来で動的化。
            // shiftImporter は storeKeys（= this.stores の key）で集計結果を返す。
            return this.stores.map(store => {
                const storeKey = store.key
                const s = this.shiftsCsvResult.slots[storeKey] || { pt6h: 0, pt7_5h: 0, ryo6h: 0, ryo7_5h: 0 }
                const ptWeighted  = 6 * s.pt6h + 7.5 * s.pt7_5h
                const ryoWeighted = 6 * s.ryo6h + 7.5 * s.ryo7_5h
                return {
                    storeKey,
                    storeName: store.name,
                    ...s,
                    ptWeighted,
                    ryoWeighted,
                    openingDays: this.shiftsCsvResult.diagnostics?.storeOpeningDays?.[storeKey] ?? 0
                }
            })
        },
        canNext() {
            if (this.step === 1) {
                // 全店とも costReport は必須。CSV は新規月で必須・既存月再編集なら DB 値で代用可
                return this.stores.every(s => {
                    const c = this.csvFiles[s.key]
                    if (!c?.costReport) return false
                    const hasCsv = c?.airmate?.parsed && c?.airregi?.parsed
                    const hasDb = this.isExistingMonth && !!this.existingMonthlyRecords[s.key]
                    return hasCsv || hasDb
                })
            }
            if (this.step === 2) return true  // 売上プレビュー（読み取り専用）
            if (this.step === 3) {
                // シフト CSV: 新規月は必須・既存月再編集なら DB 値で代用可
                if (this.shiftsCsvProcessing) return false
                if (this.shiftsCsvResult) return true
                return this.isExistingMonth
            }
            if (this.step === 4) return true  // 人件費プレビュー（読み取り専用）
            if (this.step === 5) return this.totalVariablePayroll != null && this.totalVariablePayroll >= 0  // 総額入力
            if (this.step === 6) return true  // 確認
            return false
        },
        isLastStep() {
            return this.step === this.confirmStep
        },
        ryoTotalWeightedH() {
            return this.stores.reduce((sum, s) =>
                sum + this.calcWeightedH(this.laborSlots[s.key]?.ryo6h, this.laborSlots[s.key]?.ryo7_5h), 0)
        }
    },
    watch: {
        step(val) {
            this.$emit('update:stepActive', val > 0)
            this.$emit('update:currentStep', val)
            this.$emit('update:canNext', this.canNext)
            this.$emit('update:isLastStep', this.isLastStep)
        },
        canNext(val) {
            this.$emit('update:canNext', val)
        },
        isLastStep(val) {
            this.$emit('update:isLastStep', val)
        },
        async periodKey(newVal) {
            if (!newVal || String(newVal).length < 6) {
                this.costPeriodPreview = []
                return
            }
            this.loadingPreview = true
            try {
                this.costPeriodPreview = await Promise.all(
                    this.stores.map(async (s) => ({
                        storeKey: s.key,
                        storeName: s.name,
                        costReport: await getCostReportDates(s.key, newVal)
                    }))
                )
            } catch {
                this.costPeriodPreview = []
            } finally {
                this.loadingPreview = false
            }
        }
    },
    async mounted() {
        try {
            const latestPk = await getLatestPeriodKey()
            if (latestPk) {
                const nextPk = getNextPeriodKey(latestPk)
                const parsed = parsePeriodKey(nextPk)
                if (parsed) {
                    this.selectedYear = String(parsed.year)
                    this.selectedMonth = String(parsed.month)
                }
            }
        } catch {
            // 取得失敗時は空のまま（ユーザーが手動選択）
        }
    },
    methods: {
        formatDate(dateStr) {
            if (!dateStr) return '—'
            return dateStr.replace(/-/g, '/')
        },
        dayCount(costReport) {
            if (!costReport?.start_date || !costReport?.end_date) return '?'
            const start = new Date(costReport.start_date)
            const end = new Date(costReport.end_date)
            return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1
        },
        async startEntry() {
            if (!this.canStart) return
            await this.startCsvEntry()
        },
        async startCsvEntry() {
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '集計期間を取得中...')
            try {
                const [companyRec, companySetting, ...storeResults] = await Promise.all([
                    getMonthlyCompanyRecord(this.periodKey),
                    getCompanySettings(),
                    ...this.stores.map(async (s) => {
                        const [costReport, existing] = await Promise.all([
                            getCostReportDates(s.key, this.periodKey),
                            getMonthlyRecord(s.key, this.periodKey)
                        ])
                        return { storeKey: s.key, costReport, existing }
                    })
                ])
                const init = {}
                const slots = {}
                const existing = {}
                for (const sr of storeResults) {
                    init[sr.storeKey] = {
                        airmate: { file: null, error: null, parsed: null },
                        airregi: { file: null, error: null, parsed: null },
                        warnings: [],
                        costReport: sr.costReport
                    }
                    const r = sr.existing
                    existing[sr.storeKey] = r || null
                    slots[sr.storeKey] = {
                        pt6h: r?.part_time_slots_6h ?? 0,
                        pt7_5h: r?.part_time_slots_7_5h ?? 0,
                        ryo6h: r?.ryo_slots_6h ?? 0,
                        ryo7_5h: r?.ryo_slots_7_5h ?? 0
                    }
                }
                // 全店の月次レコードが揃っていれば「既存月の再編集」モード
                this.isExistingMonth = storeResults.every(sr => !!sr.existing)
                this.existingMonthlyRecords = existing
                this.csvFiles = init
                this.laborSlots = slots
                // シフトCSV未アップ時は DB 値（または新規ゼロ）扱い
                this.laborSlotsSource = 'db'
                this.ryoHourlyRate = Number(companySetting?.ryo_hourly_rate) || 1300
                this.totalVariablePayroll = companyRec?.total_variable_payroll ?? null
                this.csvPreview = []
                this.step = 1
            } catch (e) {
                alert(e.message || '集計期間の取得に失敗しました。')
            } finally {
                this.$emit('update:loading', false)
            }
        },
        handleClearSlot(storeKey, kind) {
            if (!this.csvFiles[storeKey]) return
            this.csvFiles[storeKey][kind] = { file: null, parsed: null, error: null }
            // 削除操作時は古い警告も消す（紛らわしさ回避）
            this.csvFiles[storeKey].warnings = []
            this.$emit('update:canNext', this.canNext)
        },
        onBulkCsvChange(e) {
            const files = Array.from(e.target.files || [])
            if (files.length > 0) this.handleBulkFilesUpload(files)
            e.target.value = ''
        },
        async handleBulkFilesUpload(files) {
            if (!files || files.length === 0) return
            const globalWarnings = []
            // 今回のバッチで触れた店舗の per-store warnings をリセット
            const touchedStores = new Set()
            // 店舗×種別の後勝ち検出用
            const seenPerStore = {}  // { storeKey: { airmate: filename, airregi: filename } }

            for (const file of files) {
                let text
                try {
                    text = await readShiftJisFile(file)
                } catch (e) {
                    globalWarnings.push(`${file.name}: 読み込み失敗（${e.message || 'エラー'}）`)
                    continue
                }

                const storeKey = detectStoreKeyFromFilename(file.name)
                if (!storeKey || !this.csvFiles[storeKey]) {
                    globalWarnings.push(`${file.name}: ファイル名に店舗名（馬場本店・中野店・馬場2号店）が含まれていません`)
                    continue
                }

                if (!touchedStores.has(storeKey)) {
                    this.csvFiles[storeKey].warnings = []
                    touchedStores.add(storeKey)
                }

                const kind = detectCsvKindFromHeader(text)
                if (!kind || !['airmate', 'airregi'].includes(kind)) {
                    this.csvFiles[storeKey].warnings.push(
                        `${file.name}: 種別不明（Airメイト / Airレジ いずれのヘッダーにも一致しません）`
                    )
                    continue
                }

                const storeName = this.stores.find(s => s.key === storeKey)?.name || storeKey
                const kindLabel = kind === 'airmate' ? '商品別売上' : '日別売上'
                if (!seenPerStore[storeKey]) seenPerStore[storeKey] = {}
                if (seenPerStore[storeKey][kind]) {
                    this.csvFiles[storeKey].warnings.push(
                        `${storeName} の ${kindLabel}CSV が複数あります。「${file.name}」を採用します`
                    )
                }
                seenPerStore[storeKey][kind] = file.name

                try {
                    const dateRange = detectDateRangeFromFilename(file.name)
                    let parsed
                    if (kind === 'airmate') {
                        const m = parseAirmateCsv(text)
                        parsed = { ...m, ...dateRange }
                    } else {
                        const rows = parseAirregiCsv(text)
                        parsed = { rows, ...dateRange }
                    }
                    this.csvFiles[storeKey][kind] = { file, error: null, parsed }
                } catch (e) {
                    this.csvFiles[storeKey][kind] = { file, parsed: null, error: e.message || 'パースエラー' }
                }
            }

            this.globalCsvWarnings = globalWarnings
            this.$emit('update:canNext', this.canNext)
        },
        airmateInfoLine(storeKey) {
            const p = this.csvFiles[storeKey]?.airmate?.parsed
            if (!p) return null
            return `提供 ¥${Number(p.raw_service_sales).toLocaleString()} / 物販 ¥${Number(p.raw_merchandise_sales).toLocaleString()}`
        },
        showExistingSalesBanner(storeKey) {
            if (!this.isExistingMonth) return false
            const c = this.csvFiles[storeKey]
            const hasCsv = c?.airmate?.parsed && c?.airregi?.parsed
            return !hasCsv && !!this.existingMonthlyRecords[storeKey]
        },
        airregiInfoLine(storeKey) {
            const p = this.csvFiles[storeKey]?.airregi?.parsed
            if (!p) return null
            const totalDiscount = p.rows.reduce((s, r) => s + Number(r.discount_amount || 0), 0)
            return `${p.rows.length} 日 / 割引合計 ¥${totalDiscount.toLocaleString()}`
        },
        async buildCsvPreview() {
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '前月キャッシュを取得中...')
            try {
                const preview = []
                for (const s of this.stores) {
                    const c = this.csvFiles[s.key]
                    const cr = c.costReport
                    if (!cr) throw new Error(`${s.name}: V-MINT 集計期間が未入力です`)
                    const airmate = c.airmate?.parsed
                    const airregi = c.airregi?.parsed
                    const existing = this.existingMonthlyRecords[s.key] || null
                    // CSV 未アップなら DB 既存値フォールバック（既存月再編集モードのみ通る）
                    if (!airmate || !airregi) {
                        if (!existing) throw new Error(`${s.name}: CSV も既存値もありません`)
                        preview.push({
                            storeKey: s.key,
                            storeName: s.name,
                            start_date: cr.start_date,
                            end_date: cr.end_date,
                            raw_service_sales: null,
                            merchandise_sales: Number(existing.merchandise_sales || 0),
                            total_discount: null,
                            service_sales: Number(existing.service_sales || 0),
                            days_from_db: 0,
                            days_from_csv: 0,
                            cacheMissing: false,
                            source: 'db',
                            existing
                        })
                        continue
                    }
                    // 前月最終盤のキャッシュを DB から取得
                    const dbDaily = await getDailySalesInRange(s.key, cr.start_date, cr.end_date)
                    const calc = calcDiscountTotalInPeriod(dbDaily, airregi.rows, cr.start_date, cr.end_date)
                    // 前月最終盤の DB データが必要なはずなのに無い場合の警告判定
                    // 当月CSVの最古日 > start_date のとき、その間の日が必要
                    const csvMinDate = airregi.rows.reduce((min, r) => r.sale_date < min ? r.sale_date : min, '9999-99-99')
                    const cacheNeeded = csvMinDate > cr.start_date
                    const cacheMissing = cacheNeeded && calc.days_from_db === 0
                    preview.push({
                        storeKey: s.key,
                        storeName: s.name,
                        start_date: cr.start_date,
                        end_date: cr.end_date,
                        raw_service_sales: airmate.raw_service_sales,
                        merchandise_sales: airmate.raw_merchandise_sales,
                        total_discount: calc.total_discount,
                        service_sales: Math.max(0, airmate.raw_service_sales - calc.total_discount),
                        days_from_db: calc.days_from_db,
                        days_from_csv: calc.days_from_csv,
                        cacheMissing,
                        source: 'csv',
                        existing
                    })
                }
                // 前月キャッシュ欠落の警告
                const missing = preview.filter(p => p.cacheMissing).map(p => p.storeName)
                if (missing.length > 0) {
                    const msg = `前月分の日次キャッシュが見つかりません: ${missing.join(', ')}\n` +
                                `前月インポート漏れの可能性があります。割引集計が過小になるため、SQL で手動投入を推奨します。\n\n` +
                                `このまま続行しますか？`
                    const ok = this.requestConfirm
                        ? await this.requestConfirm(msg, '続行', 'text-amber-600 hover:bg-amber-50')
                        : window.confirm(msg)
                    if (!ok) return false
                }
                this.csvPreview = preview
                return true
            } catch (e) {
                alert(e.message || 'プレビュー生成に失敗しました。')
                return false
            } finally {
                this.$emit('update:loading', false)
            }
        },
        prevStep() {
            if (this.step > 0) this.step--
        },
        async nextStep() {
            // CSV step 1 → 2: 売上プレビュー生成
            if (this.step === 1) {
                const ok = await this.buildCsvPreview()
                if (!ok) return
                this.step = 2
                return
            }
            this.step++
        },
        async submit() {
            await this.submitCsv()
        },
        async submitCsv() {
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                // 日次キャッシュ upsert（CSV あり店舗のみ。DB値フォールバック店舗はスキップ）
                await Promise.all(this.stores.map(async (s) => {
                    const airregi = this.csvFiles[s.key]?.airregi?.parsed
                    if (!airregi) return
                    await upsertDailySalesCache(s.key, airregi.rows)
                }))
                // 月次レコード upsert（売上は CSV/DB のいずれか、枠数はプレビュー値）
                await Promise.all(this.csvPreview.map(p => {
                    const sl = this.laborSlots[p.storeKey] || {}
                    return upsertMonthlyRecord(p.storeKey, this.periodKey, {
                        service_sales: p.service_sales,
                        merchandise_sales: p.merchandise_sales,
                        part_time_slots_6h: sl.pt6h ?? 0,
                        part_time_slots_7_5h: sl.pt7_5h ?? 0,
                        ryo_slots_6h: sl.ryo6h ?? 0,
                        ryo_slots_7_5h: sl.ryo7_5h ?? 0
                    })
                }))
                // 全社人件費レコード upsert
                await upsertMonthlyCompanyRecord(this.periodKey, {
                    total_variable_payroll: this.totalVariablePayroll ?? 0
                })
                // 古いキャッシュを削除（CSV を新たにアップした店舗のみ）
                await Promise.all(this.csvPreview
                    .filter(p => p.source === 'csv')
                    .map(p => deleteOldDailySalesCache(p.storeKey, p.start_date)))
                alert('保存しました。')
                this.resetAll()
                this.$emit('submitted')
            } catch (e) {
                alert(e.message || '保存に失敗しました。')
            } finally {
                this.$emit('update:loading', false)
            }
        },
        resetAll() {
            this.step = 0
            this.csvFiles = {}
            this.csvPreview = []
            this.laborSlots = {}
            this.laborSlotsSource = 'db'
            this.isExistingMonth = false
            this.existingMonthlyRecords = {}
            this.totalVariablePayroll = null
            this.shiftsCsvFile = null
            this.shiftsCsvResult = null
            this.shiftsCsvError = null
            this.shiftsCsvFileName = null
        },
        calcWeightedH(slots6h, slots7_5h) {
            return 6.0 * Number(slots6h || 0) + 7.5 * Number(slots7_5h || 0)
        },
        clearShiftsCsv() {
            this.shiftsCsvFile = null
            this.shiftsCsvFileName = null
            this.shiftsCsvResult = null
            this.shiftsCsvError = null
            this.$emit('update:canNext', this.canNext)
        },
        // シフト CSV 取込（CSV モード Step 2）
        async onUploadShiftsCsv(event) {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            this.shiftsCsvFileName = file.name
            this.shiftsCsvFile = file
            this.shiftsCsvError = null
            this.shiftsCsvResult = null
            this.shiftsCsvProcessing = true
            try {
                const [staffs, segments, storesDb, shiftRules] = await Promise.all([
                    getHrmosStaffs(),
                    getHrmosSegments(),
                    getStores(),
                    getStoreShiftRules()
                ])
                if (staffs.length === 0 || segments.length === 0) {
                    throw new Error('HRMOS スタッフ／勤務区分マスタが未登録です。設定モードから CSV を取り込んでください。')
                }
                const storeKeyById = new Map(storesDb.map(s => [s.id, s.store_key]))
                // P3: 集計対象店舗は stores プロップ（active な shop 店舗）由来で動的化
                const storeKeys = this.stores.map(s => s.key)
                const holidaySet = await fetchJpHolidaysCached(this.periodKey)
                const result = await calcShiftsFromFile(file, this.periodKey, {
                    staffs, segments, holidaySet, storeKeyById, storeKeys, shiftRules
                })
                this.shiftsCsvResult = result
                // laborSlots に反映（result.slots のキー＝storeKeys を走査。
                // store_key 正規化シム：レガシー保存データの 'baba' → 'baba_main' は残す）
                for (const sKey of Object.keys(result.slots)) {
                    const target = (sKey === 'baba_main' && this.laborSlots['baba']) ? 'baba' : sKey
                    if (!this.laborSlots[target]) this.laborSlots[target] = { pt6h: 0, pt7_5h: 0, ryo6h: 0, ryo7_5h: 0 }
                    const s = result.slots[sKey]
                    if (!s) continue
                    this.laborSlots[target].pt6h    = s.pt6h
                    this.laborSlots[target].pt7_5h  = s.pt7_5h
                    this.laborSlots[target].ryo6h   = s.ryo6h
                    this.laborSlots[target].ryo7_5h = s.ryo7_5h
                }
                this.laborSlotsSource = 'csv'
            } catch (e) {
                this.shiftsCsvError = e.message || 'シフト CSV の処理に失敗しました'
            } finally {
                this.shiftsCsvProcessing = false
            }
        }
    }
}
</script>

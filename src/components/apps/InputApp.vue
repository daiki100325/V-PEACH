<template>
    <main class="container mx-auto px-4 py-6 max-w-lg md:max-w-3xl flex-grow">

        <!-- Step 0: 対象月選択 + モード切替 -->
        <div v-if="step === 0" class="flex flex-col items-center pt-6 pb-20">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5 w-full max-w-md">
                <div class="text-center">
                    <h2 class="text-xl font-bold text-slate-800">月次データを入力</h2>
                    <p class="text-sm text-slate-400 mt-1">全{{ stores.length }}店舗分を一括入力します</p>
                </div>

                <!-- モード切替タブ -->
                <div class="bg-slate-100 rounded-xl p-1 flex gap-1">
                    <button type="button" @click="inputMode = 'csv'"
                        class="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors"
                        :class="inputMode === 'csv' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
                        CSV インポート
                    </button>
                    <button type="button" @click="inputMode = 'manual'"
                        class="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors"
                        :class="inputMode === 'manual' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
                        手入力
                    </button>
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

        <!-- ───── Manual モード: Step 1〜N 店舗別売上入力 ───── -->
        <div v-if="inputMode === 'manual' && step >= 1 && step <= stores.length && currentStore" class="space-y-4 pb-32">

            <!-- ヘッダー -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">売上入力</p>
                    <p class="text-xs font-bold text-slate-400">{{ step }} / {{ stores.length }}</p>
                </div>
                <p class="text-base font-bold text-slate-800">{{ currentStore.storeName }} — {{ periodLabel }}</p>
                <p v-if="currentStore.costReport"
                    class="text-xs text-teal-600 mt-1.5">
                    集計期間: {{ formatDate(currentStore.costReport.start_date) }} 〜 {{ formatDate(currentStore.costReport.end_date) }}（{{ dayCount(currentStore.costReport) }}日間）
                </p>
                <p v-else class="text-xs text-slate-400 mt-1.5">集計期間: V-MINT 未入力</p>
            </div>

            <!-- 提供売上（税込） -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">提供売上（税込） <span class="text-red-500">*</span></label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <CurrencyInput v-model="currentStore.formData.service_sales"
                        :placeholder="currentStore.prevRecord ? Number(currentStore.prevRecord.service_sales).toLocaleString('ja-JP') : '例: 1,500,000'"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
                <p v-if="currentStore.prevRecord" class="text-xs text-slate-400">前月実績: ¥{{ Number(currentStore.prevRecord.service_sales || 0).toLocaleString() }}</p>
            </div>

            <!-- 物販売上（税込） -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">物販売上（税込）</label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <CurrencyInput v-model="currentStore.formData.merchandise_sales"
                        placeholder="例: 50,000（なければ空欄）"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
                <p class="text-xs text-slate-400">物販がない月は空欄のままで構いません（0として扱います）</p>
            </div>
        </div>

        <!-- ───── 人件費 画面A: バイトが埋めた枠数 ───── -->
        <div v-if="step === laborStepA && (inputMode === 'manual' || inputMode === 'csv')" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">人件費入力 A</p>
                    <p v-if="inputMode === 'csv'" class="text-xs font-bold text-slate-400">4 / 6</p>
                </div>
                <p class="text-base font-bold text-slate-800">バイトが埋めた枠数 — {{ periodLabel }}</p>
                <p class="text-xs text-slate-500 mt-1.5">店舗ごとにシフト枠数を入力してください。重みつき枠数（h）をリアルタイム計算します。</p>
            </div>
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div class="grid grid-cols-3 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                    <div class="px-4 py-2.5">店舗</div>
                    <div class="px-3 py-2.5 text-center">6h 枠数</div>
                    <div class="px-3 py-2.5 text-center">7.5h 枠数</div>
                </div>
                <div v-for="s in stores" :key="s.key" class="grid grid-cols-3 border-b border-slate-50 last:border-0 items-center">
                    <div class="px-4 py-3 text-sm font-bold text-slate-700">{{ s.name }}</div>
                    <div class="px-3 py-2">
                        <input type="number" min="0" step="1"
                            v-model.number="laborSlots[s.key].pt6h"
                            class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2 text-slate-800 text-center focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                    <div class="px-3 py-2">
                        <input type="number" min="0" step="1"
                            v-model.number="laborSlots[s.key].pt7_5h"
                            class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2 text-slate-800 text-center focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                    <div class="col-span-3 px-4 pb-2.5 text-xs text-teal-600">
                        重みつき枠数 = {{ calcWeightedH(laborSlots[s.key].pt6h, laborSlots[s.key].pt7_5h).toFixed(1) }} h
                    </div>
                </div>
                <div class="px-4 py-3 bg-teal-50 border-t border-teal-100 text-xs text-teal-700 font-bold">
                    全店合計: {{ stores.reduce((sum, s) => sum + calcWeightedH(laborSlots[s.key].pt6h, laborSlots[s.key].pt7_5h), 0).toFixed(1) }} h
                </div>
            </div>
        </div>

        <!-- ───── 人件費 画面B: りょーさんが埋めた枠数 ───── -->
        <div v-if="step === laborStepB && (inputMode === 'manual' || inputMode === 'csv')" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">人件費入力 B</p>
                    <p v-if="inputMode === 'csv'" class="text-xs font-bold text-slate-400">5 / 6</p>
                </div>
                <p class="text-base font-bold text-slate-800">りょーさんが埋めた枠数 — {{ periodLabel }}</p>
                <p class="text-xs text-slate-500 mt-1.5">PL の人件費には計上されません。バイトに置き換えた場合の機会費用として参考表示します。</p>
            </div>
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div class="grid grid-cols-3 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                    <div class="px-4 py-2.5">店舗</div>
                    <div class="px-3 py-2.5 text-center">6h 枠数</div>
                    <div class="px-3 py-2.5 text-center">7.5h 枠数</div>
                </div>
                <div v-for="s in stores" :key="s.key" class="grid grid-cols-3 border-b border-slate-50 last:border-0 items-center">
                    <div class="px-4 py-3 text-sm font-bold text-slate-700">{{ s.name }}</div>
                    <div class="px-3 py-2">
                        <input type="number" min="0" step="1"
                            v-model.number="laborSlots[s.key].ryo6h"
                            class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2 text-slate-800 text-center focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                    <div class="px-3 py-2">
                        <input type="number" min="0" step="1"
                            v-model.number="laborSlots[s.key].ryo7_5h"
                            class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2 text-slate-800 text-center focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                    <div class="col-span-3 px-4 pb-2.5 text-xs text-amber-600">
                        代替コスト参考: {{ calcWeightedH(laborSlots[s.key].ryo6h, laborSlots[s.key].ryo7_5h).toFixed(1) }} h
                    </div>
                </div>
            </div>
        </div>

        <!-- ───── 人件費 画面C: 給与・交通費総額 ───── -->
        <div v-if="step === laborStepC && (inputMode === 'manual' || inputMode === 'csv')" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">人件費入力 C</p>
                    <p v-if="inputMode === 'csv'" class="text-xs font-bold text-slate-400">6 / 6</p>
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

        <!-- ───── Manual モード: 確認画面 ───── -->
        <div v-if="inputMode === 'manual' && step === confirmStep" class="space-y-4 pb-32">
            <div v-for="sd in storeData" :key="sd.storeKey"
                class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <h3 class="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2">{{ sd.storeName }}</h3>
                <div class="divide-y divide-slate-50">
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">提供売上（税込）</span>
                        <span class="font-bold text-slate-800">¥{{ Number(sd.formData.service_sales || 0).toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">物販売上（税込）</span>
                        <span class="font-bold text-slate-800">¥{{ Number(sd.formData.merchandise_sales || 0).toLocaleString() }}</span>
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

        <!-- ───── CSV モード: Step 1 ファイルアップロード ───── -->
        <div v-if="inputMode === 'csv' && step === 1" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">CSV アップロード</p>
                    <p class="text-xs font-bold text-slate-400">1 / 6</p>
                </div>
                <p class="text-base font-bold text-slate-800">{{ periodLabel }}</p>
                <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    各店舗のボックスに<strong>商品別売上CSV（Airメイト）</strong>と<strong>日別売上CSV（Airレジ）</strong>を<strong>まとめて選択</strong>してください（順不同・1ファイルずつでも可）。
                    Airレジ CSV は当月暦月全体を指定（前月分はDBキャッシュから自動取得）。
                </p>
            </div>

            <div v-for="store in stores" :key="store.key"
                class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 class="text-sm font-bold text-slate-700">{{ store.name }}</h3>
                    <span v-if="csvFiles[store.key]?.costReport" class="text-xs text-teal-600">
                        {{ formatDate(csvFiles[store.key].costReport.start_date) }} 〜 {{ formatDate(csvFiles[store.key].costReport.end_date) }}
                    </span>
                    <span v-else class="text-xs text-red-500 font-bold">V-MINT 未入力</span>
                </div>

                <StoreCsvUpload
                    :airmate="csvFiles[store.key]?.airmate || {}"
                    :airregi="csvFiles[store.key]?.airregi || {}"
                    :airmate-info="airmateInfoLine(store.key)"
                    :airregi-info="airregiInfoLine(store.key)"
                    :warnings="csvFiles[store.key]?.warnings || []"
                    @files="(files) => handleFilesUpload(store.key, files)"
                    @clear="(kind) => handleClearSlot(store.key, kind)" />
            </div>

            <p class="text-xs text-slate-400 px-1">
                すべてのファイルが正常にパースされたら、フッターの「次へ」でプレビューに進みます。
            </p>
        </div>

        <!-- ───── CSV モード: Step 3 シフト CSV アップロード（任意） ───── -->
        <div v-if="inputMode === 'csv' && step === 3" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">シフトデータ取込（任意）</p>
                    <p class="text-xs font-bold text-slate-400">3 / 6</p>
                </div>
                <p class="text-base font-bold text-slate-800">{{ periodLabel }} — HRMOS シフト CSV</p>
                <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    HRMOS から書き出した <code class="bg-slate-100 px-1 rounded">vangvieng_shifts_YYYYMM.csv</code> をアップロードすると、画面A・Bの枠数を自動算出します。<br>
                    アップロードしない場合は画面A・B で手入力できます（既存値は保持）。
                </p>
            </div>

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div class="flex items-center gap-3">
                    <label class="inline-flex items-center cursor-pointer">
                        <span class="py-2 px-3 rounded-xl text-xs font-bold bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors">ファイルを選択</span>
                        <input type="file" accept=".csv" @change="onUploadShiftsCsv($event)"
                            ref="shiftFileInput" class="sr-only" />
                    </label>
                    <span class="text-xs text-slate-500">{{ shiftsCsvFileName || '選択されていません' }}</span>
                </div>
                <p v-if="shiftsCsvProcessing" class="text-xs text-slate-500">処理中...</p>
                <p v-else-if="shiftsCsvError" class="text-xs text-red-500">{{ shiftsCsvError }}</p>
                <div v-else-if="shiftsCsvResult" class="space-y-2">
                    <p class="text-xs text-emerald-600 font-bold">✓ 取込完了：画面A・B に反映されました</p>
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
                <p v-else class="text-xs text-slate-400">未アップロード（画面A・B で手入力）</p>
            </div>
        </div>

        <!-- ───── CSV モード: Step 2 売上プレビュー ───── -->
        <div v-if="inputMode === 'csv' && step === 2" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">プレビュー</p>
                    <p class="text-xs font-bold text-slate-400">2 / 6</p>
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
                <div class="divide-y divide-slate-50">
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">提供売上（割引後）</span>
                        <span class="font-bold text-brand-600">¥{{ Number(sd.service_sales).toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between py-1.5 text-xs">
                        <span class="text-slate-400">　元の提供売上</span>
                        <span class="text-slate-500">¥{{ Number(sd.raw_service_sales).toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between py-1.5 text-xs">
                        <span class="text-slate-400">　割引総額</span>
                        <span class="text-slate-500">−¥{{ Number(sd.total_discount).toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">物販売上</span>
                        <span class="font-bold text-slate-800">¥{{ Number(sd.merchandise_sales).toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between py-1.5 text-xs">
                        <span class="text-slate-400">　前月キャッシュ参照</span>
                        <span class="text-slate-500">{{ sd.days_from_db }} 日 / 当月CSV {{ sd.days_from_csv }} 日</span>
                    </div>
                </div>
                <p v-if="sd.existing" class="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    既存レコードあり: 提供 ¥{{ Number(sd.existing.service_sales || 0).toLocaleString() }} / 物販 ¥{{ Number(sd.existing.merchandise_sales || 0).toLocaleString() }} → 上書きされます
                </p>
            </div>
            <p class="text-xs text-slate-400 px-1">家賃・固定給・決済手数料・光熱費・雑費は設定値から自動適用されます</p>
        </div>

        <!-- ───── CSV モード: 確認画面（step 7） ───── -->
        <div v-if="inputMode === 'csv' && step === confirmStep" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">最終確認</p>
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
    getMonthlyCompanyRecord, upsertMonthlyCompanyRecord, getLatestPeriodKey
} from '../../api.js'
import { buildYearOptions, buildMonthOptions, composePeriodKey, formatPeriodLabel, getPrevPeriodKey, getNextPeriodKey, parsePeriodKey } from '../../utils/periods.js'
import {
    readShiftJisFile, parseAirmateCsv, parseAirregiCsv,
    detectDateRangeFromFilename, calcDiscountTotalInPeriod, detectCsvKindFromHeader
} from '../../utils/csvImporter.js'
import { calcShiftsFromFile } from '../../utils/shiftImporter.js'
import { fetchJpHolidaysCached } from '../../utils/jpHolidaysClient.js'
import { getHrmosStaffs, getHrmosSegments, getStores } from '../../api.js'
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
            inputMode: 'csv',
            selectedYear: '',
            selectedMonth: '',
            storeData: [],
            csvFiles: {},      // { storeKey: { airmate: {file, error, parsed}, airregi: {...}, costReport } }
            csvPreview: [],    // [{ storeKey, storeName, service_sales, merchandise_sales, total_discount, ... }]
            costPeriodPreview: [],
            loadingPreview: false,
            years: buildYearOptions(),
            months: buildMonthOptions(),
            // 人件費入力（画面A/B/C 共通）
            laborSlots: {},    // { storeKey: { pt6h, pt7_5h, ryo6h, ryo7_5h } }
            totalVariablePayroll: null,
            // シフト CSV 取込（CSV モード Step 2）
            shiftsCsvFile: null,
            shiftsCsvResult: null,    // calcShiftsFromFile の戻り値
            shiftsCsvError: null,
            shiftsCsvProcessing: false,
            shiftsCsvFileName: null
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
        currentStore() {
            if (this.inputMode === 'manual' && this.step >= 1 && this.step <= this.stores.length) {
                return this.storeData[this.step - 1] ?? null
            }
            return null
        },
        // CSV モードのみ：売上プレビュー = step 2
        csvPreviewStep() {
            return this.inputMode === 'csv' ? 2 : null
        },
        // CSV モードのみ：シフト CSV アップロード = step 3
        shiftsCsvStep() {
            return this.inputMode === 'csv' ? 3 : null
        },
        laborStepA() {
            // Manual: step N+1, CSV: step 4（売上+シフト+プレビュー の後）
            if (this.inputMode === 'manual') return this.stores.length + 1
            return 4
        },
        laborStepB() {
            return this.laborStepA + 1
        },
        laborStepC() {
            return this.laborStepB + 1
        },
        confirmStep() {
            if (this.inputMode === 'manual') return this.stores.length + 4
            return 7
        },
        formatShiftsResultForUi() {
            if (!this.shiftsCsvResult) return []
            const storeNameByKey = Object.fromEntries(this.stores.map(s => [s.key === 'baba' ? 'baba_main' : s.key, s.name]))
            // shiftImporter は 'baba_main' / 'nakano' / 'baba_2nd' で返す
            const STORE_KEYS = ['baba_main', 'nakano', 'baba_2nd']
            return STORE_KEYS.map(storeKey => {
                const s = this.shiftsCsvResult.slots[storeKey] || { pt6h: 0, pt7_5h: 0, ryo6h: 0, ryo7_5h: 0 }
                const ptWeighted  = 6 * s.pt6h + 7.5 * s.pt7_5h
                const ryoWeighted = 6 * s.ryo6h + 7.5 * s.ryo7_5h
                return {
                    storeKey,
                    storeName: storeNameByKey[storeKey] || storeKey,
                    ...s,
                    ptWeighted,
                    ryoWeighted,
                    openingDays: this.shiftsCsvResult.diagnostics?.storeOpeningDays?.[storeKey] ?? 0
                }
            })
        },
        canNext() {
            if (this.inputMode === 'manual') {
                if (this.step >= 1 && this.step <= this.stores.length) {
                    const fd = this.storeData[this.step - 1]?.formData
                    if (!fd) return false
                    return fd.service_sales != null && fd.service_sales >= 0
                }
                // 画面A: バイト枠数（0以上の整数なのでいつでも次へ可）
                if (this.step === this.laborStepA) return true
                // 画面B: 同上
                if (this.step === this.laborStepB) return true
                // 画面C: 総額が入力済みであること（0円でも可）
                if (this.step === this.laborStepC) return this.totalVariablePayroll != null && this.totalVariablePayroll >= 0
                // 確認画面
                if (this.step === this.confirmStep) return true
                return false
            }
            // CSV モード
            if (this.step === 1) {
                return this.stores.every(s => {
                    const c = this.csvFiles[s.key]
                    return c?.airmate?.parsed && c?.airregi?.parsed && c?.costReport
                })
            }
            if (this.step === 2) return true  // 売上プレビュー
            if (this.step === 3) return !this.shiftsCsvProcessing  // シフト CSV（任意・処理中以外いつでも次へ）
            if (this.step === 4) return true  // 画面A
            if (this.step === 5) return true  // 画面B
            if (this.step === 6) return this.totalVariablePayroll != null && this.totalVariablePayroll >= 0  // 画面C
            if (this.step === 7) return true  // 確認
            return false
        },
        isLastStep() {
            return this.step === this.confirmStep
        }
    },
    watch: {
        step(val) {
            this.$emit('update:stepActive', val > 0)
            this.$emit('update:currentStep', val)
            this.$emit('update:canNext', this.canNext)
            this.$emit('update:isLastStep', this.isLastStep)
        },
        inputMode() {
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
            if (this.inputMode === 'manual') {
                await this.startManualEntry()
            } else {
                await this.startCsvEntry()
            }
        },
        // ─── Manual モード ─────────────────────────────────────────────
        async startManualEntry() {
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', 'データを読み込み中...')
            try {
                const prevPk = getPrevPeriodKey(this.periodKey)
                const [companyRec, results] = await Promise.all([
                    getMonthlyCompanyRecord(this.periodKey),
                    Promise.all(
                        this.stores.map(async (s) => {
                            const [existing, prev, costDates] = await Promise.all([
                                getMonthlyRecord(s.key, this.periodKey),
                                getMonthlyRecord(s.key, prevPk),
                                getCostReportDates(s.key, this.periodKey)
                            ])
                            return {
                                storeKey: s.key,
                                storeName: s.name,
                                formData: existing ? {
                                    service_sales: existing.service_sales,
                                    merchandise_sales: existing.merchandise_sales
                                } : { service_sales: null, merchandise_sales: null },
                                prevRecord: prev,
                                costReport: costDates,
                                existingRecord: existing
                            }
                        })
                    )
                ])
                this.storeData = results
                // laborSlots を既存データで初期化
                const slots = {}
                for (const sd of results) {
                    const r = sd.existingRecord
                    slots[sd.storeKey] = {
                        pt6h: r?.part_time_slots_6h ?? 0,
                        pt7_5h: r?.part_time_slots_7_5h ?? 0,
                        ryo6h: r?.ryo_slots_6h ?? 0,
                        ryo7_5h: r?.ryo_slots_7_5h ?? 0
                    }
                }
                this.laborSlots = slots
                this.totalVariablePayroll = companyRec?.total_variable_payroll ?? null
                this.step = 1
            } catch (e) {
                alert(e.message || 'データの読み込みに失敗しました。')
            } finally {
                this.$emit('update:loading', false)
            }
        },
        // ─── CSV モード ────────────────────────────────────────────────
        async startCsvEntry() {
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '集計期間を取得中...')
            try {
                const [companyRec, ...storeResults] = await Promise.all([
                    getMonthlyCompanyRecord(this.periodKey),
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
                for (const sr of storeResults) {
                    init[sr.storeKey] = {
                        airmate: { file: null, error: null, parsed: null },
                        airregi: { file: null, error: null, parsed: null },
                        warnings: [],
                        costReport: sr.costReport
                    }
                    const r = sr.existing
                    slots[sr.storeKey] = {
                        pt6h: r?.part_time_slots_6h ?? 0,
                        pt7_5h: r?.part_time_slots_7_5h ?? 0,
                        ryo6h: r?.ryo_slots_6h ?? 0,
                        ryo7_5h: r?.ryo_slots_7_5h ?? 0
                    }
                }
                this.csvFiles = init
                this.laborSlots = slots
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
        async handleFilesUpload(storeKey, files) {
            if (!files || files.length === 0) return
            // 新しい選択ごとに警告はリセット（追加マージ方針なので既存スロットは温存）
            const warnings = []
            const seen = { airmate: null, airregi: null }
            for (const file of files) {
                let text
                try {
                    text = await readShiftJisFile(file)
                } catch (e) {
                    warnings.push(`${file.name}: 読み込み失敗（${e.message || 'エラー'}）`)
                    continue
                }
                const kind = detectCsvKindFromHeader(text)
                if (!kind) {
                    warnings.push(`${file.name}: 種別不明（Airメイト / Airレジ いずれのヘッダーにも一致しません）`)
                    continue
                }
                const kindLabel = kind === 'airmate' ? '商品別売上' : '日別売上'
                // 今回の選択内に同種が複数あれば後勝ち警告
                if (seen[kind]) {
                    warnings.push(`${kindLabel}CSV が複数選択されました。最後の「${file.name}」を採用します`)
                }
                seen[kind] = file.name
                // パース
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
            this.csvFiles[storeKey].warnings = warnings
            this.$emit('update:canNext', this.canNext)
        },
        airmateInfoLine(storeKey) {
            const p = this.csvFiles[storeKey]?.airmate?.parsed
            if (!p) return null
            return `提供 ¥${Number(p.raw_service_sales).toLocaleString()} / 物販 ¥${Number(p.raw_merchandise_sales).toLocaleString()}`
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
                    const airmate = c.airmate.parsed
                    const airregi = c.airregi.parsed
                    // 前月最終盤のキャッシュを DB から取得
                    const dbDaily = await getDailySalesInRange(s.key, cr.start_date, cr.end_date)
                    const calc = calcDiscountTotalInPeriod(dbDaily, airregi.rows, cr.start_date, cr.end_date)
                    // 前月最終盤の DB データが必要なはずなのに無い場合の警告判定
                    // 当月CSVの最古日 > start_date のとき、その間の日が必要
                    const csvMinDate = airregi.rows.reduce((min, r) => r.sale_date < min ? r.sale_date : min, '9999-99-99')
                    const cacheNeeded = csvMinDate > cr.start_date
                    const cacheMissing = cacheNeeded && calc.days_from_db === 0
                    // 既存レコード取得
                    const existing = await getMonthlyRecord(s.key, this.periodKey)
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
            if (this.inputMode === 'csv' && this.step === 1) {
                const ok = await this.buildCsvPreview()
                if (!ok) return
                this.step = 2
                return
            }
            this.step++
        },
        async submit() {
            if (this.inputMode === 'manual') {
                await this.submitManual()
            } else {
                await this.submitCsv()
            }
        },
        async submitManual() {
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                await Promise.all([
                    ...this.storeData.map(sd => {
                        const sl = this.laborSlots[sd.storeKey] || {}
                        return upsertMonthlyRecord(sd.storeKey, this.periodKey, {
                            service_sales: sd.formData.service_sales,
                            merchandise_sales: sd.formData.merchandise_sales ?? 0,
                            part_time_slots_6h: sl.pt6h ?? 0,
                            part_time_slots_7_5h: sl.pt7_5h ?? 0,
                            ryo_slots_6h: sl.ryo6h ?? 0,
                            ryo_slots_7_5h: sl.ryo7_5h ?? 0
                        })
                    }),
                    upsertMonthlyCompanyRecord(this.periodKey, {
                        total_variable_payroll: this.totalVariablePayroll ?? 0
                    })
                ])
                alert('保存しました。')
                this.resetAll()
                this.$emit('submitted')
            } catch (e) {
                alert(e.message || '保存に失敗しました。')
            } finally {
                this.$emit('update:loading', false)
            }
        },
        async submitCsv() {
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                // 日次キャッシュ upsert
                await Promise.all(this.stores.map(async (s) => {
                    const rows = this.csvFiles[s.key].airregi.parsed.rows
                    await upsertDailySalesCache(s.key, rows)
                }))
                // 月次レコード upsert（枠数を含む）
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
                // 古いキャッシュを削除
                await Promise.all(this.csvPreview.map(p =>
                    deleteOldDailySalesCache(p.storeKey, p.start_date)
                ))
                alert('保存しました。日次キャッシュも更新済みです。')
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
            this.storeData = []
            this.csvFiles = {}
            this.csvPreview = []
            this.laborSlots = {}
            this.totalVariablePayroll = null
            this.shiftsCsvFile = null
            this.shiftsCsvResult = null
            this.shiftsCsvError = null
            this.shiftsCsvFileName = null
        },
        calcWeightedH(slots6h, slots7_5h) {
            return 6.0 * Number(slots6h || 0) + 7.5 * Number(slots7_5h || 0)
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
                const [staffs, segments, storesDb] = await Promise.all([
                    getHrmosStaffs(),
                    getHrmosSegments(),
                    getStores()
                ])
                if (staffs.length === 0 || segments.length === 0) {
                    throw new Error('HRMOS スタッフ／勤務区分マスタが未登録です。設定モードから CSV を取り込んでください。')
                }
                const storeKeyById = new Map(storesDb.map(s => [s.id, s.store_key]))
                const holidaySet = await fetchJpHolidaysCached(this.periodKey)
                const result = await calcShiftsFromFile(file, this.periodKey, {
                    staffs, segments, holidaySet, storeKeyById
                })
                this.shiftsCsvResult = result
                // laborSlots に反映（store_key 正規化：baba → baba_main）
                for (const sKey of ['baba_main', 'nakano', 'baba_2nd']) {
                    const target = (sKey === 'baba_main' && this.laborSlots['baba']) ? 'baba' : sKey
                    if (!this.laborSlots[target]) this.laborSlots[target] = { pt6h: 0, pt7_5h: 0, ryo6h: 0, ryo7_5h: 0 }
                    const s = result.slots[sKey]
                    if (!s) continue
                    this.laborSlots[target].pt6h    = s.pt6h
                    this.laborSlots[target].pt7_5h  = s.pt7_5h
                    this.laborSlots[target].ryo6h   = s.ryo6h
                    this.laborSlots[target].ryo7_5h = s.ryo7_5h
                }
            } catch (e) {
                this.shiftsCsvError = e.message || 'シフト CSV の処理に失敗しました'
            } finally {
                this.shiftsCsvProcessing = false
            }
        }
    }
}
</script>

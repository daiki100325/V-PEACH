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

        <!-- ───── Manual モード: Step 1〜N 店舗別入力 ───── -->
        <div v-if="inputMode === 'manual' && step >= 1 && step <= stores.length && currentStore" class="space-y-4 pb-32">

            <!-- ヘッダー -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">入力中</p>
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

            <!-- 人件費 -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">人件費 <span class="text-red-500">*</span></label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <CurrencyInput v-model="currentStore.formData.labor_cost"
                        placeholder="例: 300,000"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
            </div>
        </div>

        <!-- ───── Manual モード: Step N+1 確認 ───── -->
        <div v-if="inputMode === 'manual' && step === stores.length + 1" class="space-y-4 pb-32">
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
                        <span class="text-slate-500">人件費</span>
                        <span class="font-bold text-slate-800">¥{{ Number(sd.formData.labor_cost || 0).toLocaleString() }}</span>
                    </div>
                </div>
            </div>
            <p class="text-xs text-slate-400 px-1">家賃・決済手数料・光熱費・雑費は設定値から自動適用されます</p>
        </div>

        <!-- ───── CSV モード: Step 1 ファイルアップロード ───── -->
        <div v-if="inputMode === 'csv' && step === 1" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">CSV アップロード</p>
                    <p class="text-xs font-bold text-slate-400">1 / 2</p>
                </div>
                <p class="text-base font-bold text-slate-800">{{ periodLabel }}</p>
                <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    各店舗について<strong>商品別売上CSV（Airメイト）</strong>と<strong>日別売上CSV（Airレジ）</strong>の2ファイルをアップロードしてください。
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

                <!-- Airメイト -->
                <FileSlot label="商品別売上CSV（Airメイト・事業月度ピッタリ）"
                    :file="csvFiles[store.key]?.airmate?.file"
                    :error="csvFiles[store.key]?.airmate?.error"
                    :info="airmateInfoLine(store.key)"
                    @change="(f) => handleFileUpload(store.key, 'airmate', f)" />

                <!-- Airレジ -->
                <FileSlot label="日別売上CSV（Airレジ・当月暦月）"
                    :file="csvFiles[store.key]?.airregi?.file"
                    :error="csvFiles[store.key]?.airregi?.error"
                    :info="airregiInfoLine(store.key)"
                    @change="(f) => handleFileUpload(store.key, 'airregi', f)" />
            </div>

            <p class="text-xs text-slate-400 px-1">
                すべてのファイルが正常にパースされたら、フッターの「次へ」でプレビューに進みます。
            </p>
        </div>

        <!-- ───── CSV モード: Step 2 プレビュー＋人件費 ───── -->
        <div v-if="inputMode === 'csv' && step === 2" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">プレビュー</p>
                    <p class="text-xs font-bold text-slate-400">2 / 2</p>
                </div>
                <p class="text-base font-bold text-slate-800">{{ periodLabel }} — 計算結果確認</p>
                <p class="text-xs text-slate-500 mt-1.5">
                    内容に問題なければ、各店舗の人件費を入力して保存してください。
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
                <!-- 人件費入力 -->
                <div class="pt-1 space-y-2">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">人件費 <span class="text-red-500">*</span></label>
                    <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                        <CurrencyInput v-model="sd.labor_cost"
                            :placeholder="sd.existing ? Number(sd.existing.labor_cost || 0).toLocaleString('ja-JP') : '例: 300,000'"
                            class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                    </div>
                </div>
            </div>
            <p class="text-xs text-slate-400 px-1">家賃・決済手数料・光熱費・雑費は設定値から自動適用されます</p>
        </div>

    </main>
</template>

<script>
import {
    getMonthlyRecord, upsertMonthlyRecord, getCostReportDates,
    getDailySalesInRange, upsertDailySalesCache, deleteOldDailySalesCache
} from '../../api.js'
import { buildYearOptions, buildMonthOptions, composePeriodKey, formatPeriodLabel, getPrevPeriodKey } from '../../utils/periods.js'
import {
    readShiftJisFile, parseAirmateCsv, parseAirregiCsv,
    detectDateRangeFromFilename, calcDiscountTotalInPeriod
} from '../../utils/csvImporter.js'
import CurrencyInput from '../CurrencyInput.vue'
import FileSlot from '../FileSlot.vue'

export default {
    name: 'InputApp',
    components: { CurrencyInput, FileSlot },
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
            months: buildMonthOptions()
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
        canNext() {
            if (this.inputMode === 'manual') {
                if (this.step >= 1 && this.step <= this.stores.length) {
                    const fd = this.storeData[this.step - 1]?.formData
                    if (!fd) return false
                    return fd.service_sales != null && fd.service_sales >= 0 &&
                           fd.labor_cost != null && fd.labor_cost >= 0
                }
                if (this.step === this.stores.length + 1) return true
                return false
            }
            // CSV モード
            if (this.step === 1) {
                // 全店舗の両ファイルがアップ済み＋パース成功
                return this.stores.every(s => {
                    const c = this.csvFiles[s.key]
                    return c?.airmate?.parsed && c?.airregi?.parsed && c?.costReport
                })
            }
            if (this.step === 2) {
                return this.csvPreview.every(p => p.labor_cost != null && p.labor_cost >= 0)
            }
            return false
        },
        isLastStep() {
            if (this.inputMode === 'manual') return this.step === this.stores.length + 1
            return this.step === 2
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
                const results = await Promise.all(
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
                                merchandise_sales: existing.merchandise_sales,
                                labor_cost: existing.labor_cost
                            } : { service_sales: null, merchandise_sales: null, labor_cost: null },
                            prevRecord: prev,
                            costReport: costDates
                        }
                    })
                )
                this.storeData = results
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
                const init = {}
                await Promise.all(this.stores.map(async (s) => {
                    const costReport = await getCostReportDates(s.key, this.periodKey)
                    init[s.key] = {
                        airmate: { file: null, error: null, parsed: null },
                        airregi: { file: null, error: null, parsed: null },
                        costReport
                    }
                }))
                this.csvFiles = init
                this.csvPreview = []
                this.step = 1
            } catch (e) {
                alert(e.message || '集計期間の取得に失敗しました。')
            } finally {
                this.$emit('update:loading', false)
            }
        },
        async handleFileUpload(storeKey, kind, file) {
            if (!file) {
                this.csvFiles[storeKey][kind] = { file: null, error: null, parsed: null }
                this.$emit('update:canNext', this.canNext)
                return
            }
            try {
                const text = await readShiftJisFile(file)
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
                        existing,
                        labor_cost: existing?.labor_cost ?? null
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
            // CSV モード step 1 → 2: プレビュー生成を挟む
            if (this.inputMode === 'csv' && this.step === 1) {
                const ok = await this.buildCsvPreview()
                if (!ok) return
                this.step = 2
                return
            }
            if (this.inputMode === 'manual' && this.step < this.stores.length + 1) {
                this.step++
                return
            }
            if (this.inputMode === 'csv' && this.step < 2) {
                this.step++
            }
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
                await Promise.all(
                    this.storeData.map(sd =>
                        upsertMonthlyRecord(sd.storeKey, this.periodKey, {
                            service_sales: sd.formData.service_sales,
                            merchandise_sales: sd.formData.merchandise_sales ?? 0,
                            labor_cost: sd.formData.labor_cost
                        })
                    )
                )
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
                // STEP A: 日次キャッシュを upsert（当月CSV分）
                await Promise.all(this.stores.map(async (s) => {
                    const rows = this.csvFiles[s.key].airregi.parsed.rows
                    await upsertDailySalesCache(s.key, rows)
                }))
                // STEP B-D: 月次レコードを upsert
                await Promise.all(this.csvPreview.map(p =>
                    upsertMonthlyRecord(p.storeKey, this.periodKey, {
                        service_sales: p.service_sales,
                        merchandise_sales: p.merchandise_sales,
                        labor_cost: p.labor_cost
                    })
                ))
                // STEP E: 古いキャッシュを削除（当月度 start_date より古いもの）
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
        }
    }
}
</script>

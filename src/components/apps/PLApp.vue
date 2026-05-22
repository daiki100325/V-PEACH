<template>
    <main class="container mx-auto px-4 py-6 max-w-lg md:max-w-5xl flex-grow">

        <!-- フィルターパネル（常時表示） -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4">
            <div class="flex flex-wrap gap-3 items-end">

                <!-- 拠点 -->
                <div class="space-y-1.5 min-w-[110px]">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">拠点</label>
                    <select v-model="selectedStoreKey"
                        class="appearance-none w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 text-slate-800">
                        <option value="all">全店舗合計</option>
                        <option v-for="store in stores" :key="store.key" :value="store.key">{{ store.name }}</option>
                    </select>
                </div>

                <!-- 期間モード -->
                <div class="space-y-1.5">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">期間</label>
                    <div class="flex gap-1.5">
                        <button v-for="mode in periodModes" :key="mode.key"
                            @click="selectedPeriodMode = mode.key"
                            :class="selectedPeriodMode === mode.key
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-teal-50 hover:text-teal-600'"
                            class="px-3 py-2.5 rounded-xl font-bold border-2 transition-all text-sm">
                            {{ mode.label }}
                        </button>
                    </div>
                </div>

                <!-- 参照年月 -->
                <div class="space-y-1.5">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {{ selectedPeriodMode === 'annual' ? '参照年' : '参照月' }}
                    </label>
                    <div class="flex gap-2">
                        <select v-model="selectedYear"
                            class="appearance-none bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 text-slate-800">
                            <option value="" disabled>年</option>
                            <option v-for="y in years" :key="y.value" :value="y.value">{{ y.label }}</option>
                        </select>
                        <select v-if="selectedPeriodMode !== 'annual'" v-model="selectedMonth"
                            class="appearance-none bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 text-slate-800">
                            <option value="" disabled>月</option>
                            <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
                        </select>
                    </div>
                </div>

                <!-- 表示ボタン -->
                <button
                    type="button"
                    @click="loadPL"
                    :disabled="!canLoad || plLoading"
                    class="px-6 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-teal-600 hover:bg-teal-700 text-white self-end">
                    表示する
                </button>
            </div>

            <!-- 各店舗の集計期間（月次のみ） -->
            <div v-if="selectedPeriodMode === 'monthly' && selectedYear && selectedMonth"
                class="border-t border-slate-100 pt-3 mt-3">
                <div v-if="loadingPreview" class="text-xs text-slate-400">集計期間を取得中...</div>
                <div v-else class="flex flex-wrap gap-2">
                    <div v-for="sd in costPeriodPreview" :key="sd.storeKey"
                        class="flex items-center gap-1.5 text-xs bg-slate-50 rounded-lg px-2.5 py-1.5">
                        <span class="font-semibold text-slate-600">{{ sd.storeName }}</span>
                        <span v-if="sd.costReport" class="text-teal-600">
                            {{ formatDate(sd.costReport.start_date) }}〜{{ formatDate(sd.costReport.end_date) }}（{{ dayCount(sd.costReport) }}日）
                        </span>
                        <span v-else class="text-slate-400">未入力</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- PL表示エリア -->
        <div class="space-y-4 pb-20">

            <!-- 初期状態（未ロード） -->
            <div v-if="!hasLoaded && !plLoading" class="text-center py-16 text-slate-400">
                <p class="text-sm">条件を選択して「表示する」を押してください</p>
            </div>

            <!-- ローディング -->
            <div v-if="plLoading" class="text-center py-12 text-slate-400">
                <div class="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p class="text-sm">データを集計中...</p>
            </div>

            <template v-if="hasLoaded && !plLoading">

                <!-- データなしバナー -->
                <div v-if="!plHasData" class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-xs">
                    <span>この期間の月次データがありません（— は未入力）</span>
                </div>

                <!-- FLR比 -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-pink-50 border-b border-pink-100">
                        <span class="text-xs font-bold text-pink-700 uppercase tracking-wider">FLR比</span>
                        <span class="text-xs text-slate-400 ml-2">（対税引後売上）</span>
                    </div>
                    <div class="grid grid-cols-3 divide-x divide-slate-100">
                        <div class="px-4 py-4 text-center">
                            <div class="text-xs text-slate-500 mb-1">F比（原価率）</div>
                            <div class="text-xl font-black text-slate-800">{{ fmtPct(displayPL.fRatio) }}</div>
                        </div>
                        <div class="px-4 py-4 text-center">
                            <div class="text-xs text-slate-500 mb-1">L比（人件費率）</div>
                            <div class="text-xl font-black text-slate-800">{{ fmtPct(displayPL.lRatio) }}</div>
                        </div>
                        <div class="px-4 py-4 text-center">
                            <div class="text-xs text-slate-500 mb-1">R比（家賃比率）</div>
                            <div class="text-xl font-black text-slate-800">{{ fmtPct(displayPL.rRatio) }}</div>
                        </div>
                    </div>
                </div>

                <!-- 売上セクション -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-teal-50 border-b border-teal-100">
                        <span class="text-xs font-bold text-teal-700 uppercase tracking-wider">売上</span>
                    </div>
                    <div class="divide-y divide-slate-50">
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-600">税込み総売上</span>
                            <span class="text-sm font-bold text-slate-800">{{ fmt(displayPL.totalSales) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 提供売上</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.serviceSales) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 物販売上</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.merchandiseSales) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-2">
                            <span class="text-xs text-slate-400 pl-3">− 消費税（1/11）</span>
                            <span class="text-xs text-slate-400">{{ fmt(displayPL.consumptionTax) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3 bg-teal-50/40">
                            <span class="text-sm font-bold text-slate-700">税引き後総売上</span>
                            <span class="text-sm font-bold text-teal-700">{{ fmt(displayPL.totalSalesAfterTax) }}</span>
                        </div>
                    </div>
                </div>

                <!-- 原価セクション -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-amber-50 border-b border-amber-100">
                        <span class="text-xs font-bold text-amber-700 uppercase tracking-wider">原価</span>
                    </div>
                    <div class="divide-y divide-slate-50">
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 提供フレーバー原価</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.flavorCost) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 炭原価</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.charcoalCost) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— ジュース原価</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.drinkCost) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 物販フレーバー原価</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.merchandiseFlavorCost) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3 bg-slate-50">
                            <span class="text-sm font-bold text-slate-600">粗利</span>
                            <span class="text-sm font-bold"
                                :class="!plHasData ? 'text-slate-400' : displayPL.grossProfit >= 0 ? 'text-teal-600' : 'text-red-500'">
                                {{ fmt(displayPL.grossProfit) }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 販管費セクション -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-rose-50 border-b border-rose-100">
                        <span class="text-xs font-bold text-rose-700 uppercase tracking-wider">販管費</span>
                    </div>
                    <div class="divide-y divide-slate-50">
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 家賃</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.rent) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 人件費</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.laborCost) }}</span>
                        </div>
                        <!-- 新方式（枠数按分）時のみ内訳を表示 -->
                        <div v-if="displayPL.laborFixed != null" class="flex justify-between px-4 py-1.5">
                            <span class="text-xs text-slate-400 pl-6">├ 固定給</span>
                            <span class="text-xs text-slate-500">{{ fmt(displayPL.laborFixed) }}</span>
                        </div>
                        <div v-if="displayPL.laborVariable != null" class="flex justify-between px-4 py-1.5">
                            <span class="text-xs text-slate-400 pl-6">└ 変動費按分</span>
                            <span class="text-xs text-slate-500">{{ fmt(displayPL.laborVariable) }}</span>
                        </div>
                        <div v-if="displayPL.ryoOpportunityCost != null && displayPL.ryoOpportunityCost > 0"
                            class="flex justify-between px-4 py-1.5 bg-amber-50/40">
                            <span class="text-xs text-amber-600 pl-6">※ りょーさん代替コスト（参考・PL非計上）</span>
                            <span class="text-xs font-bold text-amber-700">{{ fmt(displayPL.ryoOpportunityCost) }}</span>
                        </div>
                        <div v-if="displayPL.laborRate != null" class="flex justify-between px-4 py-2 bg-rose-50/50">
                            <span class="text-xs text-rose-600 pl-3">労働分配率</span>
                            <span class="text-xs font-bold text-rose-600">{{ fmtPct(displayPL.laborRate) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 決済手数料</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.paymentFee) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 光熱費</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.utilities) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 雑費</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.sundries) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3 bg-slate-50">
                            <span class="text-sm font-bold text-slate-600">営業利益</span>
                            <span class="text-sm font-bold"
                                :class="!plHasData ? 'text-slate-400' : displayPL.operatingProfit >= 0 ? 'text-teal-600' : 'text-red-500'">
                                {{ fmt(displayPL.operatingProfit) }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 全社調整セクション（全社のみ） -->
                <div v-if="selectedStoreKey === 'all'" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-slate-800 border-b border-slate-700">
                        <span class="text-xs font-bold text-slate-200 uppercase tracking-wider">全社調整</span>
                    </div>
                    <div class="divide-y divide-slate-50">
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 役員報酬</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.execRemuneration) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 借入返済</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(displayPL.debtRepayment) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-4 bg-slate-50">
                            <span class="text-base font-black text-slate-800">純現金収支（会社手残り）</span>
                            <span class="text-base font-black"
                                :class="!plHasData ? 'text-slate-400' : displayPL.netCashFlow >= 0 ? 'text-teal-600' : 'text-red-500'">
                                {{ fmt(displayPL.netCashFlow) }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Health Check -->
                <div v-if="healthHighlights.some(h => h.actual != null)" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Health Check</span>
                        <span v-if="!benchmarks.length" class="text-xs text-slate-400">設定でベンチマーク目標値を設定できます</span>
                    </div>
                    <div class="grid grid-cols-2 gap-px bg-slate-100">
                        <div v-for="h in healthHighlights" :key="h.label" class="bg-white px-4 py-3">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs text-slate-500">{{ h.label }}</span>
                                <span v-if="h.isGood === true"
                                    class="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">OK</span>
                                <span v-else-if="h.isGood === false"
                                    class="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">要注意</span>
                            </div>
                            <div class="text-sm font-bold text-slate-800">
                                {{ h.actual != null ? fmtPct(h.actual) : '—' }}
                            </div>
                            <div class="text-xs text-slate-400 mt-0.5">
                                目標: {{ h.target != null ? fmtPct(h.target) : '未設定' }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Trend Chart -->
                <div v-if="trendMonthly.length > 0"
                    class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            月次推移（{{ selectedPeriodMode === 'annual' ? selectedYear + '年' : '直近12ヶ月' }}）
                        </span>
                    </div>
                    <div class="p-4">
                        <PLTrendChart :labels="trendLabels" :trendMonthly="trendMonthly" />
                    </div>
                </div>

            </template>
        </div>

    </main>
</template>

<script>
import {
    getMonthlyRecord, getStoreSettings, getCompanySettings,
    getActiveStoreSettings, getActiveCompanySettings, getActiveBenchmarks,
    getCostReportForPE, getCostPriceForPeriod, getCostReportDates,
    getMonthlyCompanyRecord
} from '../../api.js'
import {
    calcPL, calcVariableCostFromCostReport,
    calcRolling3MonthAvg, calcAnnualSum, formatJPY, formatPct
} from '../../utils/finance.js'
import { buildYearOptions, buildMonthOptions, composePeriodKey, formatPeriodLabel, getNPrevPeriodKeys, getYearPeriodKeys } from '../../utils/periods.js'
import PLTrendChart from '../PLTrendChart.vue'

const BENCHMARK_DEFS = [
    { key: 'f_ratio', label: 'F比', getActual: (pl) => pl.fRatio, isGood: (a, t) => a <= t },
    { key: 'l_ratio', label: 'L比', getActual: (pl) => pl.lRatio, isGood: (a, t) => a <= t },
    { key: 'r_ratio', label: 'R比', getActual: (pl) => pl.rRatio, isGood: (a, t) => a <= t },
    { key: 'operating_profit_margin', label: '営業利益率', getActual: (pl) => pl.totalSalesAfterTax > 0 ? pl.operatingProfit / pl.totalSalesAfterTax : null, isGood: (a, t) => a >= t },
    { key: 'labor_rate', label: '労働分配率', getActual: (pl) => pl.laborRate, isGood: (a, t) => a <= t },
]

export default {
    name: 'PLApp',
    components: { PLTrendChart },
    props: {
        stores: { type: Array, default: () => [] }
    },
    emits: ['update:loading', 'update:loadingMessage'],
    data() {
        return {
            hasLoaded: false,
            selectedStoreKey: 'all',
            selectedPeriodMode: 'monthly',
            selectedYear: String(new Date().getFullYear()),
            selectedMonth: String(new Date().getMonth() + 1),
            periodModes: [
                { key: 'monthly', label: '月次' },
                { key: 'rolling3', label: '3ヶ月平均' },
                { key: 'annual', label: '年次' }
            ],
            plLoading: false,
            plResult: null,
            trendMonthly: [],
            benchmarks: {},
            costPeriodPreview: [],
            loadingPreview: false,
            years: buildYearOptions(),
            months: buildMonthOptions()
        }
    },
    computed: {
        canLoad() {
            if (!this.selectedYear) return false
            if (this.selectedPeriodMode !== 'annual' && !this.selectedMonth) return false
            return true
        },
        periodKey() {
            return composePeriodKey(this.selectedYear, this.selectedMonth)
        },
        periodLabel() {
            if (this.selectedPeriodMode === 'annual') return `${this.selectedYear}年 年次`
            if (this.selectedPeriodMode === 'rolling3') return `${formatPeriodLabel(this.periodKey)} 直近3ヶ月平均`
            return formatPeriodLabel(this.periodKey)
        },
        selectedStoreLabel() {
            if (this.selectedStoreKey === 'all') return '全店舗合計'
            const s = this.stores.find(x => x.key === this.selectedStoreKey)
            return s ? s.name : ''
        },
        plHasData() {
            return this.plResult !== null
        },
        displayPL() {
            if (this.plResult) return this.plResult
            const keys = [
                'serviceSales', 'merchandiseSales', 'totalSales', 'consumptionTax', 'totalSalesAfterTax',
                'flavorCost', 'charcoalCost', 'drinkCost', 'merchandiseFlavorCost', 'costTotal',
                'grossProfit', 'laborRate', 'fRatio', 'lRatio', 'rRatio',
                'rent', 'laborCost', 'laborFixed', 'laborVariable', 'ryoOpportunityCost',
                'paymentFee', 'utilities', 'sundries', 'execRemuneration', 'sgaTotal',
                'operatingProfit', 'debtRepayment', 'netCashFlow'
            ]
            return Object.fromEntries(keys.map(k => [k, null]))
        },
        healthHighlights() {
            if (!this.plResult) return []
            return BENCHMARK_DEFS.map(def => {
                const actual = def.getActual(this.plResult)
                const target = this.benchmarks[def.key] != null ? Number(this.benchmarks[def.key]) : null
                const isGood = (actual != null && target != null) ? def.isGood(actual, target) : null
                return { label: def.label, actual, target, isGood }
            })
        },
        trendLabels() {
            return this.trendMonthly.map(m => m.label)
        }
    },
    watch: {
        periodKey(newVal) {
            if (this.selectedPeriodMode === 'monthly') this.fetchCostPeriodPreview(newVal)
        },
        selectedPeriodMode(newMode) {
            if (newMode !== 'monthly') { this.costPeriodPreview = []; return }
            this.fetchCostPeriodPreview(this.periodKey)
        }
    },
    methods: {
        fmt(v) { return v == null ? '—' : formatJPY(v) },
        fmtPct(v) { return formatPct(v) },
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
        async fetchCostPeriodPreview(periodKey) {
            if (!periodKey || String(periodKey).length < 6) { this.costPeriodPreview = []; return }
            this.loadingPreview = true
            try {
                this.costPeriodPreview = await Promise.all(
                    this.stores.map(async (s) => ({
                        storeKey: s.key,
                        storeName: s.name,
                        costReport: await getCostReportDates(s.key, periodKey)
                    }))
                )
            } catch { this.costPeriodPreview = [] }
            finally { this.loadingPreview = false }
        },
        async loadPL() {
            if (!this.canLoad) return
            this.plLoading = true
            this.plResult = null
            this.trendMonthly = []
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', 'PLを集計中...')
            try {
                // 上位で1回だけ取得して全月計算で共有（companySettings は ryoHourlyRate と
                // 全社調整値の両方で使うため、isAll に関わらず取得）
                const [benchmarks, companySettings] = await Promise.all([
                    getActiveBenchmarks(this.periodKey),
                    getActiveCompanySettings(this.periodKey)
                ])
                this.benchmarks = benchmarks

                if (this.selectedPeriodMode === 'monthly') {
                    // 単月+トレンド12ヶ月をまとめて prefetch（重複API呼び出しを排除）
                    const periodKeys = getNPrevPeriodKeys(this.periodKey, 12)
                    const prefetched = await this.prefetchPeriods(periodKeys)
                    const pl = await this.loadMonthlyPLCore(
                        this.selectedStoreKey, this.periodKey, companySettings,
                        prefetched.byPeriod[this.periodKey]
                    )
                    const monthly = await this.buildTrend(this.selectedStoreKey, periodKeys, companySettings, prefetched)
                    this.plResult = pl
                    this.trendMonthly = monthly
                } else if (this.selectedPeriodMode === 'rolling3') {
                    const periodKeys = getNPrevPeriodKeys(this.periodKey, 12)
                    const prefetched = await this.prefetchPeriods(periodKeys)
                    // 3ヶ月平均は periodKeys の末尾3ヶ月（=対象月含む直近3ヶ月）
                    const last3 = periodKeys.slice(-3)
                    const plResults = await Promise.all(
                        last3.map(pk => this.loadMonthlyPLCore(this.selectedStoreKey, pk, companySettings, prefetched.byPeriod[pk]))
                    )
                    this.plResult = calcRolling3MonthAvg(plResults)
                    this.trendMonthly = await this.buildTrend(this.selectedStoreKey, periodKeys, companySettings, prefetched)
                } else if (this.selectedPeriodMode === 'annual') {
                    const periodKeys = getYearPeriodKeys(this.selectedYear)
                    const prefetched = await this.prefetchPeriods(periodKeys)
                    const monthlyPLs = await Promise.all(
                        periodKeys.map(pk => this.loadMonthlyPLCore(this.selectedStoreKey, pk, companySettings, prefetched.byPeriod[pk]))
                    )
                    this.plResult = calcAnnualSum(monthlyPLs)
                    this.trendMonthly = periodKeys.map((pk, i) => ({
                        label: `${pk % 100}月`,
                        pl: monthlyPLs[i]
                    }))
                }
                this.hasLoaded = true
            } catch (e) {
                alert(e.message || 'PL集計に失敗しました。')
            } finally {
                this.plLoading = false
                this.$emit('update:loading', false)
            }
        },

        // 期間配列ぶんの pe_monthly_company_records と全店 pe_monthly_records をまとめて取得
        // 戻り値: { byPeriod: { [periodKey]: { companyRec, allStoreRecords } } }
        async prefetchPeriods(periodKeys) {
            const [companyRecsAll, ...storeRecsByStore] = await Promise.all([
                Promise.all(periodKeys.map(pk => getMonthlyCompanyRecord(pk))),
                ...this.stores.map(s => Promise.all(periodKeys.map(pk => getMonthlyRecord(s.key, pk))))
            ])
            const byPeriod = {}
            periodKeys.forEach((pk, i) => {
                byPeriod[pk] = {
                    companyRec: companyRecsAll[i],
                    allStoreRecords: storeRecsByStore.map(arr => arr[i])
                }
            })
            return { byPeriod }
        },

        async buildTrend(storeKey, periodKeys, companySettings, prefetched) {
            const pls = await Promise.all(
                periodKeys.map(pk => this.loadMonthlyPLCore(storeKey, pk, companySettings, prefetched.byPeriod[pk]))
            )
            return periodKeys.map((pk, i) => ({
                label: `${String(pk).slice(2, 4)}/${String(pk % 100).padStart(2, '0')}`,
                pl: pls[i]
            }))
        },

        // 内部コア処理：prefetched が必須（呼び出し元で prefetchPeriods 済み前提）
        // companySettings は上位の loadPL で1回だけ取得したものを使う
        async loadMonthlyPLCore(storeKey, periodKey, companySettings, prefetched) {
            const isAll = storeKey === 'all'
            const targetStores = isAll ? this.stores.map(s => s.key) : [storeKey]
            const { companyRec, allStoreRecords } = prefetched

            // 新方式人件費パラメータ：pe_monthly_company_records の当月行があれば構築、なければ
            // laborParams=null として record.labor_cost にフォールバック（過去月互換）
            let laborParams = null
            if (companyRec) {
                const totalWeightedSlots = allStoreRecords.reduce((sum, r) => {
                    if (!r) return sum
                    return sum
                        + 6.0 * Number(r.part_time_slots_6h || 0)
                        + 7.5 * Number(r.part_time_slots_7_5h || 0)
                }, 0)
                laborParams = {
                    totalVariablePayroll: Number(companyRec.total_variable_payroll) || 0,
                    totalWeightedSlots,
                    ryoHourlyRate: Number(companySettings?.ryo_hourly_rate) || 1300
                }
            }

            // 早期 return：対象店舗のレコードがなければ計算しない（CostReport/Settings 取得もスキップ）
            const targetRecords = targetStores.map(sk => {
                const idx = this.stores.findIndex(s => s.key === sk)
                return idx >= 0 ? allStoreRecords[idx] : null
            })
            if (targetRecords.every(r => !r)) return null

            const costPrices = await getCostPriceForPeriod(periodKey)

            const storeResults = await Promise.all(
                targetStores.map(async (sk, i) => {
                    const record = targetRecords[i]
                    if (!record) return null
                    const [settings, costReport] = await Promise.all([
                        getActiveStoreSettings(sk, periodKey),
                        getCostReportForPE(sk, periodKey)
                    ])
                    const variableCosts = calcVariableCostFromCostReport(
                        costReport,
                        costPrices.price_flavor_per_g,
                        costPrices.price_charcoal_per_kg
                    )
                    return calcPL(record, settings, variableCosts, null, laborParams)
                })
            )

            if (!isAll) return storeResults[0]

            const validResults = storeResults.filter(Boolean)
            if (validResults.length === 0) return null

            const summed = validResults.reduce((acc, r) => {
                for (const k of Object.keys(r)) {
                    if (k === 'laborRate') continue
                    acc[k] = (acc[k] || 0) + (Number(r[k]) || 0)
                }
                return acc
            }, {})
            // 新方式かどうかで内訳ライン (laborFixed/laborVariable/ryoOpportunityCost) の表示可否を切り替えるため null を維持
            if (!laborParams) {
                summed.laborFixed = null
                summed.laborVariable = null
                summed.ryoOpportunityCost = null
            }
            summed.execRemuneration = Number(companySettings?.exec_remuneration) || 0
            summed.debtRepayment = Number(companySettings?.debt_repayment) || 0
            summed.sgaTotal = summed.rent + summed.laborCost + summed.paymentFee + summed.utilities + summed.sundries
            summed.operatingProfit = summed.grossProfit - summed.sgaTotal
            summed.netCashFlow = summed.operatingProfit - summed.execRemuneration - summed.debtRepayment
            summed.laborRate = summed.grossProfit > 0 ? summed.laborCost / summed.grossProfit : null
            summed.fRatio = summed.totalSalesAfterTax > 0 ? summed.costTotal / summed.totalSalesAfterTax : null
            summed.lRatio = summed.totalSalesAfterTax > 0 ? summed.laborCost / summed.totalSalesAfterTax : null
            summed.rRatio = summed.totalSalesAfterTax > 0 ? summed.rent / summed.totalSalesAfterTax : null
            return summed
        }
    }
}
</script>

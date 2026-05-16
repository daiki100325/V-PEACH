<template>
    <main class="container mx-auto px-4 py-6 max-w-lg md:max-w-5xl flex-grow">

        <!-- Step 0: フィルター選択 -->
        <div v-if="!subModeActive" class="flex flex-col items-center pt-6 pb-20">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5 w-full max-w-md">
                <div class="text-center">
                    <h2 class="text-xl font-bold text-slate-800">PLを確認</h2>
                </div>

                <!-- 拠点選択 -->
                <div class="space-y-3">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">拠点</label>
                    <select v-model="selectedStoreKey"
                        class="appearance-none w-full bg-slate-50 border border-slate-200 text-base font-bold rounded-xl p-4 text-center focus:ring-2 focus:ring-teal-500 text-slate-800">
                        <option value="all">全店舗合計</option>
                        <option v-for="store in stores" :key="store.key" :value="store.key">{{ store.name }}</option>
                    </select>
                </div>

                <!-- 期間モード -->
                <div class="space-y-3">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">期間</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button v-for="mode in periodModes" :key="mode.key"
                            @click="selectedPeriodMode = mode.key"
                            :class="selectedPeriodMode === mode.key
                                ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/30'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-teal-50 hover:text-teal-600'"
                            class="py-3 rounded-2xl font-bold border-2 transition-all active:scale-95 text-sm text-center">
                            {{ mode.label }}
                        </button>
                    </div>
                </div>

                <!-- 参照月（月次・3ヶ月平均） -->
                <div v-if="selectedPeriodMode !== 'annual'" class="space-y-2">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">参照月</label>
                    <div class="grid grid-cols-2 gap-3">
                        <select v-model="selectedYear"
                            class="appearance-none w-full bg-slate-50 border border-slate-200 text-base font-bold rounded-xl p-4 text-center focus:ring-2 focus:ring-teal-500 text-slate-800">
                            <option value="" disabled>年を選択</option>
                            <option v-for="y in years" :key="y.value" :value="y.value">{{ y.label }}</option>
                        </select>
                        <select v-model="selectedMonth"
                            class="appearance-none w-full bg-slate-50 border border-slate-200 text-base font-bold rounded-xl p-4 text-center focus:ring-2 focus:ring-teal-500 text-slate-800">
                            <option value="" disabled>月を選択</option>
                            <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
                        </select>
                    </div>
                </div>

                <!-- 参照年（年次） -->
                <div v-if="selectedPeriodMode === 'annual'" class="space-y-2">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">参照年</label>
                    <select v-model="selectedYear"
                        class="appearance-none w-full bg-slate-50 border border-slate-200 text-base font-bold rounded-xl p-4 text-center focus:ring-2 focus:ring-teal-500 text-slate-800">
                        <option value="" disabled>年を選択</option>
                        <option v-for="y in years" :key="y.value" :value="y.value">{{ y.label }}</option>
                    </select>
                </div>

                <button
                    type="button"
                    @click="loadPL"
                    :disabled="!canLoad"
                    class="w-full py-4 rounded-2xl text-base font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-teal-600 hover:bg-teal-700 text-white">
                    PLを表示
                </button>
            </div>
        </div>

        <!-- Step 1: PL表示 -->
        <div v-if="subModeActive" class="space-y-4 pb-20">

            <!-- フィルターバッジ -->
            <div class="flex flex-wrap gap-2 mb-2">
                <span class="text-xs font-bold px-3 py-1.5 rounded-full bg-teal-50 text-teal-700">{{ selectedStoreLabel }}</span>
                <span class="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">{{ periodLabel }}</span>
                <button @click="goBackToSelection"
                    class="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                    ← 条件変更
                </button>
            </div>

            <!-- ローディング -->
            <div v-if="plLoading" class="text-center py-12 text-slate-400">
                <div class="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p class="text-sm">データを集計中...</p>
            </div>

            <template v-else-if="plResult">
                <!-- 売上セクション -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-teal-50 border-b border-teal-100">
                        <span class="text-xs font-bold text-teal-700 uppercase tracking-wider">売上</span>
                    </div>
                    <div class="divide-y divide-slate-50">
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-600">総売上</span>
                            <span class="text-sm font-bold text-slate-800">{{ fmt(plResult.totalSales) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 提供売上</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.serviceSales) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 物販売上</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.merchandiseSales) }}</span>
                        </div>
                    </div>
                </div>

                <!-- 変動費セクション -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-amber-50 border-b border-amber-100">
                        <span class="text-xs font-bold text-amber-700 uppercase tracking-wider">変動費</span>
                    </div>
                    <div class="divide-y divide-slate-50">
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— フレーバー</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.flavorCost) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 炭</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.charcoalCost) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— ジュース</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.drinkCost) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3 bg-slate-50">
                            <span class="text-sm font-bold text-slate-600">粗利</span>
                            <span class="text-sm font-bold" :class="plResult.grossProfit >= 0 ? 'text-teal-600' : 'text-red-500'">
                                {{ fmt(plResult.grossProfit) }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 固定費セクション -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-rose-50 border-b border-rose-100">
                        <span class="text-xs font-bold text-rose-700 uppercase tracking-wider">固定費</span>
                    </div>
                    <div class="divide-y divide-slate-50">
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 家賃</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.rent) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 人件費</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.laborCost) }}</span>
                        </div>
                        <div v-if="plResult.laborRate != null" class="flex justify-between px-4 py-2 bg-rose-50/50">
                            <span class="text-xs text-rose-600 pl-3">労働分配率</span>
                            <span class="text-xs font-bold text-rose-600">{{ fmtPct(plResult.laborRate) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 決済手数料</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.paymentFee) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 光熱費</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.utilities) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 雑費</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.sundries) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3 bg-slate-50">
                            <span class="text-sm font-bold text-slate-600">営業利益</span>
                            <span class="text-sm font-bold" :class="plResult.operatingProfit >= 0 ? 'text-teal-600' : 'text-red-500'">
                                {{ fmt(plResult.operatingProfit) }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 最終手残り（全社のみ） -->
                <div v-if="selectedStoreKey === 'all'" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-slate-800 border-b border-slate-700">
                        <span class="text-xs font-bold text-slate-200 uppercase tracking-wider">全社調整</span>
                    </div>
                    <div class="divide-y divide-slate-50">
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 役員報酬</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.execRemuneration) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">— 借入返済</span>
                            <span class="text-sm font-bold text-slate-700">{{ fmt(plResult.debtRepayment) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-3">
                            <span class="text-sm text-slate-500 pl-3">+ 物販売益</span>
                            <span class="text-sm font-bold text-teal-600">{{ fmt(plResult.merchandiseProfit) }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-4 bg-slate-50">
                            <span class="text-base font-black text-slate-800">最終会社手残り</span>
                            <span class="text-base font-black" :class="plResult.finalProfit >= 0 ? 'text-teal-600' : 'text-red-500'">
                                {{ fmt(plResult.finalProfit) }}
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
                        <PLTrendChart :labels="trendLabels" :datasets="trendDatasets" />
                    </div>
                </div>
            </template>

            <!-- データなし -->
            <div v-else class="text-center py-16 text-slate-400">
                <p class="text-sm">この期間のデータがありません</p>
            </div>
        </div>

    </main>
</template>

<script>
import {
    getMonthlyRecord, getStoreSettings, getCompanySettings, getBenchmarks,
    getCostReportForPE, getCostPriceForPeriod, getMerchandisePriceForPeriod
} from '../../api.js'
import {
    calcPL, calcVariableCostFromCostReport, calcMerchandiseSalesQty,
    calcRolling3MonthAvg, calcAnnualSum, formatJPY, formatPct
} from '../../utils/finance.js'
import { buildYearOptions, buildMonthOptions, composePeriodKey, formatPeriodLabel, getNPrevPeriodKeys, getYearPeriodKeys } from '../../utils/periods.js'
import PLTrendChart from '../PLTrendChart.vue'

const BENCHMARK_DEFS = [
    { key: 'labor_rate', label: '労働分配率', getActual: (pl) => pl.laborRate, isGood: (a, t) => a <= t },
    { key: 'gross_profit_margin', label: '粗利率', getActual: (pl) => pl.totalSales > 0 ? pl.grossProfit / pl.totalSales : null, isGood: (a, t) => a >= t },
    { key: 'operating_profit_margin', label: '営業利益率', getActual: (pl) => pl.totalSales > 0 ? pl.operatingProfit / pl.totalSales : null, isGood: (a, t) => a >= t },
    { key: 'variable_cost_ratio', label: '変動費率', getActual: (pl) => pl.totalSales > 0 ? pl.variableCostTotal / pl.totalSales : null, isGood: (a, t) => a <= t },
]

export default {
    name: 'PLApp',
    components: { PLTrendChart },
    props: {
        stores: { type: Array, default: () => [] }
    },
    emits: ['update:loading', 'update:loadingMessage', 'update:stepActive'],
    data() {
        return {
            subModeActive: false,
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
            benchmarks: [],
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
        healthHighlights() {
            if (!this.plResult) return []
            return BENCHMARK_DEFS.map(def => {
                const actual = def.getActual(this.plResult)
                const bm = this.benchmarks.find(b => b.item_name === def.key)
                const target = bm ? Number(bm.target_value) : null
                const isGood = (actual != null && target != null) ? def.isGood(actual, target) : null
                return { label: def.label, actual, target, isGood }
            })
        },
        trendLabels() {
            return this.trendMonthly.map(m => m.label)
        },
        trendDatasets() {
            return [
                {
                    label: '総売上',
                    data: this.trendMonthly.map(m => m.pl ? Math.round(m.pl.totalSales) : null),
                    borderColor: '#0d9488',
                    backgroundColor: 'rgba(13,148,136,0.08)',
                    tension: 0.3,
                    spanGaps: true
                },
                {
                    label: '粗利',
                    data: this.trendMonthly.map(m => m.pl ? Math.round(m.pl.grossProfit) : null),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.08)',
                    tension: 0.3,
                    spanGaps: true
                },
                {
                    label: '営業利益',
                    data: this.trendMonthly.map(m => m.pl ? Math.round(m.pl.operatingProfit) : null),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99,102,241,0.08)',
                    tension: 0.3,
                    spanGaps: true
                }
            ]
        }
    },
    methods: {
        fmt(v) { return formatJPY(v) },
        fmtPct(v) { return formatPct(v) },
        goBackToSelection() {
            this.subModeActive = false
            this.plResult = null
            this.trendMonthly = []
            this.$emit('update:stepActive', false)
        },
        async loadPL() {
            if (!this.canLoad) return
            this.subModeActive = true
            this.plLoading = true
            this.plResult = null
            this.trendMonthly = []
            this.$emit('update:stepActive', true)
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', 'PLを集計中...')
            try {
                this.benchmarks = await getBenchmarks(null)

                if (this.selectedPeriodMode === 'monthly') {
                    const [pl, monthly] = await Promise.all([
                        this.loadMonthlyPL(this.selectedStoreKey, this.periodKey),
                        this.loadTrendForPeriod(this.selectedStoreKey, this.periodKey)
                    ])
                    this.plResult = pl
                    this.trendMonthly = monthly
                } else if (this.selectedPeriodMode === 'rolling3') {
                    const [pl, monthly] = await Promise.all([
                        this.loadRolling3PL(this.selectedStoreKey, this.periodKey),
                        this.loadTrendForPeriod(this.selectedStoreKey, this.periodKey)
                    ])
                    this.plResult = pl
                    this.trendMonthly = monthly
                } else if (this.selectedPeriodMode === 'annual') {
                    const { pl, monthly } = await this.loadAnnualPL(this.selectedStoreKey, this.selectedYear)
                    this.plResult = pl
                    this.trendMonthly = monthly
                }
            } catch (e) {
                alert(e.message || 'PL集計に失敗しました。')
                this.goBackToSelection()
            } finally {
                this.plLoading = false
                this.$emit('update:loading', false)
            }
        },

        // 月次PL（1ヶ月分）
        async loadMonthlyPL(storeKey, periodKey) {
            const isAll = storeKey === 'all'
            const companySettings = isAll ? await getCompanySettings() : null
            return this.loadMonthlyPLCore(storeKey, periodKey, companySettings)
        },

        // 内部: companySettingsを引数で受け取るコア処理（複数月ロード時の重複取得を防ぐ）
        async loadMonthlyPLCore(storeKey, periodKey, companySettings) {
            const isAll = storeKey === 'all'
            const targetStores = isAll ? this.stores.map(s => s.key) : [storeKey]

            const [costPrices, mercPrice] = await Promise.all([
                getCostPriceForPeriod(periodKey),
                getMerchandisePriceForPeriod(periodKey)
            ])

            const storeResults = await Promise.all(
                targetStores.map(async (sk) => {
                    const [record, settings, costReport] = await Promise.all([
                        getMonthlyRecord(sk, periodKey),
                        getStoreSettings(sk),
                        getCostReportForPE(sk, periodKey)
                    ])
                    if (!record) return null
                    const variableCosts = calcVariableCostFromCostReport(
                        costReport,
                        costPrices.price_flavor_per_g,
                        costPrices.price_charcoal_per_kg
                    )
                    const qty = calcMerchandiseSalesQty(costReport?.brandSales)
                    return calcPL(record, settings, variableCosts, qty, mercPrice.price_per_unit, null)
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
            summed.execRemuneration = Number(companySettings?.exec_remuneration) || 0
            summed.debtRepayment = Number(companySettings?.debt_repayment) || 0
            summed.finalProfit = summed.operatingProfit + summed.merchandiseProfit - summed.execRemuneration - summed.debtRepayment
            summed.laborRate = summed.grossProfit > 0 ? summed.laborCost / summed.grossProfit : null
            return summed
        },

        // 3ヶ月平均PL（periodKeyを含む直近3ヶ月の平均）
        async loadRolling3PL(storeKey, periodKey) {
            const isAll = storeKey === 'all'
            const companySettings = isAll ? await getCompanySettings() : null
            const periodKeys = getNPrevPeriodKeys(periodKey, 3)
            const plResults = await Promise.all(
                periodKeys.map(pk => this.loadMonthlyPLCore(storeKey, pk, companySettings))
            )
            return calcRolling3MonthAvg(plResults)
        },

        // 月次・3ヶ月平均用トレンドデータ（直近12ヶ月）
        async loadTrendForPeriod(storeKey, periodKey) {
            const isAll = storeKey === 'all'
            const companySettings = isAll ? await getCompanySettings() : null
            const periodKeys = getNPrevPeriodKeys(periodKey, 12)
            const pls = await Promise.all(
                periodKeys.map(pk => this.loadMonthlyPLCore(storeKey, pk, companySettings))
            )
            return periodKeys.map((pk, i) => ({
                label: `${String(pk).slice(2, 4)}/${String(pk % 100).padStart(2, '0')}`,
                pl: pls[i]
            }))
        },

        // 年次PL（指定年の全月合計 + チャート用月次データ）
        async loadAnnualPL(storeKey, year) {
            const isAll = storeKey === 'all'
            const companySettings = isAll ? await getCompanySettings() : null
            const periodKeys = getYearPeriodKeys(year)

            const monthlyPLs = await Promise.all(
                periodKeys.map(pk => this.loadMonthlyPLCore(storeKey, pk, companySettings))
            )

            const pl = calcAnnualSum(monthlyPLs)
            const monthly = periodKeys.map((pk, i) => ({
                label: `${pk % 100}月`,
                pl: monthlyPLs[i]
            }))
            return { pl, monthly }
        }
    }
}
</script>

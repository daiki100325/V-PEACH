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
                        <!-- P5: 既定では休止店舗を除外。「休止店舗も表示」ON 時のみ休止店舗も出す（休止は末尾に印） -->
                        <option v-for="store in selectorStores" :key="store.key" :value="store.key">
                            {{ store.name }}{{ store.isActive === false ? '（休止）' : '' }}
                        </option>
                    </select>
                </div>

                <!-- 休止店舗も表示トグル（全社一括・app_ui_settings 連動／過去 PL の決算閲覧用） -->
                <label class="flex items-center gap-2 self-end ml-auto cursor-pointer select-none py-2.5">
                    <input type="checkbox" :checked="showInactiveStores"
                        @change="onToggleShowInactive($event.target.checked)"
                        class="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                    <span class="text-xs font-bold text-slate-500">休止店舗も表示</span>
                </label>

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
                    <div v-for="sd in visibleCostPeriodPreview" :key="sd.storeKey"
                        class="flex items-center gap-1.5 text-xs bg-slate-50 rounded-lg px-2.5 py-1.5">
                        <span class="font-semibold text-slate-600">{{ sd.storeName }}{{ sd.isActive === false ? '（休止）' : '' }}</span>
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

                <!-- 売上・原価・販管費（モバイルは項目列sticky＋横スクロール / デスクトップは flex-1 で全幅利用） -->
                <div :class="isAllStores ? 'overflow-x-auto md:overflow-x-visible' : ''">
                    <div :class="['space-y-4', isAllStores && 'min-w-[500px] pr-4 md:pr-0 md:min-w-0']">

                        <!-- 売上セクション -->
                        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <div :class="[...plRowClass({ bg: 'bg-teal-50 border-b border-teal-100', rounded: 'rounded-t-2xl' })]">
                                <span :class="[...plLabelClass({ bg: 'teal' }), 'text-xs font-bold text-teal-700 uppercase tracking-wider']">売上</span>
                                <template v-if="isAllStores">
                                    <span v-for="col in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-xs font-bold text-slate-500 truncate']">{{ col.label }}</span>
                                </template>
                            </div>
                            <div class="divide-y divide-slate-50">
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass(), 'text-sm text-slate-600']">税込み総売上</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-800' : 'text-slate-400']">
                                        {{ fmt(col.pl?.totalSales) }}
                                    </span>
                                </div>
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-sm text-slate-500']">— 提供売上</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-700' : 'text-slate-400']">
                                        {{ fmt(col.pl?.serviceSales) }}
                                    </span>
                                </div>
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-sm text-slate-500']">— 物販売上</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-700' : 'text-slate-400']">
                                        {{ fmt(col.pl?.merchandiseSales) }}
                                    </span>
                                </div>
                                <div :class="plRowClass({ py: 'py-2' })">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-xs text-slate-400']">− 消費税（1/11）</span>
                                    <span v-for="col in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-xs text-slate-400']">
                                        {{ fmt(col.pl?.consumptionTax) }}
                                    </span>
                                </div>
                                <div :class="plRowClass({ bg: 'bg-teal-50/40', rounded: 'rounded-b-2xl' })">
                                    <span :class="[...plLabelClass({ bg: 'teal' }), 'text-sm font-bold text-slate-700']">税引き後総売上</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-teal-700' : 'text-teal-600']">
                                        {{ fmt(col.pl?.totalSalesAfterTax) }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- 原価セクション -->
                        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <div :class="plRowClass({ bg: 'bg-amber-50 border-b border-amber-100', rounded: 'rounded-t-2xl' })">
                                <span :class="[...plLabelClass({ bg: 'amber' }), 'text-xs font-bold text-amber-700 uppercase tracking-wider']">原価</span>
                                <template v-if="isAllStores">
                                    <span v-for="col in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-xs font-bold text-slate-500 truncate']">{{ col.label }}</span>
                                </template>
                            </div>
                            <div class="divide-y divide-slate-50">
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-sm text-slate-500']">— 提供FL原価</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-700' : 'text-slate-400']">
                                        {{ fmt(col.pl?.flavorCost) }}
                                    </span>
                                </div>
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-sm text-slate-500']">— 炭原価</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-700' : 'text-slate-400']">
                                        {{ fmt(col.pl?.charcoalCost) }}
                                    </span>
                                </div>
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-sm text-slate-500']">— ジュース原価</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-700' : 'text-slate-400']">
                                        {{ fmt(col.pl?.drinkCost) }}
                                    </span>
                                </div>
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-sm text-slate-500']">— 物販FL原価</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-700' : 'text-slate-400']">
                                        {{ fmt(col.pl?.merchandiseFlavorCost) }}
                                    </span>
                                </div>
                                <div :class="plRowClass({ bg: 'bg-slate-50', rounded: 'rounded-b-2xl' })">
                                    <span :class="[...plLabelClass({ bg: 'slate' }), 'text-sm font-bold text-slate-600']">粗利</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', plProfitColor(col.pl?.grossProfit, ci)]">
                                        {{ fmt(col.pl?.grossProfit) }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- 販管費セクション -->
                        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <div :class="plRowClass({ bg: 'bg-rose-50 border-b border-rose-100', rounded: 'rounded-t-2xl' })">
                                <span :class="[...plLabelClass({ bg: 'rose' }), 'text-xs font-bold text-rose-700 uppercase tracking-wider']">販管費</span>
                                <template v-if="isAllStores">
                                    <span v-for="col in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-xs font-bold text-slate-500 truncate']">{{ col.label }}</span>
                                </template>
                            </div>
                            <div class="divide-y divide-slate-50">
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-sm text-slate-500']">— 家賃</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-700' : 'text-slate-400']">
                                        {{ fmt(col.pl?.rent) }}
                                    </span>
                                </div>
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-sm text-slate-500']">— 人件費</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-700' : 'text-slate-400']">
                                        {{ fmt(col.pl?.laborCost) }}
                                    </span>
                                </div>
                                <!-- 新方式（枠数按分）時のみ内訳を表示 -->
                                <div v-if="displayPL.laborFixed != null" :class="plRowClass({ py: 'py-1.5' })">
                                    <span :class="[...plLabelClass({ indent: 2 }), 'text-xs text-slate-400']">├ 固定給</span>
                                    <span v-for="col in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-xs text-slate-500']">
                                        {{ fmt(col.pl?.laborFixed) }}
                                    </span>
                                </div>
                                <div v-if="displayPL.laborVariable != null" :class="plRowClass({ py: 'py-1.5' })">
                                    <span :class="[...plLabelClass({ indent: 2 }), 'text-xs text-slate-400']">└ 変動費按分</span>
                                    <span v-for="col in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-xs text-slate-500']">
                                        {{ fmt(col.pl?.laborVariable) }}
                                    </span>
                                </div>
                                <div v-if="displayPL.ryoOpportunityCost != null && displayPL.ryoOpportunityCost > 0"
                                    :class="plRowClass({ py: 'py-1.5', bg: 'bg-amber-50/40' })">
                                    <span :class="[...plLabelClass({ indent: 2, bg: 'amber' }), 'text-xs text-amber-600']">※ 代替コスト</span>
                                    <span v-for="col in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-xs font-bold text-amber-700']">
                                        {{ fmt(col.pl?.ryoOpportunityCost) }}
                                    </span>
                                </div>
                                <div v-if="displayPL.laborRate != null" :class="plRowClass({ py: 'py-2', bg: 'bg-rose-50/50' })">
                                    <span :class="[...plLabelClass({ indent: 1, bg: 'rose' }), 'text-xs text-rose-600']">労働分配率</span>
                                    <span v-for="col in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-xs font-bold text-rose-600']">
                                        {{ fmtPct(col.pl?.laborRate) }}
                                    </span>
                                </div>
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-sm text-slate-500']">— 決済手数料</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-700' : 'text-slate-400']">
                                        {{ fmt(col.pl?.paymentFee) }}
                                    </span>
                                </div>
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-sm text-slate-500']">— 光熱費</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-700' : 'text-slate-400']">
                                        {{ fmt(col.pl?.utilities) }}
                                    </span>
                                </div>
                                <div :class="plRowClass()">
                                    <span :class="[...plLabelClass({ indent: 1 }), 'text-sm text-slate-500']">— 雑費</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', ci === 0 ? 'text-slate-700' : 'text-slate-400']">
                                        {{ fmt(col.pl?.sundries) }}
                                    </span>
                                </div>
                                <div :class="plRowClass({ bg: 'bg-slate-50', rounded: 'rounded-b-2xl' })">
                                    <span :class="[...plLabelClass({ bg: 'slate' }), 'text-sm font-bold text-slate-600']">営業利益</span>
                                    <span v-for="(col, ci) in displayColumns" :key="col.key"
                                        :class="[...plValueClass(), 'text-sm font-bold', plProfitColor(col.pl?.operatingProfit, ci)]">
                                        {{ fmt(col.pl?.operatingProfit) }}
                                    </span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- 全社調整セクション（全社のみ・スクロールエリア外） -->
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
                            {{ trendChartTitle }}
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
    getMonthlyCompanyRecord, getLatestPeriodKey,
    getStores, getAppUiSettings, updateAppUiSettings
} from '../../api.js'
import {
    calcPL, calcVariableCostFromCostReport,
    calcRolling3MonthAvg, calcAnnualSum, formatJPY, formatPct
} from '../../utils/finance.js'
import { selectableStores, isStoreOpenForPeriod } from '../../utils/storeFilters.js'
import { buildYearOptions, buildMonthOptions, composePeriodKey, formatPeriodLabel, getNPrevPeriodKeys, getYearPeriodKeys, parsePeriodKey } from '../../utils/periods.js'
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
            months: buildMonthOptions(),
            storePLs: [],
            // P5: 集計の母集団は休止店舗も含む全 shop 店舗（closed_at で月別に除外）。
            // allStores が空の間は props.stores（active のみ）にフォールバック。
            allStores: [],
            showInactiveStores: false
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
            const s = this.aggStores.find(x => x.key === this.selectedStoreKey)
            return s ? s.name : ''
        },
        // P5: 集計の母集団（休止含む全 shop 店舗）。allStores 未ロード時は props.stores にフォールバック。
        // 閉店翌月以降の除外は periodKey ごとに isStoreOpenForPeriod で行う（ここでは母集団のみ）。
        aggStores() {
            return this.allStores.length > 0 ? this.allStores : this.stores
        },
        // P5: 拠点ドロップダウンに出す店舗。既定は休止店舗を除外、トグル ON で休止も表示。
        selectorStores() {
            return selectableStores(this.aggStores, this.showInactiveStores)
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
        },
        trendChartTitle() {
            if (this.selectedPeriodMode === 'annual') return `年次推移（直近12年）`
            // 月次・3ヶ月平均どちらも選択年の1〜12月トレンド
            return `月次推移（${this.selectedYear}年）`
        },
        isAllStores() {
            return this.selectedStoreKey === 'all'
        },
        // P5: 集計期間プレビューも displayColumns と同じトグル連動で休止店舗を出し分ける
        // （データは閉店月まで集計対象のまま・チップ表示だけトグル OFF で隠す）
        visibleCostPeriodPreview() {
            return this.costPeriodPreview.filter(sd => this.showInactiveStores || sd.isActive !== false)
        },
        displayColumns() {
            if (!this.isAllStores) {
                return [{ key: 'single', label: null, pl: this.displayPL }]
            }
            // P5: storePLs の添字は aggStores 基準のため map 後に filter する。
            // 休止店舗の列はトグル ON のときのみ表示（セレクタと同じ「（休止）」印付き）。
            const storeCols = this.aggStores
                .map((s, i) => ({
                    key: s.key,
                    label: s.name + (s.isActive === false ? '（休止）' : ''),
                    pl: this.storePLs[i] ?? null,
                    isActive: s.isActive
                }))
                .filter(c => this.showInactiveStores || c.isActive !== false)
            return [
                { key: 'all', label: '全店舗', pl: this.displayPL },
                ...storeCols
            ]
        }
    },
    async created() {
        // P5: 集計母集団（休止含む全 shop）と UI 設定（休止表示トグル）を読み込む。
        // await しないと初回 PL 読込が props.stores（active のみ）基準で走り、
        // 完了後に aggStores が allStores へ切り替わって storePLs の添字とずれる恐れがある
        await this.loadStoreContext()
        try {
            const latestPk = await getLatestPeriodKey()
            if (latestPk) {
                const parsed = parsePeriodKey(latestPk)
                if (parsed) {
                    this.selectedYear = String(parsed.year)
                    this.selectedMonth = String(parsed.month)
                }
            }
        } catch {
            // フォールバック: 当月のまま
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
        // P5: 集計母集団（休止含む全 shop 店舗）と UI 設定（休止表示トグル）を読み込む。
        // どちらも失敗時は console.error で握りつぶし、props.stores / 既定値で現状動作を継続する。
        async loadStoreContext() {
            try {
                const rows = await getStores()
                // store_type==='shop' のみを集計母集団に採用（office は PL の対象外）。
                // display_order 順（getStores 側でソート済み）を維持し、props.stores と列順を一致させる。
                // テンプレート／selectableStores が参照する形（key / name / isActive / closed_at）に map する。
                this.allStores = (rows || [])
                    .filter(s => s.store_type === 'shop')
                    .map(s => ({
                        key: s.store_key,
                        name: s.name,
                        isActive: s.is_active,
                        closed_at: s.closed_at ?? null
                    }))
            } catch (e) {
                console.error('店舗マスタの取得に失敗（props.stores で継続）:', e)
            }
            try {
                // 休止店舗も表示トグルの初期値（全社一括・app_ui_settings 連動）
                const ui = await getAppUiSettings()
                this.showInactiveStores = !!(ui && ui.show_inactive_stores)
            } catch (e) {
                console.error('UI設定の取得に失敗（休止店舗トグルは false で継続）:', e)
            }
        },
        // P5: 「休止店舗も表示」トグル。楽観更新 → 永続化、失敗時は元に戻す。全社一括設定。
        async onToggleShowInactive(checked) {
            const prev = this.showInactiveStores
            this.showInactiveStores = checked
            // トグル OFF で選択中店舗が選択肢から消えた場合は「全店舗合計」に戻す（整合処理）
            if (!checked && this.selectedStoreKey !== 'all'
                && !this.selectorStores.some(s => s.key === this.selectedStoreKey)) {
                this.selectedStoreKey = 'all'
            }
            try {
                await updateAppUiSettings({ show_inactive_stores: checked })
            } catch (e) {
                this.showInactiveStores = prev
                alert('休止店舗の表示設定の保存に失敗しました。')
            }
        },
        // モバイル時の sticky 項目列＋スクロール、デスクトップでは項目列が flex-1 で空白を埋める
        plRowClass(opts = {}) {
            const { py = 'py-3', bg = null, rounded = null } = opts
            const arr = ['flex items-center', py]
            if (bg) arr.push(bg)
            if (rounded) arr.push(rounded)
            arr.push(this.isAllStores ? 'md:px-4' : 'px-4')
            return arr
        },
        plLabelClass({ indent = 0, bg = 'white' } = {}) {
            if (!this.isAllStores) {
                const indentClass = ['', 'pl-3', 'pl-6'][indent] || ''
                return indentClass ? ['flex-1', indentClass] : ['flex-1']
            }
            const mobilePad = ['pl-4', 'pl-7', 'pl-10'][indent] || 'pl-4'
            const mobileBg = ({
                white: 'bg-white',
                teal: 'bg-teal-50',
                slate: 'bg-slate-50',
                rose: 'bg-rose-50',
                amber: 'bg-amber-50'
            })[bg] || 'bg-white'
            const desktopPad = ['md:pl-0', 'md:pl-3', 'md:pl-6'][indent] || 'md:pl-0'
            return [
                'sticky left-0 z-10 shrink-0 w-[120px] pr-1',
                mobilePad, mobileBg,
                'md:static md:bg-transparent md:flex-1 md:w-auto md:shrink md:pr-0',
                desktopPad
            ]
        },
        plValueClass() {
            if (!this.isAllStores) return ['text-right']
            return ['shrink-0 w-[88px] pr-1 md:w-24 md:pl-3 md:pr-0 text-right']
        },
        plProfitColor(value, ci) {
            if (!this.plHasData || value == null) return 'text-slate-400'
            if (value >= 0) return ci === 0 ? 'text-teal-600' : 'text-teal-500'
            return ci === 0 ? 'text-red-500' : 'text-red-400'
        },
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
                // P5: その期間に営業している店舗のみ（閉店翌月以降は除外）を aggStores から抽出
                const openStores = this.aggStores.filter(s => isStoreOpenForPeriod(s, periodKey))
                this.costPeriodPreview = await Promise.all(
                    openStores.map(async (s) => ({
                        storeKey: s.key,
                        storeName: s.name,
                        isActive: s.isActive,
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
            this.storePLs = []
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
                    // トレンドは選択年の1〜12月（選択月の単月PLも同じprefetchから取得）
                    const yearPeriodKeys = getYearPeriodKeys(this.selectedYear)
                    const prefetched = await this.prefetchPeriods(yearPeriodKeys)
                    const rawMain = await this.loadMonthlyPLCore(
                        this.selectedStoreKey, this.periodKey, companySettings,
                        prefetched.byPeriod[this.periodKey],
                        { includeStorePLs: this.isAllStores }
                    )
                    const pls = await Promise.all(
                        yearPeriodKeys.map(pk => this.loadMonthlyPLCore(this.selectedStoreKey, pk, companySettings, prefetched.byPeriod[pk]))
                    )
                    this.plResult = this.isAllStores ? rawMain?.pl ?? null : rawMain
                    if (this.isAllStores && rawMain?.storePLs) this.storePLs = rawMain.storePLs
                    this.trendMonthly = yearPeriodKeys.map((pk, i) => ({
                        label: `${pk % 100}月`,
                        pl: pls[i]
                    }))
                } else if (this.selectedPeriodMode === 'rolling3') {
                    const yearPeriodKeys = getYearPeriodKeys(this.selectedYear)
                    // 3ヶ月平均の計算に必要なもの（1・2月選択時は前年の月を含む場合あり）
                    const last3Keys = getNPrevPeriodKeys(this.periodKey, 3)
                    // 年内 + 前年の月をまとめてprefetch（重複をSetで排除）
                    const allKeys = [...new Set([...yearPeriodKeys, ...last3Keys].map(String))].map(Number)
                    const prefetched = await this.prefetchPeriods(allKeys)
                    // 3ヶ月平均のPL
                    const rawResults3 = await Promise.all(
                        last3Keys.map(pk => this.loadMonthlyPLCore(
                            this.selectedStoreKey, pk, companySettings, prefetched.byPeriod[pk],
                            { includeStorePLs: this.isAllStores }
                        ))
                    )
                    const plResults = rawResults3.map(r => this.isAllStores ? r?.pl ?? null : r)
                    this.plResult = calcRolling3MonthAvg(plResults)
                    if (this.isAllStores) {
                        // P5: storePLs は aggStores 添字基準（displayColumns と一致させる）
                        this.storePLs = this.aggStores.map((s, si) =>
                            calcRolling3MonthAvg(rawResults3.map(r => r?.storePLs?.[si] ?? null))
                        )
                    }
                    // トレンドは選択年の1〜12月
                    const pls = await Promise.all(
                        yearPeriodKeys.map(pk => this.loadMonthlyPLCore(this.selectedStoreKey, pk, companySettings, prefetched.byPeriod[pk]))
                    )
                    this.trendMonthly = yearPeriodKeys.map((pk, i) => ({
                        label: `${pk % 100}月`,
                        pl: pls[i]
                    }))
                } else if (this.selectedPeriodMode === 'annual') {
                    // 選択年のPL（年次合計）
                    const selectedYearNum = Number(this.selectedYear)
                    // トレンド: 選択年を終点に最大12年（最小開始年2026）
                    const trendStartYear = Math.max(2026, selectedYearNum - 11)
                    const trendYears = Array.from(
                        { length: selectedYearNum - trendStartYear + 1 },
                        (_, i) => trendStartYear + i
                    )
                    // 全年×12ヶ月分をまとめてprefetch（APIコール最小化）
                    const allPeriodKeys = trendYears.flatMap(y => getYearPeriodKeys(y))
                    const prefetched = await this.prefetchPeriods(allPeriodKeys)
                    // 選択年のPL
                    const selectedYearKeys = getYearPeriodKeys(this.selectedYear)
                    const rawMonthlyResults = await Promise.all(
                        selectedYearKeys.map(pk => this.loadMonthlyPLCore(
                            this.selectedStoreKey, pk, companySettings, prefetched.byPeriod[pk],
                            { includeStorePLs: this.isAllStores }
                        ))
                    )
                    const selectedMonthlyPLs = rawMonthlyResults.map(r => this.isAllStores ? r?.pl ?? null : r)
                    this.plResult = calcAnnualSum(selectedMonthlyPLs)
                    if (this.isAllStores) {
                        // P5: storePLs は aggStores 添字基準（displayColumns と一致させる）
                        this.storePLs = this.aggStores.map((s, si) =>
                            calcAnnualSum(rawMonthlyResults.map(r => r?.storePLs?.[si] ?? null))
                        )
                    }
                    // 年次トレンド: 各年の年次合計PL
                    const yearlyTrend = []
                    for (const year of trendYears) {
                        const yearKeys = getYearPeriodKeys(year)
                        const monthlyPLs = await Promise.all(
                            yearKeys.map(pk => this.loadMonthlyPLCore(this.selectedStoreKey, pk, companySettings, prefetched.byPeriod[pk]))
                        )
                        yearlyTrend.push({ label: `${year}年`, pl: calcAnnualSum(monthlyPLs) })
                    }
                    this.trendMonthly = yearlyTrend
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
            // P5: 集計母集団は aggStores（休止含む全 shop）。allStoreRecords の添字も aggStores 基準。
            const aggStores = this.aggStores
            const [companyRecsAll, ...storeRecsByStore] = await Promise.all([
                Promise.all(periodKeys.map(pk => getMonthlyCompanyRecord(pk))),
                ...aggStores.map(s => Promise.all(periodKeys.map(pk => getMonthlyRecord(s.key, pk))))
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
        async loadMonthlyPLCore(storeKey, periodKey, companySettings, prefetched, opts = {}) {
            const { includeStorePLs = false } = opts
            const isAll = storeKey === 'all'
            // P5: 母集団は aggStores（休止含む全 shop）。allStoreRecords の添字も aggStores 基準。
            const aggStores = this.aggStores
            const targetStores = isAll ? aggStores.map(s => s.key) : [storeKey]
            const { companyRec, allStoreRecords } = prefetched

            // pe_monthly_company_records がない月はデータなしとして扱う
            if (!companyRec) return null

            // P5: 人件費按分の分母（重みつき枠数合計）も「その期間に営業している店舗」だけで構成する。
            // 閉店翌月以降の店舗は isStoreOpenForPeriod=false で除外する。通常その月のシフトレコードは
            // 存在せず自然に 0 になるが、過去データの残骸で分母が膨らみ他店の変動費按分が歪むのを防ぐ安全弁。
            const totalWeightedSlots = aggStores.reduce((sum, store, idx) => {
                if (!isStoreOpenForPeriod(store, periodKey)) return sum
                const r = allStoreRecords[idx]
                if (!r) return sum
                return sum
                    + 6.0 * Number(r.part_time_slots_6h || 0)
                    + 7.5 * Number(r.part_time_slots_7_5h || 0)
            }, 0)
            const laborParams = {
                totalVariablePayroll: Number(companyRec.total_variable_payroll) || 0,
                totalWeightedSlots,
                ryoHourlyRate: Number(companySettings?.ryo_hourly_rate) || 1300
            }

            // 早期 return：対象店舗のレコードがなければ計算しない（CostReport/Settings 取得もスキップ）。
            // 閉店翌月以降は record を null 扱いとし、集計・列表示から除外する。
            const targetRecords = targetStores.map(sk => {
                const idx = aggStores.findIndex(s => s.key === sk)
                if (idx < 0) return null
                if (!isStoreOpenForPeriod(aggStores[idx], periodKey)) return null
                return allStoreRecords[idx]
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
            if (includeStorePLs) return { pl: summed, storePLs: storeResults }
            return summed
        }
    }
}
</script>

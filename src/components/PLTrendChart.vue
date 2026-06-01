<template>
    <div>
        <!-- カテゴリーボタン行 -->
        <div class="flex flex-wrap gap-2 mb-2">
            <button
                v-for="cat in CATEGORIES"
                :key="cat.key"
                @click="toggleCategory(cat.key)"
                :class="[
                    'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                    expandedCategory === cat.key
                        ? 'border-transparent text-white'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                ]"
                :style="expandedCategory === cat.key ? { background: cat.color, borderColor: cat.color } : {}"
            >
                {{ cat.label }}
                <span class="ml-1 opacity-70">{{ expandedCategory === cat.key ? '▲' : '▼' }}</span>
            </button>
        </div>

        <!-- エクスパンドエリア -->
        <div v-if="expandedCategory" class="mb-3 p-3 bg-slate-50 rounded-xl flex flex-wrap gap-2">
            <button
                v-for="m in currentMetrics"
                :key="m.key"
                @click="toggleMetric(m.key)"
                :class="[
                    'px-2.5 py-1 rounded-lg text-xs font-bold border transition-all',
                    visibleMetrics.includes(m.key)
                        ? 'text-white border-transparent'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                ]"
                :style="visibleMetrics.includes(m.key) ? { background: m.color, borderColor: m.color } : {}"
            >
                {{ m.label }}
            </button>
        </div>

        <!-- チャート -->
        <div class="relative" style="height: 220px">
            <canvas ref="canvas"></canvas>
        </div>
    </div>
</template>

<script>
import { markRaw } from 'vue'
import {
    Chart, LineController, LineElement, PointElement,
    LinearScale, CategoryScale, Tooltip, Legend
} from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

const CATEGORIES = [
    {
        key: 'sales', label: '売上', color: '#0d9488',
        metrics: [
            { key: 'totalSales', label: '税込総売上', axis: 'y', color: '#0d9488' },
            { key: 'totalSalesAfterTax', label: '税引後売上', axis: 'y', color: '#0891b2' },
            { key: 'serviceSales', label: '提供売上', axis: 'y', color: '#2dd4bf' },
            { key: 'merchandiseSales', label: '物販売上', axis: 'y', color: '#5eead4' },
            { key: 'consumptionTax', label: '消費税', axis: 'y', color: '#99f6e4' },
        ]
    },
    {
        key: 'cost', label: '原価', color: '#f59e0b',
        metrics: [
            { key: 'costTotal', label: '原価合計', axis: 'y', color: '#f59e0b' },
            { key: 'flavorCost', label: 'フレーバー原価', axis: 'y', color: '#fbbf24' },
            { key: 'charcoalCost', label: '炭原価', axis: 'y', color: '#d97706' },
            { key: 'drinkCost', label: 'ジュース原価', axis: 'y', color: '#b45309' },
            { key: 'merchandiseFlavorCost', label: '物販フレーバー原価', axis: 'y', color: '#92400e' },
        ]
    },
    {
        key: 'profit', label: '利益', color: '#6366f1',
        metrics: [
            { key: 'grossProfit', label: '粗利', axis: 'y', color: '#6366f1' },
            { key: 'operatingProfit', label: '営業利益', axis: 'y', color: '#818cf8' },
            { key: 'netCashFlow', label: '会社手残り', axis: 'y', color: '#4f46e5' },
        ]
    },
    {
        key: 'flr', label: 'FLR比', color: '#ec4899',
        metrics: [
            { key: 'fRatio', label: 'F比', axis: 'yPct', color: '#ec4899' },
            { key: 'lRatio', label: 'L比', axis: 'yPct', color: '#f43f5e' },
            { key: 'rRatio', label: 'R比', axis: 'yPct', color: '#a855f7' },
        ]
    },
    {
        key: 'sga', label: '販管費', color: '#64748b',
        metrics: [
            { key: 'rent', label: '家賃', axis: 'y', color: '#64748b' },
            { key: 'laborCost', label: '人件費', axis: 'y', color: '#475569' },
            { key: 'paymentFee', label: '決済手数料', axis: 'y', color: '#94a3b8' },
            { key: 'utilities', label: '光熱費', axis: 'y', color: '#7c8fa8' },
            { key: 'sundries', label: '雑費', axis: 'y', color: '#b0bec5' },
        ]
    },
]

const DEFAULT_VISIBLE = ['totalSales', 'fRatio', 'lRatio', 'rRatio', 'netCashFlow']

const ALL_METRICS = CATEGORIES.flatMap(c => c.metrics)

export default {
    name: 'PLTrendChart',
    props: {
        labels: { type: Array, required: true },
        trendMonthly: { type: Array, required: true }
    },
    data() {
        return {
            CATEGORIES,
            chart: null,
            expandedCategory: null,
            visibleMetrics: [...DEFAULT_VISIBLE]
        }
    },
    computed: {
        currentMetrics() {
            if (!this.expandedCategory) return []
            return CATEGORIES.find(c => c.key === this.expandedCategory)?.metrics ?? []
        },
        chartDatasets() {
            return ALL_METRICS
                .filter(m => this.visibleMetrics.includes(m.key))
                .map(m => ({
                    label: m.label,
                    yAxisID: m.axis,
                    data: this.trendMonthly.map(entry => {
                        const v = entry.pl?.[m.key]
                        if (v == null) return null
                        return m.axis === 'yPct' ? v : Math.round(v)
                    }),
                    borderColor: m.color,
                    backgroundColor: m.color + '14',
                    tension: 0.3,
                    spanGaps: true,
                    pointRadius: 3,
                    borderWidth: 2
                }))
        }
    },
    mounted() { this.init() },
    beforeUnmount() { if (this.chart) this.chart.destroy() },
    watch: {
        chartDatasets: { deep: true, handler() { this.update() } },
        labels() { this.update() }
    },
    methods: {
        toggleCategory(key) {
            this.expandedCategory = this.expandedCategory === key ? null : key
        },
        toggleMetric(key) {
            const idx = this.visibleMetrics.indexOf(key)
            if (idx >= 0) this.visibleMetrics.splice(idx, 1)
            else this.visibleMetrics.push(key)
        },
        buildOptions() {
            return {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const v = ctx.parsed.y
                                if (v == null) return `${ctx.dataset.label}: —`
                                if (ctx.dataset.yAxisID === 'yPct') {
                                    return `${ctx.dataset.label}: ${(v * 100).toFixed(1)}%`
                                }
                                return `${ctx.dataset.label}: ¥${Math.round(v).toLocaleString('ja-JP')}`
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { font: { size: 11 } } },
                    y: {
                        position: 'left',
                        ticks: {
                            font: { size: 10 },
                            callback: (v) => v === 0 ? '0' : `${(v / 10000).toFixed(0)}万`
                        }
                    },
                    yPct: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: {
                            font: { size: 10 },
                            callback: (v) => `${(v * 100).toFixed(0)}%`
                        },
                        min: 0
                    }
                }
            }
        },
        init() {
            if (this.chart) this.chart.destroy()
            // markRaw でリアクティブ化を防ぐ。data() に格納された Chart インスタンスが
            // Vue の Proxy にラップされると、chart.update() 時の内部参照同一性比較が壊れ、
            // データセット変更が再描画に反映されない（トグルが効かない）ため。
            this.chart = markRaw(new Chart(this.$refs.canvas, {
                type: 'line',
                data: { labels: this.labels, datasets: this.chartDatasets },
                options: this.buildOptions()
            }))
        },
        update() {
            if (!this.chart) { this.init(); return }
            this.chart.data.labels = this.labels
            this.chart.data.datasets = this.chartDatasets
            this.chart.options = this.buildOptions()
            this.chart.update()
        }
    }
}
</script>

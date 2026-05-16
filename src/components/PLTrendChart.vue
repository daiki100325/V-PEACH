<template>
    <div class="relative" style="height: 200px">
        <canvas ref="canvas"></canvas>
    </div>
</template>

<script>
import {
    Chart, LineController, LineElement, PointElement,
    LinearScale, CategoryScale, Tooltip, Legend
} from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

export default {
    name: 'PLTrendChart',
    props: {
        labels: { type: Array, required: true },
        datasets: { type: Array, required: true }
    },
    data() { return { chart: null } },
    mounted() { this.init() },
    beforeUnmount() { if (this.chart) this.chart.destroy() },
    watch: {
        datasets: { deep: true, handler() { this.update() } }
    },
    methods: {
        init() {
            if (this.chart) this.chart.destroy()
            this.chart = new Chart(this.$refs.canvas, {
                type: 'line',
                data: { labels: this.labels, datasets: this.datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const v = ctx.parsed.y
                                    if (v == null) return `${ctx.dataset.label}: —`
                                    return `${ctx.dataset.label}: ¥${Math.round(v).toLocaleString('ja-JP')}`
                                }
                            }
                        }
                    },
                    scales: {
                        x: { ticks: { font: { size: 11 } } },
                        y: {
                            ticks: {
                                font: { size: 10 },
                                callback: (v) => v === 0 ? '0' : `${(v / 10000).toFixed(0)}万`
                            }
                        }
                    }
                }
            })
        },
        update() {
            if (!this.chart) { this.init(); return }
            this.chart.data.labels = this.labels
            this.chart.data.datasets = this.datasets
            this.chart.update()
        }
    }
}
</script>

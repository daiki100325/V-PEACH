<template>
    <main class="container mx-auto px-4 py-6 max-w-lg md:max-w-3xl flex-grow">

        <!-- Step 0: 対象月選択 -->
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
        </div>

        <!-- Step 1〜N: 店舗別入力 -->
        <div v-if="step >= 1 && step <= stores.length && currentStore" class="space-y-4 pb-32">

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
                    <input type="number" min="0" v-model.number="currentStore.formData.service_sales"
                        :placeholder="currentStore.prevRecord ? String(currentStore.prevRecord.service_sales) : '例: 1500000'"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
                <p v-if="currentStore.prevRecord" class="text-xs text-slate-400">前月実績: ¥{{ Number(currentStore.prevRecord.service_sales || 0).toLocaleString() }}</p>
            </div>

            <!-- 物販売上（税込） -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">物販売上（税込）</label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <input type="number" min="0" v-model.number="currentStore.formData.merchandise_sales"
                        placeholder="例: 50000（なければ空欄）"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
                <p class="text-xs text-slate-400">物販がない月は空欄のままで構いません（0として扱います）</p>
            </div>

            <!-- 人件費 -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">人件費 <span class="text-red-500">*</span></label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <input type="number" min="0" v-model.number="currentStore.formData.labor_cost"
                        placeholder="例: 300000"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
            </div>
        </div>

        <!-- Step N+1: 確認 -->
        <div v-if="step === stores.length + 1" class="space-y-4 pb-32">
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

    </main>
</template>

<script>
import { getMonthlyRecord, upsertMonthlyRecord, getCostReportDates } from '../../api.js'
import { buildYearOptions, buildMonthOptions, composePeriodKey, formatPeriodLabel, getPrevPeriodKey } from '../../utils/periods.js'

export default {
    name: 'InputApp',
    props: {
        stores: { type: Array, default: () => [] }
    },
    emits: ['update:loading', 'update:loadingMessage', 'update:stepActive', 'update:currentStep', 'update:canNext', 'update:isLastStep', 'submitted'],
    data() {
        return {
            step: 0,
            selectedYear: '',
            selectedMonth: '',
            storeData: [],
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
            if (this.step >= 1 && this.step <= this.stores.length) {
                return this.storeData[this.step - 1] ?? null
            }
            return null
        },
        canNext() {
            if (this.step >= 1 && this.step <= this.stores.length) {
                const fd = this.storeData[this.step - 1]?.formData
                if (!fd) return false
                return fd.service_sales != null && fd.service_sales >= 0 &&
                       fd.labor_cost != null && fd.labor_cost >= 0
            }
            if (this.step === this.stores.length + 1) return true
            return false
        },
        isLastStep() {
            return this.step === this.stores.length + 1
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
        prevStep() {
            if (this.step > 0) this.step--
        },
        nextStep() {
            if (this.step < this.stores.length + 1) this.step++
        },
        async submit() {
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
                this.step = 0
                this.storeData = []
                this.$emit('submitted')
            } catch (e) {
                alert(e.message || '保存に失敗しました。')
            } finally {
                this.$emit('update:loading', false)
            }
        }
    }
}
</script>

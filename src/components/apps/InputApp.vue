<template>
    <main class="container mx-auto px-4 py-6 max-w-lg md:max-w-3xl flex-grow">

        <!-- Step 0: 拠点・対象月選択 -->
        <div v-if="step === 0" class="flex flex-col items-center pt-6 pb-20">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5 w-full max-w-md">
                <div class="text-center">
                    <h2 class="text-xl font-bold text-slate-800">月次データを入力</h2>
                </div>

                <!-- 拠点選択 -->
                <div class="space-y-3">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">対象店舗</label>
                    <select v-model="selectedStoreKey"
                        class="appearance-none w-full bg-slate-50 border border-slate-200 text-base font-bold rounded-xl p-4 text-center focus:ring-2 focus:ring-brand-500"
                        :class="selectedStoreKey ? 'text-slate-800' : 'text-slate-400'">
                        <option value="" disabled>店舗を選択</option>
                        <option v-for="store in stores" :key="store.key" :value="store.key">{{ store.name }}</option>
                    </select>
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

        <!-- Step 1: 売上・人件費入力 -->
        <div v-if="step === 1" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">入力中</p>
                <p class="text-base font-bold text-slate-800">
                    {{ selectedStoreName }} — {{ periodLabel }}
                </p>
            </div>

            <!-- 提供売上（税込） -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">提供売上（税込） <span class="text-red-500">*</span></label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <input type="number" min="0" v-model.number="formData.service_sales"
                        :placeholder="prevRecord ? String(prevRecord.service_sales) : '例: 1500000'"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
                <p v-if="prevRecord" class="text-xs text-slate-400">前月実績: ¥{{ Number(prevRecord.service_sales || 0).toLocaleString() }}</p>
            </div>

            <!-- 物販売上（税込） -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">物販売上（税込）</label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <input type="number" min="0" v-model.number="formData.merchandise_sales"
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
                    <input type="number" min="0" v-model.number="formData.labor_cost"
                        placeholder="例: 300000"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
            </div>
        </div>

        <!-- Step 2: 確認 -->
        <div v-if="step === 2" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <h3 class="text-base font-bold text-slate-700">入力内容の確認</h3>
                <p class="text-sm text-slate-500">{{ selectedStoreName }} — {{ periodLabel }}</p>
                <div class="divide-y divide-slate-50">
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">提供売上（税込）</span>
                        <span class="font-bold text-slate-800">¥{{ Number(formData.service_sales || 0).toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">物販売上（税込）</span>
                        <span class="font-bold text-slate-800">¥{{ Number(formData.merchandise_sales || 0).toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between py-2 text-sm">
                        <span class="text-slate-500">人件費</span>
                        <span class="font-bold text-slate-800">¥{{ Number(formData.labor_cost || 0).toLocaleString() }}</span>
                    </div>
                </div>
                <p class="text-xs text-slate-400 pt-1">家賃・決済手数料・光熱費・雑費は設定値から自動適用されます</p>
            </div>
        </div>

    </main>
</template>

<script>
import { getMonthlyRecord, upsertMonthlyRecord } from '../../api.js'
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
            selectedStoreKey: '',
            selectedYear: '',
            selectedMonth: '',
            formData: {
                service_sales: null,
                merchandise_sales: null,
                labor_cost: null
            },
            prevRecord: null,
            years: buildYearOptions(),
            months: buildMonthOptions()
        }
    },
    computed: {
        canStart() {
            return !!(this.selectedYear && this.selectedMonth && this.selectedStoreKey)
        },
        periodKey() {
            return composePeriodKey(this.selectedYear, this.selectedMonth)
        },
        periodLabel() {
            return formatPeriodLabel(this.periodKey)
        },
        selectedStoreName() {
            const s = this.stores.find(x => x.key === this.selectedStoreKey)
            return s ? s.name : ''
        },
        canNext() {
            if (this.step === 1) {
                return this.formData.service_sales != null && this.formData.service_sales >= 0 &&
                       this.formData.labor_cost != null && this.formData.labor_cost >= 0
            }
            if (this.step === 2) return true
            return false
        },
        isLastStep() {
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
        canNext(val) {
            this.$emit('update:canNext', val)
        },
        isLastStep(val) {
            this.$emit('update:isLastStep', val)
        }
    },
    methods: {
        async startEntry() {
            if (!this.canStart) return
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', 'データを読み込み中...')
            try {
                const [existing, prev] = await Promise.all([
                    getMonthlyRecord(this.selectedStoreKey, this.periodKey),
                    getMonthlyRecord(this.selectedStoreKey, getPrevPeriodKey(this.periodKey))
                ])
                this.prevRecord = prev
                if (existing) {
                    this.formData = {
                        service_sales: existing.service_sales,
                        merchandise_sales: existing.merchandise_sales,
                        labor_cost: existing.labor_cost
                    }
                } else {
                    this.formData = { service_sales: null, merchandise_sales: null, labor_cost: null }
                }
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
            if (this.step < 2) this.step++
        },
        async submit() {
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                await upsertMonthlyRecord(this.selectedStoreKey, this.periodKey, {
                    service_sales: this.formData.service_sales,
                    merchandise_sales: this.formData.merchandise_sales ?? 0,
                    labor_cost: this.formData.labor_cost
                })
                alert('保存しました。')
                this.step = 0
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

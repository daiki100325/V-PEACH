<template>
    <main class="container mx-auto px-4 py-6 max-w-lg md:max-w-3xl flex-grow">

        <!-- Step 0: 拠点・対象月・種別選択 -->
        <div v-if="step === 0" class="flex flex-col items-center pt-6 pb-20">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5 w-full max-w-md">
                <div class="text-center">
                    <h2 class="text-xl font-bold text-slate-800">月次データを入力</h2>
                </div>

                <!-- 入力種別 -->
                <div class="space-y-3">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">入力種別</label>
                    <div class="grid grid-cols-2 gap-3">
                        <button @click="inputType = 'store'"
                            :class="inputType === 'store' ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/30' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-brand-50 hover:text-brand-600'"
                            class="py-4 rounded-2xl font-bold border-2 transition-all active:scale-95 text-sm text-center">
                            店舗別
                        </button>
                        <button @click="inputType = 'company'"
                            :class="inputType === 'company' ? 'bg-slate-700 text-white border-slate-700 shadow-md shadow-slate-500/30' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'"
                            class="py-4 rounded-2xl font-bold border-2 transition-all active:scale-95 text-sm text-center">
                            全社共通費
                        </button>
                    </div>
                </div>

                <!-- 拠点選択（店舗別のみ） -->
                <div v-if="inputType === 'store'" class="space-y-3">
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

        <!-- Step 1: 売上・経費入力（店舗別） -->
        <div v-if="step === 1 && inputType === 'store'" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">入力中</p>
                <p class="text-base font-bold text-slate-800">
                    {{ selectedStoreName }} — {{ periodLabel }}
                </p>
            </div>

            <!-- 総売上 -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">総売上 <span class="text-red-500">*</span></label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <input type="number" min="0" v-model.number="formData.total_sales"
                        :placeholder="prevRecord ? String(prevRecord.total_sales) : '例: 1500000'"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
                <p v-if="prevRecord" class="text-xs text-slate-400">前月実績: ¥{{ Number(prevRecord.total_sales).toLocaleString() }}</p>
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

            <!-- 家賃 -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div class="flex items-center justify-between">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">家賃</label>
                    <span v-if="storeSettings?.fixed_rent" class="text-xs text-slate-400">設定値: ¥{{ Number(storeSettings.fixed_rent).toLocaleString() }}</span>
                </div>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <input type="number" min="0" v-model.number="formData.rent"
                        :placeholder="storeSettings?.fixed_rent ? String(storeSettings.fixed_rent) : '設定値を使用'"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
                <p class="text-xs text-slate-400">空欄の場合、設定画面の固定値を使用します</p>
            </div>

            <!-- 決済手数料 -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div class="flex items-center justify-between">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">決済手数料</label>
                    <span v-if="storeSettings?.fixed_payment_fee" class="text-xs text-slate-400">設定値: ¥{{ Number(storeSettings.fixed_payment_fee).toLocaleString() }}</span>
                </div>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <input type="number" min="0" v-model.number="formData.payment_fee"
                        :placeholder="storeSettings?.fixed_payment_fee ? String(storeSettings.fixed_payment_fee) : '設定値を使用'"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
            </div>

            <!-- 光熱費 -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div class="flex items-center justify-between">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">光熱費</label>
                    <span v-if="storeSettings?.fixed_utilities" class="text-xs text-slate-400">設定値: ¥{{ Number(storeSettings.fixed_utilities).toLocaleString() }}</span>
                </div>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <input type="number" min="0" v-model.number="formData.utilities"
                        :placeholder="storeSettings?.fixed_utilities ? String(storeSettings.fixed_utilities) : '設定値を使用'"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
            </div>

            <!-- 雑費 -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div class="flex items-center justify-between">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">雑費</label>
                    <span v-if="storeSettings?.fixed_sundries" class="text-xs text-slate-400">設定値: ¥{{ Number(storeSettings.fixed_sundries).toLocaleString() }}</span>
                </div>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <input type="number" min="0" v-model.number="formData.sundries"
                        :placeholder="storeSettings?.fixed_sundries ? String(storeSettings.fixed_sundries) : '設定値を使用'"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                </div>
            </div>
        </div>

        <!-- Step 1: 全社共通費入力 -->
        <div v-if="step === 1 && inputType === 'company'" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">入力中</p>
                <p class="text-base font-bold text-slate-800">全社共通費 — {{ periodLabel }}</p>
                <p class="text-xs text-slate-400 mt-1">3店舗共通で発生する費用（役員報酬・借入返済）を入力します</p>
            </div>

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">役員報酬</label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <input type="number" min="0" v-model.number="companyFormData.exec_remuneration"
                        :placeholder="companySettings ? String(companySettings.exec_remuneration) : '0'"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
                <p v-if="companySettings" class="text-xs text-slate-400">現在の設定値: ¥{{ Number(companySettings.exec_remuneration).toLocaleString() }}</p>
            </div>

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">借入返済</label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                    <input type="number" min="0" v-model.number="companyFormData.debt_repayment"
                        :placeholder="companySettings ? String(companySettings.debt_repayment) : '0'"
                        class="w-full bg-slate-50 border border-slate-200 text-lg font-bold rounded-xl pl-8 pr-4 py-4 text-slate-800 focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
                <p v-if="companySettings" class="text-xs text-slate-400">現在の設定値: ¥{{ Number(companySettings.debt_repayment).toLocaleString() }}</p>
            </div>
        </div>

        <!-- Step 2: 確認 -->
        <div v-if="step === 2" class="space-y-4 pb-32">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <h3 class="text-base font-bold text-slate-700">入力内容の確認</h3>
                <p class="text-sm text-slate-500">
                    {{ inputType === 'store' ? selectedStoreName : '全社共通費' }} — {{ periodLabel }}
                </p>
                <div class="divide-y divide-slate-50">
                    <template v-if="inputType === 'store'">
                        <div class="flex justify-between py-2 text-sm">
                            <span class="text-slate-500">総売上</span>
                            <span class="font-bold text-slate-800">¥{{ Number(formData.total_sales || 0).toLocaleString() }}</span>
                        </div>
                        <div class="flex justify-between py-2 text-sm">
                            <span class="text-slate-500">人件費</span>
                            <span class="font-bold text-slate-800">¥{{ Number(formData.labor_cost || 0).toLocaleString() }}</span>
                        </div>
                        <div class="flex justify-between py-2 text-sm">
                            <span class="text-slate-500">家賃</span>
                            <span class="font-bold" :class="formData.rent != null ? 'text-slate-800' : 'text-slate-400'">
                                {{ formData.rent != null ? `¥${Number(formData.rent).toLocaleString()}` : '設定値を使用' }}
                            </span>
                        </div>
                        <div class="flex justify-between py-2 text-sm">
                            <span class="text-slate-500">決済手数料</span>
                            <span class="font-bold" :class="formData.payment_fee != null ? 'text-slate-800' : 'text-slate-400'">
                                {{ formData.payment_fee != null ? `¥${Number(formData.payment_fee).toLocaleString()}` : '設定値を使用' }}
                            </span>
                        </div>
                        <div class="flex justify-between py-2 text-sm">
                            <span class="text-slate-500">光熱費</span>
                            <span class="font-bold" :class="formData.utilities != null ? 'text-slate-800' : 'text-slate-400'">
                                {{ formData.utilities != null ? `¥${Number(formData.utilities).toLocaleString()}` : '設定値を使用' }}
                            </span>
                        </div>
                        <div class="flex justify-between py-2 text-sm">
                            <span class="text-slate-500">雑費</span>
                            <span class="font-bold" :class="formData.sundries != null ? 'text-slate-800' : 'text-slate-400'">
                                {{ formData.sundries != null ? `¥${Number(formData.sundries).toLocaleString()}` : '設定値を使用' }}
                            </span>
                        </div>
                    </template>
                    <template v-else>
                        <div class="flex justify-between py-2 text-sm">
                            <span class="text-slate-500">役員報酬</span>
                            <span class="font-bold text-slate-800">¥{{ Number(companyFormData.exec_remuneration || 0).toLocaleString() }}</span>
                        </div>
                        <div class="flex justify-between py-2 text-sm">
                            <span class="text-slate-500">借入返済</span>
                            <span class="font-bold text-slate-800">¥{{ Number(companyFormData.debt_repayment || 0).toLocaleString() }}</span>
                        </div>
                    </template>
                </div>
            </div>
        </div>

    </main>
</template>

<script>
import { getMonthlyRecord, upsertMonthlyRecord, getStoreSettings, getCompanySettings, upsertCompanySettings } from '../../api.js'
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
            inputType: 'store',      // 'store' | 'company'
            selectedStoreKey: '',
            selectedYear: '',
            selectedMonth: '',
            formData: {
                total_sales: null,
                labor_cost: null,
                rent: null,
                payment_fee: null,
                utilities: null,
                sundries: null
            },
            companyFormData: {
                exec_remuneration: null,
                debt_repayment: null
            },
            storeSettings: null,
            companySettings: null,
            prevRecord: null,
            years: buildYearOptions(),
            months: buildMonthOptions()
        }
    },
    computed: {
        canStart() {
            if (!this.selectedYear || !this.selectedMonth) return false
            if (this.inputType === 'store' && !this.selectedStoreKey) return false
            return true
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
            if (this.step === 1 && this.inputType === 'store') {
                return this.formData.total_sales != null && this.formData.total_sales >= 0 &&
                       this.formData.labor_cost != null && this.formData.labor_cost >= 0
            }
            if (this.step === 1 && this.inputType === 'company') {
                return true
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
            this.$emit('update:loadingMessage', '設定を読み込み中...')
            try {
                if (this.inputType === 'store') {
                    const [settings, existing, prev] = await Promise.all([
                        getStoreSettings(this.selectedStoreKey),
                        getMonthlyRecord(this.selectedStoreKey, this.periodKey),
                        getMonthlyRecord(this.selectedStoreKey, getPrevPeriodKey(this.periodKey))
                    ])
                    this.storeSettings = settings
                    this.prevRecord = prev
                    // 既存データがあれば復元
                    if (existing) {
                        this.formData = {
                            total_sales: existing.total_sales,
                            labor_cost: existing.labor_cost,
                            rent: existing.rent,
                            payment_fee: existing.payment_fee,
                            utilities: existing.utilities,
                            sundries: existing.sundries
                        }
                    } else {
                        this.formData = { total_sales: null, labor_cost: null, rent: null, payment_fee: null, utilities: null, sundries: null }
                    }
                } else {
                    const settings = await getCompanySettings()
                    this.companySettings = settings
                    this.companyFormData = {
                        exec_remuneration: settings.exec_remuneration,
                        debt_repayment: settings.debt_repayment
                    }
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
                if (this.inputType === 'store') {
                    const fields = {}
                    if (this.formData.total_sales != null) fields.total_sales = this.formData.total_sales
                    if (this.formData.labor_cost != null) fields.labor_cost = this.formData.labor_cost
                    // nullなら設定値を使うのでDBにはnullを保存
                    fields.rent = this.formData.rent != null ? this.formData.rent : null
                    fields.payment_fee = this.formData.payment_fee != null ? this.formData.payment_fee : null
                    fields.utilities = this.formData.utilities != null ? this.formData.utilities : null
                    fields.sundries = this.formData.sundries != null ? this.formData.sundries : null
                    await upsertMonthlyRecord(this.selectedStoreKey, this.periodKey, fields)
                } else {
                    await upsertCompanySettings({
                        exec_remuneration: this.companyFormData.exec_remuneration ?? 0,
                        debt_repayment: this.companyFormData.debt_repayment ?? 0
                    })
                }
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

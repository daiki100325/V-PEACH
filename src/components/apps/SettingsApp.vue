<template>
    <main class="container mx-auto px-4 py-6 max-w-lg md:max-w-2xl flex-grow">

        <!-- サブモード選択メニュー -->
        <div v-if="subMode === null">
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5 max-w-md mx-auto">
                <div class="text-center">
                    <h2 class="text-xl font-bold text-slate-800">設定メニューを選択</h2>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button @click="openStoreSettings"
                        class="text-left rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 p-5 transition-colors focus:outline-none">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-2xl">🏪</span>
                            <span class="text-base font-bold text-slate-800">店舗別固定費</span>
                        </div>
                        <div class="text-sm text-slate-500">家賃・光熱費・雑費・決済手数料率を店舗ごとに設定します</div>
                    </button>
                    <button @click="openCompanySettings"
                        class="text-left rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 p-5 transition-colors focus:outline-none">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-2xl">🏢</span>
                            <span class="text-base font-bold text-slate-800">全社共通費</span>
                        </div>
                        <div class="text-sm text-slate-500">役員報酬・借入返済など全社共通の固定費を設定します</div>
                    </button>
                    <button @click="openBenchmarkSettings"
                        class="text-left rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 p-5 transition-colors focus:outline-none">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-2xl">🎯</span>
                            <span class="text-base font-bold text-slate-800">ベンチマーク設定</span>
                        </div>
                        <div class="text-sm text-slate-500">人件費率・原価率などの目標値を設定します</div>
                    </button>
                </div>
            </div>
        </div>

        <!-- 共通: 戻るボタン -->
        <button v-if="subMode !== null" @click="subMode = null"
            class="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 font-medium transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            設定メニューへ戻る
        </button>

        <!-- ─── 店舗別固定費 ─────────────────────────────────────────── -->
        <div v-if="subMode === 'store-settings'" class="space-y-4 pb-28">
            <h2 class="text-base font-bold text-slate-700 mb-1">店舗別固定費</h2>

            <!-- 拠点選択 -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider">対象店舗</label>
                <select v-model="ssStoreKey" @change="loadStoreSettings"
                    class="appearance-none w-full bg-slate-50 border border-slate-200 text-base font-bold rounded-xl p-4 text-center focus:ring-2 focus:ring-brand-500"
                    :class="ssStoreKey ? 'text-slate-800' : 'text-slate-400'">
                    <option value="" disabled>店舗を選択</option>
                    <option v-for="store in stores" :key="store.key" :value="store.key">{{ store.name }}</option>
                </select>
            </div>

            <template v-if="ssStoreKey && ssData">
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">固定費（月額）</p>

                    <div v-for="field in storeSettingsFields" :key="field.key" class="space-y-1">
                        <label class="block text-xs font-medium text-slate-500">{{ field.label }}</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">{{ field.prefix }}</span>
                            <input type="number" min="0" :step="field.step || 1"
                                v-model.number="ssData[field.key]"
                                class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-7 pr-3 py-3 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                        </div>
                    </div>
                </div>
            </template>

            <!-- 保存ボタン -->
            <transition name="slide-up">
                <div v-if="ssStoreKey && ssData"
                    class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 z-20">
                    <div class="container mx-auto max-w-lg">
                        <button @click="saveStoreSettings" :disabled="ssSaving"
                            class="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-full shadow-lg transition-all active:scale-95 disabled:opacity-50">
                            {{ ssSaving ? '保存中...' : '変更を保存' }}
                        </button>
                    </div>
                </div>
            </transition>
        </div>

        <!-- ─── 全社共通費 ─────────────────────────────────────────────── -->
        <div v-if="subMode === 'company-settings'" class="space-y-4 pb-28">
            <h2 class="text-base font-bold text-slate-700 mb-1">全社共通費</h2>
            <p class="text-xs text-slate-400 mb-4">3店舗で共通する費用です。PLの全社集計時に1回だけ差し引かれます。</p>

            <div v-if="csLoading" class="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
            <template v-else>
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                    <div class="space-y-1">
                        <label class="block text-xs font-medium text-slate-500">役員報酬（月額）</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">¥</span>
                            <input type="number" min="0" v-model.number="csData.exec_remuneration"
                                class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-7 pr-3 py-3 text-slate-800 focus:ring-2 focus:ring-slate-500 outline-none" />
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="block text-xs font-medium text-slate-500">借入返済（月額）</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">¥</span>
                            <input type="number" min="0" v-model.number="csData.debt_repayment"
                                class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-7 pr-3 py-3 text-slate-800 focus:ring-2 focus:ring-slate-500 outline-none" />
                        </div>
                    </div>
                </div>

                <div class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 z-20">
                    <div class="container mx-auto max-w-lg">
                        <button @click="saveCompanySettings" :disabled="csSaving"
                            class="w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-4 rounded-full shadow-lg transition-all active:scale-95 disabled:opacity-50">
                            {{ csSaving ? '保存中...' : '変更を保存' }}
                        </button>
                    </div>
                </div>
            </template>
        </div>

        <!-- ─── ベンチマーク設定 ───────────────────────────────────────── -->
        <div v-if="subMode === 'benchmark'" class="space-y-4 pb-28">
            <h2 class="text-base font-bold text-slate-700 mb-1">ベンチマーク目標値</h2>
            <p class="text-xs text-slate-400 mb-4">全社共通のHealth Check目標値を設定します。PLモードで実績と比較表示されます。</p>

            <div v-if="bmLoading" class="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
            <template v-else>
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
                    <div v-for="item in bmItems" :key="item.key" class="space-y-1">
                        <div class="flex items-center justify-between">
                            <label class="block text-xs font-medium text-slate-600">{{ item.label }}</label>
                            <span class="text-xs text-slate-400">{{ item.hint }}</span>
                        </div>
                        <div class="relative flex items-center">
                            <input type="number" min="0" max="100" step="0.1"
                                v-model.number="bmData[item.key]"
                                :placeholder="item.placeholder"
                                class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-4 pr-10 py-3 text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none" />
                            <span class="absolute right-4 text-slate-400 text-sm font-bold">%</span>
                        </div>
                    </div>
                </div>

                <div class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 z-20">
                    <div class="container mx-auto max-w-lg">
                        <button @click="saveBenchmarks" :disabled="bmSaving"
                            class="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-full shadow-lg transition-all active:scale-95 disabled:opacity-50">
                            {{ bmSaving ? '保存中...' : '変更を保存' }}
                        </button>
                    </div>
                </div>
            </template>
        </div>

    </main>
</template>

<script>
import {
    getStoreSettings, upsertStoreSettings,
    getCompanySettings, upsertCompanySettings,
    getBenchmarks, upsertBenchmark
} from '../../api.js'
import { buildYearOptions, buildMonthOptions } from '../../utils/periods.js'

export default {
    name: 'SettingsApp',
    props: {
        stores: { type: Array, default: () => [] }
    },
    emits: ['update:loading', 'update:loadingMessage'],
    data() {
        return {
            subMode: null,
            years: buildYearOptions(),
            months: buildMonthOptions(),
            // 店舗別固定費
            ssStoreKey: '',
            ssData: null,
            ssSaving: false,
            // 全社共通費
            csData: { exec_remuneration: 0, debt_repayment: 0 },
            csLoading: false,
            csSaving: false,
            // ベンチマーク
            bmLoading: false,
            bmSaving: false,
            bmData: { labor_rate: null, gross_profit_margin: null, operating_profit_margin: null, cost_ratio: null }
        }
    },
    computed: {
        bmItems() {
            return [
                { key: 'labor_rate', label: '労働分配率 目標（上限）', hint: '実績がこの値以下でOK判定', placeholder: '例: 40' },
                { key: 'gross_profit_margin', label: '粗利率 目標（下限）', hint: '実績がこの値以上でOK判定', placeholder: '例: 40' },
                { key: 'operating_profit_margin', label: '営業利益率 目標（下限）', hint: '実績がこの値以上でOK判定', placeholder: '例: 10' },
                { key: 'cost_ratio', label: '原価率 目標（上限）', hint: '実績がこの値以下でOK判定', placeholder: '例: 35' },
            ]
        },
        storeSettingsFields() {
            return [
                { key: 'fixed_rent', label: '家賃（月額）', prefix: '¥' },
                { key: 'fixed_utilities', label: '光熱費（月額）', prefix: '¥' },
                { key: 'fixed_sundries', label: '雑費（月額）', prefix: '¥' },
                { key: 'payment_fee_rate', label: '決済手数料率（%）', prefix: '', step: 0.1 }
            ]
        }
    },
    methods: {
        // ─── 店舗別固定費 ──────────────────────────────────────────────
        async openStoreSettings() {
            this.subMode = 'store-settings'
            this.ssStoreKey = ''
            this.ssData = null
        },
        async loadStoreSettings() {
            if (!this.ssStoreKey) return
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '設定を読み込み中...')
            try {
                const settings = await getStoreSettings(this.ssStoreKey)
                // payment_fee_rate はDB小数値 → UI表示用に%変換
                this.ssData = {
                    ...settings,
                    payment_fee_rate: settings.payment_fee_rate != null
                        ? Number((Number(settings.payment_fee_rate) * 100).toFixed(2))
                        : 2.5
                }
            } catch (e) {
                alert(e.message || '読み込みに失敗しました。')
            } finally {
                this.$emit('update:loading', false)
            }
        },
        async saveStoreSettings() {
            this.ssSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                // payment_fee_rate はUI入力%値 → DB保存用に小数変換
                const fields = {
                    ...this.ssData,
                    payment_fee_rate: Number(this.ssData.payment_fee_rate) / 100
                }
                await upsertStoreSettings(this.ssStoreKey, fields)
                alert('保存しました。')
            } catch (e) {
                alert(e.message || '保存に失敗しました。')
            } finally {
                this.ssSaving = false
                this.$emit('update:loading', false)
            }
        },
        // ─── 全社共通費 ─────────────────────────────────────────────
        async openCompanySettings() {
            this.subMode = 'company-settings'
            this.csLoading = true
            try {
                const settings = await getCompanySettings()
                this.csData = { exec_remuneration: settings.exec_remuneration, debt_repayment: settings.debt_repayment }
            } catch (e) {
                alert(e.message || '読み込みに失敗しました。')
            } finally {
                this.csLoading = false
            }
        },
        async saveCompanySettings() {
            this.csSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                await upsertCompanySettings(this.csData)
                alert('保存しました。')
            } catch (e) {
                alert(e.message || '保存に失敗しました。')
            } finally {
                this.csSaving = false
                this.$emit('update:loading', false)
            }
        },
        // ─── ベンチマーク ────────────────────────────────────────────
        async openBenchmarkSettings() {
            this.subMode = 'benchmark'
            this.bmLoading = true
            try {
                const bms = await getBenchmarks(null)
                this.bmData = { labor_rate: null, gross_profit_margin: null, operating_profit_margin: null, cost_ratio: null }
                for (const bm of bms) {
                    if (bm.item_name in this.bmData && bm.target_value != null) {
                        this.bmData[bm.item_name] = Number((Number(bm.target_value) * 100).toFixed(2))
                    }
                }
            } catch (e) {
                alert(e.message || '読み込みに失敗しました。')
            } finally {
                this.bmLoading = false
            }
        },
        async saveBenchmarks() {
            this.bmSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                for (const [key, val] of Object.entries(this.bmData)) {
                    if (val != null && val !== '') {
                        await upsertBenchmark(null, key, Number(val) / 100, true)
                    }
                }
                alert('保存しました。')
            } catch (e) {
                alert(e.message || '保存に失敗しました。')
            } finally {
                this.bmSaving = false
                this.$emit('update:loading', false)
            }
        },
    }
}
</script>

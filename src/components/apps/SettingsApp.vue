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
                        <div class="text-sm text-slate-500">家賃・光熱費・雑費・物販利益率を店舗ごとに設定します</div>
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
                    <button @click="openMerchandisePrice"
                        class="text-left rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 p-5 transition-colors focus:outline-none">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-2xl">💴</span>
                            <span class="text-base font-bold text-slate-800">物販販売値設定</span>
                        </div>
                        <div class="text-sm text-slate-500">物販1ユニットあたりの販売値を管理します（改定履歴対応）</div>
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

        <!-- ─── 物販販売値設定 ─────────────────────────────────────────── -->
        <div v-if="subMode === 'merchandise-price'" class="pb-4 space-y-3">
            <h2 class="text-base font-bold text-slate-700 mb-1">物販販売値設定</h2>
            <p class="text-xs text-slate-400 mb-4">各期間の価格改定を管理します。改定後の月から新しい価格が自動適用されます。</p>

            <div v-if="mpLoading" class="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
            <div v-else class="space-y-3">

                <!-- 改定履歴一覧 -->
                <div v-if="mpMasters.length === 0" class="text-center py-8 text-slate-400 text-sm">
                    価格改定の記録がありません
                </div>
                <div v-for="(master, index) in mpMasters" :key="master.id"
                    class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div class="flex items-start justify-between gap-3 mb-3">
                        <div>
                            <span class="text-sm font-bold text-slate-800">{{ mpRangeLabel(index) }}</span>
                            <span v-if="index === 0"
                                class="ml-2 text-xs font-bold text-brand-600 bg-brand-50 rounded-full px-2 py-0.5">現在適用中</span>
                        </div>
                        <button
                            v-if="index < mpMasters.length - 1"
                            @click="deleteMpEntry(master)"
                            :disabled="mpSaving"
                            class="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-slate-50 text-red-500 border border-red-200 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-40">
                            削除
                        </button>
                        <span v-else class="text-xs text-slate-400 shrink-0 py-1.5">削除不可</span>
                    </div>
                    <div class="text-xs flex justify-between">
                        <span class="text-slate-500">1ユニット販売値</span>
                        <span class="font-bold text-slate-700">¥{{ Number(master.price_per_unit).toLocaleString() }}</span>
                    </div>
                    <div v-if="master.note" class="mt-2 text-xs text-slate-400 italic">{{ master.note }}</div>
                </div>

                <!-- 新規改定追加フォーム -->
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 mt-4">
                    <div class="flex items-center justify-between">
                        <p class="text-xs font-bold text-slate-500 uppercase tracking-wide">新しい改定を追加</p>
                        <button v-if="mpMasters.length > 0" @click="prefillFromLatest"
                            class="text-xs text-brand-600 hover:text-brand-700 font-medium">
                            現在の値をコピー
                        </button>
                    </div>

                    <div class="space-y-1">
                        <label class="text-xs text-slate-400">適用開始月</label>
                        <div class="grid grid-cols-2 gap-2">
                            <select v-model="newMp.year"
                                class="bg-slate-50 border border-slate-200 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-brand-500/20 outline-none"
                                :class="newMp.year ? 'text-slate-800' : 'text-slate-400'">
                                <option value="" disabled>年</option>
                                <option v-for="y in years" :key="y.value" :value="y.value">{{ y.label }}</option>
                            </select>
                            <select v-model="newMp.month"
                                class="bg-slate-50 border border-slate-200 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-brand-500/20 outline-none"
                                :class="newMp.month ? 'text-slate-800' : 'text-slate-400'">
                                <option value="" disabled>月</option>
                                <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
                            </select>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <label class="text-xs text-slate-400">1ユニット販売値 (円)</label>
                        <input type="number" min="0" v-model.number="newMp.pricePerUnit"
                            class="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500/20 outline-none" />
                    </div>

                    <div class="space-y-1">
                        <label class="text-xs text-slate-400">改定理由メモ（任意）</label>
                        <input type="text" v-model="newMp.note" placeholder="例：物販価格改定のため"
                            class="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl p-2.5 text-slate-700 focus:ring-2 focus:ring-brand-500/20 outline-none" />
                    </div>

                    <p v-if="newMpValidation" class="text-xs text-rose-600 font-medium">{{ newMpValidation }}</p>

                    <button @click="addMpEntry" :disabled="!!newMpValidation || mpSaving"
                        class="w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                        {{ mpSaving ? '追加中...' : '追加する' }}
                    </button>
                </div>
            </div>
        </div>

    </main>
</template>

<script>
import {
    getStoreSettings, upsertStoreSettings,
    getCompanySettings, upsertCompanySettings,
    getBenchmarks, upsertBenchmark,
    getMerchandisePriceMasters, addMerchandisePriceMaster, deleteMerchandisePriceMaster
} from '../../api.js'
import { buildYearOptions, buildMonthOptions, composePeriodKey } from '../../utils/periods.js'

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
            bmData: { labor_rate: null, gross_profit_margin: null, operating_profit_margin: null, variable_cost_ratio: null },
            // 物販販売値
            mpMasters: [],
            mpLoading: false,
            mpSaving: false,
            newMp: { year: '', month: '', pricePerUnit: 0, note: '' }
        }
    },
    computed: {
        bmItems() {
            return [
                { key: 'labor_rate', label: '労働分配率 目標（上限）', hint: '実績がこの値以下でOK判定', placeholder: '例: 40' },
                { key: 'gross_profit_margin', label: '粗利率 目標（下限）', hint: '実績がこの値以上でOK判定', placeholder: '例: 40' },
                { key: 'operating_profit_margin', label: '営業利益率 目標（下限）', hint: '実績がこの値以上でOK判定', placeholder: '例: 10' },
                { key: 'variable_cost_ratio', label: '変動費率 目標（上限）', hint: '実績がこの値以下でOK判定', placeholder: '例: 35' },
            ]
        },
        storeSettingsFields() {
            return [
                { key: 'fixed_rent', label: '家賃（月額）', prefix: '¥' },
                { key: 'fixed_payment_fee', label: '決済手数料（月額）', prefix: '¥' },
                { key: 'fixed_utilities', label: '光熱費（月額）', prefix: '¥' },
                { key: 'fixed_sundries', label: '雑費（月額）', prefix: '¥' },
                { key: 'physical_profit_margin', label: '物販利益率', prefix: '', step: 0.01 }
            ]
        },
        newMpEffectiveFrom() {
            return composePeriodKey(this.newMp.year, this.newMp.month)
        },
        newMpValidation() {
            if (!this.newMp.year || !this.newMp.month) return '適用開始月を選択してください。'
            if (!this.newMpEffectiveFrom) return '適用開始月が不正です。'
            if (this.mpMasters.some(m => m.effective_from === Number(this.newMpEffectiveFrom))) {
                return 'その月の改定はすでに登録されています。'
            }
            return ''
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
                this.ssData = { ...settings }
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
                await upsertStoreSettings(this.ssStoreKey, this.ssData)
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
                this.bmData = { labor_rate: null, gross_profit_margin: null, operating_profit_margin: null, variable_cost_ratio: null }
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
        // ─── 物販販売値 ─────────────────────────────────────────────
        async openMerchandisePrice() {
            this.subMode = 'merchandise-price'
            await this.loadMpMasters()
        },
        async loadMpMasters() {
            this.mpLoading = true
            try {
                this.mpMasters = await getMerchandisePriceMasters()
            } catch (e) {
                alert(e.message || '読み込みに失敗しました。')
            } finally {
                this.mpLoading = false
            }
        },
        mpRangeLabel(index) {
            const m = this.mpMasters[index]
            const from = m.effective_from
            const fromLabel = `${String(from).slice(0, 4)}年${String(from).slice(4)}月〜`
            if (index === 0) return fromLabel
            const prev = this.mpMasters[index - 1]
            const prevYear = Number(String(prev.effective_from).slice(0, 4))
            const prevMonth = Number(String(prev.effective_from).slice(4))
            const endYear = prevMonth === 1 ? prevYear - 1 : prevYear
            const endMonth = prevMonth === 1 ? 12 : prevMonth - 1
            return `${fromLabel} 〜 ${endYear}年${endMonth}月まで`
        },
        prefillFromLatest() {
            if (this.mpMasters.length === 0) return
            this.newMp.pricePerUnit = Number(this.mpMasters[0].price_per_unit)
        },
        async addMpEntry() {
            if (this.newMpValidation) return
            this.mpSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '追加中...')
            try {
                await addMerchandisePriceMaster({
                    effective_from: Number(this.newMpEffectiveFrom),
                    price_per_unit: this.newMp.pricePerUnit,
                    note: this.newMp.note || null
                })
                await this.loadMpMasters()
                this.newMp.year = ''
                this.newMp.month = ''
                this.newMp.note = ''
                alert('追加しました。')
            } catch (e) {
                alert(e.message || '追加に失敗しました。')
            } finally {
                this.mpSaving = false
                this.$emit('update:loading', false)
            }
        },
        async deleteMpEntry(master) {
            if (!confirm(`この価格改定を削除しますか？`)) return
            this.mpSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '削除中...')
            try {
                await deleteMerchandisePriceMaster(master.id)
                await this.loadMpMasters()
            } catch (e) {
                alert(e.message || '削除に失敗しました。')
            } finally {
                this.mpSaving = false
                this.$emit('update:loading', false)
            }
        }
    }
}
</script>

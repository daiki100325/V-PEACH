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
        <div v-if="subMode === 'store-settings'" class="space-y-4 pb-16">
            <h2 class="text-base font-bold text-slate-700">店舗別固定費</h2>

            <div v-if="ssLoading" class="text-center py-12 text-slate-400 text-sm">読み込み中...</div>

            <template v-else>
                <!-- 店舗セレクター -->
                <div class="flex gap-1 bg-slate-100 rounded-2xl p-1">
                    <button v-for="ss in ssAllData" :key="ss.storeKey"
                        @click="selectedStoreKey = ss.storeKey"
                        class="flex-1 text-sm font-bold py-2 rounded-xl transition-colors"
                        :class="selectedStoreKey === ss.storeKey
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'">
                        {{ ss.storeName }}
                    </button>
                </div>

                <div v-if="selectedSS" class="space-y-3">
                    <!-- 現在適用中 -->
                    <div v-if="selectedSS.revisions.length > 0" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div class="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">現在適用中</span>
                                <span class="text-xs text-emerald-600">{{ revRangeLabel(selectedSS.revisions, 0) }}</span>
                            </div>
                            <button v-if="selectedSS.revisions.length > 1"
                                @click="deleteStoreRev(selectedSS.storeKey, selectedSS.revisions[0])"
                                :disabled="ssSaving"
                                class="text-xs text-red-400 hover:text-red-600 transition-colors">削除</button>
                        </div>
                        <div class="divide-y divide-slate-50">
                            <div v-for="field in storeSettingsFields" :key="field.key"
                                class="flex justify-between px-4 py-2.5 text-sm">
                                <span class="text-slate-500">{{ field.label }}</span>
                                <span class="font-bold text-slate-800">{{ formatSettingValue(selectedSS.revisions[0][field.key], field) }}</span>
                            </div>
                            <div v-if="selectedSS.revisions[0].note" class="px-4 py-2 text-xs text-slate-400 italic">{{ selectedSS.revisions[0].note }}</div>
                        </div>
                    </div>
                    <div v-else class="text-xs text-slate-400 px-1">設定なし（デフォルト値が使用されます）</div>

                    <!-- 新しい改訂を追加 -->
                    <div class="bg-white rounded-2xl border border-dashed border-slate-200 p-4 space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">新しい改訂を追加</span>
                            <button v-if="selectedSS.revisions.length > 0"
                                @click="prefillStoreNewForm(selectedSS.storeKey)"
                                class="text-xs text-brand-600 hover:text-brand-700 font-medium">現在の値をコピー</button>
                        </div>

                        <!-- 適用開始月 -->
                        <div class="grid grid-cols-2 gap-2">
                            <select v-model="ssNewForm[selectedSS.storeKey].year"
                                class="appearance-none bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-brand-500 text-slate-800">
                                <option value="" disabled>年</option>
                                <option v-for="y in years" :key="y.value" :value="y.value">{{ y.label }}</option>
                            </select>
                            <select v-model="ssNewForm[selectedSS.storeKey].month"
                                class="appearance-none bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-brand-500 text-slate-800">
                                <option value="" disabled>月</option>
                                <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
                            </select>
                        </div>

                        <!-- 各フィールド -->
                        <div v-for="field in storeSettingsFields" :key="field.key" class="space-y-0.5">
                            <label class="block text-xs font-medium text-slate-500">{{ field.label }}</label>
                            <div class="relative">
                                <span v-if="field.prefix" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">{{ field.prefix }}</span>
                                <input type="number" min="0" :step="field.step || 1"
                                    v-model.number="ssNewForm[selectedSS.storeKey][field.key]"
                                    class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none"
                                    :class="field.prefix ? 'pl-7 pr-3' : 'px-3'" />
                            </div>
                        </div>

                        <!-- メモ -->
                        <input type="text" v-model="ssNewForm[selectedSS.storeKey].note"
                            placeholder="改定メモ（任意）"
                            class="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />

                        <!-- バリデーションメッセージ -->
                        <p v-if="ssNewFormError(selectedSS)" class="text-xs text-red-500">{{ ssNewFormError(selectedSS) }}</p>

                        <button @click="addStoreRev(selectedSS.storeKey)"
                            :disabled="!!ssNewFormError(selectedSS) || ssSaving"
                            class="w-full py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-brand-600 hover:bg-brand-700 text-white">
                            改訂を追加する
                        </button>
                    </div>

                    <!-- 過去の改定履歴 -->
                    <div v-if="selectedSS.revisions.length > 1" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div class="px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">改定履歴</span>
                        </div>
                        <div v-for="(rev, idx) in selectedSS.revisions.slice(1)" :key="rev.id"
                            class="px-4 py-3 border-b border-slate-50 last:border-0">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-bold text-slate-600">{{ revRangeLabel(selectedSS.revisions, idx + 1) }}</span>
                                <button v-if="idx < selectedSS.revisions.slice(1).length - 1"
                                    @click="deleteStoreRev(selectedSS.storeKey, rev)"
                                    class="text-xs text-red-400 hover:text-red-600 transition-colors">削除</button>
                            </div>
                            <div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                <div v-for="field in storeSettingsFields" :key="field.key"
                                    class="flex justify-between text-xs">
                                    <span class="text-slate-400">{{ field.shortLabel }}</span>
                                    <span class="text-slate-600 font-medium">{{ formatSettingValue(rev[field.key], field) }}</span>
                                </div>
                            </div>
                            <div v-if="rev.note" class="mt-1 text-xs text-slate-400 italic">{{ rev.note }}</div>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- ─── 全社共通費 ─────────────────────────────────────────────── -->
        <div v-if="subMode === 'company-settings'" class="space-y-4 pb-16">
            <h2 class="text-base font-bold text-slate-700">全社共通費</h2>
            <p class="text-xs text-slate-400">3店舗で共通する費用です。PLの全社集計時に1回だけ差し引かれます。</p>

            <div v-if="csLoading" class="text-center py-12 text-slate-400 text-sm">読み込み中...</div>

            <template v-else>
                <!-- 現在適用中 -->
                <div v-if="csRevisions.length > 0" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">現在適用中</span>
                            <span class="text-xs text-emerald-600">{{ revRangeLabel(csRevisions, 0) }}</span>
                        </div>
                        <button v-if="csRevisions.length > 1"
                            @click="deleteCsRev(csRevisions[0])"
                            :disabled="csSaving"
                            class="text-xs text-red-400 hover:text-red-600 transition-colors">削除</button>
                    </div>
                    <div class="divide-y divide-slate-50">
                        <div class="flex justify-between px-4 py-2.5 text-sm">
                            <span class="text-slate-500">役員報酬（月額）</span>
                            <span class="font-bold text-slate-800">¥{{ Number(csRevisions[0].exec_remuneration || 0).toLocaleString() }}</span>
                        </div>
                        <div class="flex justify-between px-4 py-2.5 text-sm">
                            <span class="text-slate-500">借入返済（月額）</span>
                            <span class="font-bold text-slate-800">¥{{ Number(csRevisions[0].debt_repayment || 0).toLocaleString() }}</span>
                        </div>
                        <div v-if="csRevisions[0].note" class="px-4 py-2 text-xs text-slate-400 italic">{{ csRevisions[0].note }}</div>
                    </div>
                </div>
                <div v-else class="text-xs text-slate-400 px-1">設定なし</div>

                <!-- 新しい改訂を追加 -->
                <div class="bg-white rounded-2xl border border-dashed border-slate-200 p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">新しい改訂を追加</span>
                        <button v-if="csRevisions.length > 0" @click="prefillCsNewForm"
                            class="text-xs text-brand-600 hover:text-brand-700 font-medium">現在の値をコピー</button>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <select v-model="csNewForm.year"
                            class="appearance-none bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-brand-500 text-slate-800">
                            <option value="" disabled>年</option>
                            <option v-for="y in years" :key="y.value" :value="y.value">{{ y.label }}</option>
                        </select>
                        <select v-model="csNewForm.month"
                            class="appearance-none bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-brand-500 text-slate-800">
                            <option value="" disabled>月</option>
                            <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
                        </select>
                    </div>
                    <div class="space-y-0.5">
                        <label class="block text-xs font-medium text-slate-500">役員報酬（月額）</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">¥</span>
                            <input type="number" min="0" v-model.number="csNewForm.exec_remuneration"
                                class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-7 pr-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                        </div>
                    </div>
                    <div class="space-y-0.5">
                        <label class="block text-xs font-medium text-slate-500">借入返済（月額）</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">¥</span>
                            <input type="number" min="0" v-model.number="csNewForm.debt_repayment"
                                class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-7 pr-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                        </div>
                    </div>
                    <input type="text" v-model="csNewForm.note" placeholder="改定メモ（任意）"
                        class="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                    <p v-if="csNewFormError" class="text-xs text-red-500">{{ csNewFormError }}</p>
                    <button @click="addCsRev" :disabled="!!csNewFormError || csSaving"
                        class="w-full py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-slate-700 hover:bg-slate-800 text-white">
                        改訂を追加する
                    </button>
                </div>

                <!-- 過去の改定履歴 -->
                <div v-if="csRevisions.length > 1" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">改定履歴</span>
                    </div>
                    <div v-for="(rev, idx) in csRevisions.slice(1)" :key="rev.id"
                        class="px-4 py-3 border-b border-slate-50 last:border-0">
                        <div class="flex items-center justify-between mb-1.5">
                            <span class="text-xs font-bold text-slate-600">{{ revRangeLabel(csRevisions, idx + 1) }}</span>
                            <button v-if="idx < csRevisions.slice(1).length - 1"
                                @click="deleteCsRev(rev)"
                                class="text-xs text-red-400 hover:text-red-600 transition-colors">削除</button>
                        </div>
                        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                            <div class="flex justify-between"><span class="text-slate-400">役員報酬</span><span class="font-medium text-slate-600">¥{{ Number(rev.exec_remuneration || 0).toLocaleString() }}</span></div>
                            <div class="flex justify-between"><span class="text-slate-400">借入返済</span><span class="font-medium text-slate-600">¥{{ Number(rev.debt_repayment || 0).toLocaleString() }}</span></div>
                        </div>
                        <div v-if="rev.note" class="mt-1 text-xs text-slate-400 italic">{{ rev.note }}</div>
                    </div>
                </div>
            </template>
        </div>

        <!-- ─── ベンチマーク設定 ───────────────────────────────────────── -->
        <div v-if="subMode === 'benchmark'" class="space-y-4 pb-16">
            <h2 class="text-base font-bold text-slate-700">ベンチマーク目標値</h2>
            <p class="text-xs text-slate-400">全社共通のHealth Check目標値を設定します。PLモードで実績と比較表示されます。</p>

            <div v-if="bmLoading" class="text-center py-12 text-slate-400 text-sm">読み込み中...</div>

            <template v-else>
                <!-- 現在適用中 -->
                <div v-if="bmRevisions.length > 0" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">現在適用中</span>
                            <span class="text-xs text-emerald-600">{{ revRangeLabel(bmRevisions, 0) }}</span>
                        </div>
                        <button v-if="bmRevisions.length > 1"
                            @click="deleteBmRev(bmRevisions[0])"
                            :disabled="bmSaving"
                            class="text-xs text-red-400 hover:text-red-600 transition-colors">削除</button>
                    </div>
                    <div class="divide-y divide-slate-50">
                        <div v-for="item in bmItems" :key="item.key" class="flex justify-between px-4 py-2.5 text-sm">
                            <span class="text-slate-500">{{ item.label }}</span>
                            <span class="font-bold text-slate-800">
                                {{ bmRevisions[0][item.key] != null ? (Number(bmRevisions[0][item.key]) * 100).toFixed(1) + '%' : '未設定' }}
                            </span>
                        </div>
                        <div v-if="bmRevisions[0].note" class="px-4 py-2 text-xs text-slate-400 italic">{{ bmRevisions[0].note }}</div>
                    </div>
                </div>
                <div v-else class="text-xs text-slate-400 px-1">設定なし</div>

                <!-- 新しい改訂を追加 -->
                <div class="bg-white rounded-2xl border border-dashed border-slate-200 p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">新しい改訂を追加</span>
                        <button v-if="bmRevisions.length > 0" @click="prefillBmNewForm"
                            class="text-xs text-teal-600 hover:text-teal-700 font-medium">現在の値をコピー</button>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <select v-model="bmNewForm.year"
                            class="appearance-none bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 text-slate-800">
                            <option value="" disabled>年</option>
                            <option v-for="y in years" :key="y.value" :value="y.value">{{ y.label }}</option>
                        </select>
                        <select v-model="bmNewForm.month"
                            class="appearance-none bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500 text-slate-800">
                            <option value="" disabled>月</option>
                            <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
                        </select>
                    </div>
                    <div v-for="item in bmItems" :key="item.key" class="space-y-0.5">
                        <div class="flex items-center justify-between">
                            <label class="block text-xs font-medium text-slate-500">{{ item.label }}</label>
                            <span class="text-xs text-slate-400">{{ item.hint }}</span>
                        </div>
                        <div class="relative flex items-center">
                            <input type="number" min="0" max="100" step="0.1"
                                v-model.number="bmNewForm[item.key]"
                                :placeholder="item.placeholder"
                                class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-4 pr-10 py-2.5 text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none" />
                            <span class="absolute right-4 text-slate-400 text-sm font-bold">%</span>
                        </div>
                    </div>
                    <input type="text" v-model="bmNewForm.note" placeholder="改定メモ（任意）"
                        class="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none" />
                    <p v-if="bmNewFormError" class="text-xs text-red-500">{{ bmNewFormError }}</p>
                    <button @click="addBmRev" :disabled="!!bmNewFormError || bmSaving"
                        class="w-full py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-teal-600 hover:bg-teal-700 text-white">
                        改訂を追加する
                    </button>
                </div>

                <!-- 過去の改定履歴 -->
                <div v-if="bmRevisions.length > 1" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">改定履歴</span>
                    </div>
                    <div v-for="(rev, idx) in bmRevisions.slice(1)" :key="rev.id"
                        class="px-4 py-3 border-b border-slate-50 last:border-0">
                        <div class="flex items-center justify-between mb-1.5">
                            <span class="text-xs font-bold text-slate-600">{{ revRangeLabel(bmRevisions, idx + 1) }}</span>
                            <button v-if="idx < bmRevisions.slice(1).length - 1"
                                @click="deleteBmRev(rev)"
                                class="text-xs text-red-400 hover:text-red-600 transition-colors">削除</button>
                        </div>
                        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                            <div v-for="item in bmItems" :key="item.key" class="flex justify-between">
                                <span class="text-slate-400">{{ item.shortLabel }}</span>
                                <span class="font-medium text-slate-600">
                                    {{ rev[item.key] != null ? (Number(rev[item.key]) * 100).toFixed(1) + '%' : '—' }}
                                </span>
                            </div>
                        </div>
                        <div v-if="rev.note" class="mt-1 text-xs text-slate-400 italic">{{ rev.note }}</div>
                    </div>
                </div>
            </template>
        </div>

    </main>
</template>

<script>
import {
    getStoreSettingsRevisions, addStoreSettingsRevision, deleteStoreSettingsRevision,
    getCompanySettingsRevisions, addCompanySettingsRevision, deleteCompanySettingsRevision,
    getBenchmarksRevisions, addBenchmarksRevision, deleteBenchmarksRevision
} from '../../api.js'
import { buildYearOptions, buildMonthOptions, composePeriodKey } from '../../utils/periods.js'

function fmLabel(from) {
    return `${String(from).slice(0, 4)}年${Number(String(from).slice(4))}月〜`
}

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
            ssAllData: [],
            selectedStoreKey: '',
            ssLoading: false,
            ssSaving: false,
            ssNewForm: {},
            // 全社共通費
            csRevisions: [],
            csLoading: false,
            csSaving: false,
            csNewForm: { year: '', month: '', note: '', exec_remuneration: null, debt_repayment: null },
            // ベンチマーク
            bmRevisions: [],
            bmLoading: false,
            bmSaving: false,
            bmNewForm: { year: '', month: '', note: '', labor_rate: null, gross_profit_margin: null, operating_profit_margin: null, cost_ratio: null }
        }
    },
    computed: {
        bmItems() {
            return [
                { key: 'labor_rate', label: '労働分配率 目標（上限）', shortLabel: '労働分配率', hint: '実績がこの値以下でOK', placeholder: '例: 40' },
                { key: 'gross_profit_margin', label: '粗利率 目標（下限）', shortLabel: '粗利率', hint: '実績がこの値以上でOK', placeholder: '例: 40' },
                { key: 'operating_profit_margin', label: '営業利益率 目標（下限）', shortLabel: '営業利益率', hint: '実績がこの値以上でOK', placeholder: '例: 10' },
                { key: 'cost_ratio', label: '原価率 目標（上限）', shortLabel: '原価率', hint: '実績がこの値以下でOK', placeholder: '例: 35' },
            ]
        },
        storeSettingsFields() {
            return [
                { key: 'fixed_rent', label: '家賃（月額）', shortLabel: '家賃', prefix: '¥', isJPY: true },
                { key: 'fixed_utilities', label: '光熱費（月額）', shortLabel: '光熱費', prefix: '¥', isJPY: true },
                { key: 'fixed_sundries', label: '雑費（月額）', shortLabel: '雑費', prefix: '¥', isJPY: true },
                { key: 'payment_fee_rate', label: '決済手数料率（%）', shortLabel: '手数料率', prefix: '', step: 0.01, isRate: true }
            ]
        },
        csNewFormError() {
            if (!this.csNewForm.year || !this.csNewForm.month) return '適用開始月を選択してください。'
            const ef = Number(composePeriodKey(this.csNewForm.year, this.csNewForm.month))
            if (this.csRevisions.some(r => r.effective_from === ef)) return 'その月の改定はすでに登録されています。'
            return ''
        },
        bmNewFormError() {
            if (!this.bmNewForm.year || !this.bmNewForm.month) return '適用開始月を選択してください。'
            const ef = Number(composePeriodKey(this.bmNewForm.year, this.bmNewForm.month))
            if (this.bmRevisions.some(r => r.effective_from === ef)) return 'その月の改定はすでに登録されています。'
            return ''
        },
        selectedSS() {
            return this.ssAllData.find(s => s.storeKey === this.selectedStoreKey) || null
        }
    },
    methods: {
        // ─── ユーティリティ ────────────────────────────────────────────
        revRangeLabel(revisions, index) {
            const from = revisions[index].effective_from
            const fromLabel = fmLabel(from)
            if (index === 0) return fromLabel
            const prev = revisions[index - 1]
            const prevFrom = prev.effective_from
            const prevYear = Number(String(prevFrom).slice(0, 4))
            const prevMonth = Number(String(prevFrom).slice(4))
            const endYear = prevMonth === 1 ? prevYear - 1 : prevYear
            const endMonth = prevMonth === 1 ? 12 : prevMonth - 1
            return `${fromLabel} ${endYear}年${endMonth}月まで`
        },
        formatSettingValue(val, field) {
            if (val == null) return '—'
            if (field.isJPY) return '¥' + Number(val).toLocaleString()
            if (field.isRate) return (Number(val) * 100).toFixed(2) + '%'
            return String(val)
        },
        ssNewFormError(ss) {
            const form = this.ssNewForm[ss.storeKey]
            if (!form) return '読み込み中'
            if (!form.year || !form.month) return '適用開始月を選択してください。'
            const ef = Number(composePeriodKey(form.year, form.month))
            if (ss.revisions.some(r => r.effective_from === ef)) return 'その月の改定はすでに登録されています。'
            return ''
        },
        initNewForm(storeKey, source) {
            this.ssNewForm[storeKey] = {
                year: '', month: '', note: '',
                fixed_rent: source?.fixed_rent ?? null,
                fixed_utilities: source?.fixed_utilities ?? null,
                fixed_sundries: source?.fixed_sundries ?? null,
                payment_fee_rate: source?.payment_fee_rate != null
                    ? Number((Number(source.payment_fee_rate) * 100).toFixed(2))
                    : null
            }
        },

        // ─── 店舗別固定費 ──────────────────────────────────────────────
        async openStoreSettings() {
            this.subMode = 'store-settings'
            this.ssLoading = true
            try {
                const results = await Promise.all(
                    this.stores.map(async (s) => {
                        const revisions = await getStoreSettingsRevisions(s.key)
                        return { storeKey: s.key, storeName: s.name, revisions }
                    })
                )
                this.ssAllData = results
                this.selectedStoreKey = results[0]?.storeKey || ''
                for (const ss of results) {
                    this.initNewForm(ss.storeKey, ss.revisions[0] ?? null)
                }
            } catch (e) {
                alert(e.message || '読み込みに失敗しました。')
            } finally {
                this.ssLoading = false
            }
        },
        prefillStoreNewForm(storeKey) {
            const ss = this.ssAllData.find(s => s.storeKey === storeKey)
            if (!ss?.revisions[0]) return
            this.initNewForm(storeKey, ss.revisions[0])
        },
        async addStoreRev(storeKey) {
            const ss = this.ssAllData.find(s => s.storeKey === storeKey)
            const form = this.ssNewForm[storeKey]
            if (!ss || !form) return
            const ef = composePeriodKey(form.year, form.month)
            this.ssSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                await addStoreSettingsRevision(storeKey, ef, {
                    fixed_rent: form.fixed_rent ?? 0,
                    fixed_utilities: form.fixed_utilities ?? 0,
                    fixed_sundries: form.fixed_sundries ?? 0,
                    payment_fee_rate: Number(form.payment_fee_rate ?? 0) / 100,
                    note: form.note || null
                })
                ss.revisions = await getStoreSettingsRevisions(storeKey)
                this.initNewForm(storeKey, null)
                alert('改訂を追加しました。')
            } catch (e) {
                alert(e.message || '追加に失敗しました。')
            } finally {
                this.ssSaving = false
                this.$emit('update:loading', false)
            }
        },
        async deleteStoreRev(storeKey, rev) {
            if (!confirm(`${fmLabel(rev.effective_from)}の改訂を削除しますか？`)) return
            this.ssSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '削除中...')
            try {
                await deleteStoreSettingsRevision(rev.id)
                const ss = this.ssAllData.find(s => s.storeKey === storeKey)
                if (ss) ss.revisions = await getStoreSettingsRevisions(storeKey)
            } catch (e) {
                alert(e.message || '削除に失敗しました。')
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
                this.csRevisions = await getCompanySettingsRevisions()
            } catch (e) {
                alert(e.message || '読み込みに失敗しました。')
            } finally {
                this.csLoading = false
            }
        },
        prefillCsNewForm() {
            if (!this.csRevisions[0]) return
            const r = this.csRevisions[0]
            this.csNewForm.exec_remuneration = r.exec_remuneration
            this.csNewForm.debt_repayment = r.debt_repayment
        },
        async addCsRev() {
            const ef = composePeriodKey(this.csNewForm.year, this.csNewForm.month)
            this.csSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                await addCompanySettingsRevision(ef, {
                    exec_remuneration: this.csNewForm.exec_remuneration ?? 0,
                    debt_repayment: this.csNewForm.debt_repayment ?? 0,
                    note: this.csNewForm.note || null
                })
                this.csRevisions = await getCompanySettingsRevisions()
                this.csNewForm = { year: '', month: '', note: '', exec_remuneration: null, debt_repayment: null }
                alert('改訂を追加しました。')
            } catch (e) {
                alert(e.message || '追加に失敗しました。')
            } finally {
                this.csSaving = false
                this.$emit('update:loading', false)
            }
        },
        async deleteCsRev(rev) {
            if (!confirm(`${fmLabel(rev.effective_from)}の改訂を削除しますか？`)) return
            this.csSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '削除中...')
            try {
                await deleteCompanySettingsRevision(rev.id)
                this.csRevisions = await getCompanySettingsRevisions()
            } catch (e) {
                alert(e.message || '削除に失敗しました。')
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
                this.bmRevisions = await getBenchmarksRevisions()
            } catch (e) {
                alert(e.message || '読み込みに失敗しました。')
            } finally {
                this.bmLoading = false
            }
        },
        prefillBmNewForm() {
            if (!this.bmRevisions[0]) return
            const r = this.bmRevisions[0]
            this.bmNewForm.labor_rate = r.labor_rate != null ? Number((r.labor_rate * 100).toFixed(2)) : null
            this.bmNewForm.gross_profit_margin = r.gross_profit_margin != null ? Number((r.gross_profit_margin * 100).toFixed(2)) : null
            this.bmNewForm.operating_profit_margin = r.operating_profit_margin != null ? Number((r.operating_profit_margin * 100).toFixed(2)) : null
            this.bmNewForm.cost_ratio = r.cost_ratio != null ? Number((r.cost_ratio * 100).toFixed(2)) : null
        },
        async addBmRev() {
            const ef = composePeriodKey(this.bmNewForm.year, this.bmNewForm.month)
            this.bmSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                await addBenchmarksRevision(ef, {
                    labor_rate: this.bmNewForm.labor_rate != null ? Number(this.bmNewForm.labor_rate) / 100 : null,
                    gross_profit_margin: this.bmNewForm.gross_profit_margin != null ? Number(this.bmNewForm.gross_profit_margin) / 100 : null,
                    operating_profit_margin: this.bmNewForm.operating_profit_margin != null ? Number(this.bmNewForm.operating_profit_margin) / 100 : null,
                    cost_ratio: this.bmNewForm.cost_ratio != null ? Number(this.bmNewForm.cost_ratio) / 100 : null,
                    note: this.bmNewForm.note || null
                })
                this.bmRevisions = await getBenchmarksRevisions()
                this.bmNewForm = { year: '', month: '', note: '', labor_rate: null, gross_profit_margin: null, operating_profit_margin: null, cost_ratio: null }
                alert('改訂を追加しました。')
            } catch (e) {
                alert(e.message || '追加に失敗しました。')
            } finally {
                this.bmSaving = false
                this.$emit('update:loading', false)
            }
        },
        async deleteBmRev(rev) {
            if (!confirm(`${fmLabel(rev.effective_from)}の改訂を削除しますか？`)) return
            this.bmSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '削除中...')
            try {
                await deleteBenchmarksRevision(rev.id)
                this.bmRevisions = await getBenchmarksRevisions()
            } catch (e) {
                alert(e.message || '削除に失敗しました。')
            } finally {
                this.bmSaving = false
                this.$emit('update:loading', false)
            }
        }
    }
}
</script>

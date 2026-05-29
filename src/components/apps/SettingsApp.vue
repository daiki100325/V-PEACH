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
                    <button @click="openHrmosMasters"
                        class="text-left rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 p-5 transition-colors focus:outline-none">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-2xl">👥</span>
                            <span class="text-base font-bold text-slate-800">HRMOS マスタ管理</span>
                        </div>
                        <div class="text-sm text-slate-500">スタッフ・勤務区分マスタをCSV取込・手動上書きします</div>
                    </button>
                    <button @click="openHolidays"
                        class="text-left rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 p-5 transition-colors focus:outline-none">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-2xl">📅</span>
                            <span class="text-base font-bold text-slate-800">祝日マスタ</span>
                        </div>
                        <div class="text-sm text-slate-500">日本国民の祝日キャッシュを再取得します</div>
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
                                <CurrencyInput v-if="field.isJPY"
                                    v-model="ssNewForm[selectedSS.storeKey][field.key]"
                                    class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none"
                                    :class="field.prefix ? 'pl-7 pr-3' : 'px-3'" />
                                <input v-else type="number" min="0" :step="field.step || 1"
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
                        <div class="flex justify-between px-4 py-2.5 text-sm">
                            <span class="text-slate-500">社長代替時給（参考）</span>
                            <span class="font-bold text-slate-800">¥{{ Number(csRevisions[0].ryo_hourly_rate ?? 1300).toLocaleString() }}/h</span>
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
                            <CurrencyInput v-model="csNewForm.exec_remuneration"
                                class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-7 pr-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                        </div>
                    </div>
                    <div class="space-y-0.5">
                        <label class="block text-xs font-medium text-slate-500">借入返済（月額）</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">¥</span>
                            <CurrencyInput v-model="csNewForm.debt_repayment"
                                class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-7 pr-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                        </div>
                    </div>
                    <div class="space-y-0.5">
                        <label class="block text-xs font-medium text-slate-500">社長代替時給（機会費用計算用）</label>
                        <p class="text-xs text-slate-400">りょーさんがシフトを埋めた枠をバイト換算するときの参考時給。やや高めに設定推奨。</p>
                        <div class="relative flex items-center">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">¥</span>
                            <input type="number" min="0" step="100" v-model.number="csNewForm.ryo_hourly_rate"
                                placeholder="1300"
                                class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-7 pr-10 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                            <span class="absolute right-3 text-slate-400 text-sm">/h</span>
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
                            <div class="flex justify-between"><span class="text-slate-400">社長代替時給</span><span class="font-medium text-slate-600">¥{{ Number(rev.ryo_hourly_rate ?? 1300).toLocaleString() }}/h</span></div>
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

        <!-- ─── HRMOS マスタ管理 ───────────────────────────────────────── -->
        <div v-if="subMode === 'hrmos-masters'" class="space-y-4 pb-16">
            <h2 class="text-base font-bold text-slate-700">HRMOS マスタ管理</h2>
            <p class="text-xs text-slate-400">HRMOS から書き出したスタッフ／勤務区分 CSV を取り込み、シフト CSV 取込の自動算出に使用します。</p>

            <div v-if="hmLoading" class="text-center py-12 text-slate-400 text-sm">読み込み中...</div>

            <template v-else>
                <!-- スタッフマスタ -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-slate-700">スタッフマスタ</span>
                        <span class="text-xs text-slate-400">
                            登録: {{ hmStaffs.length }}名（固定給 {{ hmStaffCounts.fixed_salary }} / バイト {{ hmStaffCounts.part_time }} / 社長 {{ hmStaffCounts.owner_ryo }}）
                        </span>
                    </div>
                    <label class="block">
                        <span class="sr-only">スタッフ CSV</span>
                        <input type="file" accept=".csv" @change="onUploadStaffsCsv($event)"
                            class="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
                    </label>
                    <p v-if="hmStaffUploadMsg" class="text-xs" :class="hmStaffUploadOk ? 'text-emerald-600' : 'text-red-500'">{{ hmStaffUploadMsg }}</p>

                    <div v-if="hmStaffs.length > 0" class="border border-slate-100 rounded-xl max-h-64 overflow-y-auto divide-y divide-slate-50">
                        <div v-for="s in hmStaffs" :key="s.hrmos_staff_id" class="px-3 py-2 flex items-center justify-between text-xs">
                            <div class="min-w-0 flex-1">
                                <div class="font-medium text-slate-700 truncate">{{ s.display_name }}</div>
                                <div class="text-slate-400">ID {{ s.hrmos_staff_id }} / {{ s.account_name || '—' }}</div>
                            </div>
                            <select :value="s.role" @change="onChangeStaffRole(s, $event.target.value)"
                                class="text-xs border border-slate-200 rounded-lg px-2 py-1 font-bold"
                                :class="{
                                    'text-emerald-600 bg-emerald-50': s.role === 'fixed_salary',
                                    'text-slate-600 bg-slate-50': s.role === 'part_time',
                                    'text-amber-600 bg-amber-50': s.role === 'owner_ryo'
                                }">
                                <option value="fixed_salary">固定給</option>
                                <option value="part_time">バイト</option>
                                <option value="owner_ryo">社長</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 勤務区分マスタ -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-slate-700">勤務区分マスタ</span>
                        <span class="text-xs text-slate-400">
                            登録: {{ hmSegments.length }}件（按分対象 {{ hmSegmentCounts.payroll }} / 対象外 {{ hmSegmentCounts.nonPayroll }}）
                        </span>
                    </div>
                    <label class="block">
                        <span class="sr-only">勤務区分 CSV</span>
                        <input type="file" accept=".csv" @change="onUploadSegmentsCsv($event)"
                            class="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
                    </label>
                    <p v-if="hmSegUploadMsg" class="text-xs" :class="hmSegUploadOk ? 'text-emerald-600' : 'text-red-500'">{{ hmSegUploadMsg }}</p>

                    <div v-if="hmSegmentCounts.misc > 0" class="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                        ⚠ 自動判定不可（misc）: {{ hmSegmentCounts.misc }}件。下記から個別に上書きしてください。
                    </div>

                    <div v-if="hmSegments.length > 0" class="border border-slate-100 rounded-xl max-h-80 overflow-y-auto divide-y divide-slate-50">
                        <div v-for="seg in hmSegments" :key="seg.hrmos_segment_id" class="px-3 py-2 space-y-1 text-xs">
                            <div class="flex items-center justify-between">
                                <div class="min-w-0 flex-1">
                                    <div class="font-medium text-slate-700 truncate">{{ seg.segment_name }}</div>
                                    <div class="text-slate-400">ID {{ seg.hrmos_segment_id }}</div>
                                </div>
                                <label class="inline-flex items-center gap-1 text-slate-500">
                                    <input type="checkbox" :checked="seg.is_payroll_target"
                                        @change="onUpdateSegment(seg, { is_payroll_target: $event.target.checked })" />
                                    按分対象
                                </label>
                            </div>
                            <div class="flex items-center gap-2">
                                <select :value="seg.store_id ?? ''"
                                    @change="onUpdateSegment(seg, { store_id: $event.target.value === '' ? null : Number($event.target.value) })"
                                    class="text-xs border border-slate-200 rounded-lg px-2 py-1 flex-1">
                                    <option value="">店舗なし</option>
                                    <option v-for="st in hmStoresDb" :key="st.id" :value="st.id">{{ st.name }}</option>
                                </select>
                                <select :value="seg.shift_type"
                                    @change="onUpdateSegment(seg, { shift_type: $event.target.value })"
                                    class="text-xs border border-slate-200 rounded-lg px-2 py-1">
                                    <option value="early">早番</option>
                                    <option value="middle">中番</option>
                                    <option value="late">遅番</option>
                                    <option value="allin">オーラス</option>
                                    <option value="misc">その他</option>
                                </select>
                                <input type="number" min="0" step="0.5" :value="seg.default_hours"
                                    @change="onUpdateSegment(seg, { default_hours: Number($event.target.value) })"
                                    class="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1 text-right" />
                                <span class="text-slate-400">h</span>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- ─── 祝日マスタ ─────────────────────────────────────────────── -->
        <div v-if="subMode === 'holidays'" class="space-y-4 pb-16">
            <h2 class="text-base font-bold text-slate-700">祝日マスタ（日本国民の祝日）</h2>
            <p class="text-xs text-slate-400">
                データソース：<a href="https://holidays-jp.github.io/" target="_blank" rel="noopener" class="underline">holidays-jp.github.io</a>
                — 月次入力フローのシフト CSV 取込時に自動更新（30日経過時 or 当年データ欠落時）。
            </p>

            <div v-if="holLoading" class="text-center py-12 text-slate-400 text-sm">読み込み中...</div>

            <template v-else>
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                    <div class="text-sm space-y-1">
                        <div>
                            <span class="text-slate-500">最終取得：</span>
                            <span class="font-bold text-slate-800">{{ holMeta.last_fetched_at ? formatTs(holMeta.last_fetched_at) : '未取得' }}</span>
                            <span v-if="holMeta.last_fetch_status === 'success'" class="ml-2 text-emerald-600 font-bold">✓ 成功</span>
                            <span v-else-if="holMeta.last_fetch_status === 'failed'" class="ml-2 text-red-500 font-bold">✗ 失敗</span>
                        </div>
                        <div><span class="text-slate-500">キャッシュ件数：</span><span class="font-bold text-slate-800">{{ holRows.length }}件</span></div>
                    </div>

                    <div v-if="holMeta.last_fetch_status === 'failed' && holMeta.last_fetch_error"
                        class="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
                        前回エラー: {{ holMeta.last_fetch_error }}（キャッシュで動作中）
                    </div>
                    <div v-else-if="isHolidayStale" class="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                        ⚠ 30日以上取得していません。年初の祝日改正に注意してください。
                    </div>

                    <button @click="onRefreshHolidays" :disabled="holRefreshing"
                        class="w-full py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-brand-600 hover:bg-brand-700 text-white">
                        {{ holRefreshing ? '取得中...' : 'いま再取得する' }}
                    </button>
                </div>

                <div v-if="holRows.length > 0" class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">キャッシュ一覧（最新200件）</span>
                    </div>
                    <div class="max-h-80 overflow-y-auto divide-y divide-slate-50">
                        <div v-for="r in holRowsView" :key="r.holiday_date" class="px-4 py-2 flex justify-between text-xs">
                            <span class="text-slate-600">{{ r.holiday_date }}</span>
                            <span class="font-medium text-slate-700">{{ r.holiday_name }}</span>
                        </div>
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
    getBenchmarksRevisions, addBenchmarksRevision, deleteBenchmarksRevision,
    getHrmosStaffs, upsertHrmosStaffs, updateHrmosStaffRole,
    getHrmosSegments, upsertHrmosSegments, updateHrmosSegment,
    getJpHolidays, getJpHolidaysMeta,
    getStores
} from '../../api.js'
import { buildYearOptions, buildMonthOptions, composePeriodKey } from '../../utils/periods.js'
import CurrencyInput from '../CurrencyInput.vue'
import {
    readShiftJisFile,
    detectCsvKindFromHeader,
    parseHrmosStaffsCsv,
    parseHrmosSegmentsCsv
} from '../../utils/csvImporter.js'
import { forceRefreshHolidays } from '../../utils/jpHolidaysClient.js'

function fmLabel(from) {
    return `${String(from).slice(0, 4)}年${Number(String(from).slice(4))}月〜`
}

export default {
    name: 'SettingsApp',
    components: { CurrencyInput },
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
            csNewForm: { year: '', month: '', note: '', exec_remuneration: null, debt_repayment: null, ryo_hourly_rate: 1300 },
            // ベンチマーク
            bmRevisions: [],
            bmLoading: false,
            bmSaving: false,
            bmNewForm: { year: '', month: '', note: '', f_ratio: null, l_ratio: null, r_ratio: null, operating_profit_margin: null, labor_rate: null },
            // HRMOS マスタ
            hmLoading: false,
            hmStaffs: [],
            hmSegments: [],
            hmStoresDb: [],  // { id, store_key, name }（マスタ取込時の store_id 解決用）
            hmStaffUploadMsg: '',
            hmStaffUploadOk: false,
            hmSegUploadMsg: '',
            hmSegUploadOk: false,
            // 祝日
            holLoading: false,
            holRefreshing: false,
            holMeta: { last_fetched_at: null, last_fetch_status: null, last_fetch_error: null },
            holRows: []
        }
    },
    computed: {
        bmItems() {
            return [
                { key: 'f_ratio', label: 'F比 目標（上限）', shortLabel: 'F比', hint: '実績がこの値以下でOK', placeholder: '例: 30' },
                { key: 'l_ratio', label: 'L比 目標（上限）', shortLabel: 'L比', hint: '実績がこの値以下でOK', placeholder: '例: 30' },
                { key: 'r_ratio', label: 'R比 目標（上限）', shortLabel: 'R比', hint: '実績がこの値以下でOK', placeholder: '例: 10' },
                { key: 'operating_profit_margin', label: '営業利益率 目標（下限）', shortLabel: '営業利益率', hint: '実績がこの値以上でOK', placeholder: '例: 10' },
                { key: 'labor_rate', label: '労働分配率 目標（上限）', shortLabel: '労働分配率', hint: '実績がこの値以下でOK', placeholder: '例: 40' },
            ]
        },
        storeSettingsFields() {
            return [
                { key: 'fixed_rent', label: '家賃（月額）', shortLabel: '家賃', prefix: '¥', isJPY: true },
                { key: 'fixed_utilities', label: '光熱費（月額）', shortLabel: '光熱費', prefix: '¥', isJPY: true },
                { key: 'fixed_sundries', label: '雑費（月額）', shortLabel: '雑費', prefix: '¥', isJPY: true },
                { key: 'payment_fee_rate', label: '決済手数料率（%）', shortLabel: '手数料率', prefix: '', step: 0.01, isRate: true },
                { key: 'fixed_salary_total', label: '所属固定給月報酬（合計）', shortLabel: '固定給', prefix: '¥', isJPY: true, hint: '馬場本店:おの / 中野店:ばな+ぴー / 馬場2号店:つー の月報酬合計' }
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
        },
        hmStaffCounts() {
            const c = { fixed_salary: 0, part_time: 0, owner_ryo: 0 }
            for (const s of this.hmStaffs) {
                if (c[s.role] != null) c[s.role]++
            }
            return c
        },
        hmSegmentCounts() {
            let payroll = 0, nonPayroll = 0, misc = 0
            for (const seg of this.hmSegments) {
                if (seg.is_payroll_target) payroll++
                else nonPayroll++
                if (seg.shift_type === 'misc') misc++
            }
            return { payroll, nonPayroll, misc }
        },
        isHolidayStale() {
            if (!this.holMeta.last_fetched_at) return false
            const elapsed = Date.now() - new Date(this.holMeta.last_fetched_at).getTime()
            return elapsed > 30 * 24 * 60 * 60 * 1000
        },
        holRowsView() {
            return this.holRows.slice(0, 200)
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
                    : null,
                fixed_salary_total: source?.fixed_salary_total ?? null
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
                    fixed_salary_total: form.fixed_salary_total ?? 0,
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
            this.csNewForm.ryo_hourly_rate = r.ryo_hourly_rate ?? 1300
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
                    ryo_hourly_rate: this.csNewForm.ryo_hourly_rate ?? 1300,
                    note: this.csNewForm.note || null
                })
                this.csRevisions = await getCompanySettingsRevisions()
                this.csNewForm = { year: '', month: '', note: '', exec_remuneration: null, debt_repayment: null, ryo_hourly_rate: 1300 }
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
            this.bmNewForm.f_ratio = r.f_ratio != null ? Number((r.f_ratio * 100).toFixed(2)) : null
            this.bmNewForm.l_ratio = r.l_ratio != null ? Number((r.l_ratio * 100).toFixed(2)) : null
            this.bmNewForm.r_ratio = r.r_ratio != null ? Number((r.r_ratio * 100).toFixed(2)) : null
            this.bmNewForm.operating_profit_margin = r.operating_profit_margin != null ? Number((r.operating_profit_margin * 100).toFixed(2)) : null
            this.bmNewForm.labor_rate = r.labor_rate != null ? Number((r.labor_rate * 100).toFixed(2)) : null
        },
        async addBmRev() {
            const ef = composePeriodKey(this.bmNewForm.year, this.bmNewForm.month)
            this.bmSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                await addBenchmarksRevision(ef, {
                    f_ratio: this.bmNewForm.f_ratio != null ? Number(this.bmNewForm.f_ratio) / 100 : null,
                    l_ratio: this.bmNewForm.l_ratio != null ? Number(this.bmNewForm.l_ratio) / 100 : null,
                    r_ratio: this.bmNewForm.r_ratio != null ? Number(this.bmNewForm.r_ratio) / 100 : null,
                    operating_profit_margin: this.bmNewForm.operating_profit_margin != null ? Number(this.bmNewForm.operating_profit_margin) / 100 : null,
                    labor_rate: this.bmNewForm.labor_rate != null ? Number(this.bmNewForm.labor_rate) / 100 : null,
                    note: this.bmNewForm.note || null
                })
                this.bmRevisions = await getBenchmarksRevisions()
                this.bmNewForm = { year: '', month: '', note: '', f_ratio: null, l_ratio: null, r_ratio: null, operating_profit_margin: null, labor_rate: null }
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
        },

        // ─── HRMOS マスタ管理 ──────────────────────────────────────────
        async openHrmosMasters() {
            this.subMode = 'hrmos-masters'
            this.hmLoading = true
            try {
                const [staffs, segments, storesDb] = await Promise.all([
                    getHrmosStaffs(), getHrmosSegments(), getStores()
                ])
                this.hmStaffs = staffs
                this.hmSegments = segments
                this.hmStoresDb = storesDb
            } catch (e) {
                alert(e.message || '読み込みに失敗しました。')
            } finally {
                this.hmLoading = false
            }
        },
        async onUploadStaffsCsv(event) {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            this.hmStaffUploadMsg = ''
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', 'スタッフマスタ取込中...')
            try {
                const text = await readShiftJisFile(file)
                const kind = detectCsvKindFromHeader(text)
                if (kind !== 'hrmos_staffs') throw new Error('スタッフ CSV ではありません（ヘッダー判定失敗）')
                const rows = parseHrmosStaffsCsv(text)
                if (rows.length === 0) throw new Error('有効なスタッフ行が見つかりませんでした')
                // 既存ロールを尊重しつつ upsert（既存スタッフのロールは上書きしない）
                const existingById = new Map(this.hmStaffs.map(s => [s.hrmos_staff_id, s]))
                const payload = rows.map(r => {
                    const existing = existingById.get(r.hrmos_staff_id)
                    return existing ? { ...r, role: existing.role } : r
                })
                await upsertHrmosStaffs(payload)
                this.hmStaffs = await getHrmosStaffs()
                this.hmStaffUploadOk = true
                this.hmStaffUploadMsg = `${rows.length}件を取り込みました（既存スタッフのロールは保持）`
            } catch (e) {
                this.hmStaffUploadOk = false
                this.hmStaffUploadMsg = e.message || '取込に失敗しました'
            } finally {
                this.$emit('update:loading', false)
            }
        },
        async onChangeStaffRole(staff, newRole) {
            try {
                await updateHrmosStaffRole(staff.hrmos_staff_id, newRole)
                staff.role = newRole
            } catch (e) {
                alert(e.message || 'ロール更新に失敗しました')
            }
        },
        async onUploadSegmentsCsv(event) {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            this.hmSegUploadMsg = ''
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '勤務区分マスタ取込中...')
            try {
                const text = await readShiftJisFile(file)
                const kind = detectCsvKindFromHeader(text)
                if (kind !== 'hrmos_segments') throw new Error('勤務区分 CSV ではありません（ヘッダー判定失敗）')
                const storeKeyToId = {}
                for (const st of this.hmStoresDb) {
                    storeKeyToId[st.store_key] = st.id
                }
                const rows = parseHrmosSegmentsCsv(text, storeKeyToId)
                if (rows.length === 0) throw new Error('有効な勤務区分行が見つかりませんでした')
                // 既存上書きを尊重（store_id/shift_type/default_hours/is_payroll_target を保持）
                const existingById = new Map(this.hmSegments.map(s => [s.hrmos_segment_id, s]))
                const payload = rows.map(r => {
                    const existing = existingById.get(r.hrmos_segment_id)
                    if (existing) {
                        return {
                            ...r,
                            store_id: existing.store_id,
                            shift_type: existing.shift_type,
                            default_hours: existing.default_hours,
                            is_payroll_target: existing.is_payroll_target
                        }
                    }
                    return r
                })
                await upsertHrmosSegments(payload)
                this.hmSegments = await getHrmosSegments()
                this.hmSegUploadOk = true
                this.hmSegUploadMsg = `${rows.length}件を取り込みました（既存区分の手動上書きは保持）`
            } catch (e) {
                this.hmSegUploadOk = false
                this.hmSegUploadMsg = e.message || '取込に失敗しました'
            } finally {
                this.$emit('update:loading', false)
            }
        },
        async onUpdateSegment(seg, patch) {
            try {
                await updateHrmosSegment(seg.hrmos_segment_id, patch)
                Object.assign(seg, patch)
            } catch (e) {
                alert(e.message || '勤務区分の更新に失敗しました')
            }
        },

        // ─── 祝日マスタ ──────────────────────────────────────────────
        async openHolidays() {
            this.subMode = 'holidays'
            this.holLoading = true
            try {
                await this.reloadHolidays()
            } finally {
                this.holLoading = false
            }
        },
        async reloadHolidays() {
            const [meta, rows] = await Promise.all([
                getJpHolidaysMeta(),
                getJpHolidays()
            ])
            this.holMeta = meta
            this.holRows = rows.slice().reverse()  // 新しい順
        },
        async onRefreshHolidays() {
            this.holRefreshing = true
            try {
                const result = await forceRefreshHolidays()
                if (result.status === 'failed') {
                    alert(`祝日 API の取得に失敗しました: ${result.error}\nキャッシュは保持されます。`)
                }
                // reload もネットワーク断で失敗しうるので飲み込む（UI 表示は次回読込で更新）
                await this.reloadHolidays().catch(() => { /* 無視 */ })
            } catch (err) {
                // 想定外の例外も最後の保険として alert
                alert(`祝日 API の取得に失敗しました: ${err?.message || err}\nキャッシュは保持されます。`)
            } finally {
                this.holRefreshing = false
            }
        },
        formatTs(ts) {
            const d = new Date(ts)
            const z = n => String(n).padStart(2, '0')
            return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`
        }
    }
}
</script>

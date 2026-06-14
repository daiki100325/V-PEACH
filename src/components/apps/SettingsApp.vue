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
                    <button @click="openStoreMgmt"
                        class="text-left rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 p-5 transition-colors focus:outline-none">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-2xl">🏬</span>
                            <span class="text-base font-bold text-slate-800">店舗管理</span>
                        </div>
                        <div class="text-sm text-slate-500">店名・運営状態・表示順を管理します</div>
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

        <!-- ─── 店舗管理 ─────────────────────────────────────────────── -->
        <div v-if="subMode === 'store-mgmt'" class="space-y-4 pb-16">
            <h2 class="text-base font-bold text-slate-700">店舗管理</h2>
            <p class="text-xs text-slate-400">
                店名・運営状態・表示順を管理します。
                <span class="inline-flex items-center gap-0.5 text-slate-300">
                    <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    store_key
                </span>
                はシステム識別子のため変更できません。
            </p>

            <div v-if="smLoading" class="text-center py-12 text-slate-400 text-sm">読み込み中...</div>

            <template v-else>
                <!-- 店舗一覧カード -->
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <!-- データなし -->
                    <div v-if="smStores.length === 0" class="px-4 py-8 text-center text-sm text-slate-400">
                        店舗データがありません
                    </div>
                    <!-- 各店舗行 -->
                    <div v-for="(store, idx) in smStores" :key="store.id"
                        class="px-4 py-3.5 border-b border-slate-50 last:border-0"
                        :class="store.is_active ? '' : 'bg-slate-50'">
                        <div class="flex items-start gap-3">

                            <!-- ↑↓ 並べ替えボタン（shop 同士のみ入れ替わる） -->
                            <div class="flex flex-col gap-0.5 pt-0.5 shrink-0">
                                <button @click="smMoveUp(idx)"
                                    :disabled="idx === 0 || smSaving"
                                    class="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                                    title="上へ移動">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
                                    </svg>
                                </button>
                                <button @click="smMoveDown(idx)"
                                    :disabled="idx === smStores.length - 1 || smSaving"
                                    class="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                                    title="下へ移動">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </div>

                            <!-- 店名（インライン編集）+ store_key（ロック表示） -->
                            <div class="flex-1 min-w-0">
                                <!-- 編集モード -->
                                <div v-if="smEditingId === store.id" class="flex items-center gap-2 mb-0.5">
                                    <input type="text" v-model="smEditingName"
                                        @keydown.enter="smSaveName(store)"
                                        @keydown.escape="smCancelEdit"
                                        class="flex-1 min-w-0 bg-slate-50 border border-brand-300 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                                    <button @click="smSaveName(store)"
                                        :disabled="!smEditingName.trim() || smSaving"
                                        class="shrink-0 text-xs font-bold text-brand-600 hover:text-brand-700 disabled:opacity-40 transition-colors">保存</button>
                                    <button @click="smCancelEdit"
                                        class="shrink-0 text-xs text-slate-400 hover:text-slate-600 transition-colors">キャンセル</button>
                                </div>
                                <!-- 表示モード（クリックで編集開始） -->
                                <button v-else @click="smStartEdit(store)"
                                    class="group flex items-center gap-1.5 text-left mb-0.5">
                                    <span class="text-sm font-bold transition-colors"
                                        :class="store.is_active ? 'text-slate-800 group-hover:text-brand-600' : 'text-slate-400 group-hover:text-brand-500'">{{ store.name }}</span>
                                    <svg class="w-3 h-3 text-slate-200 group-hover:text-brand-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                                <!-- store_key（変更不可・ロックアイコンで視覚化） -->
                                <div class="flex items-center gap-1">
                                    <svg class="w-3 h-3 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span class="text-xs text-slate-300 font-mono">{{ store.store_key }}</span>
                                </div>
                            </div>

                            <!-- 状態バッジ + 休止/再開ボタン -->
                            <div class="flex flex-col items-end gap-1.5 shrink-0">
                                <!-- 営業中 -->
                                <span v-if="store.is_active"
                                    class="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                                    営業中
                                </span>
                                <!-- 休止中 + 閉店日 -->
                                <template v-else>
                                    <span class="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                        休止中
                                    </span>
                                    <span v-if="store.closed_at" class="text-xs text-slate-400">{{ store.closed_at }}〜</span>
                                </template>
                                <!-- アクションボタン -->
                                <button v-if="store.is_active"
                                    @click="smDeactivate(store)"
                                    :disabled="smSaving"
                                    class="text-xs text-slate-400 hover:text-red-500 disabled:opacity-40 transition-colors font-medium">
                                    休止にする
                                </button>
                                <button v-else
                                    @click="smActivate(store)"
                                    :disabled="smSaving"
                                    class="text-xs text-emerald-600 hover:text-emerald-700 disabled:opacity-40 transition-colors font-medium">
                                    再開する
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                <!-- 新店舗追加ボタン（ウィザードモーダルを開く） -->
                <button @click="nsOpenWizard"
                    :disabled="smSaving"
                    class="w-full py-2.5 rounded-xl text-sm font-medium border border-dashed border-brand-300 text-brand-600 hover:bg-brand-50 hover:border-brand-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    新店舗を追加
                </button>
            </template>
        </div>

        <!-- ─── 新店舗追加ウィザード（モーダル） ──────────────────────────── -->
        <transition name="fade">
            <div v-if="nsWizardOpen"
                class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
                @click.self="nsCloseWizard">
                <div class="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg flex flex-col"
                    style="max-height: 90dvh; overflow: hidden;">

                    <!-- ヘッダー -->
                    <div class="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                        <div>
                            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                ステップ {{ nsStep }} / 3
                            </div>
                            <h3 class="text-base font-bold text-slate-800">
                                {{ ['', '基本情報', '固定費設定', 'シフトルール'][nsStep] }}
                            </h3>
                        </div>
                        <button @click="nsCloseWizard"
                            class="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <!-- ステップインジケーター -->
                    <div class="px-6 py-3 flex items-center gap-2 shrink-0">
                        <div v-for="s in 3" :key="s"
                            class="flex-1 h-1 rounded-full transition-colors"
                            :class="s <= nsStep ? 'bg-brand-500' : 'bg-slate-100'">
                        </div>
                    </div>

                    <!-- コンテンツ（スクロール可） -->
                    <div class="flex-1 overflow-y-auto px-6 pb-4 space-y-4" style="min-height: 0;">

                        <!-- Step 1: 基本情報 -->
                        <template v-if="nsStep === 1">
                            <div class="space-y-0.5">
                                <label class="block text-xs font-medium text-slate-500">
                                    表示名 <span class="text-red-500">*</span>
                                </label>
                                <input type="text" v-model="nsForm.name" placeholder="例: 渋谷店"
                                    class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                            </div>
                            <div class="space-y-0.5">
                                <label class="block text-xs font-medium text-slate-500">
                                    店舗キー (store_key) <span class="text-red-500">*</span>
                                </label>
                                <input type="text" v-model="nsForm.store_key" placeholder="例: shibuya"
                                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                                    class="w-full bg-slate-50 border border-slate-200 text-sm font-mono rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                                <p class="text-xs text-slate-400">
                                    英小文字始まり・2〜30 文字（英小文字・数字・_ のみ）。
                                    <span class="font-bold text-slate-500">作成後は変更できません。</span>
                                </p>
                            </div>
                            <div class="space-y-0.5">
                                <label class="block text-xs font-medium text-slate-500">
                                    適用開始月 <span class="text-red-500">*</span>
                                </label>
                                <input type="month" v-model="nsForm.effective_from"
                                    class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                                <p class="text-xs text-slate-400">固定費・シフトルールの初期世代として登録されます。</p>
                            </div>
                            <p v-if="nsStep1Error" class="text-xs text-red-500">{{ nsStep1Error }}</p>
                        </template>

                        <!-- Step 2: 固定費設定 -->
                        <template v-if="nsStep === 2">
                            <div v-for="field in storeSettingsFields" :key="field.key" class="space-y-0.5">
                                <label class="block text-xs font-medium text-slate-500">
                                    {{ field.label }} <span class="text-red-500">*</span>
                                </label>
                                <div class="relative">
                                    <span v-if="field.isJPY" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">¥</span>
                                    <CurrencyInput v-if="field.isJPY"
                                        v-model="nsSettings[field.key]"
                                        class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-7 pr-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                                    <input v-else type="number" min="0" :step="field.step || 0.01"
                                        v-model.number="nsSettings[field.key]"
                                        class="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none" />
                                    <span v-if="field.isRate" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                                </div>
                                <p v-if="field.hint" class="text-xs text-slate-400">{{ field.hint }}</p>
                            </div>
                            <p v-if="nsStep2Error" class="text-xs text-red-500">{{ nsStep2Error }}</p>
                        </template>

                        <!-- Step 3: シフトルール + サマリー -->
                        <template v-if="nsStep === 3">
                            <!-- シフトルール 6マス（早番 × 中番 × 遅番 ／ 平日 × 土日祝） -->
                            <div>
                                <p class="text-xs font-medium text-slate-500 mb-2">
                                    各シフト枠の勤務時間
                                    <span class="text-slate-400 font-normal">（6h または 7.5h を選択）</span>
                                </p>
                                <div class="rounded-2xl border border-slate-100 overflow-hidden">
                                    <table class="w-full text-sm">
                                        <thead>
                                            <tr class="bg-slate-50 text-xs font-bold text-slate-500">
                                                <th class="px-4 py-2.5 text-left">シフト</th>
                                                <th class="px-4 py-2.5 text-center">平日</th>
                                                <th class="px-4 py-2.5 text-center">土日祝</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-slate-50">
                                            <tr v-for="shift in [{ key: 'early', label: '早番' }, { key: 'middle', label: '中番' }, { key: 'late', label: '遅番' }]"
                                                :key="shift.key">
                                                <td class="px-4 py-2.5 font-bold text-slate-700">{{ shift.label }}</td>
                                                <td class="px-2 py-2 text-center">
                                                    <select v-model.number="nsShiftRules[shift.key + '_weekday']"
                                                        class="appearance-none bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-brand-500 text-center">
                                                        <option :value="6">6h</option>
                                                        <option :value="7.5">7.5h</option>
                                                    </select>
                                                </td>
                                                <td class="px-2 py-2 text-center">
                                                    <select v-model.number="nsShiftRules[shift.key + '_holiday']"
                                                        class="appearance-none bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-brand-500 text-center">
                                                        <option :value="6">6h</option>
                                                        <option :value="7.5">7.5h</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- 入力内容サマリー -->
                            <div class="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-2">
                                <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">入力内容の確認</p>
                                <div class="space-y-1.5 text-sm">
                                    <div class="flex justify-between">
                                        <span class="text-slate-500">表示名</span>
                                        <span class="font-bold text-slate-800">{{ nsForm.name }}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-slate-500">店舗キー</span>
                                        <span class="font-mono font-bold text-slate-800">{{ nsForm.store_key }}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-slate-500">適用開始月</span>
                                        <span class="font-bold text-slate-800">{{ nsEffectiveFromLabel }}</span>
                                    </div>
                                    <div class="border-t border-slate-200 pt-1.5"></div>
                                    <!-- 固定費サマリー（nsFormatSettingValue で % 値を正しく表示） -->
                                    <div v-for="field in storeSettingsFields" :key="field.key"
                                        class="flex justify-between text-xs">
                                        <span class="text-slate-500">{{ field.shortLabel }}</span>
                                        <span class="font-bold text-slate-700">{{ nsFormatSettingValue(nsSettings[field.key], field) }}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- サーバーエラー表示（RPC 失敗時。入力保持のまま同ステップに留まる） -->
                            <p v-if="nsServerError" class="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{{ nsServerError }}</p>
                        </template>

                    </div>

                    <!-- フッター: 戻る / 次へ / 作成 ボタン -->
                    <div class="px-6 py-4 border-t border-slate-100 flex items-center gap-3 shrink-0">
                        <button v-if="nsStep > 1" @click="nsPrevStep"
                            :disabled="nsSaving"
                            class="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                            ← 戻る
                        </button>
                        <div class="flex-1"></div>
                        <!-- 次へボタン（Step1・2）: バリデーション通過が条件 -->
                        <button v-if="nsStep < 3" @click="nsNextStep"
                            :disabled="!!(nsStep === 1 ? nsStep1Error : nsStep2Error)"
                            class="px-6 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-brand-600 hover:bg-brand-700 text-white">
                            次へ →
                        </button>
                        <!-- 作成ボタン（Step3）: 確認ダイアログ → RPC 呼び出し -->
                        <button v-if="nsStep === 3" @click="nsSubmit"
                            :disabled="nsSaving"
                            class="px-6 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-brand-600 hover:bg-brand-700 text-white">
                            {{ nsSaving ? '作成中...' : '店舗を作成する' }}
                        </button>
                    </div>

                </div>
            </div>
        </transition>

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
    getStores, updateStore,
    createStoreAtomic
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
    inject: {
        // App.vue の provide('requestConfirm') を利用してグローバル確認ダイアログを呼び出す
        requestConfirm: { from: 'requestConfirm', default: null }
    },
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
            holRows: [],
            // 店舗管理
            smLoading: false,
            smSaving: false,
            smStores: [],        // store_type='shop' の全行（is_active 問わず・display_order 順）
            smEditingId: null,   // インライン名称編集中の store.id
            smEditingName: '',   // 編集中の一時名称
            // 新店舗追加ウィザード（create_store_atomic RPC）
            nsWizardOpen: false,  // モーダル開閉フラグ
            nsStep: 1,            // 現在のステップ 1=基本情報 / 2=固定費 / 3=シフトルール
            nsSaving: false,      // RPC 呼び出し中フラグ
            nsServerError: '',    // サーバーエラーメッセージ
            nsForm: {             // Step1: 基本情報
                name: '',
                store_key: '',
                effective_from: ''  // input[type="month"] の値（"2026-07" 形式）
            },
            nsSettings: {         // Step2: 固定費（payment_fee_rate は % 入力。例: 2.5 = 2.5%）
                fixed_rent: null,
                fixed_utilities: null,
                fixed_sundries: null,
                payment_fee_rate: null,
                fixed_salary_total: null
            },
            nsShiftRules: {       // Step3: シフトルール 6マス（デフォルト: 早番7.5h・中番6h・遅番6h）
                early_weekday: 7.5,
                early_holiday: 7.5,
                middle_weekday: 6,
                middle_holiday: 6,
                late_weekday: 6,
                late_holiday: 6
            }
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
        },
        // ─── 新店舗追加ウィザード ─────────────────────────────────────
        /** Step1 バリデーションエラー文字列（空文字列 = エラーなし） */
        nsStep1Error() {
            if (!this.nsForm.name.trim()) return '表示名を入力してください。'
            if (!this.nsForm.store_key) return '店舗キーを入力してください。'
            if (!/^[a-z][a-z0-9_]{1,29}$/.test(this.nsForm.store_key)) {
                return '店舗キーは英小文字始まり・2〜30文字（英小文字・数字・_ のみ）で入力してください。'
            }
            if (!this.nsForm.effective_from) return '適用開始月を選択してください。'
            return ''
        },
        /** Step2 バリデーションエラー文字列（空文字列 = エラーなし） */
        nsStep2Error() {
            const s = this.nsSettings
            const keys = ['fixed_rent', 'fixed_utilities', 'fixed_sundries', 'payment_fee_rate', 'fixed_salary_total']
            for (const k of keys) {
                if (s[k] === null || s[k] === '') return 'すべての項目を入力してください。'
                if (Number(s[k]) < 0) return '0 以上の値を入力してください。'
            }
            return ''
        },
        /** effective_from を YYYYMM 整数に変換（input[type="month"] の "2026-07" → 202607） */
        nsEffectiveFromInt() {
            if (!this.nsForm.effective_from) return null
            const [y, m] = this.nsForm.effective_from.split('-')
            return Number(y) * 100 + Number(m)
        },
        /** effective_from の日本語ラベル（例: "2026年7月〜"） */
        nsEffectiveFromLabel() {
            if (!this.nsEffectiveFromInt) return ''
            return fmLabel(this.nsEffectiveFromInt)
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
                const rows = parseHrmosSegmentsCsv(text, storeKeyToId, this.hmStoresDb)
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
        },

        // ─── 店舗管理 ──────────────────────────────────────────────
        async openStoreMgmt() {
            this.subMode = 'store-mgmt'
            this.smLoading = true
            try {
                const rows = await getStores()
                // shop 種別のみ display_order 順（is_active 問わず全店舗を管理対象に表示）
                this.smStores = rows.filter(s => s.store_type === 'shop')
            } catch (e) {
                alert(e.message || '読み込みに失敗しました。')
            } finally {
                this.smLoading = false
            }
        },
        smStartEdit(store) {
            this.smEditingId = store.id
            this.smEditingName = store.name
        },
        smCancelEdit() {
            this.smEditingId = null
            this.smEditingName = ''
        },
        async smSaveName(store) {
            const name = this.smEditingName.trim()
            if (!name) return
            this.smSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '保存中...')
            try {
                await updateStore(store.id, { name })
                store.name = name
                this.smCancelEdit()
            } catch (e) {
                alert(e.message || '更新に失敗しました。')
            } finally {
                this.smSaving = false
                this.$emit('update:loading', false)
            }
        },
        async smDeactivate(store) {
            // 休止化: 確認ダイアログ必須（過去データ保持の旨を明記）
            const ok = await this.smConfirm(
                `「${store.name}」を休止にしますか？\n過去データは保持され、決算時に閲覧できます。`,
                '休止にする',
                'text-red-600 hover:bg-red-50'
            )
            if (!ok) return
            this.smSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '更新中...')
            try {
                const today = new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
                await updateStore(store.id, { is_active: false, closed_at: today })
                store.is_active = false
                store.closed_at = today
            } catch (e) {
                alert(e.message || '更新に失敗しました。')
            } finally {
                this.smSaving = false
                this.$emit('update:loading', false)
            }
        },
        async smActivate(store) {
            // 再開: 確認ダイアログ → is_active=true・closed_at=null
            const ok = await this.smConfirm(
                `「${store.name}」を再開しますか？`,
                '再開する',
                'text-emerald-600 hover:bg-emerald-50'
            )
            if (!ok) return
            this.smSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '更新中...')
            try {
                await updateStore(store.id, { is_active: true, closed_at: null })
                store.is_active = true
                store.closed_at = null
            } catch (e) {
                alert(e.message || '更新に失敗しました。')
            } finally {
                this.smSaving = false
                this.$emit('update:loading', false)
            }
        },
        async smMoveUp(idx) {
            if (idx === 0) return
            await this.smSwap(idx - 1, idx)
        },
        async smMoveDown(idx) {
            if (idx === this.smStores.length - 1) return
            await this.smSwap(idx, idx + 1)
        },
        async smSwap(idxA, idxB) {
            const a = this.smStores[idxA]
            const b = this.smStores[idxB]
            this.smSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '並べ替え中...')
            try {
                // 隣接する2店舗の display_order を入れ替え（2回 update）
                // shop 同士のリスト上での操作なので office(order=0) とは絶対に入れ替わらない
                await updateStore(a.id, { display_order: b.display_order })
                await updateStore(b.id, { display_order: a.display_order })
                // ローカル状態を更新してリストを再ソート
                const tempOrder = a.display_order
                a.display_order = b.display_order
                b.display_order = tempOrder
                this.smStores = this.smStores.slice().sort((x, y) => x.display_order - y.display_order)
            } catch (e) {
                alert(e.message || '並べ替えに失敗しました。')
            } finally {
                this.smSaving = false
                this.$emit('update:loading', false)
            }
        },
        // requestConfirm が inject 済みであれば使い、なければ native confirm() にフォールバック
        smConfirm(message, okLabel = 'OK', okClass = 'text-brand-600 hover:bg-brand-50') {
            if (this.requestConfirm) {
                return this.requestConfirm(message, okLabel, okClass)
            }
            return Promise.resolve(window.confirm(message))
        },

        // ─── 新店舗追加ウィザード ──────────────────────────────────────
        /** ウィザードを開く（フォームを初期化し翌月を effective_from のデフォルトにする） */
        nsOpenWizard() {
            const now = new Date()
            const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
            const y = next.getFullYear()
            const m = String(next.getMonth() + 1).padStart(2, '0')
            this.nsForm = { name: '', store_key: '', effective_from: `${y}-${m}` }
            this.nsSettings = {
                fixed_rent: null,
                fixed_utilities: null,
                fixed_sundries: null,
                payment_fee_rate: null,
                fixed_salary_total: null
            }
            this.nsShiftRules = {
                early_weekday: 7.5, early_holiday: 7.5,
                middle_weekday: 6,  middle_holiday: 6,
                late_weekday: 6,    late_holiday: 6
            }
            this.nsStep = 1
            this.nsServerError = ''
            this.nsWizardOpen = true
        },
        /** ウィザードを閉じる（入力は全破棄。確認不要） */
        nsCloseWizard() {
            this.nsWizardOpen = false
        },
        /** 次のステップへ進む（バリデーション通過後に呼ばれる） */
        nsNextStep() {
            if (this.nsStep < 3) this.nsStep++
        },
        /** 前のステップへ戻る（入力保持） */
        nsPrevStep() {
            if (this.nsStep > 1) {
                this.nsStep--
                this.nsServerError = ''
            }
        },
        /**
         * nsSettings の表示用フォーマット（サマリー表示専用）
         * payment_fee_rate はウィザード内では % 値（例: 2.5）で保持するため
         * 通常の formatSettingValue（DB 値の 0.025 を × 100 する）とは別処理が必要
         */
        nsFormatSettingValue(val, field) {
            if (val === null || val === '') return '—'
            if (field.isJPY) return '¥' + Number(val).toLocaleString()
            if (field.isRate) return Number(val).toFixed(2) + '%'  // 既に % 値
            return String(val)
        },
        /** 最終確認ダイアログを経て create_store_atomic RPC を呼び出す */
        async nsSubmit() {
            // 最終確認（既存の smConfirm パターンを流用）
            const ok = await this.smConfirm(
                `以下の内容で店舗を作成します。よろしいですか？\n\n` +
                `店名: ${this.nsForm.name.trim()}\n` +
                `店舗キー: ${this.nsForm.store_key}\n` +
                `適用開始月: ${this.nsEffectiveFromLabel}`,
                '作成する',
                'text-brand-600 hover:bg-brand-50'
            )
            if (!ok) return

            this.nsSaving = true
            this.$emit('update:loading', true)
            this.$emit('update:loadingMessage', '店舗を作成中...')
            try {
                // payment_fee_rate は % 入力（例: 2.5）なので DB 保存時に /100 して小数化
                const pSettings = {
                    fixed_rent: Number(this.nsSettings.fixed_rent ?? 0),
                    fixed_utilities: Number(this.nsSettings.fixed_utilities ?? 0),
                    fixed_sundries: Number(this.nsSettings.fixed_sundries ?? 0),
                    payment_fee_rate: Number(this.nsSettings.payment_fee_rate ?? 0) / 100,
                    fixed_salary_total: Number(this.nsSettings.fixed_salary_total ?? 0)
                }
                const pShiftRules = [
                    { shift_type: 'early',  day_type: 'weekday', hours: this.nsShiftRules.early_weekday },
                    { shift_type: 'early',  day_type: 'holiday', hours: this.nsShiftRules.early_holiday },
                    { shift_type: 'middle', day_type: 'weekday', hours: this.nsShiftRules.middle_weekday },
                    { shift_type: 'middle', day_type: 'holiday', hours: this.nsShiftRules.middle_holiday },
                    { shift_type: 'late',   day_type: 'weekday', hours: this.nsShiftRules.late_weekday },
                    { shift_type: 'late',   day_type: 'holiday', hours: this.nsShiftRules.late_holiday }
                ]
                await createStoreAtomic({
                    p_store_key: this.nsForm.store_key,
                    p_name: this.nsForm.name.trim(),
                    p_effective_from: this.nsEffectiveFromInt,
                    p_settings: pSettings,
                    p_shift_rules: pShiftRules
                })
                // 成功: 店舗一覧リロード & ウィザードを閉じる
                const rows = await getStores()
                this.smStores = rows.filter(s => s.store_type === 'shop')
                this.nsWizardOpen = false
                alert('店舗を作成しました。')
            } catch (e) {
                // 失敗: エラーをウィザード内に表示（入力保持・Step3 に留まる）
                this.nsServerError = e.message || '店舗の作成に失敗しました。'
            } finally {
                this.nsSaving = false
                this.$emit('update:loading', false)
            }
        }
    }
}
</script>

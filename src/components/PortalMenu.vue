<template>
    <div class="flex flex-col items-center justify-center py-10">

        <!-- 年初祝日チェックバナー（祝日マスタが「現在の年 or 翌年」を欠く時のみ表示） -->
        <div v-if="holidayBannerVisible"
            class="w-full max-w-4xl px-4 mb-6">
            <div class="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-start gap-3">
                <span class="text-amber-600 text-xl">⚠</span>
                <div class="flex-1 text-sm">
                    <p class="font-bold text-amber-700">祝日マスタを更新してください</p>
                    <p class="text-amber-600 text-xs mt-0.5">
                        {{ holidayBannerMessage }}
                        <button @click="onRefreshHolidays" :disabled="holidayRefreshing"
                            class="ml-1 underline font-bold disabled:opacity-40">
                            {{ holidayRefreshing ? '取得中...' : 'いま再取得' }}
                        </button>
                        または設定モードから手動で更新できます。
                    </p>
                </div>
            </div>
        </div>

        <h3 class="text-lg font-bold text-slate-600 mb-6 bg-slate-100 px-6 py-2 rounded-full">機能を選択してください</h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl px-4">

            <!-- PLモード -->
            <button @click="$emit('open-pl')"
                class="group bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-colors transition-transform transition-shadow duration-300 text-left flex flex-col h-full focus:outline-none focus:ring-4 focus:ring-teal-500/20 active:scale-95">
                <div class="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-6 shadow-inner group-hover:bg-teal-600 transition-colors duration-300">
                    <svg class="w-8 h-8 text-teal-600 group-hover:text-white transition-colors duration-300"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z">
                        </path>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-slate-800 mb-2 group-hover:text-teal-600 transition-colors">経営PL</h3>
                <p class="text-slate-500 font-medium leading-relaxed flex-grow">月次・年次のP&Lと各指標のトレンドを確認します。</p>
                <div class="mt-6 flex items-center text-teal-600 font-bold text-sm bg-teal-50 px-4 py-2 rounded-full self-start">
                    <span>開く</span>
                    <svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </div>
            </button>

            <!-- 月次入力 -->
            <button @click="$emit('open-input')"
                class="group bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-colors transition-transform transition-shadow duration-300 text-left flex flex-col h-full focus:outline-none focus:ring-4 focus:ring-brand-500/20 active:scale-95">
                <div class="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-6 shadow-inner group-hover:bg-brand-600 transition-colors duration-300">
                    <svg class="w-8 h-8 text-brand-600 group-hover:text-white transition-colors duration-300"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z">
                        </path>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-slate-800 mb-2 group-hover:text-brand-600 transition-colors">月次入力</h3>
                <p class="text-slate-500 font-medium leading-relaxed flex-grow">店舗ごとの売上・経費データを入力します。</p>
                <div class="mt-6 flex items-center text-brand-600 font-bold text-sm bg-brand-50 px-4 py-2 rounded-full self-start">
                    <span>開く</span>
                    <svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </div>
            </button>

            <!-- 認可状況 -->
            <button @click="$emit('open-approval')"
                class="group bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-colors transition-transform transition-shadow duration-300 text-left flex flex-col h-full focus:outline-none focus:ring-4 focus:ring-indigo-500/20 active:scale-95">
                <div class="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 shadow-inner group-hover:bg-indigo-600 transition-colors duration-300">
                    <svg class="w-8 h-8 text-indigo-600 group-hover:text-white transition-colors duration-300"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z">
                        </path>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">認可状況</h3>
                <p class="text-slate-500 font-medium leading-relaxed flex-grow">認可済みパイプたばこ銘柄の閲覧・PDF取込更新を行います。</p>
                <div class="mt-6 flex items-center text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-full self-start">
                    <span>開く</span>
                    <svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </div>
            </button>

            <!-- 設定 -->
            <button @click="$emit('open-settings')"
                class="group bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-colors transition-transform transition-shadow duration-300 text-left flex flex-col h-full focus:outline-none focus:ring-4 focus:ring-slate-500/20 active:scale-95">
                <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-6 shadow-inner group-hover:bg-slate-600 transition-colors duration-300">
                    <svg class="w-8 h-8 text-slate-600 group-hover:text-white transition-colors duration-300"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z">
                        </path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-slate-800 mb-2 group-hover:text-slate-600 transition-colors">設定</h3>
                <p class="text-slate-500 font-medium leading-relaxed flex-grow">固定費・ベンチマーク・物販販売値を管理します。</p>
                <div class="mt-6 flex items-center text-slate-600 font-bold text-sm bg-slate-100 px-4 py-2 rounded-full self-start">
                    <span>開く</span>
                    <svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </div>
            </button>


        </div>
    </div>
</template>

<script>
import { checkHolidaysCoverage, forceRefreshHolidays } from '../utils/jpHolidaysClient.js'

export default {
    name: 'PortalMenu',
    emits: ['open-pl', 'open-input', 'open-settings', 'open-approval'],
    data() {
        return {
            holidayCoverage: { currentYearOk: true, nextYearOk: true },  // 未チェック時は banner 出さない
            holidayBannerVisible: false,
            holidayRefreshing: false
        }
    },
    computed: {
        holidayBannerMessage() {
            const now = new Date()
            const cy = now.getFullYear()
            if (!this.holidayCoverage.currentYearOk) {
                return `${cy}年の祝日データがキャッシュにありません。`
            }
            if (!this.holidayCoverage.nextYearOk) {
                return `${cy + 1}年の祝日データがキャッシュにありません。年初の集計に備えて取得を推奨します。`
            }
            return ''
        }
    },
    async mounted() {
        try {
            this.holidayCoverage = await checkHolidaysCoverage()
            this.holidayBannerVisible = !this.holidayCoverage.currentYearOk || !this.holidayCoverage.nextYearOk
            // 欠落していたら自動取得を試みる（成功すれば banner を消す）
            if (this.holidayBannerVisible) {
                await this.tryAutoRefresh()
            }
        } catch {
            // 失敗時は banner 非表示のまま（設定モードから手動取得可能）
        }
    },
    methods: {
        async tryAutoRefresh() {
            const result = await forceRefreshHolidays()
            if (result.status === 'success') {
                this.holidayCoverage = await checkHolidaysCoverage()
                this.holidayBannerVisible = !this.holidayCoverage.currentYearOk || !this.holidayCoverage.nextYearOk
            }
        },
        async onRefreshHolidays() {
            this.holidayRefreshing = true
            try {
                await this.tryAutoRefresh()
            } finally {
                this.holidayRefreshing = false
            }
        }
    }
}
</script>

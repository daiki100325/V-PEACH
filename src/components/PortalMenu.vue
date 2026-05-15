<template>
    <div class="flex flex-col items-center justify-center py-10">
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
export default {
    name: 'PortalMenu',
    emits: ['open-pl', 'open-input', 'open-settings']
}
</script>

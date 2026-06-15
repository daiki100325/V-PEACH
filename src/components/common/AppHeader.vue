<template>
    <header class="bg-white/90 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200/60 shadow-sm transform-gpu">
        <div class="container mx-auto px-4 h-16 flex justify-between items-center relative">

            <!-- ポータルへ戻るボタン -->
            <button v-if="appMode !== null" @click="$emit('return-to-portal')"
                class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-500 transition-colors active:scale-95 z-40">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path>
                </svg>
            </button>

            <div class="flex items-center gap-2" :class="{'ml-12': appMode !== null}">
                <!-- モード別アクセントバー -->
                <div class="w-2 h-7 rounded-full shrink-0 self-center"
                    :class="modeAccentColor">
                </div>

                <!-- ポータル表示 -->
                <div v-if="appMode === null" class="flex flex-col min-w-0 leading-tight">
                    <h1 class="text-xl font-bold tracking-tight text-slate-800 leading-none">V-PEACH</h1>
                    <span class="text-[9px] text-slate-400 font-medium tracking-[0.1em] uppercase leading-snug whitespace-nowrap mt-0.5">
                        Profit &amp; Expense Analysis for Corporate Health
                    </span>
                </div>

                <!-- モード名表示 -->
                <h1 v-else class="text-xl font-bold tracking-tight text-slate-800">{{ modeLabel }}</h1>
            </div>

        </div>
    </header>
</template>

<script>
export default {
    name: 'AppHeader',
    props: {
        appMode: { type: String, default: null }
    },
    emits: ['return-to-portal'],
    computed: {
        modeLabel() {
            const labels = { pl: '経営PL', input: '月次入力', settings: '設定', approval: '認可状況' }
            return labels[this.appMode] || 'V-PEACH'
        },
        modeAccentColor() {
            const colors = {
                pl: 'bg-teal-600',
                input: 'bg-brand-600',
                settings: 'bg-slate-600',
                approval: 'bg-indigo-600'
            }
            return colors[this.appMode] || 'bg-slate-600'
        }
    }
}
</script>

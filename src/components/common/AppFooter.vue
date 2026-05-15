<template>
    <footer v-if="appMode === 'input' && inputStepActive"
        class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
        <div class="container mx-auto max-w-lg flex justify-between items-center">
            <button @click="$emit('prev-step')"
                class="px-6 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors active:scale-95 text-sm">
                戻る
            </button>
            <button v-if="!isLastStep"
                @click="$emit('next-step')"
                :disabled="!canNext"
                class="group bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-slate-900/20 transition-colors active:scale-95 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                <span>次へ</span>
                <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </button>
            <button v-else
                @click="$emit('submit')"
                :disabled="!canNext"
                class="bg-gradient-to-r from-brand-600 to-orange-500 hover:from-brand-700 hover:to-orange-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-brand-500/30 transition-transform transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                保存する
            </button>
        </div>
    </footer>
</template>

<script>
export default {
    name: 'AppFooter',
    props: {
        appMode: { type: String, default: null },
        inputStepActive: { type: Boolean, default: false },
        canNext: { type: Boolean, default: false },
        isLastStep: { type: Boolean, default: false }
    },
    emits: ['prev-step', 'next-step', 'submit']
}
</script>

<template>
    <transition name="fade">
        <div v-if="show"
            class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center">
                <div class="relative w-20 h-20 mb-6">
                    <div class="absolute inset-0 border-4 border-slate-100 rounded-full shadow-inner shadow-slate-200/50"></div>
                    <div class="absolute inset-0 border-4 border-brand-500 rounded-full border-t-transparent animate-spin drop-shadow-md"></div>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="w-2.5 h-2.5 bg-brand-500 rounded-full animate-pulse shadow-sm shadow-brand-400"></div>
                    </div>
                </div>
                <div class="text-xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-orange-400">
                    {{ message }}
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
export default {
    name: 'LoadingOverlay',
    props: {
        show: { type: Boolean, required: true },
        message: { type: String, default: '処理中...' }
    }
}
</script>

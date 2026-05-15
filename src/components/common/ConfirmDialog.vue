<template>
    <transition name="fade">
        <div v-if="visible"
            class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
            @click.self="handleCancel">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col transform ring-1 ring-black/5 overflow-hidden">
                <div class="px-6 pt-8 pb-6 text-center">
                    <div class="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
                            </path>
                        </svg>
                    </div>
                    <p class="text-slate-700 font-medium text-sm leading-relaxed whitespace-pre-line">{{ message }}</p>
                </div>
                <div class="flex border-t border-slate-100">
                    <button @click="handleCancel"
                        class="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 transition-colors active:scale-95">
                        キャンセル
                    </button>
                    <div class="w-px bg-slate-100"></div>
                    <button @click="handleOk"
                        class="flex-1 py-4 font-bold transition-colors active:scale-95"
                        :class="okClass">
                        {{ okLabel }}
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
export default {
    name: 'ConfirmDialog',
    props: {
        visible: { type: Boolean, default: false },
        message: { type: String, default: '' },
        okLabel: { type: String, default: 'OK' },
        okClass: { type: String, default: 'text-brand-600 hover:bg-brand-50' }
    },
    emits: ['ok', 'cancel'],
    methods: {
        handleOk() { this.$emit('ok') },
        handleCancel() { this.$emit('cancel') }
    }
}
</script>

<template>
    <div class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-500">{{ label }}</label>
        <label class="block bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-2.5 cursor-pointer hover:border-brand-400 transition-colors">
            <input type="file" accept=".csv,text/csv" class="hidden" @change="onChange" />
            <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold" :class="file ? 'text-slate-700' : 'text-slate-400'">
                    {{ file ? file.name : 'ファイルを選択' }}
                </span>
                <span class="text-xs text-brand-600 font-bold shrink-0">{{ file ? '変更' : '選択' }}</span>
            </div>
        </label>
        <p v-if="info" class="text-xs text-teal-600 px-1">{{ info }}</p>
        <p v-if="error" class="text-xs text-red-500 px-1">{{ error }}</p>
    </div>
</template>

<script>
export default {
    name: 'FileSlot',
    props: {
        label: { type: String, required: true },
        file: { type: Object, default: null },
        info: { type: String, default: null },
        error: { type: String, default: null }
    },
    emits: ['change'],
    methods: {
        onChange(e) {
            const f = e.target.files?.[0] || null
            this.$emit('change', f)
            // 同じファイルを再選択できるようにリセット
            e.target.value = ''
        }
    }
}
</script>

<template>
    <div class="space-y-1.5">
        <label class="block bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-2.5 cursor-pointer hover:border-brand-400 transition-colors">
            <input type="file" accept=".csv,text/csv" multiple class="hidden" @change="onChange" />
            <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold" :class="hasAny ? 'text-slate-700' : 'text-slate-400'">
                    {{ hasAny ? '追加で選択（複数可）' : 'CSVファイルを選択（複数可・順不同）' }}
                </span>
                <span class="text-xs text-brand-600 font-bold shrink-0">{{ hasAny ? '追加' : '選択' }}</span>
            </div>
        </label>

        <!-- 種別ごとに2行表示 -->
        <div class="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            <!-- 商品別売上（Airメイト） -->
            <div class="px-3 py-2">
                <div class="flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <span class="text-xs font-bold text-slate-500">商品別売上</span>
                        <span v-if="airmate.file" class="ml-2 text-xs text-slate-700 break-all">{{ airmate.file.name }}</span>
                        <span v-else class="ml-2 text-xs text-slate-400">未取込</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span v-if="airmate.parsed" class="text-xs text-teal-600 font-bold">✓</span>
                        <span v-else-if="airmate.error" class="text-xs text-red-500 font-bold">×</span>
                        <button v-if="airmate.file" type="button" @click="$emit('clear', 'airmate')"
                            class="text-xs text-slate-400 hover:text-red-500 font-bold px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                            aria-label="商品別売上CSVを削除">削除</button>
                    </div>
                </div>
                <p v-if="airmateInfo" class="text-xs text-teal-600 mt-1">{{ airmateInfo }}</p>
                <p v-if="airmate.error" class="text-xs text-red-500 mt-1">{{ airmate.error }}</p>
            </div>

            <!-- 日別売上（Airレジ） -->
            <div class="px-3 py-2">
                <div class="flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <span class="text-xs font-bold text-slate-500">日別売上</span>
                        <span v-if="airregi.file" class="ml-2 text-xs text-slate-700 break-all">{{ airregi.file.name }}</span>
                        <span v-else class="ml-2 text-xs text-slate-400">未取込</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span v-if="airregi.parsed" class="text-xs text-teal-600 font-bold">✓</span>
                        <span v-else-if="airregi.error" class="text-xs text-red-500 font-bold">×</span>
                        <button v-if="airregi.file" type="button" @click="$emit('clear', 'airregi')"
                            class="text-xs text-slate-400 hover:text-red-500 font-bold px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                            aria-label="日別売上CSVを削除">削除</button>
                    </div>
                </div>
                <p v-if="airregiInfo" class="text-xs text-teal-600 mt-1">{{ airregiInfo }}</p>
                <p v-if="airregi.error" class="text-xs text-red-500 mt-1">{{ airregi.error }}</p>
            </div>
        </div>

        <!-- 警告メッセージ（種別不明・同種重複） -->
        <ul v-if="warnings && warnings.length" class="space-y-1">
            <li v-for="(w, i) in warnings" :key="i" class="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                ⚠ {{ w }}
            </li>
        </ul>
    </div>
</template>

<script>
export default {
    name: 'StoreCsvUpload',
    props: {
        airmate: { type: Object, default: () => ({ file: null, parsed: null, error: null }) },
        airregi: { type: Object, default: () => ({ file: null, parsed: null, error: null }) },
        airmateInfo: { type: String, default: null },
        airregiInfo: { type: String, default: null },
        warnings: { type: Array, default: () => [] }
    },
    emits: ['files', 'clear'],
    computed: {
        hasAny() {
            return !!(this.airmate?.file || this.airregi?.file)
        }
    },
    methods: {
        onChange(e) {
            const files = Array.from(e.target.files || [])
            if (files.length > 0) this.$emit('files', files)
            // 同じファイルを再選択できるようにリセット
            e.target.value = ''
        }
    }
}
</script>

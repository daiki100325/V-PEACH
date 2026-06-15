<template>
    <main class="container mx-auto px-4 py-6 max-w-lg md:max-w-3xl flex-grow">
        <div class="mb-4 flex items-start justify-between gap-3">
            <div>
                <h2 class="text-xl font-bold text-slate-800 mb-1">認可状況</h2>
                <p class="text-xs text-slate-400">財務省に認可されたパイプたばこ銘柄の閲覧・更新</p>
            </div>
            <!-- どの月日までのデータが反映済みか一目でわかるよう、常時 最終更新日時 を表示 -->
            <div class="text-right shrink-0">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">最終更新日時</div>
                <div class="text-xs font-bold text-slate-600 tabular-nums">{{ lastUpdatedLabel }}</div>
            </div>
        </div>

        <!-- サブモードタブ -->
        <div class="flex gap-1 bg-slate-100 rounded-2xl p-1 mb-5 max-w-sm">
            <button @click="subMode = 'browse'"
                class="flex-1 text-sm font-bold py-2 rounded-xl transition-colors"
                :class="subMode === 'browse' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'">
                閲覧
            </button>
            <button @click="subMode = 'update'"
                class="flex-1 text-sm font-bold py-2 rounded-xl transition-colors"
                :class="subMode === 'update' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'">
                更新
            </button>
        </div>

        <ApprovalBrowse v-if="subMode === 'browse'" />
        <ApprovalUpdate v-else @updated="loadLastUpdated" />
    </main>
</template>

<script>
import ApprovalBrowse from './approval/ApprovalBrowse.vue'
import ApprovalUpdate from './approval/ApprovalUpdate.vue'
import { getApprovalLastUpdated } from '../../api.js'

export default {
    name: 'ApprovalApp',
    components: { ApprovalBrowse, ApprovalUpdate },
    data() {
        return { subMode: 'browse', lastUpdated: null, lastUpdatedLoading: true }
    },
    computed: {
        // 例: 「2026-06-15 15:30」。取得中/未取得は控えめなプレースホルダ。
        lastUpdatedLabel() {
            if (this.lastUpdatedLoading) return '取得中…'
            if (!this.lastUpdated) return '—'
            const d = new Date(this.lastUpdated)
            if (isNaN(d.getTime())) return '—'
            const p = n => String(n).padStart(2, '0')
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
        }
    },
    mounted() {
        this.loadLastUpdated()
    },
    methods: {
        async loadLastUpdated() {
            this.lastUpdatedLoading = true
            try {
                this.lastUpdated = await getApprovalLastUpdated()
            } catch {
                this.lastUpdated = null
            } finally {
                this.lastUpdatedLoading = false
            }
        }
    }
}
</script>

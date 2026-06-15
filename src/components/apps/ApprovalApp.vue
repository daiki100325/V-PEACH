<template>
    <main class="container mx-auto px-4 py-6 max-w-lg md:max-w-3xl flex-grow">
        <div class="mb-4">
            <h2 class="text-xl font-bold text-slate-800 mb-1">認可状況</h2>
            <p class="text-xs text-slate-400">財務省に認可されたパイプたばこ銘柄の閲覧・更新</p>
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
        <ApprovalUpdate v-else />
    </main>
</template>

<script>
import ApprovalBrowse from './approval/ApprovalBrowse.vue'
import ApprovalUpdate from './approval/ApprovalUpdate.vue'

export default {
    name: 'ApprovalApp',
    components: { ApprovalBrowse, ApprovalUpdate },
    data() {
        return { subMode: 'browse' }
    }
}
</script>

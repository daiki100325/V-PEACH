<template>
    <div class="pb-24">
        <!-- 件数 + 適用中の条件 -->
        <div class="flex items-center justify-between mb-3 px-1">
            <span class="text-xs text-slate-400">
                {{ loading ? '読み込み中...' : `${items.length} 件${items.length > renderLimit ? `（${visibleItems.length} 件表示中）` : ''}` }}
            </span>
            <span class="text-[11px] text-slate-400">{{ sortLabel }}</span>
        </div>

        <!-- 一覧 -->
        <div v-if="loading" class="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
        <div v-else-if="items.length === 0" class="text-center py-12 text-slate-400 text-sm">該当する銘柄がありません。</div>
        <div v-else class="space-y-2">
            <div v-for="item in visibleItems" :key="item.id"
                class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button @click="toggleHistory(item)"
                    class="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div class="min-w-0">
                        <div class="text-sm font-bold text-slate-800 truncate">{{ item.product_name }}</div>
                        <div class="text-xs text-slate-400 mt-0.5">
                            <span class="text-indigo-600 font-medium">{{ item.brand }}</span>
                            <span v-if="item.package_size"> ・ {{ item.package_size }}</span>
                            <span v-if="item.origin_country"> ・ {{ item.origin_country }}</span>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="text-sm font-bold text-slate-800">{{ formatYen(item.current_price) }}</div>
                        <div class="text-[10px] text-slate-400">{{ item.approval_date || '認可日不明' }}</div>
                    </div>
                </button>

                <!-- 価格履歴 -->
                <div v-if="expandedId === item.id" class="border-t border-slate-100 bg-slate-50 px-4 py-3">
                    <div v-if="historyLoading" class="text-xs text-slate-400">履歴を読み込み中...</div>
                    <div v-else-if="(historyMap[item.id] || []).length === 0" class="text-xs text-slate-400">価格変更履歴はありません。</div>
                    <ul v-else class="space-y-1">
                        <li v-for="h in historyMap[item.id]" :key="h.id" class="text-xs text-slate-600 flex items-center gap-2">
                            <span class="text-slate-400">{{ h.changed_on || '日付不明' }}</span>
                            <span>{{ formatYen(h.price_before) }} → {{ formatYen(h.price_after) }}</span>
                            <span v-if="h.source === 'csv_seed'" class="text-[10px] text-slate-300">(初期データ)</span>
                        </li>
                    </ul>
                </div>
            </div>

            <!-- もっと見る（段階表示で DOM 負荷を抑制） -->
            <button v-if="items.length > renderLimit" @click="renderLimit += 300"
                class="w-full py-3 mt-1 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors">
                もっと見る（残り {{ items.length - renderLimit }} 件）
            </button>
        </div>

        <!-- ─── FAB（絞り込み・並び替え） ─────────────────────────────── -->
        <button @click="panelOpen = true"
            class="fixed bottom-6 right-6 z-40 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full pl-5 pr-6 py-4 shadow-xl shadow-indigo-600/30 transition-all duration-300 active:scale-95 flex items-center gap-2"
            :class="hasActiveFilters ? 'ring-4 ring-indigo-300 ring-offset-2' : ''">
            <span v-if="hasActiveFilters" class="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white"></span>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span class="font-bold text-sm">絞り込み</span>
        </button>

        <!-- 背景オーバーレイ -->
        <transition name="fade">
            <div v-if="panelOpen" @click="panelOpen = false" class="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"></div>
        </transition>

        <!-- にゅっと出るパネル（下からスライドアップ） -->
        <div class="fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out"
            :class="panelOpen ? 'translate-y-0' : 'translate-y-full'">
            <div class="bg-white rounded-t-3xl shadow-2xl border-t border-slate-100 max-w-2xl mx-auto p-5 pb-8 space-y-5">
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-bold text-slate-800">絞り込み・並び替え</h3>
                    <button @click="panelOpen = false" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <!-- ブランド -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1.5">ブランド</label>
                    <select v-model="selectedBrand" @change="loadItems"
                        class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                        <option value="">すべてのブランド（{{ brands.length }}）</option>
                        <option v-for="b in brands" :key="b" :value="b">{{ b }}</option>
                    </select>
                </div>

                <!-- 銘柄名検索 -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1.5">銘柄名で検索</label>
                    <input v-model="search" @input="onSearchInput" type="text" placeholder="例: Apple / Mint"
                        class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>

                <!-- 並び替え -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1.5">並び替え</label>
                    <div class="grid grid-cols-2 gap-2">
                        <button v-for="opt in sortOptions" :key="opt.key + opt.dir" @click="setSort(opt.key, opt.dir)"
                            class="text-sm font-bold py-2.5 rounded-xl border transition-colors"
                            :class="sortKey === opt.key && sortDir === opt.dir
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'">
                            {{ opt.label }}
                        </button>
                    </div>
                </div>

                <div class="flex gap-2 pt-1">
                    <button @click="resetFilters"
                        class="flex-1 text-sm font-bold py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                        クリア
                    </button>
                    <button @click="panelOpen = false"
                        class="flex-1 text-sm font-bold py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                        {{ items.length }} 件を表示
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { getApprovalBrands, getApprovalItems, getApprovalPriceHistory } from '../../../api.js'

export default {
    name: 'ApprovalBrowse',
    data() {
        return {
            brands: [],
            selectedBrand: '',
            search: '',
            sortKey: 'product_name',
            sortDir: 'asc',
            items: [],
            loading: false,
            renderLimit: 200,   // 初期描画件数（「もっと見る」で +300）
            expandedId: null,
            historyMap: {},
            historyLoading: false,
            searchTimer: null,
            panelOpen: false,
            sortOptions: [
                { key: 'product_name', dir: 'asc', label: '名前 ↑（A→Z）' },
                { key: 'product_name', dir: 'desc', label: '名前 ↓（Z→A）' },
                { key: 'approval_date', dir: 'asc', label: '認可日 ↑（古い順）' },
                { key: 'approval_date', dir: 'desc', label: '認可日 ↓（新しい順）' }
            ]
        }
    },
    computed: {
        visibleItems() {
            return this.items.slice(0, this.renderLimit)
        },
        hasActiveFilters() {
            return !!this.selectedBrand || !!this.search || this.sortKey !== 'product_name' || this.sortDir !== 'asc'
        },
        sortLabel() {
            const opt = this.sortOptions.find(o => o.key === this.sortKey && o.dir === this.sortDir)
            return opt ? opt.label : ''
        }
    },
    async mounted() {
        try {
            this.brands = await getApprovalBrands()
        } catch (e) {
            console.error('ブランド取得失敗:', e)
        }
        await this.loadItems()
    },
    methods: {
        formatYen(v) {
            if (v === null || v === undefined) return '—'
            return '¥' + Number(v).toLocaleString('ja-JP')
        },
        async loadItems() {
            this.loading = true
            this.expandedId = null
            this.renderLimit = 200   // 条件変更時は初期描画件数に戻す
            try {
                this.items = await getApprovalItems({
                    brand: this.selectedBrand, search: this.search,
                    sortKey: this.sortKey, sortDir: this.sortDir
                })
            } catch (e) {
                console.error('銘柄取得失敗:', e)
                this.items = []
            } finally {
                this.loading = false
            }
        },
        onSearchInput() {
            clearTimeout(this.searchTimer)
            this.searchTimer = setTimeout(() => this.loadItems(), 300)
        },
        setSort(key, dir) {
            this.sortKey = key
            this.sortDir = dir
            this.loadItems()
        },
        resetFilters() {
            this.selectedBrand = ''
            this.search = ''
            this.sortKey = 'product_name'
            this.sortDir = 'asc'
            this.loadItems()
        },
        async toggleHistory(item) {
            if (this.expandedId === item.id) { this.expandedId = null; return }
            this.expandedId = item.id
            if (!this.historyMap[item.id]) {
                this.historyLoading = true
                try {
                    this.historyMap[item.id] = await getApprovalPriceHistory(item.id)
                } catch (e) {
                    console.error('履歴取得失敗:', e)
                    this.historyMap[item.id] = []
                } finally {
                    this.historyLoading = false
                }
            }
        }
    }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

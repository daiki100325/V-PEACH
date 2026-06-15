<template>
    <div class="space-y-4 pb-16">
        <!-- 種別選択 + アップロード -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4">
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1">PDF の種別</label>
                <div class="flex gap-1 bg-slate-100 rounded-2xl p-1">
                    <button @click="kind = 'new'" :disabled="parsing"
                        class="flex-1 text-sm font-bold py-2 rounded-xl transition-colors"
                        :class="kind === 'new' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'">
                        新規認可
                    </button>
                    <button @click="kind = 'change'" :disabled="parsing"
                        class="flex-1 text-sm font-bold py-2 rounded-xl transition-colors"
                        :class="kind === 'change' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'">
                        変更認可
                    </button>
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1">財務省 PDF をアップロード（複数可）</label>
                <input ref="fileInput" type="file" accept="application/pdf" multiple @change="onFile" :disabled="parsing"
                    class="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100" />
                <p class="text-[11px] text-slate-400 mt-1">
                    「製造たばこの区分」が <b>パイプたばこ</b> の行のみ自動抽出します。
                    <span v-if="files.length" class="text-indigo-600 font-bold">選択中: {{ files.length }} 件</span>
                </p>
            </div>
            <button @click="parse" :disabled="!files.length || parsing"
                class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">
                {{ parsing ? `Gemini が抽出中...${progress ? ' (' + progress + ')' : ''}` : `PDF を解析する${files.length > 1 ? `（${files.length} 件）` : ''}` }}
            </button>
            <p v-if="error" class="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{{ error }}</p>
        </div>

        <!-- プレビュー -->
        <div v-if="rows.length > 0" class="space-y-3">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-700">抽出結果プレビュー（{{ rows.length }} 件）</h3>
                <span class="text-xs text-slate-400">内容を確認・修正してから確定してください</span>
            </div>

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                <div v-for="(row, idx) in rows" :key="idx" class="p-3 space-y-2"
                    :class="kind === 'change' && !row.item_id ? 'bg-amber-50' : ''">
                    <div class="flex items-start justify-between gap-2">
                        <div class="grid grid-cols-2 gap-2 flex-1">
                            <input v-model="row.brand" placeholder="ブランド" class="col-span-1 text-xs rounded-lg border border-slate-200 px-2 py-1.5" />
                            <input v-model="row.package_size" placeholder="容量" class="col-span-1 text-xs rounded-lg border border-slate-200 px-2 py-1.5" />
                            <input v-model="row.product_name" placeholder="銘柄名" class="col-span-2 text-xs rounded-lg border border-slate-200 px-2 py-1.5" />

                            <!-- 新規認可 -->
                            <template v-if="kind === 'new'">
                                <input v-model="row.origin_country" placeholder="製造国" class="text-xs rounded-lg border border-slate-200 px-2 py-1.5" />
                                <input v-model="row.approval_date" placeholder="認可日 YYYY-MM-DD" class="text-xs rounded-lg border border-slate-200 px-2 py-1.5" />
                                <input v-model.number="row.price" type="number" placeholder="小売定価(円)" class="text-xs rounded-lg border border-slate-200 px-2 py-1.5" />
                                <div v-if="row.exists" class="text-[11px] text-amber-600 self-center">※ 既存銘柄と一致（重複のため追加されません）</div>
                            </template>

                            <!-- 変更認可 -->
                            <template v-else>
                                <input v-model.number="row.price_before" type="number" placeholder="変更前(円)" class="text-xs rounded-lg border border-slate-200 px-2 py-1.5" />
                                <input v-model.number="row.price_after" type="number" placeholder="変更後(円)" class="text-xs rounded-lg border border-slate-200 px-2 py-1.5" />
                                <input v-model="row.changed_on" placeholder="変更日 YYYY-MM-DD" class="text-xs rounded-lg border border-slate-200 px-2 py-1.5" />
                                <div class="text-[11px] self-center">
                                    <span v-if="row.item_id" class="text-emerald-600">✓ {{ row.matchLabel }}</span>
                                    <select v-else v-model="row.item_id"
                                        class="text-[11px] rounded-lg border border-amber-300 px-1 py-1 w-full">
                                        <option :value="null">未マッチ（紐付けを選択）</option>
                                        <option v-for="c in candidatesFor(row)" :key="c.id" :value="c.id">
                                            {{ c.product_name }}（{{ c.package_size }}）
                                        </option>
                                    </select>
                                </div>
                            </template>
                        </div>
                        <button @click="rows.splice(idx, 1)" class="text-red-300 hover:text-red-500 text-xs shrink-0 mt-1">削除</button>
                    </div>
                </div>
            </div>

            <div v-if="kind === 'change'" class="text-xs text-slate-400 px-1">
                マッチ済み {{ matchedCount }} 件 / 未マッチ {{ rows.length - matchedCount }} 件（未マッチは紐付けを選ぶか削除してください）
            </div>

            <button @click="confirm" :disabled="confirming || confirmCount === 0"
                class="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">
                {{ confirming ? '反映中...' : `${confirmCount} 件を DB に反映する` }}
            </button>
        </div>

        <p v-if="resultMessage" class="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 font-medium">{{ resultMessage }}</p>
    </div>
</template>

<script>
import { callParseApprovalPdf, getApprovalItems, insertApprovalItems, applyApprovalChanges } from '../../../api.js'

// NFKC で半角カナ→全角・全角英数→半角などを吸収し、空白・大小を無視して比較する
const norm = s => (s || '').toString().normalize('NFKC').toLowerCase().replace(/[\s　]/g, '')
// 容量は容器名（箱/パウチ/缶）がソース間で揺れるため、重量(g)の数値だけで突合する
const sizeKey = s => {
    const m = (s || '').toString().normalize('NFKC').match(/([\d.]+)\s*g/i)
    return m ? String(parseFloat(m[1])) : norm(s)
}

export default {
    name: 'ApprovalUpdate',
    data() {
        return {
            kind: 'new',
            files: [],          // [{ name, base64 }] 複数PDF対応
            parsing: false,
            progress: '',       // "2/3" 解析進捗
            error: '',
            rows: [],
            confirming: false,
            resultMessage: ''
        }
    },
    computed: {
        matchedCount() {
            return this.rows.filter(r => r.item_id).length
        },
        confirmCount() {
            if (this.kind === 'new') return this.rows.filter(r => !r.exists).length
            return this.rows.filter(r => r.item_id && r.price_after != null).length
        }
    },
    methods: {
        async onFile(e) {
            this.error = ''
            this.resultMessage = ''
            this.rows = []
            const fileList = Array.from(e.target.files || [])
            // 複数ファイルを base64 化（data:application/pdf;base64,XXXX → XXXX のみ）
            this.files = await Promise.all(fileList.map(f => new Promise(resolve => {
                const reader = new FileReader()
                reader.onload = () => resolve({ name: f.name, base64: String(reader.result).split(',')[1] || '' })
                reader.readAsDataURL(f)
            })))
        },
        candidatesFor(row) {
            // 手動リンク用：同じ銘柄名の既存候補（容量違いなど）
            return row._cands || []
        },
        async parse() {
            this.parsing = true
            this.error = ''
            this.resultMessage = ''
            this.rows = []
            this.progress = ''
            try {
                // 複数PDFを逐次解析（Gemini を同時多発させずレート制限に優しい）。失敗ファイルは記録して続行
                const raw = []
                const failed = []
                for (let i = 0; i < this.files.length; i++) {
                    this.progress = `${i + 1}/${this.files.length}`
                    try {
                        const res = await callParseApprovalPdf(this.files[i].base64, this.kind)
                        for (const r of (res?.rows || [])) raw.push(r)
                    } catch (e) {
                        failed.push(`${this.files[i].name}: ${e.message || e}`)
                    }
                }
                // 整形＋PDF間の重複（同名・同重量）を除去
                const seen = new Set()
                const extracted = []
                for (const r of raw) {
                    const dk = norm(r.product_name) + '|' + sizeKey(r.package_size)
                    if (seen.has(dk)) continue
                    seen.add(dk)
                    extracted.push({
                        brand: r.brand || '',
                        product_name: r.product_name || '',
                        package_size: r.package_size || '',
                        origin_country: r.origin_country || '',
                        approval_date: r.approval_date || '',
                        price: r.price ?? null,
                        price_before: r.price_before ?? null,
                        price_after: r.price_after ?? null,
                        changed_on: r.changed_on || '',
                        item_id: null,
                        matchLabel: '',
                        exists: false,
                        _cands: []
                    })
                }
                if (extracted.length === 0) {
                    this.error = failed.length
                        ? ('抽出に失敗しました。' + failed.join(' / '))
                        : 'パイプたばこの行が見つかりませんでした。PDF の種別が正しいか確認してください。'
                    return
                }
                // 一部失敗があっても成功分でプレビューは進める（警告のみ表示）
                if (failed.length) this.error = `一部のPDFが失敗（${failed.length}件）: ` + failed.join(' / ')
                // 既存銘柄を全件ロードし、銘柄名（NFKC 正規化）でインデックス化してマッチング
                // ブランドの大小・granularity や容量の表記揺れに依存しない名前基準マッチ
                const all = await getApprovalItems({})
                const nameIndex = new Map()
                for (const it of all) {
                    const k = norm(it.product_name)
                    if (!nameIndex.has(k)) nameIndex.set(k, [])
                    nameIndex.get(k).push(it)
                }
                for (const row of extracted) {
                    const cands = nameIndex.get(norm(row.product_name)) || []
                    row._cands = cands
                    // 1) 名前＋重量(g)の一致を優先 → 2) 名前が一意なら容量差を無視して採用
                    let cand = cands.find(c => sizeKey(c.package_size) === sizeKey(row.package_size))
                    if (!cand && cands.length === 1) cand = cands[0]
                    if (cand) {
                        if (this.kind === 'change') {
                            row.item_id = cand.id
                            row.matchLabel = `${cand.product_name}（${cand.package_size || '-'}）`
                            if (row.price_before == null) row.price_before = cand.current_price
                        } else {
                            row.exists = true   // 新規だが既存と一致 → 重複
                        }
                    }
                }
                this.rows = extracted
            } catch (e) {
                this.error = e.message || String(e)
            } finally {
                this.parsing = false
                this.progress = ''
            }
        },
        async confirm() {
            this.confirming = true
            this.error = ''
            try {
                if (this.kind === 'new') {
                    const toAdd = this.rows.filter(r => !r.exists).map(r => ({
                        brand: r.brand,
                        product_name: r.product_name,
                        package_size: r.package_size,
                        origin_country: r.origin_country,
                        approval_date: r.approval_date || null,
                        current_price: r.price ?? null
                    }))
                    const n = await insertApprovalItems(toAdd)
                    this.resultMessage = `新規認可 ${n} 件を追加しました。`
                } else {
                    const changes = this.rows
                        .filter(r => r.item_id && r.price_after != null)
                        .map(r => ({
                            item_id: r.item_id,
                            price_before: r.price_before ?? null,
                            price_after: r.price_after,
                            changed_on: r.changed_on || null
                        }))
                    const n = await applyApprovalChanges(changes)
                    this.resultMessage = `変更認可 ${n} 件を反映しました（現行価格を更新し履歴を追加）。`
                }
                this.rows = []
                this.files = []
                if (this.$refs.fileInput) this.$refs.fileInput.value = ''
            } catch (e) {
                this.error = '反映に失敗しました: ' + (e.message || String(e))
            } finally {
                this.confirming = false
            }
        }
    }
}
</script>

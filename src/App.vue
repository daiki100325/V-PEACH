<template>
    <div id="app" class="min-h-[100dvh] flex flex-col">

        <!-- PIN認証オーバーレイ -->
        <PinAuth v-if="!authenticated" @authenticated="authenticated = true" />

        <!-- Header -->
        <AppHeader
            :appMode="appMode"
            @return-to-portal="returnToPortal"
        />

        <!-- Loading Overlay -->
        <LoadingOverlay :show="loading" :message="loadingMessage" />

        <!-- Portal Screen -->
        <main v-if="appMode === null" class="container mx-auto px-4 py-6 max-w-lg md:max-w-7xl flex-grow">
            <transition name="slide-up">
                <PortalMenu
                    @open-pl="openPLApp"
                    @open-input="openInputApp"
                    @open-settings="openSettingsApp"
                />
            </transition>
        </main>

        <!-- PL App -->
        <PLApp
            v-if="appMode === 'pl'"
            ref="plApp"
            :stores="stores"
            @update:loading="loading = $event"
            @update:loadingMessage="loadingMessage = $event"
        />

        <!-- 月次入力 App -->
        <InputApp
            v-if="appMode === 'input'"
            ref="inputApp"
            :stores="stores"
            @update:loading="loading = $event"
            @update:loadingMessage="loadingMessage = $event"
            @update:stepActive="inputStepActive = $event"
            @update:currentStep="inputStep = $event"
            @update:canNext="inputCanNext = $event"
            @update:isLastStep="inputIsLastStep = $event"
            @submitted="onInputSubmitted"
        />

        <!-- 設定 App -->
        <SettingsApp
            v-if="appMode === 'settings'"
            ref="settingsApp"
            :stores="stores"
            @update:loading="loading = $event"
            @update:loadingMessage="loadingMessage = $event"
        />

        <!-- Footer -->
        <AppFooter
            :appMode="appMode"
            :inputStepActive="inputStepActive"
            :canNext="inputCanNext"
            :isLastStep="inputIsLastStep"
            @prev-step="prevStep"
            @next-step="nextStep"
            @submit="submitInput"
        />

        <!-- Global Confirm Dialog -->
        <ConfirmDialog
            :visible="confirmDialog.visible"
            :message="confirmDialog.message"
            :okLabel="confirmDialog.okLabel"
            :okClass="confirmDialog.okClass"
            @ok="onConfirmDialogOk"
            @cancel="onConfirmDialogCancel"
        />

    </div>
</template>

<script>
import PinAuth from './components/common/PinAuth.vue'
import LoadingOverlay from './components/common/LoadingOverlay.vue'
import AppHeader from './components/common/AppHeader.vue'
import AppFooter from './components/common/AppFooter.vue'
import ConfirmDialog from './components/common/ConfirmDialog.vue'
import PortalMenu from './components/PortalMenu.vue'
import PLApp from './components/apps/PLApp.vue'
import InputApp from './components/apps/InputApp.vue'
import SettingsApp from './components/apps/SettingsApp.vue'

export default {
    name: 'App',
    components: {
        PinAuth, LoadingOverlay, AppHeader, AppFooter, ConfirmDialog,
        PortalMenu, PLApp, InputApp, SettingsApp
    },
    provide() {
        return {
            requestConfirm: (msg, okLabel, okClass) => this.appConfirm(msg, okLabel, okClass)
        }
    },
    data() {
        return {
            authenticated: false,
            appMode: null,
            loading: false,
            loadingMessage: '',
            stores: [
                { key: 'baba', name: '馬場本店' },
                { key: 'nakano', name: '中野店' },
                { key: 'baba_2nd', name: '馬場2号店' }
            ],
            // PL App
            plStepActive: false,
            // Input App
            inputStepActive: false,
            inputStep: 0,
            inputCanNext: false,
            inputIsLastStep: false,
            // Global confirm dialog
            confirmDialog: {
                visible: false, message: '', okLabel: 'OK',
                okClass: 'text-brand-600 hover:bg-brand-50', resolve: null
            }
        }
    },
    created() {
        history.replaceState({ appMode: null }, '')
    },
    mounted() {
        window.addEventListener('popstate', this.handlePopState)
    },
    beforeUnmount() {
        window.removeEventListener('popstate', this.handlePopState)
    },
    methods: {
        // ─── Global confirm dialog ─────────────────────────────────────────
        appConfirm(message, okLabel = 'OK', okClass = 'text-brand-600 hover:bg-brand-50') {
            return new Promise((resolve) => {
                this.confirmDialog = { visible: true, message, okLabel, okClass, resolve }
            })
        },
        onConfirmDialogOk() {
            const { resolve } = this.confirmDialog
            this.confirmDialog = { visible: false, message: '', okLabel: 'OK', okClass: 'text-brand-600 hover:bg-brand-50', resolve: null }
            if (resolve) resolve(true)
        },
        onConfirmDialogCancel() {
            const { resolve } = this.confirmDialog
            this.confirmDialog = { visible: false, message: '', okLabel: 'OK', okClass: 'text-brand-600 hover:bg-brand-50', resolve: null }
            if (resolve) resolve(false)
        },
        // ─── Navigation ───────────────────────────────────────────────────
        pushHistoryState() {
            history.pushState({ appMode: this.appMode }, '')
        },
        handlePopState() {
            history.pushState({ appMode: this.appMode }, '')
            if (this.inputStepActive) {
                this.prevStep()
            } else if (this.appMode !== null) {
                this.returnToPortal()
            }
        },
        openPLApp() {
            this.appMode = 'pl'
            this.plStepActive = false
            this.pushHistoryState()
        },
        openInputApp() {
            this.appMode = 'input'
            this.inputStepActive = false
            this.inputStep = 0
            this.pushHistoryState()
        },
        openSettingsApp() {
            this.appMode = 'settings'
            this.pushHistoryState()
        },
        async returnToPortal() {
            if (this.appMode === 'input' && this.inputStepActive) {
                const ok = await this.appConfirm(
                    '入力途中のデータがあります。ポータルに戻りますか？',
                    'ポータルへ',
                    'text-red-600 hover:bg-red-50'
                )
                if (!ok) return
            }
            this.appMode = null
            this.inputStepActive = false
            this.inputStep = 0
            this.pushHistoryState()
        },
        // ─── Footer actions ───────────────────────────────────────────────
        prevStep() {
            if (this.appMode === 'input' && this.$refs.inputApp) {
                this.$refs.inputApp.prevStep()
            }
        },
        nextStep() {
            if (this.appMode === 'input' && this.$refs.inputApp) {
                this.$refs.inputApp.nextStep()
            }
        },
        submitInput() {
            if (this.$refs.inputApp) this.$refs.inputApp.submit()
        },
        onInputSubmitted() {
            this.inputStepActive = false
            this.inputStep = 0
        }
    }
}
</script>

<style>
body {
    font-family: 'Noto Sans JP', sans-serif;
    background-color: #f8fafc;
    color: #1e293b;
    -webkit-font-smoothing: antialiased;
}
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active { transition: transform 0.3s ease-out, opacity 0.3s ease-out; }
.slide-up-enter-from { transform: translateY(20px); opacity: 0; }
</style>

<template>
    <input
        ref="inputEl"
        type="text"
        inputmode="numeric"
        :value="displayValue"
        @focus="onFocus"
        @blur="onBlur"
        @input="onInput"
    />
</template>

<script>
export default {
    name: 'CurrencyInput',
    props: {
        modelValue: { type: Number, default: null },
    },
    emits: ['update:modelValue'],
    data() {
        return { focused: false }
    },
    computed: {
        displayValue() {
            if (this.focused) {
                return this.modelValue != null ? String(this.modelValue) : ''
            }
            if (this.modelValue == null || this.modelValue === '') return ''
            return Math.round(this.modelValue).toLocaleString('ja-JP')
        }
    },
    methods: {
        onFocus() {
            this.focused = true
            this.$nextTick(() => this.$refs.inputEl?.select())
        },
        onBlur(e) {
            const raw = e.target.value.replace(/[^\d]/g, '')
            const val = raw === '' ? null : Number(raw)
            this.$emit('update:modelValue', isNaN(val) ? null : val)
            this.focused = false
        },
        onInput(e) {
            const raw = e.target.value.replace(/[^\d]/g, '')
            const val = raw === '' ? null : Number(raw)
            this.$emit('update:modelValue', val)
        }
    }
}
</script>

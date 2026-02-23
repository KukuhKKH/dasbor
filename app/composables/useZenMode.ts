import { useStorage } from '@vueuse/core'

export function useZenMode() {
    const isZenMode = useStorage('dashboard-zen-mode', false)

    function toggleZenMode() {
        isZenMode.value = !isZenMode.value
    }

    return {
        isZenMode,
        toggleZenMode
    }
}

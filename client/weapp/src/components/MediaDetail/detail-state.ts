import { ref } from 'wevu'

export function createMediaDetailState() {
  const expandedSeasons = ref<number[]>([])
  const operationLoading = ref(false)
  const localVisible = ref(false)
  const scrollTop = ref(0)

  return {
    expandedSeasons,
    operationLoading,
    localVisible,
    scrollTop,
  }
}

export function resetMediaDetailState(state: ReturnType<typeof createMediaDetailState>) {
  state.expandedSeasons.value = []
  state.operationLoading.value = false
  state.scrollTop.value = 0
}

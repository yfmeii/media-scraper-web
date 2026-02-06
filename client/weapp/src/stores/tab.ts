import { defineStore, ref } from 'wevu'

export const useTabStore = defineStore('tab', () => {
  const activeIndex = ref(0)

  function setActive(index: number) {
    activeIndex.value = index
  }

  return { activeIndex, setActive }
})

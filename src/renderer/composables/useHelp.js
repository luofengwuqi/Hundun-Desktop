import { inject } from 'vue'

// 帮助页是「全局主机」：App.vue 顶层挂一个 HelpView，并把 openHelp 提供出来。
// 任何层级的组件只要 useHelp() 就能打开，不必自己渲染覆盖层、也不必管 z-index。
export const HELP_PROVIDE_KEY = Symbol('hundun-help')

export function useHelp () {
  const provided = inject(HELP_PROVIDE_KEY, null)
  const openHelp = (topicId) => {
    if (typeof provided === 'function') {
      provided(topicId)
    } else {
      console.warn('[Help] openHelp called without a HelpHost:', topicId)
    }
  }
  return { openHelp }
}

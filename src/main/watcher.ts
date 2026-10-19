import { watch, type FSWatcher } from 'chokidar'
import { ROOTS } from './paths'

/** Watch the editable skill roots and call onChange (debounced) when anything changes. */
export function watchRoots(onChange: () => void): FSWatcher {
  let timer: NodeJS.Timeout | undefined
  const fire = (): void => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 400)
  }
  const watcher = watch([ROOTS.claude, ROOTS.agents], {
    ignoreInitial: true,
    followSymlinks: false,
    depth: 3,
    ignored: (p: string) => /[\\/](node_modules|\.git)([\\/]|$)/.test(p)
  })
  watcher.on('all', fire)
  return watcher
}

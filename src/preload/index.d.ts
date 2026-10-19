import type { SkillsApi } from '../shared/types'

declare global {
  interface Window {
    api: SkillsApi
  }
}

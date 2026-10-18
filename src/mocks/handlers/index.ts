import { orderHandlers } from './orders'
import { appSettingHandlers } from './appSettings'

export const handlers = [
  ...orderHandlers,
  ...appSettingHandlers,
]

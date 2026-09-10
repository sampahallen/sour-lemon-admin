import { deliveryAreaHandlers } from './deliveryAreas'
import { orderHandlers } from './orders'
import { appSettingHandlers } from './appSettings'

export const handlers = [
  ...deliveryAreaHandlers,
  ...orderHandlers,
  ...appSettingHandlers,
]

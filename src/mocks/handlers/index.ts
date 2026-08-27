import { deliveryAreaHandlers } from './deliveryAreas'
import { orderHandlers } from './orders'
import { siteSectionHandlers } from './siteSections'
import { appSettingHandlers } from './appSettings'

export const handlers = [
  ...deliveryAreaHandlers,
  ...orderHandlers,
  ...siteSectionHandlers,
  ...appSettingHandlers,
]

export {
  deleteBoard,
  getAttributionRows,
  getGaConsultations,
  getCustomer,
  getDailyInflow,
  getDailyRepeatRevenue,
  getDailySales,
  getFollowUps,
  getKpiFacts,
  listBoards,
  listCustomerSummaries,
  listMissingPhoneItems,
  listPaymentIssues,
} from './firestore'
export {
  previewBoard,
  rebuildCustomers,
  rebuildCustomersSafely,
  registerBoard,
  syncBoards,
} from './sync'
export type {
  MondayBoard,
  MondayCustomer,
  MondayItem,
  MondaySyncSummary,
} from './types'

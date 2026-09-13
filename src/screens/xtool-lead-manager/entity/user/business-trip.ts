/***************************************** *
 ********************* 출장업무 2026 보드 *****
 ***************************************** */

import type { Timestamp } from "./common"


export interface BusinessTrip {
  itemId: string
  createdAt: Timestamp
  // 상태
  state: string
}
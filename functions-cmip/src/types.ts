/**
 * 여러 모듈이 같이 쓰는 타입.
 */

export type ValidationResponse<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
    }

export type ISODate = string

// oauth Callback - google ads
export interface OauthCallbackQuery {
  code?: string
  state?: string
  error?: string
  error_description?: string
}

export interface OauthCallbackResult {
  success: boolean
  brandId: string
  message: string
}

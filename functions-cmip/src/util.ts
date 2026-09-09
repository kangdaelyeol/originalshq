import { ValidationResponse } from './types'

export const validateGetInsightBody = (
  body: Record<string, unknown>,
): ValidationResponse<{ dateStart: string; dateEnd: string }> => {
  const { dateStart, dateEnd } = body
  if (typeof dateStart !== 'string' || typeof dateEnd !== 'string'){
    return {ok:false, error: '[validateGetInsightBody] Error - 입력 날짜 타입 에러'}
  }
    return {
      ok: true,
      data: {
        dateStart,
        dateEnd,
      },
    }
}

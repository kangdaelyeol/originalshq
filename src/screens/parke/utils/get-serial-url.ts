import { PARKE_URL } from '../constants'

export const getSerialUrl = (serial: string): string => {
  return PARKE_URL + '/' + serial
}

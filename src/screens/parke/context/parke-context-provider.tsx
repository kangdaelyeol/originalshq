import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { SERIALS_PER_PAGE } from '../constants'
import {
  createSerial,
  deleteSerial,
  restoreDeletion,
  subscribeSerials,
} from '../client/card-client'
import { ParkeContext, type ParkeToast } from './parke-context'

/** 검색어를 비교용으로 다듬는다 — 앞뒤 공백을 빼고 소문자로. QR 주소를
 * 통째로 붙여 넣어도 찾을 수 있게 마지막 "/" 뒤(시리얼)만 쓴다. */
const normalizeQuery = (value: string) =>
  value.trim().split('/').filter(Boolean).pop()?.toLowerCase() ?? ''

const errorText = (error: unknown) => {
  const code = (error as { code?: string }).code
  if (code === 'PERMISSION_DENIED' || /permission/i.test(String(error))) {
    return '권한이 없습니다(관리자 목록과 DB 보안 규칙을 확인해 주세요)'
  }
  return error instanceof Error ? error.message : String(error)
}

// 되돌리기 토스트는 읽고 누를 시간을 넉넉히 준다.
const TOAST_MS = { success: 4000, error: 6000, action: 8000 }

let nextToastId = 1

export const ParkeContextProvider = ({
  adminEmail,
  children,
}: PropsWithChildren<{ adminEmail: string }>) => {
  const [serialData, setSerialData] = useState<string[]>([])
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [page, setPage] = useState(0)
  const [searchValue, setSearchValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toasts, setToasts] = useState<ParkeToast[]>([])
  // 방금 만든 시리얼 — 목록에 들어오면 그 쪽으로 이동한다.
  const [focusSerial, setFocusSerial] = useState<string | null>(null)
  const toastTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  // DB의 allow/ 를 실시간으로 받는다 — 다른 관리자가 만들거나 지운 것도 바로 보인다.
  useEffect(
    () =>
      subscribeSerials(
        (serials) => {
          setSerialData(serials)
          setListStatus('ready')
        },
        () => setListStatus('error'),
      ),
    [],
  )

  useEffect(() => {
    const timers = toastTimers.current
    return () => timers.forEach((timer) => clearTimeout(timer))
  }, [])

  const dismissToast = useCallback((id: number) => {
    clearTimeout(toastTimers.current.get(id))
    toastTimers.current.delete(id)
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (toast: Omit<ParkeToast, 'id'>) => {
      const id = nextToastId++
      setToasts((prev) => [...prev, { ...toast, id }])
      const ms = toast.action ? TOAST_MS.action : TOAST_MS[toast.tone]
      toastTimers.current.set(
        id,
        setTimeout(() => dismissToast(id), ms),
      )
    },
    [dismissToast],
  )

  // 검색어가 들어 있는 시리얼만(대소문자 무시). 쪽 나누기는 이 결과 기준.
  const query = normalizeQuery(searchValue)
  const filteredSerials = query
    ? serialData.filter((serial) => serial.toLowerCase().includes(query))
    : serialData

  // 방금 만든 시리얼이 목록에 들어오면 그 시리얼이 있는 쪽으로 간다(렌더 중
  // 한 번만 — 이펙트로 하면 렌더가 한 번 더 돈다).
  if (focusSerial && filteredSerials.includes(focusSerial)) {
    setFocusSerial(null)
    setPage(Math.floor(filteredSerials.indexOf(focusSerial) / SERIALS_PER_PAGE))
  }

  // 목록이 줄어(삭제·검색) 지금 쪽이 범위를 벗어나면 마지막 쪽으로 당긴다.
  const pageCount = Math.max(
    1,
    Math.ceil(filteredSerials.length / SERIALS_PER_PAGE),
  )
  const currentPage = Math.min(page, pageCount - 1)
  const pagedSerials = filteredSerials.slice(
    currentPage * SERIALS_PER_PAGE,
    (currentPage + 1) * SERIALS_PER_PAGE,
  )

  const changeSearch = (value: string) => {
    setSearchValue(value)
    // 검색 결과는 처음부터 보여준다.
    setPage(0)
  }

  const addSerial = async (serial: string) => {
    try {
      await createSerial(serial)
      // 검색 중이면 새 시리얼이 결과에 없을 수 있어 검색을 풀고, 목록에
      // 들어오면 그 쪽으로 간다.
      setSearchValue('')
      setFocusSerial(serial)
      return true
    } catch (error) {
      showToast({
        tone: 'error',
        message: `생성하지 못했습니다: ${errorText(error)}`,
      })
      return false
    }
  }

  const restore = useCallback(
    async (logId: string, serial: string) => {
      try {
        await restoreDeletion(logId, adminEmail)
        showToast({ tone: 'success', message: `${serial}을(를) 되돌렸습니다` })
      } catch (error) {
        showToast({
          tone: 'error',
          message: `되돌리지 못했습니다: ${errorText(error)}`,
        })
      }
    },
    [adminEmail, showToast],
  )

  const confirmDelete = async () => {
    const serial = pendingDelete
    if (!serial) return
    setDeleting(true)
    try {
      const logId = await deleteSerial(serial, adminEmail)
      setPendingDelete(null)
      showToast({
        tone: 'success',
        message: `${serial}을(를) 삭제했습니다`,
        action: { label: '되돌리기', run: () => void restore(logId, serial) },
      })
    } catch (error) {
      showToast({
        tone: 'error',
        message: `삭제하지 못했습니다: ${errorText(error)}`,
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ParkeContext.Provider
      value={{
        adminEmail,
        listStatus,
        serialList: serialData,
        filteredSerials,
        pagedSerials,
        page: currentPage,
        pageCount,
        setPage,
        searchValue,
        changeSearch,
        addSerial,
        removeSerial: setPendingDelete,
        pendingDelete,
        confirmDelete,
        cancelDelete: () => setPendingDelete(null),
        deleting,
        restore,
        toasts,
        dismissToast,
      }}
    >
      {children}
    </ParkeContext.Provider>
  )
}

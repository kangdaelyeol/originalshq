export type ToastType = 'registered' | 'deleted' | 'updated' | 'error' | 'partial'

interface ToasterMessageProps {
  type: ToastType
}

const MESSAGE_MAP: Record<ToastType, string> = {
  registered: '등록완료',
  deleted: '삭제완료',
  updated: '수정완료',
  error: '에러발생',
  // 고객 정보 등록 + 상담 등록(Meta CAPI 포함)을 한 번에 시도하는 흐름에서,
  // 고객 정보는 만들어졌는데 상담 등록만 실패한 경우 — 'error'로 뭉뚱그리면
  // "아무것도 안 됐다"고 오해해 같은 고객을 중복 등록할 수 있어 구분해둔다.
  partial: '고객 등록됨(상담 등록 실패)',
}

const COLOR_MAP: Record<ToastType, string> = {
  registered: '#3b82f6',
  deleted: '#ef4444',
  updated: '#22c55e',
  error: '#fb0404',
  partial: '#f59e0b',
}

export const ToasterMessage = ({ type }: ToasterMessageProps) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        borderRadius: 8,
        backgroundColor: '#181819',
        color: '#fff',
        fontSize: 18,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: COLOR_MAP[type],
          flexShrink: 0,
        }}
      />
      {MESSAGE_MAP[type]}
    </div>
  )
}

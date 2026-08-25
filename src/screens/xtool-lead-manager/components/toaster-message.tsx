export type ToastType = 'registered' | 'deleted' | 'updated' | 'error'

interface ToasterMessageProps {
  type: ToastType
}

const MESSAGE_MAP: Record<ToastType, string> = {
  registered: '등록완료',
  deleted: '삭제완료',
  updated: '수정완료',
  error: '에러발생',
}

const COLOR_MAP: Record<ToastType, string> = {
  registered: '#3b82f6',
  deleted: '#ef4444',
  updated: '#22c55e',
  error: '#fb0404',
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

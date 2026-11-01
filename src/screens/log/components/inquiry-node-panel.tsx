import {
  INQUIRY_DEVICES,
  type Inquiry,
  type InquiryStepStatus,
} from '../client/inquiry-client'
import { formatDateTime } from '../utils/batch-run'
import { ACCESS_DEVICE_LABEL, accessDevice } from '../utils/user-agent'
import {
  PanelBars,
  PanelCell,
  PanelList,
  PanelStats,
  PanelTitle,
  SidePanel,
  type PanelTone,
} from './side-panel'

/** 노드마다 패널에 쓰는 이름·설명. */
const NODE_INFO: Record<string, { title: string; tag: string; desc: string }> =
  {
    form: {
      title: '웹사이트 폼',
      tag: 'source',
      desc: '홈페이지 상담 신청 폼에서 들어온 신청 — 어디서 왔고 어떤 기기로 냈는지.',
    },
    fn: {
      title: 'submitInquiry',
      tag: 'xtool',
      desc: '신청을 받아 Monday 보드에 등록하고 접수 안내 문자를 보내는 함수.',
    },
    monday: {
      title: 'Monday 등록',
      tag: 'monday',
      desc: '신청이 기기별 Monday 보드에 아이템으로 들어갔는지 — 미등록 건은 다시 등록할 수 있습니다.',
    },
    sms: {
      title: '접수 안내 문자',
      tag: 'solapi',
      desc: '신청자 번호로 보낸 접수 안내 문자 — 실패 건은 다시 보낼 수 있습니다.',
    },
    phone: {
      title: '고객 휴대폰',
      tag: 'solapi',
      desc: '문자를 받은 신청자.',
    },
  }

const deviceLabel = (device: string) =>
  INQUIRY_DEVICES.find((each) => each.device === device)?.label ?? device

const STEP_MARK: Record<InquiryStepStatus, string> = {
  success: '✓',
  failed: '✕',
  pending: '…',
  skipped: '–',
}

/** 많은 순 막대 줄로 — 값이 비면 대신 쓸 이름. */
const countBy = (
  list: Inquiry[],
  keyOf: (inquiry: Inquiry) => string,
  limit = 6,
) => {
  const counts = new Map<string, number>()
  for (const each of list) {
    const key = keyOf(each)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => ({
      key: name,
      name,
      value,
      text: `${value}건`,
    }))
}

/**
 * 문의 접수 흐름 그림의 노드 상세 — 오른쪽 패널. 기기 보드 노드는 그 보드로
 * 들어온 신청만, 그 밖의 노드는 기간의 신청 전부를 그 노드의 눈으로 본다
 * (Monday는 등록, 문자는 발송 결과). 아래 목록의 줄을 누르면 표에서 그 신청이
 * 펼쳐진다.
 */
export const InquiryNodePanel = ({
  open,
  nodeId,
  nodeIds,
  inquiries,
  onSelect,
  onOpenInquiry,
  onClose,
}: {
  open: boolean
  nodeId: string
  /** 그림의 노드 순서 — ←/→로 옮길 때. */
  nodeIds: string[]
  inquiries: Inquiry[]
  onSelect: (nodeId: string) => void
  onOpenInquiry: (inquiry: Inquiry) => void
  onClose: () => void
}) => {
  const device = nodeId.startsWith('board:') ? nodeId.slice(6) : null
  const list = device
    ? inquiries.filter((each) => each.device === device)
    : inquiries
  const mondayFailed = list.filter((each) => each.monday.status !== 'success')
  const smsFailed = list.filter((each) => each.sms.status === 'failed')
  const smsSkipped = list.filter((each) => each.sms.status === 'skipped')
  const smsOk = list.filter((each) => each.sms.status === 'success')
  const info = device
    ? {
        title: deviceLabel(device),
        tag: 'board',
        desc: '이 기기 보드로 들어온 신청 — 아래 표도 이 보드만 보여 줍니다.',
      }
    : (NODE_INFO[nodeId] ?? { title: nodeId, tag: '', desc: '' })
  const smsView = nodeId === 'sms' || nodeId === 'phone'
  const tone: PanelTone =
    nodeId === 'monday'
      ? mondayFailed.length > 0
        ? 'failed'
        : 'success'
      : smsView
        ? smsFailed.length > 0
          ? 'failed'
          : 'success'
        : 'accent'
  // 목록 — Monday·문자 노드는 문제 건을 먼저, 그 밖은 최근 신청.
  const recent = (
    nodeId === 'monday' && mondayFailed.length > 0
      ? mondayFailed
      : smsView && smsFailed.length > 0
        ? smsFailed
        : list
  ).slice(0, 10)
  const index = nodeIds.indexOf(nodeId)

  return (
    <SidePanel
      open={open}
      tone={tone}
      heading={`NODE ${String(index + 1).padStart(2, '0')}/${String(nodeIds.length).padStart(2, '0')}`}
      idLine={device ? `board · ${device}` : nodeId}
      contentKey={nodeId}
      label={`${info.title} 상세`}
      onClose={onClose}
      onStep={(step) =>
        onSelect(nodeIds[(index + step + nodeIds.length) % nodeIds.length])
      }
    >
      <PanelTitle title={info.title} tag={info.tag} desc={info.desc} />

      <PanelCell title="SUMMARY" index={1}>
        <PanelStats
          items={[
            { label: '상담 신청', value: `${list.length}건` },
            {
              label: 'Monday 등록',
              value: `${list.length - mondayFailed.length}건`,
            },
            {
              label: 'Monday 미등록',
              value: `${mondayFailed.length}건`,
              tone: mondayFailed.length ? 'fail' : undefined,
            },
            { label: '문자 발송', value: `${smsOk.length}건` },
            {
              label: '문자 실패',
              value: `${smsFailed.length}건`,
              tone: smsFailed.length ? 'fail' : undefined,
            },
            { label: '문자 건너뜀', value: `${smsSkipped.length}건` },
          ]}
        />
      </PanelCell>

      {nodeId === 'monday' ? (
        <PanelCell title="BOARDS" index={2}>
          <PanelBars
            rows={countBy(list, (each) => each.device, 10).map((row) => ({
              ...row,
              key: `board:${row.key}`,
              name: deviceLabel(row.name),
            }))}
            empty="들어온 신청이 없습니다."
            onPick={onSelect}
          />
        </PanelCell>
      ) : smsView ? (
        <PanelCell title="RESULT" index={2}>
          <PanelBars
            rows={countBy(list, (each) => each.sms.status).map((row) => ({
              ...row,
              name: `${STEP_MARK[row.key as InquiryStepStatus]} ${row.key}`,
            }))}
            empty="보낸 문자가 없습니다."
          />
        </PanelCell>
      ) : (
        <>
          <PanelCell title="SOURCES" index={2}>
            <PanelBars
              rows={countBy(
                list,
                (each) =>
                  [each.utmSource, each.utmMedium]
                    .filter(Boolean)
                    .join(' / ') || '(직접)',
              )}
              empty="들어온 신청이 없습니다."
            />
          </PanelCell>
          <PanelCell title="ACCESS" index={3}>
            <PanelBars
              rows={countBy(
                list,
                (each) => ACCESS_DEVICE_LABEL[accessDevice(each.userAgent)],
              )}
              empty="들어온 신청이 없습니다."
            />
          </PanelCell>
        </>
      )}

      <PanelCell
        title={
          nodeId === 'monday' && mondayFailed.length > 0
            ? 'NOT REGISTERED'
            : smsView && smsFailed.length > 0
              ? 'FAILED'
              : 'RECENT'
        }
        index={4}
      >
        <PanelList
          items={recent.map((each) => ({
            key: each.id,
            title: each.company
              ? `${each.company} · ${each.name || '-'}`
              : each.name || each.phoneFormatted,
            meta: `${formatDateTime(each.receivedAt)} · ${deviceLabel(each.device)}`,
            side: `M${STEP_MARK[each.monday.status]} S${STEP_MARK[each.sms.status]}`,
            onOpen: () => onOpenInquiry(each),
          }))}
          empty="해당하는 신청이 없습니다."
        />
      </PanelCell>
    </SidePanel>
  )
}

import { Linking } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { mondayDate, visibleColumns } from '@xtool-core/monday-values';
import type { TechBoardKey, TechBoardMeta, TechItemDoc } from '@xtool-core/tech-boards';
import { timelineSteps, type TimelineStep } from '@xtool-core/tech-timeline';
import { elapsedSeconds, formatDuration, timeTracking, useTickingNow } from '@xtool-core/time-tracking';
import type { DetailSpec } from '../../../features/dashboard/boards';
import { useItemFiles } from '../../../features/dashboard/item-files';
import { useParts } from '../parts';

// 상세 "정보" — 웹 RecordDrawer 본문: 이름/값 목록(연락처는 전화, 교체 영상은 열기), 긴 글(빈 것은 뺀다), 작은 목록
// (설치 품목·청구 부품), 타임라인(단계별 날짜 — 웹 상세와 같은 tech-timeline), 파일(사진은 썸네일 — 누르면 기기의
// 기본 보기로 연다). 칸·순서는 보드 정의가 정한다.

export function DetailBody({
  detail,
  meta,
  item,
}: {
  detail: DetailSpec;
  meta: TechBoardMeta | null;
  item: TechItemDoc | null;
}) {
  const P = useParts();
  return (
    <>
      <P.DetailFields
        fields={detail.fields.map(field => ({
          key: field.key,
          label: field.label,
          value: field.value,
          content: field.phone ? (
            <P.PhoneLink phone={field.phone} action={field.phoneAction} />
          ) : field.link ? (
            <P.Button
              variant="plain"
              size="sm"
              icon={ExternalLink}
              label={field.link.label}
              onPress={() => {
                if (field.link) Linking.openURL(field.link.url).catch(() => undefined);
              }}
            />
          ) : undefined,
        }))}
      />
      {detail.texts.map(t => (t.text ? <P.DetailText key={t.label} label={t.label} text={t.text} /> : null))}
      {detail.lists.map(list => (
        <P.DetailList key={list.key} title={list.title} items={list.items} />
      ))}
      {meta && item && <TimelineList meta={meta} item={item} />}
      <ItemFiles meta={meta} item={item} />
    </>
  );
}

/** 단계 값 글자 — 날짜는 Monday 날짜, 시간 추적은 지금까지 쌓인 시간, 비었으면 — */
function stepText(step: TimelineStep, now: number): string {
  if (!step.filled) return '—';
  if (step.column.type !== 'time_tracking') return mondayDate(step.cell?.text ?? '');
  const t = timeTracking(step.cell);
  if (!t) return step.cell?.text?.trim() || '—';
  return `${formatDuration(elapsedSeconds(t, now))}${t.running ? ' · 진행 중' : ''}`;
}

/** 타임라인(웹 상세 "타임라인" 구역) — 타임라인 목록이 있는 보드만. 시간 추적이 켜져 있으면 1초마다 다시 그린다 */
function TimelineList({ meta, item }: { meta: TechBoardMeta; item: TechItemDoc }) {
  const P = useParts();
  const steps = timelineSteps(meta.key as TechBoardKey, visibleColumns(meta), item);
  const running = steps.some(s => s.column.type === 'time_tracking' && timeTracking(s.cell)?.running);
  const now = useTickingNow(running);
  if (steps.length === 0) return null;
  return (
    <P.DetailList
      title="타임라인"
      items={steps.map(step => ({ key: step.column.id, label: step.column.title, meta: stepText(step, now) }))}
    />
  );
}

/** 파일 칸(웹 ItemFiles) — 파일 칸이 있는 보드만. 올리기·지우기는 웹에서 */
function ItemFiles({ meta, item }: { meta: TechBoardMeta | null; item: TechItemDoc | null }) {
  const P = useParts();
  const files = useItemFiles(meta, item);
  if (!files.hasFileColumns) return null;
  return (
    <>
      <P.FileList
        title={files.files.length ? `파일 ${files.files.length}` : '파일'}
        files={files.files}
        empty="올린 파일이 없어요."
        onPressFile={files.open}
      />
      {files.loading && <P.Notice loading text="파일 주소를 받는 중…" />}
      {files.error && (
        <P.Notice
          tone="error"
          text={`파일을 열 주소를 받지 못했어요 — ${files.error}`}
          action={{ label: '다시 시도', onPress: files.retry }}
        />
      )}
    </>
  );
}

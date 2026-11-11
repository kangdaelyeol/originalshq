import type { ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { CalendarDays, Check, FileText, MapPin, Phone, Timer } from 'lucide-react-native';
import { fileCount, isChecked, mondayDate, parseJson, splitNames, splitText } from '@xtool-core/monday-values';
import { formatPhone } from '@xtool-core/tech-stage';
import { isPhoneColumn } from '@xtool-core/tech-edit';
import { elapsedSeconds, formatDuration, hasTime, timeTracking, useTickingNow } from '@xtool-core/time-tracking';
import type { TechCellValue, TechColumn } from '@xtool-core/tech-boards';
import { callPhone, dialNumber } from '../../../features/phone-call';
import { STATE } from '../theme';
import { useMon } from '../theme-context';
import { AvatarStack, Chip, MText, StatusBlock } from './basics';

// 칸 값 그리기 — 웹 monday-cells.tsx의 칸 종류별 모양을 카드(card: 한 줄 미니 칸)와 정보 목록(full)에 맞게 옮겼다.

export type CellMode = 'card' | 'full';

const PEOPLE_TYPES = new Set(['people', 'assignee']);
const CHIP_TYPES = new Set(['dropdown', 'board_relation']);

/** 칸에 값이 있는지 — 카드에 빈 칸을 늘어놓지 않으려고 */
export const hasValue = (column: TechColumn, cell: TechCellValue | undefined): boolean => {
  if (column.type === 'checkbox') return isChecked(cell);
  if (column.type === 'file') return fileCount(cell) > 0;
  if (column.type === 'time_tracking') return hasTime(timeTracking(cell)) || Boolean(cell?.text?.trim());
  return Boolean(cell?.text?.trim());
};

const linkOf = (cell: TechCellValue | undefined): string | null => {
  const url = parseJson(cell?.value)?.url;
  return typeof url === 'string' && url ? url : null;
};

export function CellValue({
  column,
  cell,
  mode,
  callable,
}: {
  column: TechColumn;
  cell: TechCellValue | undefined;
  mode: CellMode;
  /** 전화 칸을 눌러 전화 걸 수 있게 — 정보 목록(full)은 늘, 카드는 화면이 넘긴다(고르는 중이면 false) */
  callable?: boolean;
}) {
  const p = useMon();
  const text = cell?.text?.trim() ?? '';
  const full = mode === 'full';

  if (column.type === 'status') {
    return full ? (
      <StatusBlock label={text} height={34} minWidth={0} fontSize={14} stretch />
    ) : (
      <StatusBlock label={text} />
    );
  }

  if (PEOPLE_TYPES.has(column.type)) {
    const names = splitNames(text);
    if (!full) return <AvatarStack names={names} />;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <AvatarStack names={names} />
        <MText style={{ flexShrink: 1 }}>{names.length ? names.join(', ') : '—'}</MText>
      </View>
    );
  }

  if (CHIP_TYPES.has(column.type)) {
    const labels = splitText(text);
    if (labels.length === 0) return <Empty />;
    return (
      <View style={{ flexDirection: 'row', flexWrap: full ? 'wrap' : 'nowrap', gap: 4 }}>
        {(full ? labels : labels.slice(0, 2)).map((label, i) => (
          <Chip key={`${label}-${i}`} label={label} />
        ))}
      </View>
    );
  }

  if (column.type === 'checkbox') {
    return (
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 3,
          borderWidth: 1,
          borderColor: p.control,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isChecked(cell) && <Check size={13} strokeWidth={3} color={STATE.good} />}
      </View>
    );
  }

  if (column.type === 'file') {
    const count = fileCount(cell);
    if (!count) return <Empty />;
    return (
      <Row>
        <FileText size={14} color={p.text2} />
        <MText color={p.text2}>{count}</MText>
      </Row>
    );
  }

  if (!text) return <Empty />;

  if (column.type === 'date') {
    return (
      <Row>
        {!full && <CalendarDays size={13} color={p.text2} />}
        <MText size={full ? 14 : 13}>{mondayDate(text)}</MText>
      </Row>
    );
  }

  if (column.type === 'phone' || isPhoneColumn(column)) {
    const phone = formatPhone(text) ?? text;
    // 번호가 둘 적힌 칸도 있어서 첫 번호만 건다(phone-call)
    const canCall = (callable ?? full) && !!dialNumber(text);
    return (
      <Pressable
        disabled={!canCall}
        onPress={() => callPhone(text)}
        hitSlop={6}
        accessibilityRole={canCall ? 'button' : undefined}
        accessibilityLabel={canCall ? `${phone}로 전화` : undefined}
      >
        <Row>
          <Phone size={13} color={canCall ? p.link : p.text2} />
          <MText size={full ? 14 : 13} color={canCall ? p.link : p.text}>
            {phone}
          </MText>
        </Row>
      </Pressable>
    );
  }

  if (column.type === 'link') {
    const url = linkOf(cell);
    return (
      <Pressable disabled={!url} onPress={() => url && Linking.openURL(url)} hitSlop={6}>
        <MText color={p.link} numberOfLines={full ? undefined : 1}>
          {text}
        </MText>
      </Pressable>
    );
  }

  if (column.type === 'time_tracking') return <TimeTrackingValue cell={cell} full={full} />;

  if (column.type === 'location') {
    return (
      <Row>
        <MapPin size={13} color={p.text2} />
        <MText size={full ? 14 : 13} numberOfLines={full ? undefined : 1} style={{ flexShrink: 1 }}>
          {text}
        </MText>
      </Row>
    );
  }

  return (
    <MText size={full ? 14 : 13} numberOfLines={full ? undefined : 1} style={full ? { lineHeight: 21 } : undefined}>
      {text}
    </MText>
  );
}

/** 시간 추적(타이머) — 켜져 있으면 1초마다 올라간다(값은 Monday에서 켜고 끌 때만 바뀐다 — core time-tracking) */
function TimeTrackingValue({ cell, full }: { cell: TechCellValue | undefined; full: boolean }) {
  const p = useMon();
  const t = timeTracking(cell);
  const now = useTickingNow(!!t?.running);
  if (!t) return <MText size={full ? 14 : 13}>{cell?.text?.trim() || '—'}</MText>;
  return (
    <Row>
      <Timer size={13} color={t.running ? p.link : p.text2} />
      <MText size={full ? 14 : 13} style={{ fontVariant: ['tabular-nums'] }}>
        {formatDuration(elapsedSeconds(t, now))}
        {t.running ? ' · 진행 중' : ''}
      </MText>
    </Row>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>{children}</View>;
}

function Empty() {
  const p = useMon();
  return <MText color={p.text4}>—</MText>;
}

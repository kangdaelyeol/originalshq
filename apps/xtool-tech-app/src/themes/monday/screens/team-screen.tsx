import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Users } from 'lucide-react-native';
import { useTeamRows } from '../../../features/team-view';
import { Avatar, MText, withAlpha } from '../parts/basics';
import { BoardSkeleton, EmptyState, ScreenHeader } from '../parts/chrome';
import { STATE, type MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';

// 팀원 — 웹 팀원 & 권한(team-page.tsx)의 표를 폰 목록으로: 동그라미·이름·직책·담당 영역, 오른쪽에 상태 알약
// ("진행 중 N건 · 임박·지남 M" 또는 "맡은 업무 없음"). 누르면 그 사람의 업무(웹 내 업무 ?who=).
// 명단과 건수는 공용 훅(features/team-view)이 센다.

export function TeamScreen() {
  const p = useMon();
  const s = useStyles(styles);
  const navigation = useNavigation();
  const { rows, loading } = useTeamRows();

  return (
    <View style={s.screen}>
      <ScreenHeader title="팀원" />
      <ScrollView contentContainerStyle={s.body}>
        <MText size={13} color={p.text2} style={s.lead}>
          기술팀 {rows.length}명 — 등록과 담당 영역은 관리자 화면에서 정해요
        </MText>
        {loading && rows.length === 0 ? (
          <BoardSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} text="기술팀 명단을 불러오지 못했어요" />
        ) : (
          <View style={s.card}>
            {rows.map((r, i) => (
              <Pressable
                key={r.name}
                onPress={() => navigation.navigate('PersonWork', { who: r.name })}
                style={({ pressed }) => [s.row, i > 0 && s.rowLine, pressed && { backgroundColor: p.overlay }]}
              >
                <Avatar name={r.name} size={32} />
                <View style={s.who}>
                  <MText size={15} numberOfLines={1}>
                    {r.name}
                  </MText>
                  {!!r.sub && (
                    <MText size={12} color={p.text2} numberOfLines={1}>
                      {r.sub}
                    </MText>
                  )}
                </View>
                <Pill open={r.open} urgent={r.urgent} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** 상태 알약 — 임박·지남이 있으면 주황, 아니면 파랑, 없으면 흐린 글자(웹 팀원 표 상태 칸) */
function Pill({ open, urgent }: { open: number; urgent: number }) {
  const p = useMon();
  if (open === 0) {
    return (
      <MText size={12} color={p.text2}>
        맡은 업무 없음
      </MText>
    );
  }
  const tone = urgent > 0 ? STATE.warn : STATE.info;
  return (
    <View
      style={{
        paddingHorizontal: 8,
        height: 24,
        borderRadius: 4,
        justifyContent: 'center',
        backgroundColor: withAlpha(tone, 0.16),
      }}
    >
      <MText size={12} color={tone}>
        진행 중 {open}건{urgent > 0 ? ` · 임박·지남 ${urgent}` : ''}
      </MText>
    </View>
  );
}

const styles = (p: MonPalette) => ({
  screen: { flex: 1, backgroundColor: p.bg },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 12 },
  lead: { paddingHorizontal: 4 },
  card: { borderWidth: 1, borderColor: p.line, borderRadius: 12, backgroundColor: p.page, overflow: 'hidden' as const },
  row: {
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  rowLine: { borderTopWidth: 1, borderColor: p.line },
  who: { flex: 1, gap: 2 },
});

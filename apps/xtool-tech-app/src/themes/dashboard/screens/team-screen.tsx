import { useNavigation } from '@react-navigation/native';
import { useTeamTable } from '../../../features/dashboard/team';
import { useParts } from '../parts';

// 팀원 — 웹 team-page "팀원 & 권한": 기술팀으로 등록한 사람(이름순) — 이메일, 직책·담당 영역, 그룹 역할, 지금 맡은 업무
// (진행 중 N · 임박·지남 N). 누르면 그 사람의 업무. 수정 기록(로그)·구성원 관리는 웹에서.

export function TeamScreen() {
  const P = useParts();
  const navigation = useNavigation();
  const t = useTeamTable();
  return (
    <P.Screen inTabs header={<P.ScreenHeader title="팀원" />}>
      <P.Card title={t.title} subtitle={t.subtitle} padded={false}>
        {t.loading ? (
          <P.EmptyState loading title="불러오는 중…" />
        ) : t.empty ? (
          <P.EmptyState title={t.empty} />
        ) : (
          t.rows.map(row => (
            <P.PersonRow
              key={row.key}
              name={row.name}
              sub={row.email}
              pills={[{ label: row.sub, tone: 'neutral' }, ...row.pills]}
              onPress={() => navigation.navigate('PersonWork', { who: row.name })}
            />
          ))
        )}
      </P.Card>
    </P.Screen>
  );
}

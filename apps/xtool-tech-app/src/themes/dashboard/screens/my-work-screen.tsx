import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LayoutList, UserRound } from 'lucide-react-native';
import { useDashboardMyWork } from '../../../features/dashboard/my-work';
import { layout } from '../layout';
import { useParts } from '../parts';
import { PickSheet } from '../pick-sheet';

// 내 업무 — 웹 my-work-page(대시보드 짜임): 기간 → 숫자 카드 넷(진행 중·임박·지남·14일 넘은 건·기간 완료) → "내 담당
// 업무" 판(상태·검색·직원·보드로 거르기, 20줄 + 더 보기). 줄을 누르면 그 보드의 상세. who가 있으면 그 직원의 업무
// (팀원·개요에서 연다 — onBack으로 뒤로).

type Picker = 'person' | 'board' | null;

export function MyWorkScreen({ who, onBack }: { who?: string; onBack?: () => void }) {
  const P = useParts();
  const navigation = useNavigation();
  const m = useDashboardMyWork(who);
  const [picker, setPicker] = useState<Picker>(null);

  return (
    <P.Screen inTabs={!onBack} header={<P.ScreenHeader title={m.screenTitle} onBack={onBack} />}>
      <P.Segmented
        label="조회 기간"
        size="sm"
        options={m.periodOptions}
        value={m.period.period}
        onChange={m.period.setPeriod}
      />
      <P.KpiGrid items={m.loading ? null : m.kpis} />

      <P.Card
        title={m.title}
        subtitle={m.subtitle}
        padded={false}
        toolbar={
          <View style={layout.stack}>
            <P.Segmented label="상태" size="sm" options={m.states} value={m.state} onChange={m.setState} />
            <P.SearchField value={m.query} onChangeText={m.setQuery} placeholder="고객·업무 이름·단계 검색" />
            <View style={layout.wrap}>
              <P.Chip
                label={m.person.label}
                icon={UserRound}
                selected={m.person.value !== null}
                trailing="chevron"
                onPress={() => setPicker('person')}
              />
              <P.Chip
                label={m.board.label}
                icon={LayoutList}
                selected={m.board.value !== ''}
                trailing={m.board.value ? 'clear' : 'chevron'}
                onPress={() => setPicker('board')}
                onClear={() => m.setBoard('')}
              />
            </View>
          </View>
        }
      >
        {m.loading && m.rows.length === 0 ? (
          <P.EmptyState loading title="불러오는 중…" />
        ) : m.empty ? (
          <P.EmptyState title={m.empty} />
        ) : (
          m.rows.map(row => (
            <P.WorkRow
              key={row.key}
              row={row}
              onPress={() => navigation.navigate('Item', { boardKey: row.boardKey, itemId: row.itemId })}
            />
          ))
        )}
        {m.more && (
          <P.Button variant="plain" label={`더 보기 · ${m.more.remaining}건 남음`} onPress={m.more.onPress} block />
        )}
      </P.Card>

      <PickSheet
        visible={picker === 'person'}
        title="직원"
        value={m.person.value}
        options={m.person.options.map(option => ({
          value: option.value,
          label: option.label,
          right:
            option.count !== undefined ? (
              <P.Text variant="small" tone="muted">
                {`진행 중 ${option.count}`}
              </P.Text>
            ) : undefined,
        }))}
        onPick={m.setPerson}
        onClose={() => setPicker(null)}
      />
      <PickSheet
        visible={picker === 'board'}
        title="보드"
        value={m.board.value}
        options={m.board.options}
        onPick={m.setBoard}
        onClose={() => setPicker(null)}
      />
    </P.Screen>
  );
}

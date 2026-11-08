import { ScrollView, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useMon } from '../theme-context';
import { MenuTitle, Sheet, SheetRow } from './chrome';

// 그룹(진행 단계) 고르기 — 웹 고르기 막대의 "이동" 메뉴: "어느 진행 단계로 옮길까요" + 그룹 색 점(10×10, 반경 3).
// 보드 고르기 막대·내 업무 고르기 막대·항목 화면 그룹 줄이 같이 쓴다.

export function MoveSheet({
  visible,
  groups,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  groups: readonly { id: string; title: string; color: string }[];
  /** 지금 그룹(항목 하나를 옮길 때) — 체크 */
  current?: string;
  onPick: (groupId: string) => void;
  onClose: () => void;
}) {
  const p = useMon();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <MenuTitle>어느 진행 단계로 옮길까요</MenuTitle>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}>
        {groups.map(g => (
          <SheetRow
            key={g.id}
            label={g.title}
            on={g.id === current}
            left={<View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: g.color }} />}
            right={g.id === current ? <Check size={14} color={p.link} /> : null}
            onPress={() => onPick(g.id)}
          />
        ))}
      </ScrollView>
    </Sheet>
  );
}

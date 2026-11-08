import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import { BOARD_TABS } from '@xtool-core/tech-boards';
import { BOARD_ICONS } from '../../../features/board-icons';
import { MText } from '../parts/basics';
import { ScreenHeader } from '../parts/chrome';
import type { MonPalette } from '../theme';
import { useMon, useStyles } from '../theme-context';

// 보드 — 웹 사이드바의 보드 메뉴를 폰 목록으로: "메뉴"(출장업무·AS·아톡문의·기타업무), "관리"(AS 신청서·부품 마스터·
// 대여품 관리·SN 관리). 같은 아이콘·같은 순서(BOARD_TABS). 누르면 그 보드 화면.

const SECTIONS = [
  { label: '메뉴', section: 'work' as const },
  { label: '관리', section: 'manage' as const },
];

export function BoardsScreen() {
  const p = useMon();
  const s = useStyles(styles);
  const navigation = useNavigation();
  return (
    <View style={s.screen}>
      <ScreenHeader title="보드" />
      <ScrollView contentContainerStyle={s.body}>
        {SECTIONS.map(sec => (
          <View key={sec.section} style={s.section}>
            <MText size={13} color={p.textSoft} style={s.sectionLabel}>
              {sec.label}
            </MText>
            <View style={s.card}>
              {BOARD_TABS.filter(t => t.section === sec.section).map((tab, i) => {
                const Icon = BOARD_ICONS[tab.key];
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => navigation.navigate('Board', { boardKey: tab.key })}
                    style={({ pressed }) => [s.row, i > 0 && s.rowLine, pressed && { backgroundColor: p.overlay }]}
                  >
                    <Icon size={20} strokeWidth={2} color={p.text2} />
                    <MText size={15} color={p.textSoft} style={s.label}>
                      {tab.label}
                    </MText>
                    <ChevronRight size={16} color={p.text4} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = (p: MonPalette) => ({
  screen: { flex: 1, backgroundColor: p.bg },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 22 },
  section: { gap: 10 },
  sectionLabel: { paddingHorizontal: 12 },
  card: { borderWidth: 1, borderColor: p.line, borderRadius: 12, backgroundColor: p.nav, overflow: 'hidden' as const },
  row: { height: 52, paddingHorizontal: 14, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  rowLine: { borderTopWidth: 1, borderColor: p.line },
  label: { flex: 1 },
});

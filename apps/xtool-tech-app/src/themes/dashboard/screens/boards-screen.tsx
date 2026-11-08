import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BOARD_ICONS } from '../../../features/board-icons';
import { useBoardsHub } from '../../../features/dashboard/boards-hub';
import { layout } from '../layout';
import { useParts } from '../parts';

// 보드 — 웹 사이드바의 보드 메뉴를 폰 목록으로: "메뉴"(출장업무·AS·아톡문의·기타업무), "관리"(AS 신청서·부품 마스터·
// 대여품 관리·SN 관리). 같은 아이콘·같은 순서(BOARD_TABS), 보드마다 진행 중(또는 전체) 수. 누르면 그 보드 화면.

export function BoardsScreen() {
  const P = useParts();
  const navigation = useNavigation();
  const { sections } = useBoardsHub();
  return (
    <P.Screen inTabs header={<P.ScreenHeader title="보드" />}>
      {sections.map(section => (
        <P.Section key={section.key} title={section.label}>
          <View style={layout.stack}>
            {section.tiles.map(tile => (
              <P.BoardTile
                key={tile.key}
                label={tile.label}
                title={tile.title}
                icon={BOARD_ICONS[tile.key]}
                count={tile.count}
                caption={tile.caption}
                onPress={() => navigation.navigate('Board', { boardKey: tile.key })}
              />
            ))}
          </View>
        </P.Section>
      ))}
    </P.Screen>
  );
}

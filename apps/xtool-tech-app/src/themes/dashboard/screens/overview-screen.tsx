import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { BOARD_TABS, type TechBoardKey } from '@xtool-core/tech-boards';
import { useOverview } from '../../../features/dashboard/overview';
import { layout } from '../layout';
import { useParts } from '../parts';

// 개요 — 웹 overview-page: 위에서부터 나의 진행 중 업무 · 오늘·이번 주 일정, 챙겨야 할 것, 기술팀 왕(이번 주·이번 달 ×
// AS왕·수리왕·아톡처리왕), 팀 현황. 줄·일정을 누르면 그 항목 상세, 타일은 그 보드, 팀원은 그 사람의 업무.

export function OverviewScreen() {
  const P = useParts();
  const navigation = useNavigation();
  const o = useOverview();
  const openItem = (boardKey: TechBoardKey, itemId: string) => navigation.navigate('Item', { boardKey, itemId });
  const { myWork, schedule } = o;
  const overdue = schedule.view.overdue;

  return (
    <P.Screen inTabs header={<P.ScreenHeader title="개요" />}>
      <P.Card
        title="나의 진행 중 업무"
        subtitle={myWork.subtitle}
        padded={false}
        toolbar={
          myWork.filters.length > 0 ? (
            <P.Segmented
              label="보드"
              variant="chips"
              size="sm"
              scroll
              options={myWork.filters}
              value={myWork.filter}
              onChange={myWork.setFilter}
            />
          ) : undefined
        }
      >
        {myWork.empty ? (
          <P.EmptyState title={myWork.empty} />
        ) : myWork.loading && myWork.rows.length === 0 ? (
          <P.EmptyState loading title="불러오는 중…" />
        ) : (
          myWork.rows.map(row => (
            <P.WorkRow key={row.key} row={row} onPress={() => openItem(row.boardKey, row.itemId)} />
          ))
        )}
        {myWork.more && (
          <P.Button
            variant="plain"
            label={`더 보기 · ${myWork.more.remaining}건 남음`}
            onPress={myWork.more.onPress}
            block
          />
        )}
      </P.Card>

      <P.Card
        title="오늘·이번 주 일정"
        subtitle={schedule.subtitle}
        actions={
          <P.Segmented
            label="일정 범위"
            size="sm"
            options={schedule.scopes}
            value={schedule.scope}
            onChange={schedule.setScope}
          />
        }
      >
        <View style={layout.stack}>
          {overdue && (
            <>
              <P.Button
                variant="secondary"
                size="sm"
                label={overdue.label}
                icon={schedule.showOverdue ? ChevronUp : ChevronDown}
                iconAfter
                onPress={schedule.toggleOverdue}
              />
              {schedule.showOverdue && (
                <P.ScheduleDay day={overdue} onPressEvent={e => openItem(e.boardKey, e.itemId)} />
              )}
            </>
          )}
          {schedule.view.days.map(day => (
            <P.ScheduleDay key={day.key} day={day} onPressEvent={e => openItem(e.boardKey, e.itemId)} />
          ))}
        </View>
      </P.Card>

      <P.AttentionRow
        tiles={o.attention.tiles}
        loading={o.attention.loading}
        onPressTile={tile => {
          const tab = BOARD_TABS.find(t => t.slug === tile.slug);
          if (tab) navigation.navigate('Board', { boardKey: tab.key });
        }}
      />

      {o.kings.map(section => (
        <P.Section key={section.span} title={section.title} aside={section.range}>
          <View style={layout.stack}>
            {section.cards.map(({ key, ...card }) => (
              <P.KingCard key={key} {...card} />
            ))}
          </View>
        </P.Section>
      ))}

      <P.TeamCard
        members={o.team.members}
        me={o.myNames}
        loading={o.team.loading}
        onPressMember={name => navigation.navigate('PersonWork', { who: name })}
      />
    </P.Screen>
  );
}

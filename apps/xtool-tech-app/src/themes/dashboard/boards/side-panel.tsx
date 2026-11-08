import type { SidePanel } from '../../../features/dashboard/boards';
import { useParts } from '../parts';

// 보드 옆 판 — 웹 board-body__side의 판 두 장(막대 목록·다가오는 일정·짧은 목록). 폰에서는 목록 아래로 쌓는다.
// 무엇을 보일지는 보드 정의(features/dashboard/boards/*)가 정한다.

export function SidePanelCard({ panel, today }: { panel: SidePanel; today: string }) {
  const P = useParts();
  const { body } = panel;
  return (
    <P.Card title={panel.title} subtitle={panel.subtitle}>
      {body.kind === 'bars' ? (
        <P.BarList items={body.items} unit={body.unit} empty={body.empty} />
      ) : body.kind === 'upcoming' ? (
        <P.UpcomingList items={body.items} today={today} empty={body.empty} mode={body.mode} />
      ) : (
        <P.MiniList items={body.items} empty={body.empty} />
      )}
    </P.Card>
  );
}

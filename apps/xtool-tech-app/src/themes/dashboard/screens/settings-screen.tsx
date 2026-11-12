import { View } from 'react-native';
import { BellRing, LogOut, RotateCw, Settings } from 'lucide-react-native';
import { useCurrentMember } from '@xtool-core/member-context';
import { APP_VERSION } from '../../../features/app-info';
import { LAYOUT_CHOICES, useLayout } from '../../../features/layout';
import { signOutPressed, usePushSetting } from '../../../features/push';
import { layout } from '../layout';
import { useParts } from '../parts';

// 설정 — 웹 설정 화면 중 폰에 필요한 것: 내 정보, 레이아웃(Monday 표·대시보드·물), 테마마다 다른 외관 카드(글라스: 배경·
// 강조색·유리 / 물: 벽·강조색·판 — parts.AppearanceSettings), 신규 문의 알림(features/push), 버전, 로그아웃(Monday 설정
// 화면과 같은 기능).

export function SettingsScreen() {
  const P = useParts();
  const { layout: current, setLayout } = useLayout();
  const member = useCurrentMember();
  const push = usePushSetting();
  const name = member?.name || member?.email || '';
  return (
    <P.Screen inTabs header={<P.ScreenHeader title="설정" />}>
      <P.Card>
        <View style={layout.row}>
          <P.Avatar name={name} size="lg" highlight />
          <View style={layout.flex}>
            <P.Text variant="strong" numberOfLines={1}>
              {member?.name || '이름 없음'}
            </P.Text>
            <P.Text variant="small" tone="muted" numberOfLines={1}>
              {`${member?.isAdmin ? '관리자 · ' : ''}${member?.email ?? ''}`}
            </P.Text>
          </View>
        </View>
      </P.Card>

      <P.Card title="레이아웃" subtitle="모양만 바뀌고 기능은 같아요 · 이 기기에서만 바뀌어요" padded={false}>
        {LAYOUT_CHOICES.map(choice => (
          <P.OptionRow
            key={choice.key}
            label={choice.label}
            description={choice.description}
            selected={current === choice.key}
            onPress={() => setLayout(choice.key)}
          />
        ))}
      </P.Card>

      <P.AppearanceSettings />

      {push.supported && (
        <P.Card title="알림" subtitle={push.text}>
          <View style={layout.stack}>
            <P.CheckField label="신규 문의 알림" value={push.enabled} onChange={push.setEnabled} disabled={push.busy} />
            {push.test || push.openSettings || push.retry ? (
              <View style={layout.wrap}>
                {push.test && (
                  <P.Button size="sm" variant="secondary" icon={BellRing} label="테스트 알림" onPress={push.test} />
                )}
                {push.openSettings && (
                  <P.Button
                    size="sm"
                    variant="secondary"
                    icon={Settings}
                    label="iPhone 설정 열기"
                    onPress={push.openSettings}
                  />
                )}
                {push.retry && (
                  <P.Button size="sm" variant="secondary" icon={RotateCw} label="다시 켜기" onPress={push.retry} />
                )}
              </View>
            ) : null}
          </View>
        </P.Card>
      )}

      <P.Card title="버전 정보" subtitle={`xtool tech 앱 ${APP_VERSION}`} />

      <P.Button variant="danger" icon={LogOut} label="로그아웃" onPress={signOutPressed} block />
    </P.Screen>
  );
}

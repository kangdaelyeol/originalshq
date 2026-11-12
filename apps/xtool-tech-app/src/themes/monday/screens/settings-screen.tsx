import { Pressable, ScrollView, Switch, View } from 'react-native';
import { BellRing, Check, LogOut, RotateCw, Settings, type LucideIcon } from 'lucide-react-native';
import { useCurrentMember } from '@xtool-core/member-context';
import { APP_VERSION } from '../../../features/app-info';
import { LAYOUT_CHOICES, useLayout } from '../../../features/layout';
import { signOutPressed, usePushSetting } from '../../../features/push';
import { Avatar, MText } from '../parts/basics';
import { ScreenHeader } from '../parts/chrome';
import { MONDAY_ACCENT, PALETTE_CHOICES, type MonPalette } from '../theme';
import { useMon, useSetPalette, useStyles } from '../theme-context';

// 설정 — 웹 설정 화면 중 폰에 필요한 것만: 내 정보, 레이아웃(Monday 표·대시보드·물), Monday 색상(남색·라이트·블랙),
// 신규 문의 알림(대시보드 설정과 같은 features/push), 버전(features/app-info), 로그아웃.

export function SettingsScreen() {
  const p = useMon();
  const s = useStyles(styles);
  const setPalette = useSetPalette();
  const { layout, setLayout } = useLayout();
  const member = useCurrentMember();
  const push = usePushSetting();
  const name = member?.name || member?.email || '';
  return (
    <View style={s.screen}>
      <ScreenHeader title="설정" />
      <ScrollView contentContainerStyle={s.body}>
        <View style={[s.card, s.profile]}>
          <Avatar name={name} size={52} color={MONDAY_ACCENT} />
          <View style={s.flex}>
            <MText size={17} numberOfLines={1}>
              {member?.name || '이름 없음'}
            </MText>
            <MText size={13} color={p.text2} numberOfLines={1}>
              {member?.isAdmin ? '관리자 · ' : ''}
              {member?.email}
            </MText>
          </View>
        </View>

        <View style={s.card}>
          <MText size={15} weight="semibold">
            레이아웃
          </MText>
          <MText size={12} color={p.text2} style={s.cardSub}>
            모양만 바뀌고 기능은 같아요 · 이 기기에서만 바뀌어요
          </MText>
          <View style={s.layouts}>
            {LAYOUT_CHOICES.map(choice => {
              const on = layout === choice.key;
              return (
                <Pressable
                  key={choice.key}
                  onPress={() => setLayout(choice.key)}
                  style={[s.layoutRow, on && { borderColor: p.primary, backgroundColor: p.toolOn }]}
                >
                  <View style={s.flex}>
                    <MText size={14}>{choice.label}</MText>
                    <MText size={12} color={p.text2}>
                      {choice.description}
                    </MText>
                  </View>
                  {on && <Check size={16} color={p.link} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.card}>
          <MText size={15} weight="semibold">
            Monday 색상
          </MText>
          <MText size={12} color={p.text2} style={s.cardSub}>
            이 기기에서만 바뀌어요
          </MText>
          <View style={s.tiles}>
            {PALETTE_CHOICES.map(choice => {
              const on = p.key === choice.key;
              return (
                <Pressable
                  key={choice.key}
                  onPress={() => setPalette(choice.key)}
                  style={[s.tile, on && { borderColor: p.primary, backgroundColor: p.toolOn }]}
                >
                  <View style={[s.swatch, { backgroundColor: choice.swatch[0] }]}>
                    <View style={[s.swatchBar, { backgroundColor: choice.swatch[1] }]} />
                    <View style={[s.swatchDot, { backgroundColor: choice.swatch[2] }]} />
                  </View>
                  <View style={s.tileLabel}>
                    <MText size={13}>{choice.label}</MText>
                    {on && <Check size={14} color={p.link} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {push.supported && (
          <View style={s.card}>
            <MText size={15} weight="semibold">
              알림
            </MText>
            <MText size={12} color={p.text2} style={s.cardSub}>
              {push.text}
            </MText>
            <View style={[s.layoutRow, s.pushSwitch]}>
              <MText size={14} style={s.flex}>
                신규 문의 알림
              </MText>
              <Switch
                value={push.enabled}
                onValueChange={push.setEnabled}
                disabled={push.busy}
                trackColor={{ true: p.primary, false: p.control }}
              />
            </View>
            {push.test || push.openSettings || push.retry ? (
              <View style={s.pushActions}>
                {push.test && <PushButton icon={BellRing} label="테스트 알림" onPress={push.test} />}
                {push.openSettings && (
                  <PushButton icon={Settings} label="iPhone 설정 열기" onPress={push.openSettings} />
                )}
                {push.retry && <PushButton icon={RotateCw} label="다시 켜기" onPress={push.retry} />}
              </View>
            ) : null}
          </View>
        )}

        <View style={s.card}>
          <MText size={15} weight="semibold">
            버전 정보
          </MText>
          <MText size={13} color={p.text2} style={s.cardSub}>
            xtool tech 앱 {APP_VERSION}
          </MText>
        </View>

        <Pressable
          onPress={signOutPressed}
          style={({ pressed }) => [s.logout, pressed && { backgroundColor: p.overlay }]}
        >
          <LogOut size={16} color={p.dangerText} />
          <MText color={p.dangerText}>로그아웃</MText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** 알림 카드의 작은 단추 — 테두리 단추(로그아웃 단추와 같은 결) */
function PushButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const p = useMon();
  const s = useStyles(styles);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.pushButton, pressed && { backgroundColor: p.overlay }]}>
      <Icon size={14} color={p.text} />
      <MText size={13}>{label}</MText>
    </Pressable>
  );
}

const styles = (p: MonPalette) => ({
  screen: { flex: 1, backgroundColor: p.bg },
  flex: { flex: 1, gap: 2 },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 14 },
  card: {
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 12,
    backgroundColor: p.page,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  profile: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14 },
  cardSub: { marginTop: 4 },
  tiles: { flexDirection: 'row' as const, gap: 10, marginTop: 14 },
  layouts: { gap: 8, marginTop: 14 },
  layoutRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tile: { flex: 1, borderWidth: 1, borderColor: p.line, borderRadius: 8, padding: 8, gap: 8 },
  swatch: { height: 54, borderRadius: 4, overflow: 'hidden' as const, padding: 6, gap: 6 },
  swatchBar: { height: 12, borderRadius: 3 },
  swatchDot: { width: 28, height: 12, borderRadius: 3 },
  tileLabel: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  pushSwitch: { marginTop: 14 },
  pushActions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginTop: 10 },
  pushButton: {
    height: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: p.control,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
  },
  logout: {
    height: 46,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: p.control,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 8,
  },
});

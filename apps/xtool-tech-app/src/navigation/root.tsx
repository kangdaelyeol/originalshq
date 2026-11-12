import { Fragment, useCallback, useMemo, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createNavigationContainerRef,
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PeriodProvider } from '../features/kpis';
import { useLayout } from '../features/layout';
import { usePushOpen, usePushRegistration } from '../features/push';
import { THEMES } from '../themes';
import type { ThemeModule } from '../themes/types';
import type { RootScreenProps, RootStackParams, TabParams } from './types';

// 로그인 뒤 앱 — 지금 레이아웃(설정 > 레이아웃)의 테마가 아래 탭·화면·토스트·배경을 내놓는다. 이동 구조(탭 위로 보드·
// 항목·직원 업무를 쌓는 것)는 모든 테마가 같다. 레이아웃을 바꾸면 화면 틀을 새로 그린다(key).

const Stack = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator<TabParams>();
/** 화면 밖(알림을 눌러 열기)에서 화면을 옮길 때 */
const navRef = createNavigationContainerRef<RootStackParams>();

function ThemedApp({ theme }: { theme: ThemeModule }) {
  const chrome = theme.useChrome();
  const insets = useSafeAreaInsets();
  const base = chrome.dark ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      background: chrome.background,
      card: chrome.background,
      text: chrome.text,
      border: chrome.border,
      primary: chrome.primary,
    },
  };
  const { screens } = theme;
  const Frame = theme.Frame ?? Fragment;
  // 화면 부품은 테마마다 한 번만 만든다 — 렌더마다 새로 만들면 화면이 처음부터 다시 그려진다.
  const { TabsScreen, PersonWork } = useMemo(() => makeScreens(theme), [theme]);
  // 신규 문의 알림을 눌러 열렸으면 그 문의 상세 — 화면 이동이 준비된 뒤에
  const [navReady, setNavReady] = useState(false);
  const openInquiry = useCallback((itemId: string) => {
    if (navRef.isReady()) navRef.navigate('Item', { boardKey: 'techInquiry', itemId });
  }, []);
  usePushOpen(navReady ? openInquiry : null);

  return (
    <Frame>
      <View style={{ flex: 1, backgroundColor: theme.Frame ? 'transparent' : chrome.background }}>
        <StatusBar barStyle={chrome.statusBar} />
        <NavigationContainer ref={navRef} theme={navTheme} onReady={() => setNavReady(true)}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.Frame ? 'transparent' : chrome.background },
            }}
          >
            <Stack.Screen name="Tabs" component={TabsScreen} />
            <Stack.Screen name="Board" component={screens.Board} />
            <Stack.Screen name="Item" component={screens.Item} />
            <Stack.Screen name="PersonWork" component={PersonWork} />
          </Stack.Navigator>
        </NavigationContainer>
        <theme.Toaster bottom={insets.bottom + 72} />
      </View>
    </Frame>
  );
}

function makeScreens(theme: ThemeModule) {
  const { screens, TabBar } = theme;
  const MyWorkTab = () => <screens.MyWork />;
  const TabsScreen = () => (
    <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={props => <TabBar {...props} />}>
      {theme.tabs.map(name => {
        const component = name === 'Overview' ? screens.Overview : name === 'MyWork' ? MyWorkTab : screens[name];
        return component ? <Tabs.Screen key={name} name={name} component={component} /> : null;
      })}
    </Tabs.Navigator>
  );
  const PersonWork = ({ route, navigation }: RootScreenProps<'PersonWork'>) => (
    <screens.MyWork who={route.params.who} onBack={navigation.goBack} />
  );
  return { TabsScreen, PersonWork };
}

export function MainApp() {
  const { layout, ready } = useLayout();
  // 신규 문의 알림 — 로그인한 동안 이 기기 등록(features/push)
  usePushRegistration();
  if (!ready) return null;
  // 기간은 레이아웃을 바꿔도 그대로 둔다(틀 바깥).
  return (
    <PeriodProvider>
      <ThemedApp key={layout} theme={THEMES[layout]} />
    </PeriodProvider>
  );
}

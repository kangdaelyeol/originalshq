import NativeXtoolPush from './NativeXtoolPush';

// 신규 문의 알림 네이티브 모듈 — iOS에서만 있고, 없으면(안드로이드·모듈을 빼고 빌드한 앱) null.

export interface PushDevice {
  deviceId: string;
  secret: string;
  token: string;
  env: 'production' | 'sandbox';
}

export type PushPermission = 'granted' | 'denied' | 'notDetermined';

const native = NativeXtoolPush;

export const XtoolPush = native
  ? {
      enable: async (actionUrl: string) => (await native.enable(actionUrl)) as PushDevice | null,
      disable: () => native.disable(),
      takeOpened: () => native.takeOpened(),
      permission: async () => (await native.permission()) as PushPermission,
      onOpened: (listener: (itemId: string) => void) => native.onOpened(listener),
    }
  : null;

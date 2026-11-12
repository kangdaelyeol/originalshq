import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// 신규 문의 알림 네이티브 모듈(codegen 명세) — iOS만. 구현은 ios/XtoolPush.mm(껍데기) → ios/XtoolPushCenter.swift.

export interface Spec extends TurboModule {
  /**
   * 알림 권한을 묻고(처음 한 번) APNs에 등록한다. actionUrl은 알림 단추("내가 맡기")가 부를 주소 — 앱이 꺼져 있어도
   * Swift가 바로 부르도록 기기에 적어 둔다. 허락하면 { deviceId, secret, token, env }, 거절하면 null.
   */
  enable(actionUrl: string): Promise<Object | null>;
  /** 알림 끄기·로그아웃 — 단추 주소와 기기 비밀 값을 지운다(다음에 켜면 새 비밀 값) */
  disable(): Promise<void>;
  /** 알림을 눌러 앱이 열렸으면 그 문의 id — 한 번만 돌려준다 */
  takeOpened(): Promise<string | null>;
  /** 지금 알림 권한 — 'granted' | 'denied' | 'notDetermined' */
  permission(): Promise<string>;
  /** 앱이 켜진 채로 알림을 눌렀다(문의 id) — 받으면 takeOpened로 가져간다 */
  readonly onOpened: CodegenTypes.EventEmitter<string>;
}

export default TurboModuleRegistry.get<Spec>('XtoolPush');

import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import type { AccessTarget } from '@xtool-core/access';
import { admit, authErrorMessage, type AuthOutcome } from '@xtool-core/auth';
import { xtoolFirebase } from '@xtool-core/firebase';
import { GOOGLE_IOS_CLIENT_ID } from './firebase-config';

// Google 로그인 — 웹은 Firebase 팝업을 쓰지만 앱에서는 팝업이 안 돼서, iOS Google 로그인 창(GoogleSignIn)으로 받은
// ID 토큰을 Firebase에 넘긴다. 그 뒤 권한 확인(admit)은 웹과 같다.

/** iOS OAuth 클라이언트 ID가 들어 있어야 Google 로그인을 쓸 수 있다(firebase-config.ts). */
export const isGoogleSignInReady = GOOGLE_IOS_CLIENT_ID !== '';

if (isGoogleSignInReady) GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT_ID });

export async function signInWithGoogle(target: AccessTarget): Promise<AuthOutcome> {
  if (!isGoogleSignInReady)
    return { ok: false, message: 'Google 로그인 설정이 아직 안 됐어요. 이메일로 로그인해 주세요.' };
  try {
    // 지난번 계정을 그대로 쓰지 않고 매번 계정을 고르게(웹 prompt: select_account).
    await GoogleSignin.signOut().catch(() => null);
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return { ok: false, message: '', cancelled: true };
    const idToken = response.data.idToken;
    if (!idToken) return { ok: false, message: 'Google 계정 정보를 받지 못했어요. 다시 해 주세요.' };
    const cred = await signInWithCredential(xtoolFirebase().auth, GoogleAuthProvider.credential(idToken));
    return await admit(cred, target);
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
      return { ok: false, message: '', cancelled: true };
    }
    return { ok: false, message: authErrorMessage(e) };
  }
}

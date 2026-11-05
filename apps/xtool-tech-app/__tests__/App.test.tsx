/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// 앱 뼈대만 본다 — Firebase·공용 데이터 코드(xtool-core)는 가짜로. 로그아웃 상태면 로그인 화면이 뜬다.
// 화면 가장자리 값이 없는 테스트 환경에서도 그리게(라이브러리가 주는 가짜)
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/firebase', () => ({}));
jest.mock('@xtool-core/session', () => ({ useXtoolSession: () => ({ status: 'signedOut' }) }));
jest.mock('@xtool-core/auth', () => ({ signInWithEmail: jest.fn(), signOutXtool: jest.fn() }));
jest.mock('@xtool-core/access', () => ({ DENIED_MESSAGE: {} }));
jest.mock('@xtool-core/member-context', () => ({
  MemberContext: require('react').createContext(null),
  useCurrentMember: () => null,
}));
jest.mock('@xtool-core/tech-boards-store', () => ({ useTechBoard: jest.fn() }));

test('signed out shows the login screen', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(tree?.root.findAllByProps({ placeholder: '이메일' }).length).toBeGreaterThan(0);
});

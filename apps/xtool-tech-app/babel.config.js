module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated·Skia 애니메이션 함수(worklet)를 UI 스레드용으로 바꾼다 — 플러그인 목록의 맨 끝에 둔다.
  plugins: ['react-native-worklets/plugin'],
};

const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// 이 앱은 originalshq 저장소 안에 있고, 웹과 같이 쓰는 데이터 코드(packages/xtool-core)를 소스 그대로 가져다 쓴다.
// - watchFolders: 앱 폴더 밖의 공용 코드도 Metro가 보고 바뀌면 다시 묶는다.
// - '@xtool-core/…' → packages/xtool-core/src/… (웹은 tsconfig.paths.json의 같은 별칭)
// - 공용 코드가 부르는 react·firebase 등은 이 앱의 node_modules에서만 찾는다. 저장소 루트(웹)의 node_modules를
//   보면 React·Firebase가 두 벌이 되어(훅 오류, "No Firebase App") 깨진다.
const projectRoot = __dirname;
const coreSrc = path.resolve(projectRoot, '../../packages/xtool-core/src');
const CORE_PREFIX = '@xtool-core/';

// 공용 코드(앱 폴더 밖)가 부르는 패키지는 앱 폴더에서 부른 것처럼 찾는다 — 위로 올라가며 찾게 두면 저장소 루트의
// node_modules가 먼저 걸린다. 앱 안 패키지끼리는 그대로(패키지 안 node_modules에 든 다른 판도 찾게).
const appEntry = path.join(projectRoot, 'index.js');
const isPackageName = name => !name.startsWith('.') && !path.isAbsolute(name);

const config = {
  // 개발 서버 포트 — 이 맥의 8081은 다른 프로젝트가 쓴다. 앱(SceneDelegate.swift metroPort)도 8082로 붙는다.
  server: { port: 8082 },
  watchFolders: [path.resolve(projectRoot, '../../packages/xtool-core')],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    resolveRequest: (context, moduleName, platform) => {
      const name = moduleName.startsWith(CORE_PREFIX)
        ? path.join(coreSrc, moduleName.slice(CORE_PREFIX.length))
        : moduleName;
      const outside = !context.originModulePath.startsWith(projectRoot + path.sep);
      return context.resolveRequest(
        outside && isPackageName(name) ? { ...context, originModulePath: appEntry } : context,
        name,
        platform,
      );
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);

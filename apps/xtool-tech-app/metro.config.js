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

const config = {
  watchFolders: [path.resolve(projectRoot, '../../packages/xtool-core')],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    disableHierarchicalLookup: true,
    resolveRequest: (context, moduleName, platform) =>
      context.resolveRequest(
        context,
        moduleName.startsWith(CORE_PREFIX) ? path.join(coreSrc, moduleName.slice(CORE_PREFIX.length)) : moduleName,
        platform,
      ),
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);

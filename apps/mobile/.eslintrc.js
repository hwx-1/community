module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void promise` 明确表示事件回调有意忽略 Promise 返回值。
    'no-void': 'off',
    // React Navigation 官方 API 以渲染函数接收 tabBarIcon。
    'react/no-unstable-nested-components': ['warn', {allowAsProps: true}],
    // 主题色来自系统日/夜间模式，需在渲染时组合语义色样式。
    'react-native/no-inline-styles': 'off',
  },
};

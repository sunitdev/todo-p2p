// NativeWind v4 + Expo Router. Active after `bun install` (pending dep approval).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Reanimated plugin MUST be last.
      'react-native-reanimated/plugin',
    ],
  };
};

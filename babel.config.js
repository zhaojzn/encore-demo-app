module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      ['module-resolver', { alias: { '@': './', '~': './' }, extensions: ['.ts','.tsx','.js','.jsx','.json'] }],
      'react-native-worklets/plugin', 
    ],
  };
};
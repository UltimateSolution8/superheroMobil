module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    overrides: [
      {
        test: /node_modules\/react-native\/jest\/mock\.js$/,
        presets: [['@babel/preset-typescript', { allExtensions: true, isTSX: false }]],
      },
    ],
  };
};

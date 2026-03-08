const babel = require('@babel/core');

module.exports = {
  process(src, filename) {
    if (filename.endsWith('react-native/jest/mock.js')) {
      return { code: 'module.exports = { __esModule: true, default: function mock() {} };' };
    }
    const result = babel.transformSync(src, {
      filename,
      babelrc: false,
      configFile: false,
      parserOpts: {
        plugins: ['flow', 'typescript'],
      },
      plugins: [
        '@babel/plugin-transform-flow-strip-types',
        ['@babel/plugin-transform-typescript', { isTSX: false, allowDeclareFields: true }],
      ],
    });
    return result || src;
  },
};

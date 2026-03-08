const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'react-native', 'jest', 'mock.js');

try {
  if (fs.existsSync(target)) {
    fs.writeFileSync(
      target,
      'module.exports = { __esModule: true, default: function mock() {} };\n',
      'utf8',
    );
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('Failed to patch react-native jest mock:', err?.message || err);
}

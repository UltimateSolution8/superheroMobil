module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.js' }],
    },
    transformIgnorePatterns: ['/node_modules/'],
    setupFilesAfterEnv: ['./jest.setup.js'],
    moduleNameMapper: {
        '^expo-constants$': '<rootDir>/__tests__/__mocks__/expo-constants.js',
        '^react-native$': '<rootDir>/__tests__/__mocks__/react-native.js',
        '^@react-navigation/native$': '<rootDir>/__tests__/__mocks__/react-navigation-native.js',
        '^react-native-safe-area-context$': '<rootDir>/__tests__/__mocks__/react-native-safe-area-context.js',
    },
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/types.ts',
    ],
    testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};

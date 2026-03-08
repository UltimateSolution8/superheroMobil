jest.mock('expo-constants', () => ({
  expoConfig: { extra: {} },
}));

describe('config', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('uses API base url from env', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.mysuperhero.xyz';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../src/config');
    expect(config.API_BASE_URL).toBe('https://api.mysuperhero.xyz');
  });
});

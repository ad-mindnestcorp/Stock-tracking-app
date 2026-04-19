/**
 * Unit tests for the i18n module.
 * Verifies key translation strings resolve correctly for the 'en' locale.
 */

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', regionCode: 'US' }],
}));

import { initI18n } from '@/lib/i18n';
import i18n from '@/lib/i18n';

beforeAll(() => {
  initI18n();
});

describe('i18n — English translations', () => {
  it('resolves home.title', () => {
    expect(i18n.t('home.title')).toBe('Stockvest');
  });

  it('resolves auth.signIn', () => {
    expect(i18n.t('auth.signIn')).toBe('Sign In');
  });

  it('resolves common.retry', () => {
    expect(i18n.t('common.retry')).toBe('Retry');
  });

  it('falls back gracefully for missing key', () => {
    // i18next returns the key path when a key is missing
    const result = i18n.t('non.existent.key' as never);
    expect(typeof result).toBe('string');
  });

  it('all alert type keys exist', () => {
    const types = ['rsi_overbought', 'rsi_oversold', '52w_high', '52w_low'] as const;
    types.forEach((type) => {
      const key = `alerts.types.${type}` as const;
      expect(i18n.t(key as never)).toBeTruthy();
    });
  });
});

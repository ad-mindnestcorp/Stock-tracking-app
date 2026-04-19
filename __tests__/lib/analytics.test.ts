/**
 * Unit tests for the analytics module.
 * The Mixpanel SDK is mocked so no real network calls are made.
 */

jest.mock('mixpanel-react-native', () => ({
  Mixpanel: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    identify: jest.fn(),
    track: jest.fn(),
    reset: jest.fn(),
    getPeople: jest.fn().mockReturnValue({ set: jest.fn() }),
  })),
}));

// Re-import after mocks are set up
import { initAnalytics, track, identify, reset } from '@/lib/analytics';

describe('analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Simulate a Mixpanel token being present
    process.env.EXPO_PUBLIC_MIXPANEL_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
  });

  it('initialises without throwing', async () => {
    await expect(initAnalytics()).resolves.toBeUndefined();
  });

  it('track() does not throw before init', () => {
    expect(() => track('sign_in')).not.toThrow();
  });

  it('identify() does not throw before init', () => {
    expect(() => identify('user-123', { email: 'test@test.com' })).not.toThrow();
  });

  it('reset() does not throw before init', () => {
    expect(() => reset()).not.toThrow();
  });
});

/**
 * Jest global setup (setupFilesAfterEnv).
 *
 * Expo 54's "winter" runtime (expo/src/winter) installs lazy property getters on
 * `global` for things like `structuredClone`, `__ExpoImportMetaRegistry`, `URL`, etc.
 * Those getters call `require()` lazily, which jest-runtime rejects with
 * "You are trying to import a file outside of the scope of the test code."
 *
 * The fix: replace each lazy getter with a static no-op value BEFORE any test
 * module can trigger the getter.
 */

const EXPO_WINTER_GLOBALS: string[] = [
  '__ExpoImportMetaRegistry',
  'structuredClone',
  'TextDecoder',
  'TextDecoderStream',
  'TextEncoderStream',
  'URL',
  'URLSearchParams',
];

// Safe static stubs — these are only needed to prevent the lazy require() from firing.
// Tests that genuinely need these should mock them via jest.mock().
const STATIC_STUBS: Record<string, unknown> = {
  __ExpoImportMetaRegistry: { url: null },
  structuredClone: (val: unknown) => JSON.parse(JSON.stringify(val)),
  TextDecoder: class TextDecoder {},
  TextDecoderStream: class TextDecoderStream {},
  TextEncoderStream: class TextEncoderStream {},
  // URL and URLSearchParams are built-ins in Node 18 — only stub if missing
};

for (const name of EXPO_WINTER_GLOBALS) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  // Replace lazy getters (those installed by expo's installGlobal have `get` but no `value`)
  if (descriptor && typeof descriptor.get === 'function' && !('value' in descriptor)) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: STATIC_STUBS[name],
    });
  }
}

// Silence expected noise from native module setup
global.console = {
  ...console,
  warn: jest.fn(),
};

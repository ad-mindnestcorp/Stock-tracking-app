import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * SecureStore keys must be alphanumeric + dots/dashes only.
 */
const sanitizeKey = (key: string) => key.replace(/[^a-zA-Z0-9._-]/g, '_');

/**
 * SecureStore has a 2048-byte limit per entry.
 * The Supabase session JSON exceeds this, so we split large values into
 * numbered chunks and reassemble them on read.
 */
const CHUNK_SIZE = 1800;

const ChunkedSecureStore = {
  getItem: async (key: string): Promise<string | null> => {
    const safeKey = sanitizeKey(key);
    const countStr = await SecureStore.getItemAsync(`${safeKey}__n`);
    if (countStr === null) {
      return SecureStore.getItemAsync(safeKey);
    }
    const count = parseInt(countStr, 10);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${safeKey}__${i}`);
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  setItem: async (key: string, value: string): Promise<void> => {
    const safeKey = sanitizeKey(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(safeKey, value);
      await SecureStore.deleteItemAsync(`${safeKey}__n`).catch(() => null);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${safeKey}__${i}`, chunk))
    );
    await SecureStore.setItemAsync(`${safeKey}__n`, String(chunks.length));
    await SecureStore.deleteItemAsync(safeKey).catch(() => null);
  },

  removeItem: async (key: string): Promise<void> => {
    const safeKey = sanitizeKey(key);
    const countStr = await SecureStore.getItemAsync(`${safeKey}__n`);
    if (countStr !== null) {
      const count = parseInt(countStr, 10);
      await Promise.all([
        ...Array.from({ length: count }, (_, i) =>
          SecureStore.deleteItemAsync(`${safeKey}__${i}`).catch(() => null)
        ),
        SecureStore.deleteItemAsync(`${safeKey}__n`).catch(() => null),
      ]);
    }
    await SecureStore.deleteItemAsync(safeKey).catch(() => null);
  },
};

/**
 * SecureStore is not available on web; fall back to a simple in-memory store.
 * Tokens are never persisted to disk on web in this starter — acceptable for dev.
 */
const webMemoryStore: Record<string, string> = {};
const WebMemoryAdapter = {
  getItem: (key: string) => Promise.resolve(webMemoryStore[key] ?? null),
  setItem: (key: string, value: string) => {
    webMemoryStore[key] = value;
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    delete webMemoryStore[key];
    return Promise.resolve();
  },
};

const storage = Platform.OS === 'web' ? WebMemoryAdapter : ChunkedSecureStore;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

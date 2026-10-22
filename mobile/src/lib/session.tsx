import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { configureApi, normalizeUrl } from './api';
import type { MemberRole } from './types';

// Oturum: sunucu adresi, giriş yapan kullanıcı ve seçili işletme. Telefonda güvenli depoda saklanır.

export interface SessionUser { userId: string; fullName: string; token: string }
export interface SessionFarm { id: string; name: string; role: MemberRole }

interface SessionValue {
  ready: boolean;
  serverUrl: string;
  user: SessionUser | null;
  farm: SessionFarm | null;
  canManage: boolean;            // sahip ya da yönetici
  canWrite: boolean;             // izleyici değil
  setServerUrl: (url: string) => Promise<void>;
  signIn: (user: SessionUser) => Promise<void>;
  signOut: () => Promise<void>;
  selectFarm: (farm: SessionFarm | null) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const KEYS = { server: 'serverUrl', user: 'user', farm: 'farm', cloudMigrated: 'cloudMigrated' };

// Varsayılan sunucu: Render'daki bulut API'si
export const CLOUD_URL = 'https://ciftligim-api.onrender.com';
const isLocalUrl = (u: string) => /^http:\/\/(localhost|\d{1,3}(\.\d{1,3}){3})/i.test(u);

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown) {
  if (value == null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [serverUrl, setServer] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [farm, setFarm] = useState<SessionFarm | null>(null);

  const signOut = useCallback(async () => {
    setUser(null);
    setFarm(null);
    await writeJson(KEYS.user, null);
    await writeJson(KEYS.farm, null);
  }, []);

  useEffect(() => {
    (async () => {
      let [s, u, f] = await Promise.all([
        SecureStore.getItemAsync(KEYS.server).catch(() => null),
        readJson<SessionUser>(KEYS.user),
        readJson<SessionFarm>(KEYS.farm),
      ]);
      // Bir kerelik geçiş: eski sürümde evdeki bilgisayar adresi kayıtlıysa buluta geç ve yeniden giriş iste
      const migrated = await SecureStore.getItemAsync(KEYS.cloudMigrated).catch(() => null);
      if (!migrated) {
        if (!s || isLocalUrl(s)) {
          s = CLOUD_URL;
          u = null; f = null;
          await SecureStore.setItemAsync(KEYS.server, s);
          await writeJson(KEYS.user, null);
          await writeJson(KEYS.farm, null);
        }
        await SecureStore.setItemAsync(KEYS.cloudMigrated, '1');
      }
      setServer(s ?? CLOUD_URL);
      setUser(u);
      setFarm(u ? f : null);
      setReady(true);
    })();
  }, []);

  // API istemcisini her değişiklikte güncelle (render sırasında, ilk istekten önce hazır olsun)
  configureApi(serverUrl, user?.token ?? null, () => { void signOut(); });

  const value = useMemo<SessionValue>(() => ({
    ready, serverUrl, user, farm,
    canManage: farm?.role === 'owner' || farm?.role === 'manager',
    canWrite: !!farm && farm.role !== 'viewer',
    setServerUrl: async (url) => {
      const n = normalizeUrl(url);
      setServer(n);
      await SecureStore.setItemAsync(KEYS.server, n);
    },
    signIn: async (u) => {
      setUser(u);
      setFarm(null);
      await writeJson(KEYS.user, u);
      await writeJson(KEYS.farm, null);
    },
    signOut,
    selectFarm: async (f) => {
      setFarm(f);
      await writeJson(KEYS.farm, f);
    },
  }), [ready, serverUrl, user, farm, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession, SessionProvider içinde kullanılmalı.');
  return v;
}

/** Seçili işletme Id'si; işletme seçilmeden açılan ekranlarda boş döner */
export function useFarmId(): string {
  return useSession().farm?.id ?? '';
}

import { useEffect } from 'react';
import * as Updates from 'expo-updates';

/**
 * Uygulama açılınca uzaktan güncelleme var mı bakar; varsa indirip hemen yeniden başlatır.
 * (APK kurmadan ekran/kod değişiklikleri telefona gelir. Geliştirme modunda çalışmaz.)
 */
export function useOtaUpdate() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable || cancelled) return;
        const res = await Updates.fetchUpdateAsync();
        if (res.isNew && !cancelled) await Updates.reloadAsync();
      } catch {
        // internet yoksa ya da sunucuya ulaşılamazsa sessizce geç
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

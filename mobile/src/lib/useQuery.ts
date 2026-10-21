import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { api, errorMessage } from './api';

// Ekran her açıldığında (ve geri dönüldüğünde) veriyi yeniden çeker.
export function useQuery<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
    if (!path) { setLoading(false); return; }
    const id = ++seq.current;
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await api.get<T>(path);
      if (id === seq.current) { setData(result); setError(null); }
    } catch (e) {
      if (id === seq.current) setError(errorMessage(e));
    } finally {
      if (id === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [path]);

  useFocusEffect(useCallback(() => { void load('silent'); }, [load]));

  return {
    data, error, loading, refreshing, setData,
    reload: () => load('silent'),
    refresh: () => load('refresh'),
  };
}

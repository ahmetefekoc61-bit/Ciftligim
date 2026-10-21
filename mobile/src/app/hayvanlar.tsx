import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { AnimalRow } from '@/components/AnimalRow';
import { colors } from '@/components/theme';
import { Chips, Empty, ErrorBox, Fab, Loading, Muted, Screen, s } from '@/components/ui';
import { options, speciesIcon, statusLabel } from '@/lib/labels';
import { useFarmId, useSession } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { AnimalListItem, AnimalStatus, Herd, Species } from '@/lib/types';

export default function Hayvanlar() {
  const farmId = useFarmId();
  const { canManage } = useSession();
  const params = useLocalSearchParams<{ herdId?: string }>();
  const [search, setSearch] = useState('');
  const [speciesId, setSpeciesId] = useState<number | null>(null);
  const [herdId, setHerdId] = useState<string | null>(params.herdId ?? null);
  const [status, setStatus] = useState<AnimalStatus>('active');

  const qs = new URLSearchParams();
  qs.set('status', status);
  if (speciesId) qs.set('speciesId', String(speciesId));
  if (herdId) qs.set('herdId', herdId);

  const animals = useQuery<AnimalListItem[]>(farmId ? `/api/farms/${farmId}/animals?${qs.toString()}` : null);
  const species = useQuery<Species[]>('/api/species');
  const herds = useQuery<Herd[]>(farmId ? `/api/farms/${farmId}/herds` : null);

  // Arama telefonda anında süzülür (küpe no ya da isim)
  const filtered = useMemo(() => {
    const t = search.trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, '');
    if (!t) return animals.data ?? [];
    return (animals.data ?? []).filter((a) =>
      (a.earTag ?? '').toLocaleUpperCase('tr-TR').includes(t) ||
      (a.name ?? '').toLocaleUpperCase('tr-TR').replace(/\s+/g, '').includes(t));
  }, [animals.data, search]);

  const speciesOptions = (species.data ?? []).map((sp) => ({ value: sp.id, label: `${speciesIcon[sp.id] ?? ''} ${sp.name}` }));
  const herdOptions = (herds.data ?? []).map((h) => ({ value: h.id, label: h.name }));

  return (
    <Screen
      refreshing={animals.refreshing}
      onRefresh={animals.refresh}
      footer={canManage ? <Fab icon="add" label="Hayvan" onPress={() => router.push('/hayvan/form')} /> : undefined}
    >
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Küpe no ya da isim ara…"
        placeholderTextColor="#9AA096"
        style={[s.input, { marginBottom: 12 }]}
        autoCapitalize="characters"
      />
      {speciesOptions.length > 0 && <Chips options={speciesOptions} value={speciesId} onChange={setSpeciesId} allowNone />}
      {herdOptions.length > 0 && <Chips options={herdOptions} value={herdId} onChange={setHerdId} allowNone />}
      <Chips options={options(statusLabel)} value={status} onChange={(v) => v && setStatus(v)} />

      <View style={{ marginTop: 4 }}>
        {animals.loading ? <Loading /> : animals.error ? <ErrorBox message={animals.error} onRetry={animals.reload} /> :
          filtered.length === 0 ? (
            <Empty icon="paw-outline" title="Hayvan bulunamadı" hint={canManage ? 'Sağ alttaki + ile hayvan ekleyebilirsin.' : undefined} />
          ) : (
            <>
              <Muted style={{ marginBottom: 8, color: colors.muted }}>{filtered.length} hayvan</Muted>
              {filtered.map((a) => (
                <AnimalRow key={a.id} a={a} onPress={() => router.push({ pathname: '/hayvan/[id]', params: { id: a.id } })} />
              ))}
            </>
          )}
      </View>
    </Screen>
  );
}

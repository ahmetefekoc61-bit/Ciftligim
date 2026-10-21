import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, TextInput } from 'react-native';
import { Badge, Empty, ErrorBox, Fab, ListItem, Loading, Muted, Screen, s } from '@/components/ui';
import { fmtArea, ownershipLabel, parcelTitle } from '@/lib/labels';
import { useFarmId, useSession } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { ParcelListItem } from '@/lib/types';

export default function Tarlalar() {
  const farmId = useFarmId();
  const { canManage } = useSession();
  const q = useQuery<ParcelListItem[]>(farmId ? `/api/farms/${farmId}/parcels` : null);
  const [search, setSearch] = useState('');

  const list = useMemo(() => {
    const t = search.trim().toLocaleLowerCase('tr-TR');
    if (!t) return q.data ?? [];
    return (q.data ?? []).filter((p) =>
      `${p.nickname ?? ''} ${p.neighborhood} ${p.district} ${p.blockNo}/${p.parcelNo} ${p.locality ?? ''}`
        .toLocaleLowerCase('tr-TR').includes(t));
  }, [q.data, search]);

  const total = list.reduce((sum, p) => sum + (p.areaM2 ?? 0), 0);

  return (
    <Screen
      refreshing={q.refreshing}
      onRefresh={q.refresh}
      footer={canManage ? <Fab icon="add" label="Tarla" onPress={() => router.push('/tarla/form')} /> : undefined}
    >
      <TextInput value={search} onChangeText={setSearch} placeholder="Ad, köy, ada/parsel ara…" placeholderTextColor="#9AA096" style={[s.input, { marginBottom: 12 }]} />
      {q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> :
        list.length === 0 ? <Empty icon="grid-outline" title="Tarla yok" hint={canManage ? 'Sağ alttaki + ile TKGM\'den tarla ekleyebilirsin.' : undefined} /> : (
          <>
            <Muted style={{ marginBottom: 8 }}>{list.length} tarla · {fmtArea(total)}</Muted>
            {list.map((p) => (
              <ListItem
                key={p.id}
                title={parcelTitle(p)}
                subtitle={[`${p.neighborhood}, ${p.district}`, fmtArea(p.areaM2), p.lastCropName ? `${p.lastSeasonYear}: ${p.lastCropName}` : null]
                  .filter(Boolean).join(' · ')}
                left={<Text style={{ fontSize: 26 }}>🌾</Text>}
                right={<Badge text={ownershipLabel[p.ownership]} tone={p.ownership === 'owned' ? 'green' : 'amber'} />}
                onPress={() => router.push({ pathname: '/tarla/[id]', params: { id: p.id } })}
              />
            ))}
          </>
        )}
    </Screen>
  );
}

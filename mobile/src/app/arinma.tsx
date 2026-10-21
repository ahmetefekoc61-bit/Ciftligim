import { router } from 'expo-router';
import { Empty, ErrorBox, ListItem, Loading, Muted, Screen } from '@/components/ui';
import { animalTitle } from '@/components/AnimalRow';
import { daysUntil, fmtDate } from '@/lib/format';
import { useFarmId } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { Withdrawal } from '@/lib/types';

export default function Arinma() {
  const farmId = useFarmId();
  const q = useQuery<Withdrawal[]>(farmId ? `/api/farms/${farmId}/withdrawals` : null);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Muted style={{ marginBottom: 12 }}>Bu hayvanlar ilaç kalıntısı nedeniyle henüz kesilmemeli ya da sütü satılmamalı.</Muted>
      {q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> :
        (q.data ?? []).length === 0 ? <Empty icon="checkmark-circle-outline" title="Arınma süresinde hayvan yok" /> :
        q.data!.map((w) => {
          const parts: string[] = [];
          if (w.meatBlockedUntil) parts.push(`Et: ${fmtDate(w.meatBlockedUntil)} (${daysUntil(w.meatBlockedUntil)} gün)`);
          if (w.milkBlockedUntil) parts.push(`Süt: ${fmtDate(w.milkBlockedUntil)} (${daysUntil(w.milkBlockedUntil)} gün)`);
          return (
            <ListItem
              key={w.animalId}
              title={`${animalTitle(w)} · ${w.speciesName}`}
              subtitle={parts.join('\n')}
              onPress={() => router.push({ pathname: '/hayvan/[id]', params: { id: w.animalId } })}
            />
          );
        })}
    </Screen>
  );
}

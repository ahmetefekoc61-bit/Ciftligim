import { Text, View } from 'react-native';
import { fmtAge } from '@/lib/format';
import { locationLabel, sexLabel, speciesIcon, statusLabel } from '@/lib/labels';
import type { AnimalListItem } from '@/lib/types';
import { Badge, ListItem } from './ui';

export function animalTitle(a: { earTag: string | null; name: string | null }) {
  if (a.earTag && a.name) return `${a.earTag} · ${a.name}`;
  return a.earTag ?? a.name ?? 'Küpesiz hayvan';
}

export function AnimalRow({ a, onPress }: { a: AnimalListItem; onPress: () => void }) {
  const parts = [a.breedName ?? a.speciesName, sexLabel[a.sex], fmtAge(a.ageMonths)];
  if (a.herdName) parts.push(a.herdName);
  return (
    <ListItem
      title={animalTitle(a)}
      subtitle={parts.join(' · ')}
      left={<Text style={{ fontSize: 28 }}>{speciesIcon[a.speciesId] ?? '🐾'}</Text>}
      right={
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {a.status !== 'active' && <Badge text={statusLabel[a.status]} tone="red" />}
          {a.inWithdrawal && <Badge text="Arınmada" tone="amber" />}
          {a.currentLocation && <Badge text={locationLabel[a.currentLocation]} tone={a.currentLocation === 'pasture' ? 'green' : 'neutral'} />}
        </View>
      }
      onPress={onPress}
    />
  );
}

export function AnimalPickerRow({ a, selected, onPress }: { a: AnimalListItem; selected: boolean; onPress: () => void }) {
  return (
    <ListItem
      title={animalTitle(a)}
      subtitle={`${a.breedName ?? a.speciesName} · ${sexLabel[a.sex]}`}
      left={<Text style={{ fontSize: 24 }}>{selected ? '✅' : '⬜'}</Text>}
      right={<View />}
      onPress={onPress}
    />
  );
}

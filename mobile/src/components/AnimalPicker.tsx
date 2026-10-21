import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { AnimalListItem, AnimalSex } from '@/lib/types';
import { animalTitle } from './AnimalRow';
import { colors } from './theme';
import { s } from './ui';

// Anne / baba seçimi: aynı türden, uygun cinsiyetteki hayvanlar arasında arama
export function AnimalPicker({ label, animals, sex, speciesId, excludeId, value, onChange }: {
  label: string; animals: AnimalListItem[]; sex: AnimalSex; speciesId: number | null;
  excludeId?: string; value: string | null; onChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const pool = useMemo(
    () => animals.filter((a) => a.sex === sex && a.speciesId === speciesId && a.id !== excludeId),
    [animals, sex, speciesId, excludeId],
  );
  const selected = pool.find((a) => a.id === value) ?? animals.find((a) => a.id === value);
  const matches = useMemo(() => {
    const t = q.trim().toLocaleUpperCase('tr-TR');
    return (t ? pool.filter((a) => animalTitle(a).toLocaleUpperCase('tr-TR').includes(t)) : pool).slice(0, 6);
  }, [pool, q]);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      {selected ? (
        <Pressable onPress={() => onChange(null)} style={[s.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={s.body}>{animalTitle(selected)}</Text>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Kaldır</Text>
        </Pressable>
      ) : pool.length === 0 ? (
        <Text style={s.muted}>{speciesId ? 'Bu türde uygun hayvan yok.' : 'Önce tür seçin.'}</Text>
      ) : (
        <>
          <TextInput value={q} onChangeText={setQ} placeholder="Küpe no ya da isimle ara" placeholderTextColor="#9AA096" style={s.input} />
          <View style={[s.chips, { marginTop: 8 }]}>
            {matches.map((a) => (
              <Pressable key={a.id} onPress={() => { onChange(a.id); setQ(''); }} style={s.chip}>
                <Text style={s.chipText}>{animalTitle(a)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

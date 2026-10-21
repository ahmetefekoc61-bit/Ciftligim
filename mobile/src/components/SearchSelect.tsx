import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { colors } from './theme';
import { s } from './ui';

// Uzun listeden (il, ilçe, mahalle, ürün) arayarak seçim
export function SearchSelect<T extends string | number>({ label, items, value, onChange, loading, placeholder, max = 24 }: {
  label: string; items: { value: T; label: string }[]; value: T | null;
  onChange: (v: T | null, label: string | null) => void; loading?: boolean; placeholder?: string; max?: number;
}) {
  const [q, setQ] = useState('');
  const selected = items.find((i) => i.value === value) ?? null;
  const matches = useMemo(() => {
    const t = q.trim().toLocaleLowerCase('tr-TR');
    return (t ? items.filter((i) => i.label.toLocaleLowerCase('tr-TR').includes(t)) : items).slice(0, max);
  }, [items, q, max]);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      {selected ? (
        <Pressable onPress={() => { onChange(null, null); setQ(''); }} style={[s.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={[s.body, { fontWeight: '700' }]}>{selected.label}</Text>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Değiştir</Text>
        </Pressable>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <TextInput value={q} onChangeText={setQ} placeholder={placeholder ?? 'Ara...'} placeholderTextColor="#9AA096" style={s.input} />
          <View style={[s.chips, { marginTop: 8 }]}>
            {matches.map((i) => (
              <Pressable key={String(i.value)} onPress={() => { onChange(i.value, i.label); setQ(''); }} style={s.chip}>
                <Text style={s.chipText}>{i.label}</Text>
              </Pressable>
            ))}
            {items.length > matches.length && !q && <Text style={s.muted}>…yazarak ara ({items.length} seçenek)</Text>}
          </View>
        </>
      )}
    </View>
  );
}

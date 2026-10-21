import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Body, Button, Card, Chips, DateField, ErrorBox, Field, Muted, Screen, Section, Toggle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { parseNumber, today } from '@/lib/format';
import { options, sexLabel } from '@/lib/labels';
import { useFarmId, useSession } from '@/lib/session';
import type { AnimalSex } from '@/lib/types';

interface Kid { sex: AnimalSex; earTag: string; name: string }

export default function Yavrulama() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const farmId = useFarmId();
  const { canManage } = useSession();
  const [date, setDate] = useState<string | null>(today());
  const [count, setCount] = useState('1');
  const [alive, setAlive] = useState('');
  const [difficulty, setDifficulty] = useState<string | null>('Kolay');
  const [notes, setNotes] = useState('');
  const [addKids, setAddKids] = useState(canManage);
  const [kids, setKids] = useState<Kid[]>([{ sex: 'female', earTag: '', name: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = Math.max(0, Math.min(20, Math.round(parseNumber(count) ?? 0)));

  const setCountAndKids = (v: string) => {
    setCount(v);
    const c = Math.max(0, Math.min(20, Math.round(parseNumber(v) ?? 0)));
    setKids((prev) => Array.from({ length: c }, (_, i) => prev[i] ?? { sex: 'female', earTag: '', name: '' }));
  };

  const updateKid = (i: number, patch: Partial<Kid>) =>
    setKids((prev) => prev.map((k, j) => (j === i ? { ...k, ...patch } : k)));

  const save = async () => {
    if (!date) return setError('Doğum tarihini seçin.');
    const aliveN = alive.trim() ? Math.round(parseNumber(alive) ?? -1) : null;
    if (aliveN != null && (aliveN < 0 || aliveN > n)) return setError('Canlı yavru sayısı toplamdan fazla olamaz.');
    setBusy(true); setError(null);
    try {
      await api.post(`/api/farms/${farmId}/animals/${animalId}/births`, {
        birthDate: date, offspringCount: n, aliveCount: aliveN,
        difficulty, notes: notes.trim() || null,
        offspring: addKids
          ? kids.slice(0, aliveN ?? n).map((k) => ({ sex: k.sex, earTag: k.earTag.trim() || null, name: k.name.trim() || null }))
          : null,
      });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <DateField label="Doğum tarihi" value={date} onChange={setDate} />
        <Field label="Yavru sayısı" value={count} onChangeText={setCountAndKids} keyboardType="number-pad" />
        <Field label="Canlı doğan (boşsa hepsi)" value={alive} onChangeText={setAlive} keyboardType="number-pad" />
        <Chips label="Doğum" options={['Kolay', 'Yardımlı', 'Zor', 'Sezaryen'].map((d) => ({ value: d, label: d }))} value={difficulty} onChange={setDifficulty} allowNone />
        <Field label="Not" value={notes} onChangeText={setNotes} />
      </Card>

      {canManage && n > 0 && (
        <Section title="Yavrular">
          <Card>
            <Toggle label="Yavruları hayvan olarak da ekle" value={addKids} onChange={setAddKids} />
            {addKids ? (
              <>
                <Muted style={{ marginBottom: 8 }}>Anne, tür, ırk, sürü ve doğum tarihi otomatik doldurulur. Küpe sonra da eklenebilir.</Muted>
                {kids.slice(0, alive.trim() ? Math.round(parseNumber(alive) ?? n) : n).map((k, i) => (
                  <View key={i} style={{ marginBottom: 8 }}>
                    <Body style={{ fontWeight: '700', marginBottom: 6 }}>{i + 1}. yavru</Body>
                    <Chips options={options(sexLabel)} value={k.sex} onChange={(v) => v && updateKid(i, { sex: v })} />
                    <Field label="Küpe no" value={k.earTag} onChangeText={(t) => updateKid(i, { earTag: t })} autoCapitalize="characters" />
                    <Field label="İsim" value={k.name} onChangeText={(t) => updateKid(i, { name: t })} />
                  </View>
                ))}
              </>
            ) : null}
          </Card>
        </Section>
      )}

      {error && <ErrorBox message={error} />}
      <Button title="Kaydet" icon="checkmark" onPress={save} loading={busy} />
    </Screen>
  );
}

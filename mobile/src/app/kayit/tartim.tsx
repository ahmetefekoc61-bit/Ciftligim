import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, DateField, ErrorBox, Field, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { parseNumber, today } from '@/lib/format';
import { useFarmId } from '@/lib/session';

export default function Tartim() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const farmId = useFarmId();
  const [kg, setKg] = useState('');
  const [date, setDate] = useState<string | null>(today());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const n = parseNumber(kg);
    if (n == null || n <= 0) return setError('Ağırlığı kilogram olarak girin.');
    setBusy(true); setError(null);
    try {
      await api.post(`/api/farms/${farmId}/animals/${animalId}/weights`, { weightKg: n, weighedOn: date, notes: notes.trim() || null });
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
        <Field label="Ağırlık (kg)" value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder="ör. 48,5" autoFocus />
        <DateField label="Tartım tarihi" value={date} onChange={setDate} />
        <Field label="Not" value={notes} onChangeText={setNotes} />
      </Card>
      {error && <ErrorBox message={error} />}
      <Button title="Kaydet" icon="checkmark" onPress={save} loading={busy} />
    </Screen>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Chips, DateField, ErrorBox, Field, Muted, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { today } from '@/lib/format';
import type { AnimalStatus } from '@/lib/types';
import { useFarmId } from '@/lib/session';

const exits: { value: Exclude<AnimalStatus, 'active'>; label: string }[] = [
  { value: 'sold', label: 'Satıldı' }, { value: 'slaughtered', label: 'Kesildi' },
  { value: 'dead', label: 'Öldü' }, { value: 'lost', label: 'Kayıp' },
];

export default function Cikis() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const farmId = useFarmId();
  const [status, setStatus] = useState<Exclude<AnimalStatus, 'active'>>('sold');
  const [date, setDate] = useState<string | null>(today());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!date) return setError('Tarih seçin.');
    setBusy(true); setError(null);
    try {
      await api.post(`/api/farms/${farmId}/animals/${animalId}/exit`, { status, date, notes: notes.trim() || null });
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
        <Muted style={{ marginBottom: 8 }}>Hayvan silinmez; geçmişi korunur ve listede "aktif olmayanlar" altında görünür.</Muted>
        <Chips options={exits} value={status} onChange={(v) => v && setStatus(v)} />
        <DateField label="Tarih" value={date} onChange={setDate} />
        <Field label="Not" value={notes} onChangeText={setNotes} placeholder="ör. Pazarda 9.000 TL'ye satıldı" multiline />
      </Card>
      {error && <ErrorBox message={error} />}
      <Button title="Kaydet" icon="checkmark" onPress={save} loading={busy} />
    </Screen>
  );
}

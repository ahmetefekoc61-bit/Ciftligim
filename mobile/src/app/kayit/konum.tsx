import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Chips, ErrorBox, Field, Muted, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { locationLabel, options } from '@/lib/labels';
import { useFarmId } from '@/lib/session';
import type { AnimalLocation } from '@/lib/types';

export default function Konum() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const farmId = useFarmId();
  const [location, setLocation] = useState<AnimalLocation>('pasture');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api.post(`/api/farms/${farmId}/animals/${animalId}/locations`, { location, since: null, notes: notes.trim() || null });
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
        <Muted style={{ marginBottom: 8 }}>Hayvanın şu anki yerini seç. Kayıt şimdiki zamanla tutulur.</Muted>
        <Chips options={options(locationLabel)} value={location} onChange={(v) => v && setLocation(v)} />
        <Field label="Not" value={notes} onChangeText={setNotes} placeholder="ör. Yukarı mera" />
      </Card>
      {error && <ErrorBox message={error} />}
      <Button title="Kaydet" icon="checkmark" onPress={save} loading={busy} />
    </Screen>
  );
}

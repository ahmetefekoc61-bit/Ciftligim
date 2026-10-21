import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { TreatmentForm } from '@/components/TreatmentForm';
import { Button, Card, Chips, Empty, Field, Loading, Muted, Screen, Section } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { locationLabel, options } from '@/lib/labels';
import { useFarmId } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { AnimalLocation, Herd } from '@/lib/types';

type Action = 'treatment' | 'location';

// Bütün sürüye aynı anda aşı/ilaç ya da meraya çıkış/ahıra giriş
export default function Toplu() {
  const farmId = useFarmId();
  const herds = useQuery<Herd[]>(farmId ? `/api/farms/${farmId}/herds` : null);
  const [herdId, setHerdId] = useState<string | null>(null);
  const [action, setAction] = useState<Action>('treatment');
  const [location, setLocation] = useState<AnimalLocation>('pasture');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const herd = herds.data?.find((h) => h.id === herdId);

  const moveHerd = async () => {
    if (!herdId) return;
    setBusy(true);
    try {
      const r = await api.post<{ count: number }>(`/api/farms/${farmId}/herds/${herdId}/location`, { location, notes: notes.trim() || null });
      Alert.alert('Tamam', `${r.count} hayvanın konumu "${locationLabel[location]}" olarak kaydedildi.`);
      router.back();
    } catch (e) {
      Alert.alert('Hata', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (herds.loading) return <Screen><Loading /></Screen>;
  if ((herds.data ?? []).length === 0) return <Screen><Empty icon="albums-outline" title="Önce bir sürü oluştur" /></Screen>;

  return (
    <Screen>
      <Card>
        <Chips label="Sürü" options={(herds.data ?? []).map((h) => ({ value: h.id, label: `${h.name} (${h.animalCount})` }))} value={herdId} onChange={setHerdId} />
        <Chips
          label="İşlem"
          options={[{ value: 'treatment', label: 'Aşı / İlaç' }, { value: 'location', label: 'Konum değiştir' }]}
          value={action}
          onChange={(v) => v && setAction(v)}
        />
        {herd && <Muted>{herd.animalCount} aktif hayvanın her birine ayrı kayıt düşülür.</Muted>}
      </Card>

      {!herdId ? null : action === 'location' ? (
        <Section title="Konum">
          <Card>
            <Chips options={options(locationLabel)} value={location} onChange={(v) => v && setLocation(v)} />
            <Field label="Not" value={notes} onChangeText={setNotes} placeholder="ör. Yaz merası" />
            <Button title="Tüm sürüye uygula" icon="checkmark-done" onPress={moveHerd} loading={busy} />
          </Card>
        </Section>
      ) : (
        <TreatmentForm
          submitLabel="Tüm sürüye uygula"
          onSubmit={async (req) => {
            try {
              const r = await api.post<{ count: number }>(`/api/farms/${farmId}/treatments/batch`, { herdId, animalIds: null, treatment: req });
              Alert.alert('Tamam', `${r.count} hayvana kayıt eklendi.`);
              router.back();
            } catch (e) {
              throw new Error(errorMessage(e));
            }
          }}
        />
      )}
    </Screen>
  );
}

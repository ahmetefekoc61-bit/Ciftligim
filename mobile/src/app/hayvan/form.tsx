import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { AnimalPicker } from '@/components/AnimalPicker';
import { Button, Card, Chips, DateField, ErrorBox, Field, Loading, Screen, Section, Toggle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { sexLabel, options, speciesIcon } from '@/lib/labels';
import { useFarmId } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { AnimalDetail, AnimalListItem, AnimalRequest, AnimalSex, Herd, Species } from '@/lib/types';

// Hayvan ekleme ve düzenleme (id varsa düzenleme). Küpe okutmadan gelirse earTag dolu gelir.
export default function HayvanForm() {
  const params = useLocalSearchParams<{ id?: string; earTag?: string }>();
  const editId = params.id;
  const farmId = useFarmId();

  const species = useQuery<Species[]>('/api/species');
  const herds = useQuery<Herd[]>(farmId ? `/api/farms/${farmId}/herds` : null);
  const animals = useQuery<AnimalListItem[]>(farmId ? `/api/farms/${farmId}/animals` : null);
  const existing = useQuery<AnimalDetail>(farmId && editId ? `/api/farms/${farmId}/animals/${editId}` : null);

  const [speciesId, setSpeciesId] = useState<number | null>(5);   // varsayılan: koyun
  const [breedId, setBreedId] = useState<number | null>(null);
  const [herdId, setHerdId] = useState<string | null>(null);
  const [earTag, setEarTag] = useState(params.earTag ?? '');
  const [name, setName] = useState('');
  const [sex, setSex] = useState<AnimalSex>('female');
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [estimated, setEstimated] = useState(false);
  const [motherId, setMotherId] = useState<string | null>(null);
  const [fatherId, setFatherId] = useState<string | null>(null);
  const [colorMarks, setColorMarks] = useState('');
  const [microchip, setMicrochip] = useState('');
  const [acquiredOn, setAcquiredOn] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId);

  // Düzenlemede mevcut bilgileri forma doldur
  useEffect(() => {
    const a = existing.data;
    if (!a || loaded) return;
    setSpeciesId(a.speciesId); setBreedId(a.breedId); setHerdId(a.herdId);
    setEarTag(a.earTag ?? ''); setName(a.name ?? ''); setSex(a.sex);
    setBirthDate(a.birthDate); setEstimated(a.birthDateEstimated);
    setMotherId(a.mother?.id ?? null); setFatherId(a.father?.id ?? null);
    setColorMarks(a.colorMarks ?? ''); setMicrochip(a.microchip ?? '');
    setAcquiredOn(a.acquiredOn); setNotes(a.notes ?? '');
    setLoaded(true);
  }, [existing.data, loaded]);

  // Tek sürü varsa yeni hayvanı otomatik ona koy
  useEffect(() => {
    if (!editId && herds.data?.length === 1 && herdId === null) setHerdId(herds.data[0].id);
  }, [editId, herds.data, herdId]);

  const breeds = species.data?.find((sp) => sp.id === speciesId)?.breeds ?? [];

  const save = async () => {
    setError(null);
    if (!speciesId) return setError('Tür seçin.');
    const body: AnimalRequest = {
      speciesId, breedId, herdId,
      earTag: earTag.trim() || null, microchip: microchip.trim() || null, name: name.trim() || null,
      sex, birthDate, birthDateEstimated: estimated,
      motherId, fatherId,
      colorMarks: colorMarks.trim() || null, acquiredOn, notes: notes.trim() || null,
    };
    if (!body.earTag && !body.name)
      return setError('Küpe numarası ya da isimden en az biri girilmeli (sonra bulabilmek için).');
    setBusy(true);
    try {
      const saved = editId
        ? await api.put<AnimalDetail>(`/api/farms/${farmId}/animals/${editId}`, body)
        : await api.post<AnimalDetail>(`/api/farms/${farmId}/animals`, body);
      if (editId) {
        router.back();
      } else {
        Alert.alert('Kaydedildi', 'Hayvan eklendi.', [
          { text: 'Yeni hayvan ekle', onPress: () => resetForNext() },
          { text: 'Profile git', onPress: () => router.replace({ pathname: '/hayvan/[id]', params: { id: saved.id } }) },
        ]);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Arka arkaya ekleme: tür/ırk/sürü/cinsiyet kalsın, kimlik bilgileri temizlensin
  const resetForNext = () => {
    setEarTag(''); setName(''); setMicrochip(''); setColorMarks(''); setNotes('');
    setMotherId(null); setFatherId(null);
    void animals.reload();
  };

  if (editId && !loaded) return <Screen>{existing.error ? <ErrorBox message={existing.error} /> : <Loading />}</Screen>;

  return (
    <Screen>
      <Stack.Screen options={{ title: editId ? 'Hayvanı düzenle' : 'Yeni hayvan' }} />

      <Section title="Kimlik">
        <Card>
          <Chips
            label="Tür"
            options={(species.data ?? []).map((sp) => ({ value: sp.id, label: `${speciesIcon[sp.id] ?? ''} ${sp.name}` }))}
            value={speciesId}
            onChange={(v) => { setSpeciesId(v); setBreedId(null); setMotherId(null); setFatherId(null); }}
          />
          {breeds.length > 0 && (
            <Chips label="Irk" options={breeds.map((b) => ({ value: b.id, label: b.name }))} value={breedId} onChange={setBreedId} allowNone />
          )}
          <Field label="Küpe numarası" value={earTag} onChangeText={setEarTag} autoCapitalize="characters" placeholder="ör. TR06 1234" />
          <Field label="İsim (isteğe bağlı)" value={name} onChangeText={setName} placeholder="ör. Pamuk" />
          <Chips label="Cinsiyet" options={options(sexLabel)} value={sex} onChange={(v) => v && setSex(v)} />
        </Card>
      </Section>

      <Section title="Doğum ve soy">
        <Card>
          <DateField label="Doğum tarihi" value={birthDate} onChange={setBirthDate} optional />
          {birthDate && <Toggle label="Doğum tarihi tahmini" value={estimated} onChange={setEstimated} />}
          <AnimalPicker label="Anne" animals={animals.data ?? []} sex="female" speciesId={speciesId} excludeId={editId} value={motherId} onChange={setMotherId} />
          <AnimalPicker label="Baba" animals={animals.data ?? []} sex="male" speciesId={speciesId} excludeId={editId} value={fatherId} onChange={setFatherId} />
        </Card>
      </Section>

      <Section title="Sürü ve diğer">
        <Card>
          {(herds.data?.length ?? 0) > 0 ? (
            <Chips label="Sürü" options={(herds.data ?? []).map((h) => ({ value: h.id, label: h.name }))} value={herdId} onChange={setHerdId} allowNone />
          ) : null}
          <Field label="Renk / ayırt edici işaret" value={colorMarks} onChangeText={setColorMarks} placeholder="ör. alnı beyaz" />
          <Field label="Mikroçip no" value={microchip} onChangeText={setMicrochip} autoCapitalize="characters" />
          <DateField label="Alış tarihi (satın alındıysa)" value={acquiredOn} onChange={setAcquiredOn} optional />
          <Field label="Notlar" value={notes} onChangeText={setNotes} multiline />
        </Card>
      </Section>

      {error && <ErrorBox message={error} />}
      <Button title={editId ? 'Kaydet' : 'Hayvanı ekle'} icon="checkmark" onPress={save} loading={busy} />
    </Screen>
  );
}

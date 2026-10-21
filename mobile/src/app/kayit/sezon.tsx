import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { SearchSelect } from '@/components/SearchSelect';
import { Body, Button, Card, DateField, ErrorBox, Field, Muted, Row, Screen, Toggle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtNumber, parseNumber } from '@/lib/format';
import { useFarmId } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { Crop, SeasonRecord } from '@/lib/types';

export default function Sezon() {
  const params = useLocalSearchParams<{ parcelId: string; areaM2?: string; seasonId?: string; data?: string }>();
  const farmId = useFarmId();
  const crops = useQuery<Crop[]>('/api/crops');
  const initial = useMemo<SeasonRecord | null>(() => {
    try { return params.data ? JSON.parse(params.data) : null; } catch { return null; }
  }, [params.data]);

  const [year, setYear] = useState(String(initial?.year ?? new Date().getFullYear()));
  const [fallow, setFallow] = useState(initial ? initial.cropId == null : false);
  const [cropId, setCropId] = useState<number | null>(initial?.cropId ?? null);
  const [variety, setVariety] = useState(initial?.variety ?? '');
  const [plantedDa, setPlantedDa] = useState(initial?.plantedAreaM2 ? String(initial.plantedAreaM2 / 1000).replace('.', ',') : '');
  const [sowing, setSowing] = useState<string | null>(initial?.sowingDate ?? null);
  const [harvest, setHarvest] = useState<string | null>(initial?.harvestDate ?? null);
  const [yieldKg, setYieldKg] = useState(initial?.yieldKg != null ? String(initial.yieldKg).replace('.', ',') : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parcelArea = parseNumber(params.areaM2 ?? '') ?? null;
  const area = (parseNumber(plantedDa) ?? 0) * 1000 || parcelArea;
  const y = parseNumber(yieldKg);
  const perDa = y != null && area ? y / (area / 1000) : null;

  const save = async () => {
    const yr = parseInt(year, 10);
    if (!(yr >= 1950)) return setError('Yılı yazın.');
    if (!fallow && !cropId) return setError('Ürün seçin ya da "Nadas" işaretleyin.');
    setBusy(true); setError(null);
    const body = {
      year: yr, cropId: fallow ? null : cropId, variety: variety.trim() || null,
      plantedAreaM2: parseNumber(plantedDa) ? (parseNumber(plantedDa) ?? 0) * 1000 : null,
      sowingDate: sowing, harvestDate: harvest, yieldKg: y, notes: notes.trim() || null,
    };
    try {
      const base = `/api/farms/${farmId}/parcels/${params.parcelId}/seasons`;
      if (params.seasonId) await api.put(`${base}/${params.seasonId}`, body);
      else await api.post(base, body);
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
        <Field label="Yıl" value={year} onChangeText={setYear} keyboardType="number-pad" />
        <Toggle label="Nadas (ekilmedi)" value={fallow} onChange={setFallow} />
        {!fallow && (
          <>
            <SearchSelect label="Ürün" items={(crops.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              value={cropId} onChange={(v) => setCropId(v)} max={30} />
            <Field label="Çeşit (isteğe bağlı)" value={variety} onChangeText={setVariety} placeholder="ör. Bezostaja" />
            <Field label="Ekilen alan (dekar, boşsa tarlanın tamamı)" value={plantedDa} onChangeText={setPlantedDa} keyboardType="decimal-pad" />
            <DateField label="Ekim tarihi" value={sowing} onChange={setSowing} optional />
            <DateField label="Hasat tarihi" value={harvest} onChange={setHarvest} optional />
            <Field label="Kalkan ürün (kg)" value={yieldKg} onChangeText={setYieldKg} keyboardType="decimal-pad" />
            {perDa != null && <Body style={{ marginTop: -6, marginBottom: 10 }}>→ Dekar başına {fmtNumber(perDa)} kg</Body>}
          </>
        )}
        <Field label="Not" value={notes} onChangeText={setNotes} multiline />
        <Muted>Hasattan önce ekimi kaydedip, hasatta bu kaydı açarak verimi ekleyebilirsin.</Muted>
      </Card>
      {error && <ErrorBox message={error} />}
      <Row><Button title="Kaydet" icon="checkmark" style={{ flex: 1 }} onPress={save} loading={busy} /></Row>
    </Screen>
  );
}

import { useEffect, useState } from 'react';
import { Body, Button, Card, Chips, DateField, ErrorBox, Field, Muted, Section } from './ui';
import { fmtDate, fromIsoDate, parseNumber, today, toIsoDate } from '@/lib/format';
import { options, treatmentLabel } from '@/lib/labels';
import { useFarmId } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { Medicine, TreatmentRequest, TreatmentType } from '@/lib/types';

const routes = ['Deri altı', 'Kas içi', 'Ağızdan', 'Sırttan dökme', 'Damar içi'];

function addDays(iso: string, days: number) {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

// Tek hayvan ve toplu uygulamada ortak tedavi formu
export function TreatmentForm({ submitLabel, onSubmit }: {
  submitLabel: string; onSubmit: (req: TreatmentRequest) => Promise<void>;
}) {
  const farmId = useFarmId();
  const medicines = useQuery<Medicine[]>(farmId ? `/api/farms/${farmId}/medicines` : null);

  const [type, setType] = useState<TreatmentType>('antiparasitic');
  const [medicineId, setMedicineId] = useState<string | null>(null);
  const [medicineText, setMedicineText] = useState('');
  const [dose, setDose] = useState('');
  const [doseUnit, setDoseUnit] = useState('ml');
  const [route, setRoute] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(today());
  const [description, setDescription] = useState('');
  const [meatDays, setMeatDays] = useState('');
  const [milkDays, setMilkDays] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const med = medicines.data?.find((m) => m.id === medicineId) ?? null;

  // İlaç seçilince birimi ve katalogdaki arınma sürelerini öner
  useEffect(() => {
    if (!med) return;
    setDoseUnit(med.defaultUnit);
    setMeatDays(med.meatWithdrawalDays != null ? String(med.meatWithdrawalDays) : '');
    setMilkDays(med.milkWithdrawalDays != null ? String(med.milkWithdrawalDays) : '');
    if (/aşı/i.test(med.name)) setType('vaccine');
  }, [med]);

  const day = date ?? today();
  const meatN = parseNumber(meatDays);
  const milkN = parseNumber(milkDays);

  const submit = async () => {
    setError(null);
    const doseN = parseNumber(dose);
    if (dose.trim() && (doseN == null || doseN <= 0)) return setError('Doz geçerli bir sayı olmalı.');
    if (!medicineId && !medicineText.trim() && !description.trim())
      return setError('Listeden ilaç seçin, ilaç adı yazın ya da açıklama girin.');
    // Saat bilgisi: bugünse şimdi, geçmiş günse öğlen
    const at = day === today() ? new Date() : new Date(fromIsoDate(day).getTime() + 12 * 3600_000);
    setBusy(true);
    try {
      await onSubmit({
        type, medicineId, medicineText: medicineId ? null : medicineText.trim() || null,
        dose: doseN, doseUnit: doseN != null ? doseUnit.trim() || 'ml' : null,
        route, administeredAt: at.toISOString(), description: description.trim() || null,
        meatWithdrawalUntil: meatN != null && meatN >= 0 ? addDays(day, Math.round(meatN)) : null,
        milkWithdrawalUntil: milkN != null && milkN >= 0 ? addDays(day, Math.round(milkN)) : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section title="Uygulama">
        <Card>
          <Chips label="Tür" options={options(treatmentLabel)} value={type} onChange={(v) => v && setType(v)} />
          <Chips
            label="İlaç (katalogdan)"
            options={(medicines.data ?? []).map((m) => ({ value: m.id, label: m.name }))}
            value={medicineId}
            onChange={setMedicineId}
            allowNone
          />
          {!medicineId && (
            <Field label="Ya da ilaç adı yaz" value={medicineText} onChangeText={setMedicineText} placeholder="ör. Ivermektin %1" />
          )}
          <Field label="Doz" value={dose} onChangeText={setDose} keyboardType="decimal-pad" placeholder="ör. 4" />
          {dose.trim() !== '' && <Field label="Birim" value={doseUnit} onChangeText={setDoseUnit} autoCapitalize="none" />}
          <Chips label="Uygulama yolu" options={routes.map((r) => ({ value: r, label: r }))} value={route} onChange={setRoute} allowNone />
          <DateField label="Tarih" value={date} onChange={setDate} />
          <Field label="Açıklama" value={description} onChangeText={setDescription} multiline placeholder="ör. Bahar parazit uygulaması" />
        </Card>
      </Section>

      <Section title="Arınma süresi">
        <Card>
          <Muted style={{ marginBottom: 8 }}>
            Prospektüsteki süreyi gir. Bu süre dolana kadar hayvan kesilmemeli / sütü satılmamalı. Boş bırakılırsa uyarı oluşmaz.
          </Muted>
          <Field label="Et arınma (gün)" value={meatDays} onChangeText={setMeatDays} keyboardType="number-pad" />
          {meatN != null && meatN > 0 && <Body style={{ marginTop: -6, marginBottom: 8 }}>→ {fmtDate(addDays(day, Math.round(meatN)))} tarihine kadar</Body>}
          <Field label="Süt arınma (gün)" value={milkDays} onChangeText={setMilkDays} keyboardType="number-pad" />
          {milkN != null && milkN > 0 && <Body style={{ marginTop: -6, marginBottom: 8 }}>→ {fmtDate(addDays(day, Math.round(milkN)))} tarihine kadar</Body>}
        </Card>
      </Section>

      {error && <ErrorBox message={error} />}
      <Button title={submitLabel} icon="checkmark" onPress={submit} loading={busy} />
    </>
  );
}

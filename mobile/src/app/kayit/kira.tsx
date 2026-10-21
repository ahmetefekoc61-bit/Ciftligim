import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Button, Card, DateField, ErrorBox, Field, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { parseNumber, today } from '@/lib/format';
import { useFarmId } from '@/lib/session';
import type { LeaseRecord } from '@/lib/types';

export default function Kira() {
  const params = useLocalSearchParams<{ parcelId: string; leaseId?: string; data?: string }>();
  const farmId = useFarmId();
  const initial = useMemo<LeaseRecord | null>(() => {
    try { return params.data ? JSON.parse(params.data) : null; } catch { return null; }
  }, [params.data]);

  const [who, setWho] = useState(initial?.counterparty ?? '');
  const [start, setStart] = useState<string | null>(initial?.startDate ?? today());
  const [end, setEnd] = useState<string | null>(initial?.endDate ?? null);
  const [terms, setTerms] = useState(initial?.terms ?? '');
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!who.trim()) return setError('Karşı tarafın adını yazın.');
    if (!start) return setError('Başlangıç tarihini seçin.');
    setBusy(true); setError(null);
    const body = { counterparty: who.trim(), startDate: start, endDate: end, terms: terms.trim() || null, amount: parseNumber(amount), notes: notes.trim() || null };
    try {
      const base = `/api/farms/${farmId}/parcels/${params.parcelId}/leases`;
      if (params.leaseId) await api.put(`${base}/${params.leaseId}`, body);
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
        <Field label="Kiraya veren / ortak" value={who} onChangeText={setWho} placeholder="ör. Mehmet Yılmaz" />
        <DateField label="Başlangıç" value={start} onChange={setStart} maxToday={false} />
        <DateField label="Bitiş (süresizse boş)" value={end} onChange={setEnd} optional maxToday={false} />
        <Field label="Şartlar" value={terms} onChangeText={setTerms} multiline placeholder="ör. Yıllık nakit / ürünün üçte biri" />
        <Field label="Tutar (TL, yıllık)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field label="Not" value={notes} onChangeText={setNotes} multiline />
      </Card>
      {error && <ErrorBox message={error} />}
      <Button title="Kaydet" icon="checkmark" onPress={save} loading={busy} />
    </Screen>
  );
}

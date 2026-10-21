import { useState } from 'react';
import { Alert } from 'react-native';
import { Badge, Body, Button, Card, ErrorBox, Field, Loading, Muted, Row, Screen, Section } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { parseNumber } from '@/lib/format';
import { useFarmId, useSession } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { Medicine } from '@/lib/types';

export default function Ilaclar() {
  const farmId = useFarmId();
  const { canManage } = useSession();
  const q = useQuery<Medicine[]>(farmId ? `/api/farms/${farmId}/medicines` : null);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [ingredient, setIngredient] = useState('');
  const [unit, setUnit] = useState('ml');
  const [meat, setMeat] = useState('');
  const [milk, setMilk] = useState('');
  const [busy, setBusy] = useState(false);

  const startEdit = (m: Medicine | null) => {
    setEditId(m?.id ?? null);
    setName(m && !m.isShared ? m.name : m ? `${m.name} (bizim)` : '');
    setIngredient(m?.activeIngredient ?? '');
    setUnit(m?.defaultUnit ?? 'ml');
    setMeat(m?.meatWithdrawalDays != null ? String(m.meatWithdrawalDays) : '');
    setMilk(m?.milkWithdrawalDays != null ? String(m.milkWithdrawalDays) : '');
  };

  const save = async () => {
    const body = {
      name: name.trim(), activeIngredient: ingredient.trim() || null, defaultUnit: unit.trim() || 'ml',
      meatWithdrawalDays: parseNumber(meat), milkWithdrawalDays: parseNumber(milk), notes: null,
    };
    setBusy(true);
    try {
      const own = q.data?.find((m) => m.id === editId && !m.isShared);
      if (own) await api.put(`/api/farms/${farmId}/medicines/${own.id}`, body);
      else await api.post(`/api/farms/${farmId}/medicines`, body);
      startEdit(null);
      void q.reload();
    } catch (e) {
      Alert.alert('Kaydedilemedi', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Muted style={{ marginBottom: 12 }}>
        Ortak katalogdaki ilaçlarda arınma süresi boştur, çünkü ürüne göre değişir. Sık kullandığın ilacı prospektüsteki sürelerle
        "bizim" ilacı olarak ekle; tedavi girerken süre otomatik dolar.
      </Muted>
      {q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> :
        (q.data ?? []).map((m) => (
          <Card key={m.id} onPress={canManage ? () => startEdit(m) : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '700', flex: 1 }}>{m.name}</Body>
              <Badge text={m.isShared ? 'Ortak' : 'Bizim'} tone={m.isShared ? 'neutral' : 'green'} />
            </Row>
            {m.activeIngredient && <Muted>{m.activeIngredient}</Muted>}
            <Muted>
              Et: {m.meatWithdrawalDays != null ? `${m.meatWithdrawalDays} gün` : '—'} · Süt: {m.milkWithdrawalDays != null ? `${m.milkWithdrawalDays} gün` : '—'} · Birim: {m.defaultUnit}
            </Muted>
          </Card>
        ))}

      {canManage && (
        <Section title={editId && q.data?.find((m) => m.id === editId && !m.isShared) ? 'İlacı düzenle' : 'İlaç ekle'}>
          <Card>
            <Field label="Ad" value={name} onChangeText={setName} placeholder="ör. Ivomec %1" />
            <Field label="Etken madde" value={ingredient} onChangeText={setIngredient} />
            <Field label="Birim" value={unit} onChangeText={setUnit} autoCapitalize="none" />
            <Field label="Et arınma (gün)" value={meat} onChangeText={setMeat} keyboardType="number-pad" />
            <Field label="Süt arınma (gün)" value={milk} onChangeText={setMilk} keyboardType="number-pad" />
            <Row>
              <Button title="Kaydet" icon="checkmark" style={{ flex: 1 }} onPress={save} loading={busy} />
              {editId && <Button title="Vazgeç" variant="ghost" onPress={() => startEdit(null)} />}
            </Row>
          </Card>
        </Section>
      )}
    </Screen>
  );
}

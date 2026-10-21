import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Chips, DateField, ErrorBox, Field, Row, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { parseNumber, today } from '@/lib/format';
import { operationLabel, options } from '@/lib/labels';
import { useFarmId } from '@/lib/session';
import type { OperationType } from '@/lib/types';

const unitsByType: Record<OperationType, string> = {
  tillage: 'dekar', sowing: 'kg', fertilizing: 'kg', spraying: 'lt', irrigation: 'saat', harvest: 'kg', other: '',
};

export default function Islem() {
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const farmId = useFarmId();
  const [type, setType] = useState<OperationType>('tillage');
  const [date, setDate] = useState<string | null>(today());
  const [product, setProduct] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState(unitsByType.tillage);
  const [cost, setCost] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!date) return setError('Tarih seçin.');
    setBusy(true); setError(null);
    try {
      await api.post(`/api/farms/${farmId}/parcels/${parcelId}/operations`, {
        type, performedOn: date, product: product.trim() || null,
        quantity: parseNumber(qty), unit: unit.trim() || null, cost: parseNumber(cost), description: desc.trim() || null,
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
        <Chips label="İşlem" options={options(operationLabel)} value={type} onChange={(v) => { if (v) { setType(v); setUnit(unitsByType[v]); } }} />
        <DateField label="Tarih" value={date} onChange={setDate} />
        <Field label="Kullanılan ürün" value={product} onChangeText={setProduct}
          placeholder={type === 'fertilizing' ? 'ör. DAP 18-46' : type === 'spraying' ? 'ör. yabani ot ilacı' : type === 'sowing' ? 'ör. tohum çeşidi' : ''} />
        <Row>
          <Field half label="Miktar" value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
          <Field half label="Birim" value={unit} onChangeText={setUnit} autoCapitalize="none" />
        </Row>
        <Field label="Maliyet (TL)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
        <Field label="Açıklama" value={desc} onChangeText={setDesc} multiline />
      </Card>
      {error && <ErrorBox message={error} />}
      <Button title="Kaydet" icon="checkmark" onPress={save} loading={busy} />
    </Screen>
  );
}

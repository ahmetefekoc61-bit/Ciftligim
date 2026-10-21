import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Body, Button, Card, Chips, Empty, ErrorBox, Field, Loading, Muted, Row, Screen, Section } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useFarmId, useSession } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { Herd, Member } from '@/lib/types';

export default function Suruler() {
  const farmId = useFarmId();
  const { canManage } = useSession();
  const herds = useQuery<Herd[]>(farmId ? `/api/farms/${farmId}/herds` : null);
  const members = useQuery<Member[]>(farmId && canManage ? `/api/farms/${farmId}/members` : null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const shepherds = (members.data ?? []).filter((m) => m.role === 'shepherd');

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/farms/${farmId}/herds`, { name: name.trim(), notes: null });
      setName('');
      void herds.reload();
    } catch (e) {
      Alert.alert('Eklenemedi', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (h: Herd) =>
    Alert.alert('Sürüyü sil', `"${h.name}" silinsin mi? Hayvanlar silinmez, sürüsüz kalır.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try { await api.del(`/api/farms/${farmId}/herds/${h.id}`); void herds.reload(); }
          catch (e) { Alert.alert('Silinemedi', errorMessage(e)); }
        },
      },
    ]);

  const toggleShepherd = async (h: Herd, userId: string) => {
    const assigned = h.shepherds.some((s) => s.userId === userId);
    try {
      if (assigned) await api.del(`/api/farms/${farmId}/herds/${h.id}/shepherds/${userId}`);
      else await api.post(`/api/farms/${farmId}/herds/${h.id}/shepherds`, { userId });
      void herds.reload();
    } catch (e) {
      Alert.alert('Hata', errorMessage(e));
    }
  };

  return (
    <Screen refreshing={herds.refreshing} onRefresh={herds.refresh}>
      {herds.loading ? <Loading /> : herds.error ? <ErrorBox message={herds.error} onRetry={herds.reload} /> :
        (herds.data ?? []).length === 0 ? <Empty icon="albums-outline" title="Henüz sürü yok" hint={canManage ? 'Aşağıdan ilk sürünü oluştur.' : undefined} /> :
        herds.data!.map((h) => (
          <Card key={h.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '800', fontSize: 18 }}>{h.name}</Body>
              <Badge text={`${h.animalCount} hayvan`} tone="green" />
            </Row>
            {h.notes && <Muted>{h.notes}</Muted>}
            <Muted style={{ marginTop: 6 }}>
              Çoban: {h.shepherds.length ? h.shepherds.map((s) => s.fullName).join(', ') : 'atanmamış'}
            </Muted>
            <Row style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <Button title="Hayvanlar" variant="secondary" style={{ flexGrow: 1 }} onPress={() => router.push({ pathname: '/hayvanlar', params: { herdId: h.id } })} />
              {canManage && <Button title={editing === h.id ? 'Kapat' : 'Çoban ata'} variant="ghost" onPress={() => setEditing(editing === h.id ? null : h.id)} />}
              {canManage && <Button title="Sil" variant="ghost" onPress={() => remove(h)} />}
            </Row>
            {editing === h.id && (
              <View style={{ marginTop: 8 }}>
                {shepherds.length === 0 ? (
                  <Muted>İşletmede çoban rolünde üye yok. Önce "Üyeler" ekranından çoban ekle.</Muted>
                ) : (
                  <Chips
                    label="Dokunarak ata / kaldır"
                    options={shepherds.map((m) => ({ value: m.userId, label: `${h.shepherds.some((s) => s.userId === m.userId) ? '✓ ' : ''}${m.fullName}` }))}
                    value={null}
                    onChange={(v) => v && toggleShepherd(h, v)}
                  />
                )}
              </View>
            )}
          </Card>
        ))}

      {canManage && (
        <Section title="Yeni sürü">
          <Card>
            <Field label="Sürü adı" value={name} onChangeText={setName} placeholder="ör. Koyun sürüsü, Kuzular" />
            <Button title="Ekle" icon="add" onPress={create} loading={busy} />
          </Card>
        </Section>
      )}
    </Screen>
  );
}

import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Badge, Button, Card, Empty, ErrorBox, Field, ListItem, Loading, Muted, Screen, Section } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { roleLabel } from '@/lib/labels';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { Farm } from '@/lib/types';

export default function Isletmeler() {
  const session = useSession();
  const q = useQuery<Farm[]>('/api/farms');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const choose = async (f: Farm) => {
    await session.selectFarm({ id: f.id, name: f.name, role: f.myRole });
    router.replace('/ana');
  };

  const create = async () => {
    if (name.trim().length < 2) return Alert.alert('İşletme adı', 'En az 2 karakter girin.');
    setBusy(true);
    try {
      const f = await api.post<Farm>('/api/farms', { name: name.trim() });
      setName('');
      await choose(f);
    } catch (e) {
      Alert.alert('Oluşturulamadı', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const logout = () =>
    Alert.alert('Çıkış', 'Hesaptan çıkılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: async () => { await session.signOut(); router.replace('/giris'); } },
    ]);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ headerRight: () => <Button title="Çıkış" variant="ghost" onPress={logout} style={{ minHeight: 36 }} /> }} />
      <Muted>Merhaba {session.user?.fullName}. Çalışmak istediğin işletmeyi seç.</Muted>

      <Section title="İşletmeler">
        {q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> :
          q.data && q.data.length > 0 ? q.data.map((f) => (
            <ListItem
              key={f.id}
              title={f.name}
              subtitle={`${f.animalCount} aktif hayvan`}
              right={<Badge text={roleLabel[f.myRole]} tone={f.myRole === 'owner' ? 'green' : 'blue'} />}
              onPress={() => choose(f)}
            />
          )) : (
            <Empty
              icon="home-outline"
              title="Henüz işletmen yok"
              hint="Aşağıdan yeni bir işletme oluştur. Başkasının işletmesine katılmak için sahibinden seni üye olarak eklemesini iste."
            />
          )}
      </Section>

      <Section title="Yeni işletme">
        <Card>
          <Field label="İşletme adı" value={name} onChangeText={setName} placeholder="ör. Gölbaşı Çiftliği" />
          <Button title="Oluştur" icon="add-circle-outline" onPress={create} loading={busy} />
        </Card>
      </Section>
    </Screen>
  );
}

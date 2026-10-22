import { useState } from 'react';
import { Alert } from 'react-native';
import { Badge, Body, Button, Card, Chips, ErrorBox, Field, ListItem, Loading, Muted, Row, Screen, Section } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { roleLabel } from '@/lib/labels';
import { useFarmId, useSession } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { Member, MemberRole } from '@/lib/types';

export default function Uyeler() {
  const farmId = useFarmId();
  const session = useSession();
  const me = session.user?.userId;
  const isOwner = session.farm?.role === 'owner';
  const q = useQuery<Member[]>(farmId ? `/api/farms/${farmId}/members` : null);
  const [login, setLogin] = useState('');
  const [role, setRole] = useState<MemberRole>('shepherd');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const assignable: MemberRole[] = isOwner ? ['manager', 'shepherd', 'viewer'] : ['shepherd', 'viewer'];

  const add = async () => {
    if (!login.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/farms/${farmId}/members`, { login: login.trim(), role });
      setLogin('');
      void q.reload();
    } catch (e) {
      Alert.alert('Eklenemedi', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (m: Member, r: MemberRole) => {
    try { await api.put(`/api/farms/${farmId}/members/${m.userId}`, { role: r }); setSelected(null); void q.reload(); }
    catch (e) { Alert.alert('Değiştirilemedi', errorMessage(e)); }
  };

  const remove = (m: Member) =>
    Alert.alert('Üyeyi çıkar', `${m.fullName} işletmeden çıkarılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkar', style: 'destructive', onPress: async () => {
          try { await api.del(`/api/farms/${farmId}/members/${m.userId}`); void q.reload(); }
          catch (e) { Alert.alert('Çıkarılamadı', errorMessage(e)); }
        },
      },
    ]);

  const resetPassword = (m: Member) =>
    Alert.alert('Şifreyi sıfırla', `${m.fullName} için geçici şifre oluşturulsun mu? Eski şifresi çalışmaz olur.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sıfırla', style: 'destructive', onPress: async () => {
          try {
            const r = await api.post<{ geciciSifre: string }>(`/api/farms/${farmId}/members/${m.userId}/reset-password`);
            setSelected(null);
            Alert.alert(
              'Geçici şifre',
              `${m.fullName} için yeni şifre:\n\n${r.geciciSifre}\n\nBunu kendisine ilet. Giriş yaptıktan sonra "Şifremi değiştir" ekranından kendi şifresini belirlesin.`,
            );
          } catch (e) {
            Alert.alert('Sıfırlanamadı', errorMessage(e));
          }
        },
      },
    ]);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> :
        (q.data ?? []).map((m) => (
          <Card key={m.userId}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '700' }}>{m.fullName}{m.userId === me ? ' (sen)' : ''}</Body>
              <Badge text={roleLabel[m.role]} tone={m.role === 'owner' ? 'green' : m.role === 'shepherd' ? 'amber' : 'blue'} />
            </Row>
            <Muted>{m.email ?? m.phone}</Muted>
            {session.canManage && m.role !== 'owner' && m.userId !== me && assignable.includes(m.role) && (
              selected === m.userId ? (
                <>
                  <Chips label="Yeni rol" options={assignable.map((r) => ({ value: r, label: roleLabel[r] }))} value={m.role} onChange={(v) => v && v !== m.role && changeRole(m, v)} />
                  <Row>
                    <Button title="Şifre sıfırla" icon="key-outline" variant="secondary" style={{ flex: 1 }} onPress={() => resetPassword(m)} />
                    <Button title="Üyeyi çıkar" variant="danger" style={{ flex: 1 }} onPress={() => remove(m)} />
                    <Button title="Kapat" variant="ghost" onPress={() => setSelected(null)} />
                  </Row>
                </>
              ) : <Button title="Düzenle" variant="ghost" style={{ alignSelf: 'flex-start', minHeight: 36 }} onPress={() => setSelected(m.userId)} />
            )}
          </Card>
        ))}

      {session.canManage && (
        <Section title="Üye ekle">
          <Card>
            <Muted style={{ marginBottom: 8 }}>Eklenecek kişi önce uygulamaya kendi telefonundan kayıt olmalı.</Muted>
            <Field label="E-posta ya da telefon" value={login} onChangeText={setLogin} autoCapitalize="none" keyboardType="email-address" />
            <Chips label="Rol" options={assignable.map((r) => ({ value: r, label: roleLabel[r] }))} value={role} onChange={(v) => v && setRole(v)} />
            <Button title="Ekle" icon="person-add" onPress={add} loading={busy} />
          </Card>
          <ListItem title="Roller ne yapabilir?" subtitle="Sahip/Yönetici: her şey · Çoban: atandığı sürülerde kayıt girer, hayvan ekleyip silemez · İzleyici: yalnızca görür" />
        </Section>
      )}
    </Screen>
  );
}

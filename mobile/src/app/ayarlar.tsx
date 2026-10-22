import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Alert, Image, View } from 'react-native';
import { Badge, Body, Button, Card, ListItem, Muted, Row, Screen, Section } from '@/components/ui';
import { roleLabel } from '@/lib/labels';
import { useSession } from '@/lib/session';

export default function Ayarlar() {
  const session = useSession();
  const { user, farm, canManage } = session;

  const logout = () =>
    Alert.alert('Çıkış yap', 'Hesaptan çıkılsın mı? Tekrar girerken e-posta/telefon ve şifre gerekecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkış yap', style: 'destructive', onPress: async () => {
          await session.signOut();
          router.replace('/giris');
        },
      },
    ]);

  const updated = Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.createdAt
    ? `${Updates.createdAt.toLocaleDateString('tr-TR')} ${Updates.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <Screen>
      <Card>
        <Body style={{ fontWeight: '800', fontSize: 18 }}>{user?.fullName}</Body>
        {farm && (
          <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <Muted>{farm.name}</Muted>
            <Badge text={roleLabel[farm.role]} tone="green" />
          </Row>
        )}
      </Card>

      <Section title="İşletme">
        <ListItem title="İşletme değiştir / yeni işletme" subtitle="Başka bir işletmeye geç ya da yenisini oluştur" onPress={() => router.push('/isletmeler')} />
        {canManage && <ListItem title="Üyeler ve çobanlar" subtitle="Üye ekle, rol değiştir, şifre sıfırla" onPress={() => router.push('/uyeler')} />}
      </Section>

      <Section title="Hesap">
        <ListItem title="Şifremi değiştir" subtitle="Mevcut şifrenle yeni şifre belirle" onPress={() => router.push('/sifre-degistir')} />
      </Section>

      <Button title="Çıkış yap" icon="log-out-outline" variant="danger" onPress={logout} style={{ marginTop: 8 }} />

      <View style={{ alignItems: 'center', marginTop: 28, marginBottom: 12 }}>
        <Image source={require('../../assets/aek-logo.png')} style={{ width: 120, height: 78 }} resizeMode="contain" />
        <Muted style={{ marginTop: 8, fontSize: 12, textAlign: 'center' }}>
          Çiftliğim · Sürüm {Constants.expoConfig?.version ?? '?'}{updated ? `\nSon güncelleme: ${updated}` : ''}
        </Muted>
      </View>
    </Screen>
  );
}

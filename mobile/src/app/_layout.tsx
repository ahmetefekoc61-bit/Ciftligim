import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/components/theme';
import { SessionProvider } from '@/lib/session';
import { useOtaUpdate } from '@/lib/updates';

const NO_HOME = new Set(['index', 'giris', 'isletmeler', 'ana', 'sifre-yenile']);

function HomeButton() {
  return (
    <Pressable onPress={() => router.dismissTo('/ana')} hitSlop={12} accessibilityLabel="Ana sayfa" style={{ paddingHorizontal: 6 }}>
      <Ionicons name="home-outline" size={22} color="#fff" />
    </Pressable>
  );
}

export default function RootLayout() {
  useOtaUpdate();
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={({ route }) => ({
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.bg },
            // Derindeki her ekranda sağ üstte "ana sayfa" düğmesi
            headerRight: NO_HOME.has(route.name) ? undefined : () => <HomeButton />,
          })}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="giris" options={{ title: 'Çiftliğim', headerBackVisible: false }} />
          <Stack.Screen name="sifre-yenile" options={{ title: 'Şifremi unuttum' }} />
          <Stack.Screen name="sifre-degistir" options={{ title: 'Şifremi değiştir' }} />
          <Stack.Screen name="ayarlar" options={{ title: 'Ayarlar' }} />
          <Stack.Screen name="isletmeler" options={{ title: 'İşletmelerim' }} />
          <Stack.Screen name="ana" options={{ title: 'Çiftliğim', headerBackVisible: false }} />
          <Stack.Screen name="tarim" options={{ title: 'Tarım' }} />
          <Stack.Screen name="hayvancilik" options={{ title: 'Hayvancılık' }} />
          <Stack.Screen name="hayvanlar" options={{ title: 'Hayvanlar' }} />
          <Stack.Screen name="hayvan/[id]" options={{ title: 'Hayvan' }} />
          <Stack.Screen name="hayvan/form" options={{ title: 'Hayvan' }} />
          <Stack.Screen name="kayit/tedavi" options={{ title: 'Tedavi / Aşı' }} />
          <Stack.Screen name="kayit/tartim" options={{ title: 'Tartım' }} />
          <Stack.Screen name="kayit/konum" options={{ title: 'Konum' }} />
          <Stack.Screen name="kayit/yavrulama" options={{ title: 'Yavrulama' }} />
          <Stack.Screen name="kayit/cikis" options={{ title: 'Sürüden çıkış' }} />
          <Stack.Screen name="tara" options={{ title: 'Küpe okut' }} />
          <Stack.Screen name="suruler" options={{ title: 'Sürüler' }} />
          <Stack.Screen name="toplu" options={{ title: 'Toplu işlem' }} />
          <Stack.Screen name="uyeler" options={{ title: 'Üyeler' }} />
          <Stack.Screen name="ilaclar" options={{ title: 'İlaç kataloğu' }} />
          <Stack.Screen name="arinma" options={{ title: 'Arınma süresindekiler' }} />
          <Stack.Screen name="tarlalar" options={{ title: 'Tarlalar' }} />
          <Stack.Screen name="tarla/[id]" options={{ title: 'Tarla' }} />
          <Stack.Screen name="tarla/form" options={{ title: 'Tarla' }} />
          <Stack.Screen name="harita" options={{ title: 'Harita' }} />
          <Stack.Screen name="kayit/sezon" options={{ title: 'Ekim / verim' }} />
          <Stack.Screen name="kayit/islem" options={{ title: 'Tarla işlemi' }} />
          <Stack.Screen name="kayit/kira" options={{ title: 'Kira / ortakçılık' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

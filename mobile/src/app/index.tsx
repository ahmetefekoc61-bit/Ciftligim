import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Loading } from '@/components/ui';
import { useSession } from '@/lib/session';

// Açılışta nereye gidileceğine karar verir
export default function Index() {
  const { ready, user, farm } = useSession();
  if (!ready) return <View style={{ flex: 1 }}><Loading /></View>;
  if (!user) return <Redirect href="/giris" />;
  if (!farm) return <Redirect href="/isletmeler" />;
  return <Redirect href="/ana" />;
}

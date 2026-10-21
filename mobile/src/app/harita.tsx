import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FarmMap, type FarmMapHandle } from '@/components/FarmMap';
import { colors } from '@/components/theme';
import { Body, Button, Card, Muted, Row } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { tkgm } from '@/lib/tkgm';
import { fmtArea, parcelTitle } from '@/lib/labels';
import { useFarmId, useSession } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { ParcelListItem, TkgmParcel } from '@/lib/types';

// Tüm tarlalar uydu görüntüsü üzerinde. Boş bir yere dokununca o noktadaki parsel TKGM'den sorgulanır.
export default function Harita() {
  const farmId = useFarmId();
  const { canManage } = useSession();
  const q = useQuery<ParcelListItem[]>(farmId ? `/api/farms/${farmId}/parcels` : null);
  const map = useRef<FarmMapHandle>(null);
  const [found, setFound] = useState<TkgmParcel | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookError, setLookError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const onTap = async (lat: number, lon: number) => {
    setFound(null); setLookError(null); setLooking(true);
    try {
      const t = await tkgm.parcelAt(lat, lon);
      setFound(t);
      map.current?.showTemp(t.geometry, t.centerLat, t.centerLon);
    } catch (e) {
      setLookError(errorMessage(e));
    } finally {
      setLooking(false);
    }
  };

  const locateMe = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Konum izni', 'Konumunu haritada göstermek için izin gerekli.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      map.current?.setMyLocation(pos.coords.latitude, pos.coords.longitude);
    } catch (e) {
      Alert.alert('Konum alınamadı', errorMessage(e));
    } finally {
      setLocating(false);
    }
  };

  const existing = found && (q.data ?? []).find((p) =>
    p.neighborhood === found.neighborhood && p.blockNo === found.blockNo && p.parcelNo === found.parcelNo);

  const parcels = (q.data ?? []).map((p) => ({
    id: p.id, title: p.nickname ?? `${p.blockNo}/${p.parcelNo}`, geojson: p.boundaryGeoJson, lat: p.centerLat, lon: p.centerLon,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom', 'left', 'right']}>
      {q.loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FarmMap
          ref={map}
          parcels={parcels}
          tapToQuery
          onParcelPress={(id) => router.push({ pathname: '/tarla/[id]', params: { id } })}
          onMapTap={onTap}
          style={{ flex: 1, height: undefined, borderRadius: 0 }}
        />
      )}

      <View style={st.panel}>
        {looking ? (
          <Card><Row><ActivityIndicator color={colors.primary} /><Body>TKGM'de parsel aranıyor…</Body></Row></Card>
        ) : lookError ? (
          <Card><Muted>{lookError}</Muted></Card>
        ) : found ? (
          <Card>
            <Body style={{ fontWeight: '800' }}>{found.neighborhood} · {found.blockNo} ada {found.parcelNo} parsel</Body>
            <Muted>{found.district}, {found.province} · {fmtArea(found.areaM2)}{found.quality ? ` · ${found.quality}` : ''}</Muted>
            {existing ? (
              <Button title={`Kayıtlı: ${parcelTitle(existing)} — aç`} variant="secondary" style={{ marginTop: 8 }}
                onPress={() => router.push({ pathname: '/tarla/[id]', params: { id: existing.id } })} />
            ) : canManage ? (
              <Button title="Bu parseli tarlalarıma ekle" icon="add" style={{ marginTop: 8 }}
                onPress={() => router.push({ pathname: '/tarla/form', params: { tkgm: JSON.stringify(found) } })} />
            ) : null}
          </Card>
        ) : (
          <Card>
            <Muted>Tarlana dokun → ayrıntıları aç. Boş bir yere dokun → o noktadaki parseli TKGM'den bul.</Muted>
          </Card>
        )}
        <Button title="Konumum" icon="locate" variant="secondary" onPress={locateMe} loading={locating} />
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  panel: { padding: 12, gap: 8, backgroundColor: colors.bg },
});

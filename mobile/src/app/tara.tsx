import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { colors } from '@/components/theme';
import { Button, Card, Field, Muted, Screen } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useFarmId, useSession } from '@/lib/session';
import type { AnimalDetail } from '@/lib/types';

// Küpeyi barkod/QR olarak okutur ya da numara elle yazılır → hayvanın profili açılır.
export default function Tara() {
  const farmId = useFarmId();
  const { canManage } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  const lookup = async (raw: string) => {
    const tag = raw.replace(/\s+/g, '').toUpperCase();
    if (!tag) return;
    setBusy(true);
    try {
      const a = await api.get<AnimalDetail>(`/api/farms/${farmId}/animals/by-tag/${encodeURIComponent(tag)}`);
      router.replace({ pathname: '/hayvan/[id]', params: { id: a.id } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        Alert.alert(
          'Kayıtlı değil',
          `${tag} küpe numaralı hayvan bulunamadı.`,
          [
            { text: 'Tamam', style: 'cancel', onPress: () => { locked.current = false; } },
            ...(canManage ? [{
              text: 'Bu küpeyle ekle',
              onPress: () => router.replace({ pathname: '/hayvan/form', params: { earTag: tag } }),
            }] : []),
          ],
        );
      } else {
        Alert.alert('Hata', errorMessage(e), [{ text: 'Tamam', onPress: () => { locked.current = false; } }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const onScan = (r: BarcodeScanningResult) => {
    if (locked.current) return;
    locked.current = true;
    void lookup(r.data);
  };

  return (
    <Screen>
      <Card>
        <Field
          label="Küpe numarasını yaz"
          value={manual}
          onChangeText={setManual}
          autoCapitalize="characters"
          placeholder="ör. TR061234"
          onSubmitEditing={() => lookup(manual)}
          returnKeyType="search"
        />
        <Button title="Bul" icon="search" onPress={() => lookup(manual)} loading={busy} />
      </Card>

      <Card>
        <Muted style={{ marginBottom: 10 }}>
          Ya da küpedeki barkodu / QR kodu kameraya göster. (Barkodsuz küpelerde numarayı yukarıya yaz.)
        </Muted>
        {!permission ? null : !permission.granted ? (
          <Button title="Kameraya izin ver" icon="camera" variant="secondary" onPress={requestPermission} />
        ) : (
          <View style={st.cameraBox}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'datamatrix', 'pdf417'] }}
              onBarcodeScanned={busy ? undefined : onScan}
            />
            <View style={st.frame} pointerEvents="none" />
          </View>
        )}
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  cameraBox: { height: 320, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
  frame: { position: 'absolute', left: '12%', right: '12%', top: '30%', bottom: '30%', borderWidth: 3, borderColor: colors.accent, borderRadius: 12 },
});

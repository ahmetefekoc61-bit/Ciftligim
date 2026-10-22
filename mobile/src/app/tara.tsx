import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ocrSupported, recognizeText } from '../../modules/kupe-ocr';

// 1. yol: telefonda ML Kit (internetsiz). 2. yol: sunucuda Tesseract (telefon okuyamazsa).
async function extractTextFromImage(uri: string): Promise<string[]> {
  const r = await recognizeText(uri);
  const out: string[] = [];
  for (const b of r?.blocks ?? []) {
    out.push(b.text);
    for (const l of b.lines ?? []) out.push(l);
  }
  return out.length ? out : (r?.text ? [r.text] : []);
}

async function extractTextOnServer(uri: string): Promise<string[]> {
  const form = new FormData();
  form.append('image', { uri, name: 'kupe.jpg', type: 'image/jpeg' } as unknown as Blob);
  const r = await api.upload<{ lines: string[] }>('/api/ocr', form);
  return r.lines ?? [];
}
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { animalTitle } from '@/components/AnimalRow';
import { colors } from '@/components/theme';
import { Badge, Body, Button, Card, Chips, Field, ListItem, Muted, Row, Screen, Section } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { extractCandidates, matchTags, normalizeTag, type TagMatch } from '@/lib/earTagOcr';
import { setScannedTag } from '@/lib/scanResult';
import { useFarmId, useSession } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { AnimalDetail, AnimalListItem } from '@/lib/types';

type Mode = 'text' | 'barcode';

// Çerçeve: önizleme kutusunun içindeki oran (yazı buraya hizalanır)
const FRAME = { left: 0.08, right: 0.08, top: 0.3, bottom: 0.3 };

// Küpe okutma:
//  - Yazı modu: fotoğraf çekilir, çerçeve kırpılıp büyütülür, telefonda (internetsiz) ML Kit ile okunur,
//    okunan numaralar sürüdeki küpelerle benzerliğe göre eşleştirilir (silik yazıda 1-2 hata tolere edilir).
//  - Barkod modu: küpede barkod/QR varsa canlı okur.
//  - mode=pick ile açılırsa (hayvan ekleme formu) seçilen numara forma döner.
export default function Tara() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const pickMode = params.mode === 'pick';
  const farmId = useFarmId();
  const { canManage } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('text');
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverReading, setServerReading] = useState(false);
  const [manual, setManual] = useState('');
  const [candidates, setCandidates] = useState<string[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [box, setBox] = useState({ w: 0, h: 0 });
  const camera = useRef<CameraView>(null);
  const locked = useRef(false);

  // Eşleştirme için sürüdeki tüm hayvanlar (satılan/ölenler dahil değil)
  const animals = useQuery<AnimalListItem[]>(farmId ? `/api/farms/${farmId}/animals` : null);
  const matches: TagMatch<AnimalListItem>[] = useMemo(
    () => (candidates.length ? matchTags(candidates, animals.data ?? [], (a) => a.earTag) : []),
    [candidates, animals.data],
  );

  const choose = async (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag) return;
    if (pickMode) {
      setScannedTag(tag);
      router.back();
      return;
    }
    setBusy(true);
    try {
      const a = await api.get<AnimalDetail>(`/api/farms/${farmId}/animals/by-tag/${encodeURIComponent(tag)}`);
      router.replace({ pathname: '/hayvan/[id]', params: { id: a.id } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        Alert.alert('Kayıtlı değil', `${tag} küpe numaralı hayvan bulunamadı.`, [
          { text: 'Tamam', style: 'cancel', onPress: () => { locked.current = false; } },
          ...(canManage ? [{ text: 'Bu küpeyle ekle', onPress: () => router.replace({ pathname: '/hayvan/form', params: { earTag: tag } }) }] : []),
        ]);
      } else {
        Alert.alert('Hata', errorMessage(e), [{ text: 'Tamam', onPress: () => { locked.current = false; } }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const onBarcode = (r: BarcodeScanningResult) => {
    if (locked.current) return;
    locked.current = true;
    void choose(r.data);
  };

  // Fotoğraf çek → çerçeveyi kırp, büyüt → oku
  const readText = async () => {
    if (!camera.current) return;
    setBusy(true); setCandidates([]); setRawText('');
    try {
      let photo: { uri: string; width: number; height: number };
      try {
        const p = await camera.current.takePictureAsync({ quality: 1 });
        if (!p?.uri) throw new Error('Kamera fotoğraf döndürmedi.');
        photo = p;
      } catch (e) {
        Alert.alert('Fotoğraf çekilemedi', `${errorMessage(e)}\n\nKamerayı kapatıp açmayı (geri çıkıp tekrar gir) dene.`);
        return;
      }

      const results: string[] = [];
      let ocrError: unknown = null;
      let cropUri: string | null = null;

      // Çerçeve bölgesini kes ve büyüt (önizleme "cover" ile gösterildiği için ölçek hesabı gerekir)
      try {
        if (box.w > 0 && box.h > 0 && photo.width > 0 && photo.height > 0) {
          const scale = Math.max(box.w / photo.width, box.h / photo.height);
          const offX = (photo.width * scale - box.w) / 2;
          const offY = (photo.height * scale - box.h) / 2;
          const x = Math.max(0, (box.w * FRAME.left + offX) / scale);
          const y = Math.max(0, (box.h * FRAME.top + offY) / scale);
          const width = Math.min(photo.width - x, (box.w * (1 - FRAME.left - FRAME.right)) / scale);
          const height = Math.min(photo.height - y, (box.h * (1 - FRAME.top - FRAME.bottom)) / scale);
          const img = await ImageManipulator.manipulate(photo.uri)
            .crop({ originX: Math.round(x), originY: Math.round(y), width: Math.round(width), height: Math.round(height) })
            .resize({ width: 1600 })
            .renderAsync();
          cropUri = (await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 })).uri;
        }
      } catch { cropUri = null; }

      // 1) Telefonda oku (çerçeve, sonra tüm fotoğraf)
      if (ocrSupported) {
        for (const u of [cropUri, photo.uri]) {
          if (!u) continue;
          try { results.push(...await extractTextFromImage(u)); } catch (e) { ocrError = ocrError ?? e; }
        }
      }

      // 2) Telefon okuyamadıysa (ya da numara çıkmadıysa) fotoğrafı sunucuya gönder
      if (extractCandidates(results).length === 0) {
        try {
          let sendUri = cropUri;
          if (!sendUri) {
            const img = await ImageManipulator.manipulate(photo.uri).resize({ width: 1600 }).renderAsync();
            sendUri = (await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 })).uri;
          }
          setServerReading(true);
          results.push(...await extractTextOnServer(sendUri));
          ocrError = null;
        } catch (e) {
          ocrError = ocrError ?? e;
        } finally {
          setServerReading(false);
        }
      }

      if (results.length === 0 && ocrError) {
        Alert.alert('Yazı okunamadı', `${errorMessage(ocrError)}\n\nNumarayı aşağıdan elle yazabilirsin.`);
        return;
      }

      const c = extractCandidates(results);
      setRawText(results.join(' · ').slice(0, 300));
      setCandidates(c);
      if (c.length === 0) {
        Alert.alert('Numara okunamadı', 'Küpeyi çerçeveye yaklaştırıp tekrar dene. Karanlıksa feneri aç, parlıyorsa açıyı biraz değiştir.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <Screen>
      <Stack.Screen options={{ title: pickMode ? 'Küpe numarasını oku' : 'Küpe okut' }} />

      <Chips
        options={[
          { value: 'text' as Mode, label: '🔤 Yazıyı oku' },
          { value: 'barcode', label: '▦ Barkod / QR' },
        ]}
        value={mode}
        onChange={(v) => { if (v) { setMode(v); setCandidates([]); locked.current = false; } }}
      />

      <Card>
        {!permission ? null : !permission.granted ? (
          <Button title="Kameraya izin ver" icon="camera" variant="secondary" onPress={requestPermission} />
        ) : (
          <>
            <View style={st.cameraBox} onLayout={onLayout}>
              <CameraView
                ref={camera}
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torch}
                autofocus="on"
                barcodeScannerSettings={mode === 'barcode'
                  ? { barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'datamatrix', 'pdf417'] }
                  : undefined}
                onBarcodeScanned={mode === 'barcode' && !busy ? onBarcode : undefined}
              />
              <View pointerEvents="none" style={[st.frame, {
                left: `${FRAME.left * 100}%`, right: `${FRAME.right * 100}%`, top: `${FRAME.top * 100}%`, bottom: `${FRAME.bottom * 100}%`,
              }]} />
              <Pressable onPress={() => setTorch((t) => !t)} style={st.torch}>
                <Text style={{ fontSize: 22 }}>{torch ? '🔦' : '💡'}</Text>
              </Pressable>
              {busy && <View style={st.busy}><ActivityIndicator size="large" color="#fff" /><Text style={{ color: '#fff', marginTop: 8, textAlign: 'center' }}>{serverReading ? 'Sunucuda okunuyor…\n(ilk seferde 1 dk sürebilir)' : 'Okunuyor…'}</Text></View>}
            </View>
            {mode === 'text' ? (
              <>
                <Muted style={{ marginTop: 8 }}>Küpedeki numarayı sarı çerçeveye al, sabit tut ve bas. Silikse feneri aç, birkaç kez dene.</Muted>
                <Button title="Fotoğraf çek ve oku" icon="scan" onPress={readText} loading={busy} style={{ marginTop: 8 }} />
              </>
            ) : (
              <Muted style={{ marginTop: 8 }}>Barkodu çerçeveye göster, kendiliğinden okur.</Muted>
            )}
          </>
        )}
      </Card>

      {matches.length > 0 && (
        <Section title="Sürüde eşleşenler">
          {matches.map((m) => (
            <ListItem
              key={m.tag}
              title={animalTitle(m.item)}
              subtitle={`Okunan: ${m.candidate} · ${m.label}`}
              right={<Badge text={`%${m.score}`} tone={m.score >= 90 ? 'green' : 'amber'} />}
              onPress={() => (pickMode ? choose(m.tag) : router.replace({ pathname: '/hayvan/[id]', params: { id: m.item.id } }))}
            />
          ))}
        </Section>
      )}

      {candidates.length > 0 && (
        <Section title={matches.length ? 'Diğer okunan numaralar' : 'Okunan numaralar'}>
          <Card>
            <Muted style={{ marginBottom: 8 }}>Doğru olana dokun{pickMode ? '' : ' (kayıtlıysa açılır, değilse eklemeyi önerir)'}. Yanlışsa aşağıdan düzelt.</Muted>
            <Row style={{ flexWrap: 'wrap' }}>
              {candidates.slice(0, 8).map((c) => (
                <Button key={c} title={c} variant="secondary" style={{ minHeight: 40 }} onPress={() => choose(c)} />
              ))}
            </Row>
            {!!rawText && <Muted style={{ marginTop: 8, fontSize: 12 }}>Görülen yazı: {rawText}</Muted>}
          </Card>
        </Section>
      )}

      <Section title="Elle yaz">
        <Card>
          <Field
            label="Küpe numarası"
            value={manual}
            onChangeText={setManual}
            autoCapitalize="characters"
            placeholder="ör. TR061234"
            onSubmitEditing={() => choose(manual)}
            returnKeyType="search"
          />
          <Button title={pickMode ? 'Bunu kullan' : 'Bul'} icon={pickMode ? 'checkmark' : 'search'} onPress={() => choose(manual)} loading={busy} />
        </Card>
      </Section>
    </Screen>
  );
}

const st = StyleSheet.create({
  cameraBox: { height: 340, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
  frame: { position: 'absolute', borderWidth: 3, borderColor: colors.accent, borderRadius: 12 },
  torch: { position: 'absolute', right: 10, top: 10, backgroundColor: 'rgba(0,0,0,.45)', borderRadius: 999, padding: 8 },
  busy: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' },
});

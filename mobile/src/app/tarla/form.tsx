import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FarmMap } from '@/components/FarmMap';
import { SearchSelect } from '@/components/SearchSelect';
import { Body, Button, Card, Chips, ErrorBox, Field, Loading, Muted, Row, Screen, Section } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtNumber, parseNumber } from '@/lib/format';
import { fmtArea, options, ownershipLabel } from '@/lib/labels';
import { useFarmId } from '@/lib/session';
import { tkgm } from '@/lib/tkgm';
import { useQuery } from '@/lib/useQuery';
import type { OwnershipType, ParcelDetail, ParcelRequest, TkgmItem, TkgmParcel } from '@/lib/types';

// Tarla ekle / düzenle. Haritadan gelirse TKGM sonucu "tkgm" parametresinde JSON olarak gelir.
export default function TarlaForm() {
  const params = useLocalSearchParams<{ id?: string; tkgm?: string }>();
  const editId = params.id;
  const farmId = useFarmId();
  const existing = useQuery<ParcelDetail>(farmId && editId ? `/api/farms/${farmId}/parcels/${editId}` : null);

  // TKGM seçimleri
  const [provinces, setProvinces] = useState<TkgmItem[]>([]);
  const [districts, setDistricts] = useState<TkgmItem[]>([]);
  const [hoods, setHoods] = useState<TkgmItem[]>([]);
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [hoodId, setHoodId] = useState<number | null>(null);
  const [listLoading, setListLoading] = useState<'il' | 'ilce' | 'mahalle' | null>(null);
  const [tkgmError, setTkgmError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  // Tarla bilgileri
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [hood, setHood] = useState('');
  const [tkgmHoodId, setTkgmHoodId] = useState<number | null>(null);
  const [block, setBlock] = useState('');
  const [parcel, setParcel] = useState('');
  const [nickname, setNickname] = useState('');
  const [locality, setLocality] = useState('');
  const [quality, setQuality] = useState('');
  const [areaDa, setAreaDa] = useState('');           // dekar olarak girilir
  const [ownership, setOwnership] = useState<OwnershipType>('owned');
  const [shareNum, setShareNum] = useState('');
  const [shareDen, setShareDen] = useState('');
  const [titleOwner, setTitleOwner] = useState('');
  const [notes, setNotes] = useState('');
  const [geometry, setGeometry] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [fromTkgm, setFromTkgm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId);

  const applyTkgm = (t: TkgmParcel) => {
    setProvince(t.province); setDistrict(t.district); setHood(t.neighborhood);
    setTkgmHoodId(t.neighborhoodId);
    setBlock(String(t.blockNo)); setParcel(String(t.parcelNo));
    if (t.areaM2) setAreaDa(String(+(t.areaM2 / 1000).toFixed(3)).replace('.', ','));
    if (t.quality) setQuality(t.quality);
    if (t.locality) setLocality(t.locality);
    setGeometry(t.geometry ? JSON.stringify(t.geometry) : null);
    setCenter(t.centerLat != null && t.centerLon != null ? { lat: t.centerLat, lon: t.centerLon } : null);
    setFromTkgm(true);
  };

  // Haritadan gelen TKGM sonucu
  useEffect(() => {
    if (params.tkgm) {
      try { applyTkgm(JSON.parse(params.tkgm) as TkgmParcel); } catch { /* yok say */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tkgm]);

  // Düzenlemede mevcut bilgiler
  useEffect(() => {
    const p = existing.data;
    if (!p || loaded) return;
    setProvince(p.province); setDistrict(p.district); setHood(p.neighborhood); setTkgmHoodId(p.tkgmNeighborhoodId);
    setBlock(String(p.blockNo)); setParcel(String(p.parcelNo));
    setNickname(p.nickname ?? ''); setLocality(p.locality ?? ''); setQuality(p.quality ?? '');
    setAreaDa(p.areaM2 != null ? String(+(p.areaM2 / 1000).toFixed(3)).replace('.', ',') : '');
    setOwnership(p.ownership);
    setShareNum(p.shareNumerator ? String(p.shareNumerator) : ''); setShareDen(p.shareDenominator ? String(p.shareDenominator) : '');
    setTitleOwner(p.titleOwner ?? ''); setNotes(p.notes ?? '');
    setCenter(p.centerLat != null && p.centerLon != null ? { lat: p.centerLat, lon: p.centerLon } : null);
    setLoaded(true);
  }, [existing.data, loaded]);

  // İl listesi
  useEffect(() => {
    setListLoading('il');
    tkgm.provinces()
      .then(setProvinces)
      .catch((e) => setTkgmError(errorMessage(e)))
      .finally(() => setListLoading(null));
  }, []);

  const pickProvince = (id: number | null) => {
    setProvinceId(id); setDistrictId(null); setHoodId(null); setDistricts([]); setHoods([]);
    if (!id) return;
    setListLoading('ilce'); setTkgmError(null);
    tkgm.districts(id)
      .then(setDistricts).catch((e) => setTkgmError(errorMessage(e))).finally(() => setListLoading(null));
  };

  const pickDistrict = (id: number | null) => {
    setDistrictId(id); setHoodId(null); setHoods([]);
    if (!id) return;
    setListLoading('mahalle'); setTkgmError(null);
    tkgm.neighborhoods(id)
      .then(setHoods).catch((e) => setTkgmError(errorMessage(e))).finally(() => setListLoading(null));
  };

  const fetchFromTkgm = async () => {
    const hoodToUse = hoodId ?? tkgmHoodId;
    const b = parseInt(block, 10); const pa = parseInt(parcel, 10);
    if (!hoodToUse) return setTkgmError('Önce il, ilçe ve mahalle/köy seçin.');
    if (!(b >= 0) || !(pa > 0)) return setTkgmError('Ada ve parsel numarasını yazın (ada yoksa 0).');
    setFetching(true); setTkgmError(null);
    try {
      const t = await tkgm.parcel(hoodToUse, b, pa);
      applyTkgm(t);
    } catch (e) {
      setTkgmError(errorMessage(e));
    } finally {
      setFetching(false);
    }
  };

  const save = async () => {
    setError(null);
    const b = parseInt(block, 10); const pa = parseInt(parcel, 10);
    if (!province.trim() || !district.trim() || !hood.trim()) return setError('İl, ilçe ve mahalle/köy gerekli.');
    if (!(b >= 0) || !(pa > 0)) return setError('Ada (yoksa 0) ve parsel numarası gerekli.');
    const da = parseNumber(areaDa);
    if (areaDa.trim() && (da == null || da <= 0)) return setError('Alan geçerli bir sayı olmalı (dekar).');
    const body: ParcelRequest = {
      province: province.trim(), district: district.trim(), neighborhood: hood.trim(), tkgmNeighborhoodId: tkgmHoodId,
      blockNo: b, parcelNo: pa, nickname: nickname.trim() || null, locality: locality.trim() || null,
      quality: quality.trim() || null, areaM2: da != null ? Math.round(da * 1000 * 100) / 100 : null,
      ownership, shareNumerator: ownership === 'shared' ? parseInt(shareNum, 10) || null : null,
      shareDenominator: ownership === 'shared' ? parseInt(shareDen, 10) || null : null,
      titleOwner: titleOwner.trim() || null, boundaryGeoJson: geometry,
      centerLat: center?.lat ?? null, centerLon: center?.lon ?? null, fromTkgm, notes: notes.trim() || null,
    };
    setBusy(true);
    try {
      const saved = editId
        ? await api.put<ParcelDetail>(`/api/farms/${farmId}/parcels/${editId}`, body)
        : await api.post<ParcelDetail>(`/api/farms/${farmId}/parcels`, body);
      if (editId) router.back();
      else router.replace({ pathname: '/tarla/[id]', params: { id: saved.id } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (editId && !loaded) return <Screen>{existing.error ? <ErrorBox message={existing.error} /> : <Loading />}</Screen>;

  return (
    <Screen>
      <Stack.Screen options={{ title: editId ? 'Tarlayı düzenle' : 'Yeni tarla' }} />

      <Section title="TKGM'den getir">
        <Card>
          <Muted style={{ marginBottom: 10 }}>
            İl, ilçe ve mahalle/köyü seç; ada ve parsel numarasını yaz. Alan, nitelik ve harita sınırı otomatik dolar.
          </Muted>
          <SearchSelect label="İl" items={provinces.map((i) => ({ value: i.id, label: i.name }))} value={provinceId}
            onChange={(v) => pickProvince(v)} loading={listLoading === 'il'} placeholder="İl ara (ör. Ankara)" />
          {provinceId && (
            <SearchSelect label="İlçe" items={districts.map((i) => ({ value: i.id, label: i.name }))} value={districtId}
              onChange={(v) => pickDistrict(v)} loading={listLoading === 'ilce'} placeholder="İlçe ara" />
          )}
          {districtId && (
            <SearchSelect label="Mahalle / köy" items={hoods.map((i) => ({ value: i.id, label: i.name }))} value={hoodId}
              onChange={(v) => setHoodId(v)} loading={listLoading === 'mahalle'} placeholder="Mahalle/köy ara" />
          )}
          <Row>
            <Field half label="Ada" value={block} onChangeText={setBlock} keyboardType="number-pad" placeholder="0" />
            <Field half label="Parsel" value={parcel} onChangeText={setParcel} keyboardType="number-pad" />
          </Row>
          {tkgmError && <ErrorBox message={tkgmError} />}
          <Button title="TKGM'den getir" icon="cloud-download-outline" variant="secondary" onPress={fetchFromTkgm} loading={fetching} />
        </Card>
      </Section>

      {geometry && (
        <FarmMap
          parcels={[{ id: 'yeni', title: `${block}/${parcel}`, geojson: geometry, lat: center?.lat ?? null, lon: center?.lon ?? null }]}
          focusId="yeni"
          style={{ marginTop: 4, marginBottom: 4 }}
        />
      )}
      {fromTkgm && (
        <Card style={{ backgroundColor: '#E3EFE2' }}>
          <Body style={{ fontWeight: '700' }}>✓ TKGM'den alındı</Body>
          <Muted>{province} / {district} / {hood} · {block} ada {parcel} parsel</Muted>
          {areaDa ? <Muted>{fmtArea((parseNumber(areaDa) ?? 0) * 1000)} {quality ? `· ${quality}` : ''}</Muted> : null}
        </Card>
      )}

      <Section title="Tarla bilgileri">
        <Card>
          <Field label="Tarlaya verdiğin ad" value={nickname} onChangeText={setNickname} placeholder="ör. Dere tarla" />
          <Field label="İl" value={province} onChangeText={setProvince} />
          <Field label="İlçe" value={district} onChangeText={setDistrict} />
          <Field label="Mahalle / köy" value={hood} onChangeText={setHood} />
          {!fromTkgm && (
            <Row>
              <Field half label="Ada" value={block} onChangeText={setBlock} keyboardType="number-pad" />
              <Field half label="Parsel" value={parcel} onChangeText={setParcel} keyboardType="number-pad" />
            </Row>
          )}
          <Field label="Alan (dekar)" value={areaDa} onChangeText={setAreaDa} keyboardType="decimal-pad"
            hint={parseNumber(areaDa) ? `${fmtNumber((parseNumber(areaDa) ?? 0) * 1000, 0)} m²` : '1 dekar = 1 dönüm = 1000 m²'} />
          <Field label="Mevki" value={locality} onChangeText={setLocality} placeholder="ör. Kuyulu" />
          <Field label="Nitelik" value={quality} onChangeText={setQuality} placeholder="ör. Tarla" />
        </Card>
      </Section>

      <Section title="Sahiplik">
        <Card>
          <Chips options={options(ownershipLabel)} value={ownership} onChange={(v) => v && setOwnership(v)} />
          {ownership === 'shared' && (
            <Row>
              <Field half label="Pay" value={shareNum} onChangeText={setShareNum} keyboardType="number-pad" placeholder="1" />
              <Field half label="Payda" value={shareDen} onChangeText={setShareDen} keyboardType="number-pad" placeholder="3" />
            </Row>
          )}
          <Field label="Tapudaki malik" value={titleOwner} onChangeText={setTitleOwner} />
          <Field label="Not" value={notes} onChangeText={setNotes} multiline />
        </Card>
      </Section>

      {error && <ErrorBox message={error} />}
      <Button title={editId ? 'Kaydet' : 'Tarlayı ekle'} icon="checkmark" onPress={save} loading={busy} />
    </Screen>
  );
}

// TKGM Parsel Sorgu — telefon doğrudan sorgular (Türkiye IP'si). Olmazsa sunucu üzerinden dener.
// Resmi/açık bir API değil: yalnızca kullanıcı istediğinde tek parsel sorulur, listeler bellekte tutulur.
import { api } from './api';
import type { TkgmItem, TkgmParcel } from './types';

const BASE = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/';
const PROVINCES_URL = 'https://parselsorgu.tkgm.gov.tr/app/modules/administrativeQuery/data/ilListe.json';

const cache = new Map<string, TkgmItem[]>();

async function getJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* boş */ }
    const message = data && typeof data === 'object' && !Array.isArray(data) ? (data.Message ?? data.message) : null;
    if (!res.ok || data == null || message) throw new Error(message ? `TKGM: ${message}` : `TKGM yanıt vermedi (${res.status}).`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function parseList(data: any): TkgmItem[] {
  const list: TkgmItem[] = [];
  for (const f of data?.features ?? []) {
    const p = f?.properties ?? {};
    const id = Number(p.id);
    const name = p.text ?? p.ad ?? p.name;
    if (Number.isFinite(id) && name) list.push({ id, name: String(name).trim() });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

function parseArea(v: unknown): number | null {
  if (typeof v === 'number') return v > 0 ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseParcel(data: any, neighborhoodId: number | null): TkgmParcel {
  if (data?.type !== 'Feature' || !data.properties) throw new Error('TKGM\'de bu parsel bulunamadı.');
  const p = data.properties;
  const geometry = data.geometry ?? null;
  let lat: number | null = null; let lon: number | null = null;
  let ring: any = geometry?.coordinates;
  while (Array.isArray(ring) && Array.isArray(ring[0]) && Array.isArray(ring[0][0])) ring = ring[0];
  if (Array.isArray(ring) && ring.length) {
    const pts = ring.filter((c: any) => Array.isArray(c) && c.length >= 2);
    lon = pts.reduce((s: number, c: number[]) => s + c[0], 0) / pts.length;
    lat = pts.reduce((s: number, c: number[]) => s + c[1], 0) / pts.length;
  }
  const str = (k: string) => (p[k] == null || String(p[k]).trim() === '' ? null : String(p[k]).trim());
  return {
    neighborhoodId: Number(p.mahalleId) || neighborhoodId,
    province: str('ilAd') ?? '', district: str('ilceAd') ?? '', neighborhood: str('mahalleAd') ?? '',
    blockNo: Number(p.adaNo) || 0, parcelNo: Number(p.parselNo) || 0,
    areaM2: parseArea(p.alan), quality: str('nitelik'), locality: str('mevkii') ?? str('mevki'), sheet: str('pafta'),
    geometry, centerLat: lat, centerLon: lon,
  };
}

/** Önce telefondan, olmazsa sunucudan dene */
async function withFallback<T>(direct: () => Promise<T>, viaServer: () => Promise<T>): Promise<T> {
  try {
    return await direct();
  } catch (e) {
    try { return await viaServer(); } catch { throw e; }
  }
}

async function cachedList(key: string, url: string, serverPath: string): Promise<TkgmItem[]> {
  const hit = cache.get(key);
  if (hit) return hit;
  const list = await withFallback(async () => parseList(await getJson(url)), () => api.get<TkgmItem[]>(serverPath));
  cache.set(key, list);
  return list;
}

export const tkgm = {
  provinces: () => cachedList('il', PROVINCES_URL, '/api/tkgm/iller'),
  districts: (provinceId: number) =>
    cachedList(`ilce:${provinceId}`, `${BASE}idariYapi/ilceListe/${provinceId}`, `/api/tkgm/ilceler/${provinceId}`),
  neighborhoods: (districtId: number) =>
    cachedList(`mah:${districtId}`, `${BASE}idariYapi/mahalleListe/${districtId}`, `/api/tkgm/mahalleler/${districtId}`),
  parcel: (neighborhoodId: number, block: number, parcel: number) =>
    withFallback(
      async () => parseParcel(await getJson(`${BASE}parsel/${neighborhoodId}/${block}/${parcel}`), neighborhoodId),
      () => api.get<TkgmParcel>(`/api/tkgm/parsel/${neighborhoodId}/${block}/${parcel}`)),
  parcelAt: (lat: number, lon: number) =>
    withFallback(
      async () => parseParcel(await getJson(`${BASE}parsel/${lat.toFixed(6)}/${lon.toFixed(6)}/`), null),
      () => api.get<TkgmParcel>(`/api/tkgm/konum?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`)),
};

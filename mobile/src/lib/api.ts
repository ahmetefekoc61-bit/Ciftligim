// Backend ile konuşan tek yer. Sunucu adresi ve token oturumdan (session.tsx) buraya yazılır.

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const state = {
  baseUrl: '',
  token: null as string | null,
  onUnauthorized: () => {},
};

export function configureApi(baseUrl: string, token: string | null, onUnauthorized: () => void) {
  state.baseUrl = normalizeUrl(baseUrl);
  state.token = token;
  state.onUnauthorized = onUnauthorized;
}

/**
 * Sunucu adresini tamamlar:
 *  "192.168.1.5"            → "http://192.168.1.5:5029"   (evdeki bilgisayar)
 *  "ciftligim.onrender.com" → "https://ciftligim.onrender.com" (bulut)
 */
export function normalizeUrl(input: string): string {
  let u = input.trim().replace(/\/+$/, '');
  if (!u) return '';
  const isLocal = /^(https?:\/\/)?(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?$/i.test(u);
  if (!/^https?:\/\//i.test(u)) u = `${isLocal ? 'http' : 'https'}://${u}`;
  if (isLocal && !/:\d+$/.test(u.replace(/^https?:\/\//i, ''))) u = `${u}:5029`;
  return u;
}

async function request<T>(method: string, path: string, body?: unknown, baseOverride?: string): Promise<T> {
  const base = baseOverride ?? state.baseUrl;
  if (!base) throw new ApiError('Sunucu adresi girilmemiş.', 0);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75000)   // ücretsiz sunucu uykudan ~1 dk.da uyanır;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      'Sunucuya ulaşılamadı. Bilgisayarda API çalışıyor mu, telefon aynı Wi-Fi ağında mı, adres doğru mu?',
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    if (res.status === 401 && state.token) state.onUnauthorized();
    const message =
      (data && typeof data === 'object' && (data.hata || data.title)) ||
      (res.status === 401 ? 'Oturum süresi doldu, tekrar giriş yapın.' :
       res.status === 403 ? 'Bu işlem için yetkiniz yok.' :
       res.status === 404 ? 'Kayıt bulunamadı.' : `Sunucu hatası (${res.status}).`);
    // ASP.NET doğrulama hataları: { errors: { Alan: ["mesaj"] } }
    if (data?.errors && typeof data.errors === 'object') {
      const first = Object.values(data.errors as Record<string, string[]>)[0]?.[0];
      throw new ApiError(first ? `Geçersiz veri: ${first}` : String(message), res.status);
    }
    throw new ApiError(String(message), res.status);
  }
  return data as T;
}

/** Fotoğraf gibi dosya gönderimi (multipart/form-data). */
async function upload<T>(path: string, form: FormData): Promise<T> {
  if (!state.baseUrl) throw new ApiError('Sunucu adresi girilmemiş.', 0);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let res: Response;
  try {
    res = await fetch(`${state.baseUrl}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
      body: form,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.', 0);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    if (res.status === 401 && state.token) state.onUnauthorized();
    throw new ApiError(String((data && data.hata) || `Sunucu hatası (${res.status}).`), res.status);
  }
  return data as T;
}

export const api = {
  upload,
  get: <T>(path: string) => request<T>('GET', path),
  post: <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T = unknown>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  del: <T = unknown>(path: string) => request<T>('DELETE', path),
  /** Giriş ekranında, henüz kaydedilmemiş bir adresi denemek için */
  ping: (baseUrl: string) => request<{ veritabani: string }>('GET', '/health/db', undefined, normalizeUrl(baseUrl)),
  postTo: <T>(baseUrl: string, path: string, body: unknown) =>
    request<T>('POST', path, body, normalizeUrl(baseUrl)),
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Beklenmeyen bir hata oluştu.';
}

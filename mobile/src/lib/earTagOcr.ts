// Küpe yazısını okuma (OCR) sonrası: metinden aday küpe numaralarını çıkarma ve
// sürüdeki küpelerle "benzerlik" karşılaştırması (silik yazıda 1-2 karakter yanlış okunabilir).

/** "tr 06 1234" → "TR061234" (uygulamanın küpe kayıt biçimi) */
export function normalizeTag(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

// Rakam olması gereken yerde sık karışan harfler
const toDigit: Record<string, string> = {
  O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', '|': '1', '!': '1', T: '7', Z: '2', S: '5', B: '8', G: '6', A: '4', E: '3',
};

function digitsOnly(s: string): string {
  return s.split('').map((c) => (/\d/.test(c) ? c : toDigit[c] ?? '')).join('');
}

/** OCR metin bloklarından küpe numarası adaylarını çıkarır (en olası önce) */
export function extractCandidates(blocks: string[]): string[] {
  const out: string[] = [];
  const push = (v: string) => { if (v.length >= 4 && !out.includes(v)) out.push(v); };
  const text = blocks.join('\n').toUpperCase().replace(/[^\S\n]+/g, ' ');

  // 1) "TR" ile başlayan numaralar: TR 06 123 4567 gibi; TR'den sonraki karakterleri rakama zorla
  for (const m of text.matchAll(/T\s?[RK]\s?([0-9OQDILZSBGAE| ]{4,20})/g)) {
    const d = digitsOnly(m[1].replace(/\s/g, ''));
    if (d.length >= 4) push(`TR${d}`);
  }
  // 2) Satırlardaki uzun rakam grupları (boşluklarla bölünmüş olabilir)
  for (const line of text.split('\n')) {
    const compact = line.replace(/\s/g, '');
    const runs = compact.match(/[0-9OQDILZSB|]{4,}/g) ?? [];
    for (const r of runs) {
      const digitCount = (r.match(/\d/g) ?? []).length;
      if (digitCount >= Math.ceil(r.length * 0.6)) push(digitsOnly(r));
    }
  }
  return out;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export interface TagMatch<T> { item: T; tag: string; candidate: string; score: number; label: string }

/**
 * Adayları sürüdeki küpelerle karşılaştırır. score 0-100.
 *  100: birebir · 85-95: 1 karakter farklı · 70-80: "TR" ya da il kodu okunmamış ama son rakamlar tutuyor
 */
export function matchTags<T>(candidates: string[], items: T[], getTag: (t: T) => string | null): TagMatch<T>[] {
  const best = new Map<T, TagMatch<T>>();
  for (const item of items) {
    const raw = getTag(item);
    if (!raw) continue;
    const tag = normalizeTag(raw);
    const tagDigits = tag.replace(/\D/g, '');
    for (const c of candidates) {
      const cDigits = c.replace(/\D/g, '');
      let score = 0; let label = '';
      if (c === tag || (cDigits.length >= 6 && cDigits === tagDigits)) { score = 100; label = 'Birebir'; }
      else {
        const d = levenshtein(c, tag);
        const dd = levenshtein(cDigits, tagDigits);
        const m = Math.min(d, dd);
        if (m === 1 && tagDigits.length >= 5) { score = 90; label = '1 karakter farklı'; }
        else if (cDigits.length >= 5 && tagDigits.endsWith(cDigits)) { score = 80; label = 'Son rakamlar tutuyor'; }
        else if (m === 2 && tagDigits.length >= 8) { score = 75; label = '2 karakter farklı'; }
        else if (cDigits.length >= 6 && tagDigits.length >= 6 && cDigits.slice(-6) === tagDigits.slice(-6)) { score = 72; label = 'Son 6 rakam tutuyor'; }
      }
      const prev = best.get(item);
      if (score > 0 && (!prev || score > prev.score)) best.set(item, { item, tag, candidate: c, score, label });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 5);
}

import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { fmtAge, fmtDate, today } from './format';
import { locationLabel, sexLabel, statusLabel } from './labels';
import type { AnimalListItem } from './types';

export type ExportFormat = 'excel' | 'pdf';

const COLUMNS = ['Sıra', 'Küpe No', 'İsim', 'Tür', 'Irk', 'Cinsiyet', 'Doğum tarihi', 'Yaş', 'Sürü', 'Konum', 'Durum', 'Arınma'];

function rowOf(a: AnimalListItem, i: number): string[] {
  return [
    String(i + 1),
    a.earTag ?? '',
    a.name ?? '',
    a.speciesName,
    a.breedName ?? '',
    sexLabel[a.sex],
    a.birthDate ? fmtDate(a.birthDate) : '',
    a.ageMonths != null ? fmtAge(a.ageMonths) : '',
    a.herdName ?? '',
    a.currentLocation ? locationLabel[a.currentLocation] : '',
    statusLabel[a.status],
    a.inWithdrawal ? 'Arınmada' : '',
  ];
}

function safeName(title: string): string {
  const map: Record<string, string> = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U' };
  return title.replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => map[c] ?? c).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'liste';
}

function csvCell(v: string): string {
  // Excel (Türkçe) ayırıcı olarak ; kullanır. Başında 0 olan küpe no bozulmasın diye metin olarak işaretlenir.
  const needsQuote = /[;"\n]/.test(v);
  const s = v.replace(/"/g, '""');
  return needsQuote ? `"${s}"` : s;
}

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function share(uri: string, mimeType: string, uti: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu cihazda paylaşma desteklenmiyor.');
  await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle: title });
}

export async function exportAnimals(animals: AnimalListItem[], title: string, format: ExportFormat) {
  const base = `${safeName(title)}_${today()}`;
  const rows = animals.map(rowOf);

  if (format === 'excel') {
    const lines = [COLUMNS, ...rows].map((r, idx) =>
      r.map((c, j) => (idx > 0 && j === 1 && /^\d/.test(c) ? `="${c}"` : csvCell(c))).join(';'));
    const file = new File(Paths.cache, `${base}.csv`);
    if (file.exists) file.delete();
    file.create();
    file.write('﻿' + lines.join('\r\n'));
    await share(file.uri, 'text/csv', 'public.comma-separated-values-text', `${title} — Excel`);
    return;
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,Arial,sans-serif;color:#1F2A1F;margin:24px}
    h1{font-size:20px;margin:0;color:#1F4A27} .sub{color:#6B7268;font-size:12px;margin:4px 0 14px}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{background:#2F6B3A;color:#fff;text-align:left;padding:6px 5px}
    td{padding:5px;border-bottom:1px solid #E1DCCF} tr:nth-child(even) td{background:#F4F1EA}
    .foot{margin-top:14px;color:#9AA096;font-size:10px}
  </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="sub">${animals.length} hayvan · ${fmtDate(today())}</div>
    <table><thead><tr>${COLUMNS.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <div class="foot">Çiftliğim · AEK Software</div>
  </body></html>`;
  const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 }); // A4 yatay
  const dst = new File(Paths.cache, `${base}.pdf`);
  if (dst.exists) dst.delete();
  new File(uri).move(dst);
  await share(dst.uri, 'application/pdf', 'com.adobe.pdf', `${title} — PDF`);
}

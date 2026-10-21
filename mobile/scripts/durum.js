// Bilgisayarın yerel IP adresini ve son APK derlemesinin durumunu kısaca yazar.
// Kullanım (kök klasörde): npm run durum
const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

const ips = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address);
console.log(`IP: ${ips.join(', ') || 'bulunamadı'}`);

try {
  const out = execSync('npx eas-cli@latest build:list -p android --limit 1 --non-interactive --json', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const b = JSON.parse(out.slice(out.indexOf('[')))[0];
  const url = b?.artifacts?.applicationArchiveUrl || b?.artifacts?.buildUrl || '-';
  console.log(`DURUM: ${b?.status ?? '?'}`);
  console.log(`APK: ${url}`);
  // Linki dosyaya da yaz (kopyalamak kolay olsun)
  require('fs').writeFileSync(path.join(__dirname, '..', 'son-apk.txt'), `${b?.status}\n${url}\n`);
  if (b?.error?.message) console.log(`HATA: ${b.error.message}`);
} catch (e) {
  console.log('Derleme durumu alınamadı: ' + (e.message || e));
}

// Tek komutta: sunucuyu derle → GitHub'a gönder (Render kendini günceller) → yeni APK'yı başlat
// Çalıştırma: kök klasörde  npm run 0-hepsini-yayinla
const { execSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');

function run(title, cmd, opts = {}) {
  console.log(`\n==== ${title} ====\n> ${cmd}`);
  return execSync(cmd, { cwd: root, stdio: opts.capture ? 'pipe' : 'inherit', encoding: 'utf8' });
}

try {
  run('1/3 Sunucu derleniyor', 'dotnet build backend/Ciftligim.Api');

  const status = run('2/3 Değişiklikler kontrol ediliyor', 'git status --porcelain', { capture: true });
  const risky = status.split('\n').filter((l) => /credentials\.json|\.keystore|\.jks|\.env\b/i.test(l));
  if (risky.length) {
    console.error('\nDUR: Gizli dosyalar commit edilecekti, iptal edildi:\n' + risky.join('\n'));
    process.exit(1);
  }
  if (status.trim()) {
    run('2/3 GitHub\'a gönderiliyor', 'git add -A');
    run('', 'git commit -m "v0.5.0: yeni logo, sifremi unuttum, uye sifre sifirlama, suru listesi indirme"');
  } else {
    console.log('Commit edilecek değişiklik yok.');
  }
  run('', 'git push');

  run('3/3 Yeni APK başlatılıyor (Expo sunucusunda)', 'npm run yeni-apk');
  console.log('\nTAMAM. APK 15-30 dk içinde hazır olur: npm run durum');
} catch (e) {
  console.error('\nHATA: Bir adım başarısız oldu, yukarıdaki mesaja bak.');
  process.exit(1);
}

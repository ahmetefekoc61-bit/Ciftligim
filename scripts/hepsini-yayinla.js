// Tek komutta: sunucuyu derle → GitHub'a gönder (Render kendini günceller) → yeni APK'yı başlat
// Çalıştırma: kök klasörde  npm run 0-hepsini-yayinla   (APK)
//            ya da          npm run 0-kod-gonder-guncelle (APK'sız: sadece uzaktan güncelleme)
const otaOnly = process.argv.includes('--guncelle');
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
    const msg = process.env.MSG || (otaOnly ? 'Guncelleme' : 'Yeni APK surumu');
    run('', `git commit -m "${msg.replace(/"/g, "'")}"`);
  } else {
    console.log('Commit edilecek değişiklik yok.');
  }
  run('', 'git push');

  if (otaOnly) {
    run('3/3 Telefonlara uzaktan güncelleme gönderiliyor', 'npm run guncelle');
    console.log('\nTAMAM. Telefonda uygulamayı kapatıp aç; yeni hali gelir. (Render sunucusu da birkaç dk içinde güncellenir.)');
  } else {
    run('3/3 Yeni APK başlatılıyor (Expo sunucusunda)', 'npm run yeni-apk');
    console.log('\nTAMAM. APK 15-30 dk içinde hazır olur: npm run durum');
  }
} catch (e) {
  console.error('\nHATA: Bir adım başarısız oldu, yukarıdaki mesaja bak.');
  process.exit(1);
}

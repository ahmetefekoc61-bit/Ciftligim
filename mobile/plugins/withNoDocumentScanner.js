// expo-camera'nın kullanmadığımız belge tarayıcı (ML Kit beta) bağımlılığını kapatır.
// Eski sürümlü ML Kit parçaları, küpe yazı okumada kullandığımız ML Kit ile çakışabiliyor.
const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withNoDocumentScanner(config) {
  return withGradleProperties(config, (cfg) => {
    const key = 'expo.camera.document-scanner-enabled';
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === key));
    cfg.modResults.push({ type: 'property', key, value: 'false' });
    return cfg;
  });
};

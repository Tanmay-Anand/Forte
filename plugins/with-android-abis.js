// Restricts release builds to the CPU architectures Forte actually ships for.
//
// React Native's default builds native libraries for four ABIs, which made the
// universal APK 103 MB — 81 MB of it libraries for CPUs no target phone has.
// Every Android phone sold since ~2017 is arm64-v8a.
//
// `expo run:android` passes -PreactNativeArchitectures for the connected device,
// which overrides this, so debug builds on an x86_64 emulator still work.
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'reactNativeArchitectures';

module.exports = function withAndroidAbis(config, { abis = ['arm64-v8a'] } = {}) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === KEY),
    );
    cfg.modResults.push({ type: 'property', key: KEY, value: abis.join(',') });
    return cfg;
  });
};

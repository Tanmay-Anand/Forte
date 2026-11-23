// Puts Forte's status-bar icon into the Android build as `ic_stat_forte`.
//
// Android draws a notification's small icon as a white silhouette. Without one
// it falls back to the launcher icon, which on a full-colour mark becomes a
// blank shape on the lock screen. The PNGs are drawn by tools/bake-brand.mjs,
// one per density; this copies them into res/drawable-<density>/ at prebuild,
// where notifee finds them by name (workout-notification.ts, `smallIcon`).
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

module.exports = function withNotificationIcon(config, { name = 'ic_stat_forte', source = 'assets/notification' } = {}) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const project = cfg.modRequest.projectRoot;
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      for (const density of DENSITIES) {
        const from = path.join(project, source, `${name}-${density}.png`);
        if (!fs.existsSync(from)) throw new Error(`with-notification-icon: missing ${from} (run node tools/bake-brand.mjs)`);
        const dir = path.join(res, `drawable-${density}`);
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(from, path.join(dir, `${name}.png`));
      }
      return cfg;
    },
  ]);
};

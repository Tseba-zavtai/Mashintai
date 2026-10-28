const fs = require('node:fs/promises');
const path = require('node:path');
const { withFinalizedMod } = require('expo/config-plugins');

// Keep the existing brand bitmap; inset it without resampling/editing the asset.
const foreground = `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android" android:drawable="@mipmap/ic_launcher_foreground" android:inset="12%" />
`;
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/iconBackground" />
  <foreground android:drawable="@drawable/tureesly_launcher_foreground" />
</adaptive-icon>
`;
module.exports = function withAndroidBranding(config) {
  return withFinalizedMod(config, ['android', async mod => {
    const res = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res');
    await fs.mkdir(path.join(res, 'drawable'), { recursive: true });
    await fs.mkdir(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
    await fs.writeFile(path.join(res, 'drawable/tureesly_launcher_foreground.xml'), foreground);
    for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
      await fs.writeFile(path.join(res, 'mipmap-anydpi-v26', name), adaptive);
    }
    return mod;
  }]);
};

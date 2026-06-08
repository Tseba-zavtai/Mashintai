const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withBankQueries(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    if (!androidManifest.manifest.queries) {
      androidManifest.manifest.queries = [];
    }

    const schemes = [
      "qpaywallet",
      "khanbank",
      "statebankmongolia",
      "xacbank",
      "tdbbank",
      "tdbwallet",
      "socialpay-payment",
      "most",
      "nibank",
      "ckbank",
      "capitronbank",
      "bogdbank",
      "transbank",
      "mbank",
      "ard",
      "toki",
      "arig",
      "Monpay",
      "hipay"
    ];

    const existing = androidManifest.manifest.queries;

    schemes.forEach((scheme) => {
      existing.push({
        intent: [
          {
            action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
            data: [{ $: { "android:scheme": scheme } }]
          }
        ]
      });
    });

    return config;
  });
};
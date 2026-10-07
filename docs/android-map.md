# Android map

Android uses Leaflet 1.9.4 in react-native-webview 13.15.0 with OpenStreetMap
standard raster tiles. iOS continues to use react-native-maps / Apple Maps.
No Google Maps key, Google billing account or paid tile-provider account is
needed by this Android renderer. Existing Firebase credentials are untouched.

Leaflet assets are fetched from unpkg with pinned versions and integrity hashes.
An internet connection is required. Load failures offer a manual retry; no
automatic request loop, offline download or prefetch is implemented.

OSM requirements: https://operations.osmfoundation.org/policies/tiles/
- Visible attribution is at the top to avoid the listing-card overlay.
- WebView uses a Tureesly-specific User-Agent and default HTTP disk caching.
- Only viewport tiles are requested; do not add bulk/offline downloading.
- Public OSM tiles are best-effort, not an unlimited production hosting SLA.
  Reassess hosting before substantial growth. No automatic paid fallback exists.
- Tile/CDN servers receive ordinary network metadata and viewed map tile areas;
  review the app privacy policy before release. Listing titles stay inside the
  local WebView, inserted using textContent, not sent to a geocoding service.

Build a NEW APK (the previous APK lacks the WebView native dependency):
`npx eas build --platform android --profile preview`

After device verification build the Play AAB with the production profile.
Check browsing/panning/zoom, category filtering, marker navigation, nearby radius,
recenter, denied GPS permission, post pin selection, profile pin save, no network
and retry, and attribution-link visibility. Verify iOS Apple Maps separately.

The prior Cloud billing account is not modified or cancelled by this code change.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('components/OpenStreetMap.tsx', 'utf8');
const code = source.match(/<script>\n([\s\S]*?)<\/script>/)[1];
const messages = [], handlers = {}, markers = [], tiles = {};
let fits = 0, clears = 0;
const map = {
  setView() { return this; }, on(name, fn) { handlers[name] = fn; },
  fitBounds() { fits++; }, invalidateSize() {},
  getCenter: () => ({lat: 47.9, lng: 106.9}),
  getBounds: () => ({getNorth: () => 48, getSouth: () => 47.8, getEast: () => 107, getWest: () => 106.8}),
};
const context = {
  window: { ReactNativeWebView: {postMessage: s => messages.push(JSON.parse(s))}, addEventListener() {} },
  document: {createElement: () => ({textContent: ''})},
  L: {
    map: () => map,
    control: {attribution: () => ({addTo() {}})},
    tileLayer: () => ({addTo() {return this;}, on(name, fn) {tiles[name] = fn;}}),
    layerGroup: () => ({addTo() {return this;}, clearLayers() {clears++;}}),
    circle: () => ({addTo() {}}), circleMarker: () => ({addTo() {}}), divIcon: v => v,
    marker: () => {const m = {addTo() {return this;}, bindTooltip(label) {this.label = label;}, on(name, fn) {this[name] = fn;}}; markers.push(m); return m;},
  },
};
context.window.L = context.L;
vm.runInNewContext(code, context);
assert.equal(messages[0].type, 'ready');
context.window.updateMap({items: [{index: 2, kind: 'marker', props: {coordinate: {latitude: 47, longitude: 106}, title: '<script>bad</script>'}}], region: {latitude:47,longitude:106,latitudeDelta:0.1,longitudeDelta:0.1}});
assert.equal(clears, 1);
assert.equal(markers[0].label.textContent, '<script>bad</script>');
markers[0].click();
assert.deepEqual(messages.at(-1), {type:'marker',index:2});
handlers.click({latlng:{lat:47.5,lng:106.5}});
assert.equal(messages.at(-1).coordinate.latitude, 47.5);
handlers.moveend();
const before = fits;
context.window.setMapRegion(messages.at(-1).region);
assert.equal(fits, before, 'controlled-region echo must not reset the viewport');
tiles.tileerror(); assert.equal(messages.at(-1).type, 'tileError');
tiles.tileload(); assert.equal(messages.at(-1).type, 'tileLoaded');
console.log('OSM bridge: ready, safe labels, marker, tap, region echo, tile errors passed');

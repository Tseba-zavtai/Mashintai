import React, { Children, forwardRef, isValidElement, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import WebView from "react-native-webview";
import type { MapViewProps, Region } from "react-native-maps";
import * as Location from "expo-location";

// Declarative children consumed below, not native Google map components.
export function Marker(_props: any) { void _props; return null; }
export function Circle(_props: any) { void _props; return null; }
const fallback: Region = { latitude: 47.9184, longitude: 106.9177, latitudeDelta: 0.0922, longitudeDelta: 0.0421 };
const valid = (p: any) => Number.isFinite(p?.latitude) && Number.isFinite(p?.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

// Static HTML: listing text is passed through the bridge, never interpolated into HTML.
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>html,body,#map{height:100%;width:100%;margin:0}body{background:#eee}.leaflet-control-attribution{font-size:10px}.pin{background:#800bb9;border:2px solid white;border-radius:50%;box-shadow:0 2px 5px #555;color:white;text-align:center;font:bold 18px sans-serif;line-height:24px}</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
(function(){
 const send = (data) => window.ReactNativeWebView.postMessage(JSON.stringify(data));
 if(!window.L){send({type:'error'});return;}
 const map=L.map('map',{zoomControl:false,attributionControl:false,maxZoom:19}).setView([47.9184,106.9177],12);
 // Top attribution stays visible above the listing-card overlay.
 L.control.attribution({position:'topright',prefix:false}).addTo(map);
 const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,keepBuffer:0,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
 tiles.on('tileerror',()=>send({type:'tileError'}));
 tiles.on('tileload',()=>send({type:'tileLoaded'}));
 const layer=L.layerGroup().addTo(map);
 let lastRegion=null;
 window.setMapRegion=function(r){
   if(!r)return;
   if(lastRegion && ['latitude','longitude','latitudeDelta','longitudeDelta'].every(k=>Math.abs(lastRegion[k]-r[k])<0.00001))return;
   const lat=Math.max(-85,Math.min(85,r.latitude));
   const dy=Math.max(0.0001,r.latitudeDelta)/2, dx=Math.max(0.0001,r.longitudeDelta)/2;
   map.fitBounds([[lat-dy,r.longitude-dx],[lat+dy,r.longitude+dx]],{animate:false});
 };
 map.on('moveend',()=>{const c=map.getCenter(),b=map.getBounds();lastRegion={latitude:c.lat,longitude:((c.lng+540)%360)-180,latitudeDelta:b.getNorth()-b.getSouth(),longitudeDelta:b.getEast()-b.getWest()};send({type:'region',region:lastRegion});});
 map.on('click',e=>send({type:'press',coordinate:{latitude:e.latlng.lat,longitude:((e.latlng.lng+540)%360)-180}}));
 window.updateMap=function(data){
   layer.clearLayers();
   data.items.forEach(item=>{
     const p=item.props,c=p.coordinate||p.center;
     if(item.kind==='circle'){L.circle([c.latitude,c.longitude],{radius:p.radius,color:p.strokeColor||'#800bb9',fillColor:p.fillColor||'#800bb9',fillOpacity:0.12,weight:p.strokeWidth||2,interactive:false}).addTo(layer);return;}
     const marker=L.marker([c.latitude,c.longitude],{icon:L.divIcon({className:'pin',html:'•',iconSize:[28,28],iconAnchor:[14,28]}),bubblingMouseEvents:false}).addTo(layer);
     if(p.title){const label=document.createElement('span');label.textContent=p.title;marker.bindTooltip(label);}
     marker.on('click',()=>send({type:'marker',index:item.index}));
   });
   if(data.user)L.circleMarker([data.user.latitude,data.user.longitude],{radius:7,color:'#fff',weight:2,fillColor:'#1677ff',fillOpacity:1,interactive:false}).addTo(layer);
   window.setMapRegion(data.region);
 };
 window.addEventListener('resize',()=>map.invalidateSize());
 send({type:'ready'});
})();</script></body></html>`;
const source = { html, baseUrl: "https://mn.tureestei.app/" };

const OpenStreetMap = forwardRef(function OpenStreetMap(props: MapViewProps, ref) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tileFailed, setTileFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [user, setUser] = useState<{ latitude: number; longitude: number } | null>(null);
  const initial = useRef(props.initialRegion || fallback);
  const lastNativeRegion = useRef<Region | null>(null);
  const children = Children.toArray(props.children).filter(isValidElement) as React.ReactElement<any>[];
  const items = children.flatMap((child, index) => {
    const p = child.props;
    const kind = child.type === Circle ? "circle" : "marker";
    if (!valid(p.coordinate || p.center)) return [];
    return [{ index, kind, props: { coordinate: p.coordinate, center: p.center, radius: p.radius, strokeColor: p.strokeColor, fillColor: p.fillColor, strokeWidth: p.strokeWidth, title: p.title } }];
  });
  const payload = JSON.stringify({ items, user, region: props.region || lastNativeRegion.current || initial.current });
  useEffect(() => { if (ready) web.current?.injectJavaScript(`window.updateMap(${payload});true;`); }, [payload, ready]);
  useEffect(() => {
    if (ready || failed) return;
    const timeout = setTimeout(() => setFailed(true), 20000);
    return () => clearTimeout(timeout);
  }, [ready, failed, attempt]);
  useEffect(() => {
    if (!props.showsUserLocation) return;
    let disposed = false;
    let subscription: Location.LocationSubscription | undefined;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (disposed || permission.status !== "granted") return;
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 25 }, loc => {
        if (!disposed) setUser({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      });
      if (disposed) subscription.remove();
    })().catch(() => {});
    return () => { disposed = true; subscription?.remove(); };
  }, [props.showsUserLocation]);
  useImperativeHandle(ref, () => ({ animateToRegion: (region: Region) => {
    initial.current = region;
    web.current?.injectJavaScript(`window.setMapRegion && window.setMapRegion(${JSON.stringify(region)});true;`);
  } }), []);
  return <View style={props.style}>
    <WebView key={attempt} ref={web} style={StyleSheet.absoluteFill} source={source}
      originWhitelist={["*"]} javaScriptEnabled cacheEnabled cacheMode="LOAD_DEFAULT"
      userAgent="Tureesly/1.0 (Android; mn.tureestei.app)" mixedContentMode="never"
      allowFileAccess={false} allowUniversalAccessFromFileURLs={false} setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={request => {
        if (request.url === "about:blank" || request.url === source.baseUrl) return true;
        if (request.url.startsWith("https://www.openstreetmap.org/")) void Linking.openURL(request.url);
        return false;
      }}
      onError={() => setFailed(true)} onRenderProcessGone={() => setFailed(true)}
      onMessage={event => {
        try {
          const message = JSON.parse(event.nativeEvent.data);
          if (message.type === "ready") { setReady(true); setFailed(false); }
          if (message.type === "error") setFailed(true);
          if (message.type === "tileError") setTileFailed(true);
          if (message.type === "tileLoaded") setTileFailed(false);
          if (message.type === "region" && valid(message.region)) {
            lastNativeRegion.current = message.region;
            props.onRegionChangeComplete?.(message.region, { isGesture: true });
          }
          if (message.type === "press" && valid(message.coordinate)) props.onPress?.({ nativeEvent: { coordinate: message.coordinate, position: { x: 0, y: 0 } } } as any);
          if (message.type === "marker" && Number.isInteger(message.index)) children[message.index]?.props.onPress?.();
        } catch { /* Ignore malformed web messages. */ }
      }} />
    {!ready && !failed && <View pointerEvents="none" style={styles.notice}><ActivityIndicator color="#800bb9" /><Text>Газрын зураг ачаалж байна…</Text></View>}
    {(failed || tileFailed) && <View style={styles.notice}>
      <Text>Газрын зураг ачаалсангүй. Интернэтээ шалгана уу.</Text>
      <TouchableOpacity onPress={() => { setReady(false); setFailed(false); setTileFailed(false); setAttempt(a => a + 1); }}><Text style={styles.retry}>Дахин ачаалах</Text></TouchableOpacity>
    </View>}
  </View>;
});
const styles = StyleSheet.create({ notice: { position: "absolute", top: 32, left: 12, right: 12, padding: 12, borderRadius: 10, backgroundColor: "white" }, retry: { color: "#800bb9", fontWeight: "700", paddingTop: 8 } });
export default OpenStreetMap;

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// react-native-webview tipleri React 19 tipleriyle uyuşmuyor; bileşeni gevşek tiple kullanıyoruz
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WV: any = WebView;
interface WebViewRef { injectJavaScript: (js: string) => void }

// Uydu görüntüsü üzerinde tarla sınırları. Leaflet + Esri World Imagery (telefonda internet gerekir).

export interface MapParcel {
  id: string;
  title: string;
  geojson: string | null;      // GeoJSON geometry (metin)
  lat: number | null;
  lon: number | null;
}

export interface FarmMapHandle {
  showTemp: (geometry: unknown | null, lat: number | null, lon: number | null) => void;
  clearTemp: () => void;
  setMyLocation: (lat: number, lon: number) => void;
}

interface Props {
  parcels: MapParcel[];
  focusId?: string | null;
  tapToQuery?: boolean;                       // boş yere dokununca koordinat gönder
  onParcelPress?: (id: string) => void;
  onMapTap?: (lat: number, lon: number) => void;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
}

export const FarmMap = forwardRef<FarmMapHandle, Props>(function FarmMap(
  { parcels, focusId, tapToQuery, onParcelPress, onMapTap, style, interactive = true }, ref,
) {
  const web = useRef<WebViewRef>(null);

  useImperativeHandle(ref, () => ({
    showTemp: (g, lat, lon) => web.current?.injectJavaScript(`window.showTemp(${JSON.stringify(g ?? null)}, ${lat ?? 'null'}, ${lon ?? 'null'}); true;`),
    clearTemp: () => web.current?.injectJavaScript('window.clearTemp(); true;'),
    setMyLocation: (lat, lon) => web.current?.injectJavaScript(`window.setMyLocation(${lat}, ${lon}); true;`),
  }), []);

  const html = useMemo(() => buildHtml({
    parcels: parcels.map((p) => ({ ...p, geo: safeParse(p.geojson) })),
    focusId: focusId ?? null,
    tapToQuery: !!tapToQuery,
    interactive,
  }), [parcels, focusId, tapToQuery, interactive]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === 'parcel' && onParcelPress) onParcelPress(m.id);
      if (m.type === 'tap' && onMapTap) onMapTap(m.lat, m.lng);
    } catch { /* yok say */ }
  };

  return (
    <View style={[st.box, style]}>
      <WV
        ref={web}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        style={{ backgroundColor: '#1d2a1d' }}
        nestedScrollEnabled
      />
    </View>
  );
});

function safeParse(s: string | null): unknown | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function buildHtml(data: object) {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{height:100%;margin:0;background:#1d2a1d}
  .lbl{background:rgba(31,74,39,.85);color:#fff;border:0;border-radius:6px;font:600 12px sans-serif;padding:2px 6px;box-shadow:none}
  .lbl:before{display:none}
  .err{position:absolute;top:40%;width:100%;text-align:center;color:#fff;font:15px sans-serif}
</style></head><body><div id="map"></div><script>
var D=${JSON.stringify(data)};
function post(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
if(typeof L==='undefined'){ document.body.innerHTML='<div class="err">Harita yüklenemedi. İnternet bağlantısını kontrol et.</div>'; }
else {
  var map=L.map('map',{zoomControl:D.interactive,attributionControl:true,dragging:D.interactive,touchZoom:D.interactive,doubleClickZoom:D.interactive,scrollWheelZoom:false}).setView([39.0,35.0],6);
  var sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Uydu © Esri'}).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19}).addTo(map);
  var group=L.featureGroup().addTo(map), focusLayer=null, tempLayer=null, me=null;
  D.parcels.forEach(function(p){
    var focus=D.focusId===p.id, layer=null;
    var style={color:focus?'#FFD54F':'#7CFC00',weight:focus?3:2,fillColor:focus?'#FFD54F':'#7CFC00',fillOpacity:focus?.25:.15};
    if(p.geo){ try{ layer=L.geoJSON(p.geo,{style:style}); }catch(e){ layer=null; } }
    if(!layer && p.lat!=null && p.lon!=null){ layer=L.circleMarker([p.lat,p.lon],{radius:8,color:style.color,fillOpacity:.6}); }
    if(!layer) return;
    layer.bindTooltip(p.title,{permanent:D.parcels.length<=25,direction:'center',className:'lbl'});
    layer.on('click',function(ev){ L.DomEvent.stopPropagation(ev); post({type:'parcel',id:p.id}); });
    layer.addTo(group); if(focus) focusLayer=layer;
  });
  try{
    if(focusLayer) map.fitBounds(focusLayer.getBounds?focusLayer.getBounds():L.latLngBounds([focusLayer.getLatLng()]),{maxZoom:17,padding:[20,20]});
    else if(group.getLayers().length) map.fitBounds(group.getBounds(),{maxZoom:16,padding:[20,20]});
  }catch(e){}
  if(D.tapToQuery){ map.on('click',function(e){ window.showTemp(null,e.latlng.lat,e.latlng.lng); post({type:'tap',lat:e.latlng.lat,lng:e.latlng.lng}); }); }
  window.showTemp=function(g,lat,lng){
    if(tempLayer){ map.removeLayer(tempLayer); tempLayer=null; }
    if(g){ tempLayer=L.geoJSON(g,{style:{color:'#FFD54F',weight:3,fillOpacity:.3,dashArray:'6 4'}}).addTo(map); map.fitBounds(tempLayer.getBounds(),{maxZoom:18,padding:[30,30]}); }
    else if(lat!=null){ tempLayer=L.circleMarker([lat,lng],{radius:7,color:'#FFD54F',fillOpacity:.8}).addTo(map); }
  };
  window.clearTemp=function(){ if(tempLayer){ map.removeLayer(tempLayer); tempLayer=null; } };
  window.setMyLocation=function(lat,lng){
    if(me) map.removeLayer(me);
    me=L.circleMarker([lat,lng],{radius:8,color:'#fff',weight:3,fillColor:'#2B7BE4',fillOpacity:1}).addTo(map);
    map.setView([lat,lng],Math.max(map.getZoom(),16));
  };
}
</script></body></html>`;
}

const st = StyleSheet.create({
  box: { height: 260, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1d2a1d' },
});

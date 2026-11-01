// 한국·북한 국경 GeoJSON 생성 (world-atlas 1:10m, 오프라인) → public/geo/korea.json
import fs from 'fs';
import {feature} from 'topojson-client';
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-10m.json', 'utf8'));
const all = feature(topo, topo.objects.countries).features;
const pick = {'410': 'KOR', '408': 'PRK'};
const out = all.filter(f => pick[String(f.id)]).map(f => ({type: 'Feature', properties: {iso: pick[String(f.id)]}, geometry: f.geometry}));
// 좌표 소수 4자리로 줄이기
const r = c => Array.isArray(c[0]) ? c.map(r) : [Math.round(c[0]*1e4)/1e4, Math.round(c[1]*1e4)/1e4];
out.forEach(f => f.geometry.coordinates = r(f.geometry.coordinates));
fs.writeFileSync('public/geo/korea.json', JSON.stringify({type: 'FeatureCollection', features: out}));
console.log(out.map(f => f.properties.iso), fs.statSync('public/geo/korea.json').size);

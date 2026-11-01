import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender, staticFile, useCurrentFrame} from 'remotion';
import {buildPlan, cameraAt, FPS} from '../lib/schedule';
import {COLORS, Episode, Timeline} from '../lib/types';
import {MapOverlay} from './MapOverlay';

export const MAP_W = 1080;
export const MAP_H = 1056; // Y 384 ~ 1440

const abs = (p: string) => new URL(staticFile(p), window.location.href).href;

const buildStyle = (offline: boolean): maplibregl.StyleSpecification => {
  const bounds: [number, number, number, number] = [123.5, 35.0, 131.0, 41.5];
  const sources: maplibregl.StyleSpecification['sources'] = {
    korea: {type: 'geojson', data: abs('geo/korea.json')},
  };
  const layers: maplibregl.LayerSpecification[] = [
    {id: 'bg', type: 'background', paint: {'background-color': '#0b1016'}},
  ];
  if (!offline) {
    sources.sat = {type: 'raster', tiles: [abs('tiles/sat') + '/{z}/{x}/{y}.jpg'], tileSize: 256, minzoom: 5, maxzoom: 12, bounds};
    layers.push(
      {id: 'sat', type: 'raster', source: 'sat', paint: {
        'raster-saturation': -0.35, 'raster-contrast': 0.18, 'raster-brightness-max': 0.78, 'raster-fade-duration': 0,
      }},
    );
  }
  const glow = (iso: 'PRK' | 'KOR', color: string): maplibregl.LayerSpecification[] => [
    {id: `${iso}-fill`, type: 'fill', source: 'korea', filter: ['==', ['get', 'iso'], iso], paint: {'fill-color': color, 'fill-opacity': 0.1}},
    {id: `${iso}-glow1`, type: 'line', source: 'korea', filter: ['==', ['get', 'iso'], iso], paint: {'line-color': color, 'line-width': 22, 'line-blur': 16, 'line-opacity': 0.45}},
    {id: `${iso}-glow2`, type: 'line', source: 'korea', filter: ['==', ['get', 'iso'], iso], paint: {'line-color': color, 'line-width': 8, 'line-blur': 4, 'line-opacity': 0.85}},
    {id: `${iso}-core`, type: 'line', source: 'korea', filter: ['==', ['get', 'iso'], iso], paint: {'line-color': '#ffffff', 'line-width': 1.6, 'line-opacity': 0.9}},
  ];
  layers.push(...glow('KOR', COLORS.rok), ...glow('PRK', COLORS.nk));
  return {version: 8, sources, layers};
};

export const MapCanvas: React.FC<{episode: Episode; timeline: Timeline; offline: boolean}> = ({episode, timeline, offline}) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const lastCam = useRef('');
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() => delayRender('지도 초기화', {timeoutInMilliseconds: 110000}));
  const [proj, setProj] = useState<{frame: number; project: (ll: [number, number]) => [number, number]} | null>(null);

  useEffect(() => {
    const cam = cameraAt(sec, episode, timeline);
    const map = new maplibregl.Map({
      container: box.current!,
      style: buildStyle(offline),
      center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing,
      interactive: false, attributionControl: false, fadeDuration: 0,
      preserveDrawingBuffer: true, pixelRatio: 0.75, // 렌더 속도: 지도만 75% 해상도 (자막·도형은 원본 해상도) maxPitch: 70,
    });
    map.on('error', (e) => console.warn('[map] ' + (e?.error?.message ?? 'error')));
    map.once('idle', () => {
      mapRef.current = map;
      setReady(true);
      continueRender(initHandle);
    });
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const handle = delayRender(`지도 프레임 ${frame}`, {timeoutInMilliseconds: 60000});
    const cam = cameraAt(sec, episode, timeline);
    // 국경 발광: 은은하게 맥동
    const pulse = 0.35 + 0.2 * Math.sin(sec * 3.2);
    map.setPaintProperty('PRK-glow1', 'line-opacity', pulse + 0.1);
    map.setPaintProperty('KOR-glow1', 'line-opacity', pulse);
    map.jumpTo({center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing});
    setProj({frame, project: (ll) => {
      const p = map.project(ll);
      return [p.x, p.y];
    }});
    const key = JSON.stringify(cam) + pulse.toFixed(4);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      requestAnimationFrame(() => continueRender(handle));
    };
    const timer = setTimeout(finish, 20000);
    if (key === lastCam.current) {
      finish();
    } else {
      lastCam.current = key;
      map.once('idle', finish);
      map.triggerRepaint();
    }
    return () => clearTimeout(timer);
  }, [frame, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = buildPlan(episode, timeline);
  return (
    <div style={{position: 'absolute', inset: 0, width: MAP_W, height: MAP_H}}>
      <div ref={box} style={{position: 'absolute', inset: 0, width: MAP_W, height: MAP_H}} />
      {proj && proj.frame === frame ? (
        <MapOverlay sec={sec} episode={episode} timeline={timeline} plan={plan} project={proj.project} />
      ) : null}
      {!offline && (
        <div style={{position: 'absolute', right: 14, bottom: 96, fontSize: 16, color: 'rgba(255,255,255,0.55)', fontFamily: 'Pretendard'}}>
          위성영상 © Esri
        </div>
      )}
    </div>
  );
};

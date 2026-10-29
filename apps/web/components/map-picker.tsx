'use client';
import { useState, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { mapProvider, worldPoint, coordinates } from '../lib/maps';
export function MapPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
}) {
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false),
    [zoom, setZoom] = useState(14),
    [center, setCenter] = useState({ latitude: latitude ?? 6.3703, longitude: longitude ?? 2.3912 }),
    ref = useRef<HTMLDivElement>(null);
  if (!mapProvider) return null;
  const c = worldPoint(center.latitude, center.longitude, zoom),
    point = latitude !== null && longitude !== null ? worldPoint(latitude, longitude, zoom) : null;
  function move(dx: number, dy: number) {
    setCenter(coordinates(c.x + dx, c.y + dy, zoom));
  }
  function choose(x: number, y: number) {
    const next = coordinates(c.x + x, c.y + y, zoom);
    onChange(next.latitude, next.longitude);
  }
  return (
    <div className="point-picker">
      {!loaded ? (
        <>
          <p className="small muted">
            Une carte facultative permet de préciser le point. Le fournisseur reçoit votre adresse IP et la
            zone affichée. Votre description de soin ne lui est jamais transmise.
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setCenter({ latitude: latitude ?? 6.3703, longitude: longitude ?? 2.3912 });
              setLoaded(true);
            }}
          >
            Afficher la carte avec mon accord
          </button>
        </>
      ) : (
        <>
          <p className="small muted" id="map-help">
            Cliquez pour placer le point. Au clavier : flèches pour déplacer la carte, Entrée pour choisir son
            centre.
          </p>
          <div className="map-controls">
            {[
              ['←', -128, 0, 'Déplacer vers l’ouest'],
              ['↑', 0, -128, 'Déplacer vers le nord'],
              ['↓', 0, 128, 'Déplacer vers le sud'],
              ['→', 128, 0, 'Déplacer vers l’est'],
            ].map(([label, x, y, title]) => (
              <button
                key={String(label)}
                type="button"
                aria-label={String(title)}
                onClick={() => move(Number(x), Number(y))}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              aria-label="Zoom avant"
              disabled={zoom >= 18}
              onClick={() => setZoom((z) => z + 1)}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom arrière"
              disabled={zoom <= 10}
              onClick={() => setZoom((z) => z - 1)}
            >
              −
            </button>
          </div>
          <div
            ref={ref}
            className="map-viewport"
            role="button"
            tabIndex={0}
            aria-label="Choisir un point d’intervention sur la carte"
            aria-describedby="map-help"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              choose(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
            }}
            onKeyDown={(e) => {
              if (e.key.startsWith('Arrow')) {
                e.preventDefault();
                move(
                  e.key === 'ArrowRight' ? 128 : e.key === 'ArrowLeft' ? -128 : 0,
                  e.key === 'ArrowDown' ? 128 : e.key === 'ArrowUp' ? -128 : 0,
                );
              }
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                choose(0, 0);
              }
            }}
          >
            {[-2, -1, 0, 1, 2].flatMap((dx) =>
              [-1, 0, 1].map((dy) => {
                const x = Math.floor(c.x / 256) + dx,
                  y = Math.floor(c.y / 256) + dy;
                return (
                  <img
                    key={zoom + '-' + x + '-' + y}
                    src={mapProvider!.tileUrl(zoom, x, y)}
                    alt=""
                    draggable={false}
                    width={256}
                    height={256}
                    referrerPolicy="strict-origin-when-cross-origin"
                    onError={() => setFailed(true)}
                    style={{
                      position: 'absolute',
                      maxWidth: 'none',
                      left: 'calc(50% + ' + (x * 256 - c.x) + 'px)',
                      top: 'calc(50% + ' + (y * 256 - c.y) + 'px)',
                      pointerEvents: 'none',
                    }}
                  />
                );
              }),
            )}
            <span className="map-cross" aria-hidden="true">
              +
            </span>
            {point && (
              <MapPin
                aria-hidden="true"
                size={32}
                className="map-marker"
                style={{
                  left: 'calc(50% + ' + (point.x - c.x) + 'px)',
                  top: 'calc(50% + ' + (point.y - c.y) + 'px)',
                }}
              />
            )}
          </div>
          <p className="small">
            <a href={mapProvider.attributionUrl} target="_blank" rel="noreferrer">
              {mapProvider.attribution}
            </a>{' '}
            ·{' '}
            <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">
              Signaler une erreur
            </a>
          </p>
          {failed && (
            <p role="status" className="small muted">
              Le fond de carte est indisponible. Continuez avec votre adresse ou la localisation facultative.
            </p>
          )}
          {latitude !== null && longitude !== null && (
            <p role="status" className="small">
              Point choisi : {latitude.toFixed(5)}, {longitude.toFixed(5)}. Vérifiez le repère écrit.
            </p>
          )}
          <button type="button" className="btn btn-text btn-sm" onClick={() => setLoaded(false)}>
            Masquer la carte
          </button>
        </>
      )}
    </div>
  );
}

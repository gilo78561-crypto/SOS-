export interface MapProvider {
  tileUrl: (z: number, x: number, y: number) => string;
  attribution: string;
  attributionUrl: string;
}
export const mapProvider: MapProvider | null =
  process.env.NEXT_PUBLIC_MAP_PROVIDER === 'disabled'
    ? null
    : {
        tileUrl: (z, x, y) =>
          (process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y)),
        attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '© OpenStreetMap contributors',
        attributionUrl:
          process.env.NEXT_PUBLIC_MAP_ATTRIBUTION_URL || 'https://www.openstreetmap.org/copyright',
      };
export function worldPoint(latitude: number, longitude: number, zoom: number) {
  const size = 256 * 2 ** zoom,
    lat = (Math.max(-85.05, Math.min(85.05, latitude)) * Math.PI) / 180;
  return { x: ((longitude + 180) / 360) * size, y: ((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2) * size };
}
export function coordinates(x: number, y: number, zoom: number) {
  const size = 256 * 2 ** zoom;
  return {
    longitude: Math.max(-180, Math.min(180, (x / size) * 360 - 180)),
    latitude: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / size))) * 180) / Math.PI,
  };
}

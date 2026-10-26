// A plain equirectangular projection shared by the map outline script and the city dots.
export const MAP_WIDTH = 1000;

export function project(lat: number, lon: number): [number, number] {
  return [((lon + 180) / 360) * MAP_WIDTH, ((90 - lat) / 180) * (MAP_WIDTH / 2)];
}

export interface MapView {
  x: number;
  y: number;
  width: number;
  height: number;
}

function viewOf(north: number, south: number, west: number, east: number): MapView {
  const [x, y] = project(north, west);
  const [x2, y2] = project(south, east);
  return { x, y, width: x2 - x, height: y2 - y };
}

// Antarctica and the far north have no cities, so the world view is cropped to latitudes 84 to -58.
export const WORLD_VIEW = viewOf(84, -58, -180, 180);
// A third of the cities are in Europe, where they crowd together on the world view.
export const EUROPE_VIEW = viewOf(63, 34, -12, 36);

export const viewBox = (v: MapView) => `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.width.toFixed(1)} ${v.height.toFixed(1)}`;

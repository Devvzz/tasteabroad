// A plain equirectangular projection shared by the map outline script and the city dots.
export const MAP_WIDTH = 1000;
// Antarctica and the far north have no cities, so the view is cropped to latitudes 84 to -58.
const TOP_LAT = 84;
const BOTTOM_LAT = -58;

export function project(lat: number, lon: number): [number, number] {
  return [((lon + 180) / 360) * MAP_WIDTH, ((90 - lat) / 180) * (MAP_WIDTH / 2)];
}

const top = project(TOP_LAT, 0)[1];
const bottom = project(BOTTOM_LAT, 0)[1];
export const MAP_VIEWBOX = `0 ${top.toFixed(0)} ${MAP_WIDTH} ${(bottom - top).toFixed(0)}`;

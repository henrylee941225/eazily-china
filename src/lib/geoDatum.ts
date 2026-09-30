// WGS-84 <-> GCJ-02 conversion.
//
// Mainland China map providers (AutoNavi/Amap, Apple's China tiles, Baidu's
// intermediate step) render on GCJ-02, a state-mandated offset of WGS-84.
// GPS returns WGS-84. Existing app/search/routing coordinates use GCJ-02
// in mainland China; MapTiler rendering converts them back to WGS-84.
//
// Algorithm: the widely published EVIL_TRANSFORM formula. Applied only to
// coordinates inside the mainland-China bounding box; points outside are
// returned unchanged (Hong Kong, Macau, Taiwan use WGS-84).

const A = 6378245.0;
const EE = 0.006693421622965943;
const PI = Math.PI;

export type LatLng = { latitude: number; longitude: number };

export const isInsideMainlandChina = ({ latitude, longitude }: LatLng): boolean => {
  // Rough bounding box that excludes HK/Macau/Taiwan.
  return (
    longitude >= 73.66 &&
    longitude <= 135.05 &&
    latitude >= 18.0 &&
    latitude <= 53.55
  );
};

const transformLat = (x: number, y: number): number => {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
};

const transformLng = (x: number, y: number): number => {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
};

/** Convert WGS-84 to GCJ-02. Returns the input unchanged outside mainland China. */
export const wgs84ToGcj02 = (coord: LatLng): LatLng => {
  if (!isInsideMainlandChina(coord)) return coord;
  const { latitude, longitude } = coord;
  const dLat = transformLat(longitude - 105.0, latitude - 35.0);
  const dLng = transformLng(longitude - 105.0, latitude - 35.0);
  const radLat = (latitude / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const finalLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  const finalLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { latitude: latitude + finalLat, longitude: longitude + finalLng };
};

/** Invert the offset iteratively, preserving coordinates outside China. */
export const gcj02ToWgs84 = (coord: LatLng): LatLng => {
  if (!isInsideMainlandChina(coord)) return coord;
  let result = { ...coord };
  for (let i = 0; i < 10; i++) {
    const projected = wgs84ToGcj02(result);
    const latitudeError = projected.latitude - coord.latitude;
    const longitudeError = projected.longitude - coord.longitude;
    result = {
      latitude: result.latitude - latitudeError,
      longitude: result.longitude - longitudeError,
    };
    if (Math.max(Math.abs(latitudeError), Math.abs(longitudeError)) < 1e-9) break;
  }
  return result;
};

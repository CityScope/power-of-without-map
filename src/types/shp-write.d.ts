declare module "shp-write" {
  const shpwrite: {
    zip: (geojson: GeoJSON.FeatureCollection) => ArrayBuffer;
  };
  export default shpwrite;
}

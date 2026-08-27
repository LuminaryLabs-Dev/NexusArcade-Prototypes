export function composeBiomeTile(globalTileX, globalTileY, fields, nearbyTowns) {
  const place = nearbyTowns.find((town) => (
    town.theme === 'rotwood'
    && Math.hypot(globalTileX - town.x, globalTileY - town.y) <= town.place.radius
  ));
  if (place) {
    return {
      regionId: 'rotwood',
      groundIndex: 1,
      placeStyle: 1,
      kit: place.place.kit,
      townId: place.id
    };
  }
  return {
    regionId: fields.region.id,
    groundIndex: fields.region.ground,
    placeStyle: 0,
    kit: null,
    townId: null
  };
}

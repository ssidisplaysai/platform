import { feature } from "topojson-client";
import statesAtlas from "us-atlas/states-albers-10m.json";
import type { FeatureCollection, Geometry, Position } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { GLW_CAMPAIGN_US_STATES } from "./campaign-geography";

type StateProperties = { name: string };
type StateGeometry = { code: string; name: string; path: string };

const CODE_BY_NAME = new Map(GLW_CAMPAIGN_US_STATES.map((state) => [state.name, state.code]));

function ringPath(ring: Position[]): string {
  return ring.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join("") + "Z";
}

function geometryPath(geometry: Geometry): string {
  if (geometry.type === "Polygon") return geometry.coordinates.map(ringPath).join("");
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flatMap((polygon) => polygon.map(ringPath)).join("");
  return "";
}

const topology = statesAtlas as unknown as Topology<{ states: GeometryCollection<StateProperties> }>;
const states = feature(topology, topology.objects.states) as FeatureCollection<Geometry, StateProperties>;

export const GLW_US_STATE_GEOMETRY: readonly StateGeometry[] = states.features.flatMap((state) => {
  const code = CODE_BY_NAME.get(state.properties.name);
  const path = geometryPath(state.geometry);
  return code && path ? [{ code, name: state.properties.name, path }] : [];
});

export const GLW_US_MAP_VIEW_BOX = "-60 10 1020 610";
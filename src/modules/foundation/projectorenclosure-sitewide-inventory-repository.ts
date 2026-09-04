import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";
import type { SitewideInventorySnapshot } from "./projectorenclosure-sitewide-planner";

const NAMESPACE = "projectorenclosure-sitewide-inventory-v1";
type State = { snapshots: SitewideInventorySnapshot[] };
const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: () => ({ snapshots: [] }) });
let state = loaded.state;
let revision = loaded.revision;

export function saveProjectorEnclosureInventorySnapshot(snapshot: SitewideInventorySnapshot): SitewideInventorySnapshot {
  const existing = state.snapshots.find((item) => item.snapshotId === snapshot.snapshotId);
  const next = existing ? state.snapshots.map((item) => item.snapshotId === snapshot.snapshotId ? deepClone(snapshot) : item) : [...state.snapshots, deepClone(snapshot)];
  const saved = savePersistedState({ namespace: NAMESPACE, state: { snapshots: next }, expectedRevision: revision });
  state = { snapshots: next };
  revision = saved.revision;
  return deepClone(snapshot);
}

export function listProjectorEnclosureInventorySnapshots(): readonly SitewideInventorySnapshot[] {
  return deepClone(state.snapshots);
}

export function getLatestProjectorEnclosureInventorySnapshot(): SitewideInventorySnapshot | null {
  return deepClone([...state.snapshots].sort((a, b) => b.authorityTimestamp.localeCompare(a.authorityTimestamp))[0] ?? null);
}
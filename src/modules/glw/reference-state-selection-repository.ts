import "server-only";

import { deepClone, loadPersistedState, savePersistedState } from "@/modules/foundation/foundation-persistence";

const PERSISTENCE_NAMESPACE = "glw-reference-state-selection-repository";
const OUTDOOR_SPHERE_CAMPAIGN_ID = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview";

export type GlwReferenceStateSelection = {
  campaignId: string;
  organizationId: string;
  siteId: string;
  stateCode: string;
  selectedBy: string;
  selectedAt: string;
};

type State = { selections: GlwReferenceStateSelection[] };
let revision = 0;
let selections = new Map<string, GlwReferenceStateSelection>();

function seed(): State {
  return {
    selections: [{
      campaignId: OUTDOOR_SPHERE_CAMPAIGN_ID,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      stateCode: "IN",
      selectedBy: "OWNER_INTENT_GLW_REFERENCE_GENERATION_GROUNDING_AND_QA_HARDENING_V1",
      selectedAt: "2026-09-14T00:00:00.000Z",
    }],
  };
}

function load(): void {
  const loaded = loadPersistedState<State>({ namespace: PERSISTENCE_NAMESPACE, seedFactory: seed });
  selections = new Map(loaded.state.selections.map((selection) => [selection.campaignId, deepClone(selection)]));
  revision = loaded.revision;
}

load();

export function getGlwReferenceStateSelection(campaignId: string): GlwReferenceStateSelection | null {
  load();
  const selection = selections.get(campaignId);
  return selection ? deepClone(selection) : null;
}

export function saveGlwReferenceStateSelection(input: GlwReferenceStateSelection): GlwReferenceStateSelection {
  load();
  selections.set(input.campaignId, deepClone(input));
  const saved = savePersistedState<State>({
    namespace: PERSISTENCE_NAMESPACE,
    state: { selections: [...selections.values()].map((selection) => deepClone(selection)) },
    expectedRevision: revision,
  });
  revision = saved.revision;
  return deepClone(input);
}
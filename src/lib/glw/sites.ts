export type GlwSite = {
  id: string;
  name: string;
  region: string;
};

export const glwSites: GlwSite[] = [
  { id: "led-display-warehouse", name: "LED Display Warehouse", region: "Austin, TX" },
  { id: "california-outdoor-led", name: "California Outdoor LED", region: "Los Angeles, CA" },
  { id: "sphere-rental-dallas", name: "Sphere Rental Dallas", region: "Dallas, TX" },
  { id: "projection-screen-chicago", name: "Projection Screen Chicago", region: "Chicago, IL" },
];

export function getGlwSite(siteId: string): GlwSite | null {
  return glwSites.find((site) => site.id === siteId) ?? null;
}

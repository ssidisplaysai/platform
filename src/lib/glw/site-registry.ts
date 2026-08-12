export type GlwPublishingDefaults = {
  defaultStatus: "draft" | "publish";
  dailyPageLimit: number;
  hourlyPageLimit: number;
  maxConcurrentJobs: number;
  productRotation: string[];
  stateRotation: string[];
  retryLimit: number;
};

export type GlwSiteRegistryEntry = {
  id: string;
  name: string;
  region: string;
  siteCode: string;
  workspaceId: string;
  domain: string;
  wordpressBaseUrl: string;
  wordpressCredentialName: string;
  publishingEnabled: boolean;
  publishingDefaults: GlwPublishingDefaults;
};

const DEFAULT_PUBLISHING_LIMITS = {
  dailyPageLimit: 25,
  hourlyPageLimit: 5,
  maxConcurrentJobs: 2,
  retryLimit: 2,
} as const;

export const GLW_SITE_REGISTRY: GlwSiteRegistryEntry[] = [
  {
    id: "led-display-warehouse",
    name: "LED Display Warehouse",
    region: "Austin, TX",
    siteCode: "LDW",
    workspaceId: "glw-led-display-warehouse",
    domain: "https://leddisplaywarehouse.com",
    wordpressBaseUrl: "https://leddisplaywarehouse.com/wp-json",
    wordpressCredentialName: "LED Warehouse WordPress Credential",
    publishingEnabled: true,
    publishingDefaults: {
      defaultStatus: "publish",
      dailyPageLimit: DEFAULT_PUBLISHING_LIMITS.dailyPageLimit,
      hourlyPageLimit: DEFAULT_PUBLISHING_LIMITS.hourlyPageLimit,
      maxConcurrentJobs: DEFAULT_PUBLISHING_LIMITS.maxConcurrentJobs,
      productRotation: ["direct_view_led_video_walls", "led_wall_rental", "outdoor_led_displays"],
      stateRotation: ["TX", "CA", "FL", "NY", "IL"],
      retryLimit: DEFAULT_PUBLISHING_LIMITS.retryLimit,
    },
  },
  {
    id: "screen-solutions-international",
    name: "Screen Solutions International",
    region: "Dallas, TX",
    siteCode: "SSI",
    workspaceId: "glw-screen-solutions-international",
    domain: "https://ssidisplays.com",
    wordpressBaseUrl: "https://ssidisplays.com/wp-json",
    wordpressCredentialName: "SSI WordPress Credential",
    publishingEnabled: false,
    publishingDefaults: {
      defaultStatus: "draft",
      dailyPageLimit: DEFAULT_PUBLISHING_LIMITS.dailyPageLimit,
      hourlyPageLimit: DEFAULT_PUBLISHING_LIMITS.hourlyPageLimit,
      maxConcurrentJobs: DEFAULT_PUBLISHING_LIMITS.maxConcurrentJobs,
      productRotation: ["direct_view_led_video_walls", "digital_signage", "commercial_led_displays"],
      stateRotation: ["TX", "CA", "FL", "GA", "NC"],
      retryLimit: DEFAULT_PUBLISHING_LIMITS.retryLimit,
    },
  },
  {
    id: "california-outdoor-led",
    name: "California Outdoor LED",
    region: "Los Angeles, CA",
    siteCode: "COL",
    workspaceId: "glw-california-outdoor-led",
    domain: "https://californiaoutdoorled.com",
    wordpressBaseUrl: "https://californiaoutdoorled.com/wp-json",
    wordpressCredentialName: "California Outdoor LED WordPress Credential",
    publishingEnabled: true,
    publishingDefaults: {
      defaultStatus: "draft",
      dailyPageLimit: DEFAULT_PUBLISHING_LIMITS.dailyPageLimit,
      hourlyPageLimit: DEFAULT_PUBLISHING_LIMITS.hourlyPageLimit,
      maxConcurrentJobs: DEFAULT_PUBLISHING_LIMITS.maxConcurrentJobs,
      productRotation: ["outdoor_led_displays", "stadium_led_displays"],
      stateRotation: ["CA", "NV", "AZ", "OR", "WA"],
      retryLimit: DEFAULT_PUBLISHING_LIMITS.retryLimit,
    },
  },
  {
    id: "sphere-rental-dallas",
    name: "Sphere Rental Dallas",
    region: "Dallas, TX",
    siteCode: "SRD",
    workspaceId: "glw-sphere-rental-dallas",
    domain: "https://sphererentaldallas.com",
    wordpressBaseUrl: "https://sphererentaldallas.com/wp-json",
    wordpressCredentialName: "Sphere Rental Dallas WordPress Credential",
    publishingEnabled: true,
    publishingDefaults: {
      defaultStatus: "draft",
      dailyPageLimit: DEFAULT_PUBLISHING_LIMITS.dailyPageLimit,
      hourlyPageLimit: DEFAULT_PUBLISHING_LIMITS.hourlyPageLimit,
      maxConcurrentJobs: DEFAULT_PUBLISHING_LIMITS.maxConcurrentJobs,
      productRotation: ["rental_led_displays", "event_led_walls"],
      stateRotation: ["TX", "OK", "LA", "AR", "NM"],
      retryLimit: DEFAULT_PUBLISHING_LIMITS.retryLimit,
    },
  },
  {
    id: "projection-screen-chicago",
    name: "Projection Screen Chicago",
    region: "Chicago, IL",
    siteCode: "PSC",
    workspaceId: "glw-projection-screen-chicago",
    domain: "https://projectionscreenchicago.com",
    wordpressBaseUrl: "https://projectionscreenchicago.com/wp-json",
    wordpressCredentialName: "Projection Screen Chicago WordPress Credential",
    publishingEnabled: true,
    publishingDefaults: {
      defaultStatus: "draft",
      dailyPageLimit: DEFAULT_PUBLISHING_LIMITS.dailyPageLimit,
      hourlyPageLimit: DEFAULT_PUBLISHING_LIMITS.hourlyPageLimit,
      maxConcurrentJobs: DEFAULT_PUBLISHING_LIMITS.maxConcurrentJobs,
      productRotation: ["projection_screens", "rental_projection"],
      stateRotation: ["IL", "WI", "IN", "MI", "OH"],
      retryLimit: DEFAULT_PUBLISHING_LIMITS.retryLimit,
    },
  },
];

export function getGlwSites(): GlwSiteRegistryEntry[] {
  return [...GLW_SITE_REGISTRY];
}

export function getGlwSite(siteId: string): GlwSiteRegistryEntry | null {
  return GLW_SITE_REGISTRY.find((site) => site.id === siteId) ?? null;
}

export function getGlwPublishingDefaults(siteId: string): GlwPublishingDefaults | null {
  return getGlwSite(siteId)?.publishingDefaults ?? null;
}
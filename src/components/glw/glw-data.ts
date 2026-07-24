export type GlwSite = {
  id: string;
  name: string;
  region: string;
};

export type GlwJobStatus = "running" | "queued" | "succeeded" | "failed";

export type GlwMetric = {
  label: string;
  value: string;
  detail: string;
};

export type GlwJobRow = {
  id: string;
  status: GlwJobStatus;
  type: "Page" | "Blog";
  site: string;
  title: string;
  started: string;
  duration: string;
  actionLabel: string;
};

export const glwSites: GlwSite[] = [
  { id: "led-display-warehouse", name: "LED Display Warehouse", region: "Austin, TX" },
  { id: "california-outdoor-led", name: "California Outdoor LED", region: "Los Angeles, CA" },
  { id: "sphere-rental-dallas", name: "Sphere Rental Dallas", region: "Dallas, TX" },
  { id: "projection-screen-chicago", name: "Projection Screen Chicago", region: "Chicago, IL" },
];

export const dashboardMetrics: GlwMetric[] = [
  { label: "Pages Today", value: "18", detail: "+4 from yesterday" },
  { label: "Blogs Today", value: "6", detail: "+2 from yesterday" },
  { label: "Running Jobs", value: "3", detail: "1 page, 2 blog jobs" },
  { label: "Failed Jobs", value: "1", detail: "Waiting on retry" },
  { label: "Average Job Time", value: "4m 18s", detail: "All successful jobs, last 24h" },
];

export const recentJobs: GlwJobRow[] = [
  {
    id: "job-1042",
    status: "running",
    type: "Page",
    site: "LED Display Warehouse",
    title: "Homepage hero refresh for new rental campaign",
    started: "2 min ago",
    duration: "03:14",
    actionLabel: "Open",
  },
  {
    id: "job-1041",
    status: "queued",
    type: "Blog",
    site: "California Outdoor LED",
    title: "How to choose an outdoor LED wall for events",
    started: "7 min ago",
    duration: "--",
    actionLabel: "Review",
  },
  {
    id: "job-1040",
    status: "succeeded",
    type: "Page",
    site: "Sphere Rental Dallas",
    title: "Rental package overview for trade show planners",
    started: "18 min ago",
    duration: "04:42",
    actionLabel: "View",
  },
  {
    id: "job-1039",
    status: "failed",
    type: "Blog",
    site: "Projection Screen Chicago",
    title: "Projection screen sizing guide for corporate venues",
    started: "31 min ago",
    duration: "02:51",
    actionLabel: "Retry",
  },
  {
    id: "job-1038",
    status: "succeeded",
    type: "Page",
    site: "LED Display Warehouse",
    title: "Dealer landing page with pricing and availability details",
    started: "46 min ago",
    duration: "05:07",
    actionLabel: "View",
  },
];

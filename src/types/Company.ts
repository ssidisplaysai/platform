import type { Company } from "@/types/models/Company";

export const companies: Company[] = [
  {
    id: "ssi",
    slug: "ssi",
    name: "Screen Solutions International",
    shortName: "SSI",
    description:
      "Projection films, display systems, kiosks, LED, spheres, and custom visual solutions.",
    status: "active",
    accentColor: "#ef4444",
    modules: ["dashboard", "projects", "crm", "quotes", "inventory", "documents"],
  },
  {
    id: "rj-metal",
    slug: "rj-metal",
    name: "RJ Metal",
    shortName: "RJ Metal",
    description:
      "Metal fabrication, laser cutting, bending, upfits, and manufacturing support.",
    status: "active",
    accentColor: "#ef4444",
    modules: ["dashboard", "projects", "manufacturing", "inventory", "purchasing"],
  },
  {
    id: "green-machine-works",
    slug: "green-machine-works",
    name: "Green Machine Works",
    shortName: "GMW",
    description:
      "Pre-roll manufacturing equipment, machine leasing, production, and automation.",
    status: "planning",
    accentColor: "#ef4444",
    modules: ["dashboard", "projects", "manufacturing", "inventory", "customers"],
  },
  {
    id: "led-display-warehouse",
    slug: "led-display-warehouse",
    name: "LED Display Warehouse",
    shortName: "LED Warehouse",
    description:
      "LED display products, pricing, ecommerce, product catalogs, and dealer sales.",
    status: "active",
    accentColor: "#ef4444",
    modules: ["dashboard", "products", "crm", "quotes", "inventory", "marketing"],
  },
  {
    id: "stoner",
    slug: "stoner",
    name: "STONER",
    shortName: "STONER",
    description:
      "Lifestyle brand, collectibles, apparel, drops, product lines, and brand ecosystem.",
    status: "planning",
    accentColor: "#ef4444",
    modules: ["dashboard", "products", "drops", "marketing", "documents"],
  },
];

export function getCompanyBySlug(slug: string) {
  return companies.find((company) => company.slug === slug);
}
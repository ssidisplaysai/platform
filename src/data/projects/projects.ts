import type { Project } from "@/types/models/Project";

export const projects: Project[] = [
  {
    id: "project-ripleys-sphere",
    companyId: "ssi",
    customerId: "customer-ripleys",
    name: "Ripley’s Digital Sphere",
    description: "Digital sphere project for Ripley’s Aquarium.",
    status: "active",
    priority: "high",
    value: 0,
    startDate: "2026-01-01",
    dueDate: "2026-12-31",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: "project-led-warehouse-catalog",
    companyId: "led-display-warehouse",
    name: "LED Warehouse Catalog",
    description: "Product catalog and ecommerce infrastructure buildout.",
    status: "planning",
    priority: "medium",
    value: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: "project-stoner-product-drop",
    companyId: "stoner",
    name: "STONER Product Drop",
    description: "Brand drop planning for STONER collector ecosystem.",
    status: "concept",
    priority: "high",
    value: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

export function getProjectsByCompanyId(companyId: string) {
  return projects.filter((project) => project.companyId === companyId);
}
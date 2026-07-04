import { DataTable } from "@/components/tables/DataTable";

const projects = [
  {
    name: "Ripley’s Digital Sphere",
    status: "Active",
    priority: "High",
    company: "SSI",
    value: "$0",
  },
  {
    name: "LED Warehouse Catalog",
    status: "Planning",
    priority: "Medium",
    company: "LED Warehouse",
    value: "$0",
  },
  {
    name: "STONER Product Drop",
    status: "Concept",
    priority: "High",
    company: "STONER",
    value: "$0",
  },
];

const columns = [
  { key: "name", label: "Project" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "company", label: "Company" },
  { key: "value", label: "Value" },
];

export function ProjectTable() {
  return (
    <DataTable
      title="Projects"
      description="Company projects, installs, builds, launches, and internal initiatives."
      columns={columns}
      data={projects}
    />
  );
}
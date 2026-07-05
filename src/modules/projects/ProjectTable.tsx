import { DataTable } from "@/components/tables/DataTable";
import {
  getProjectsByCompanyId,
  projects,
} from "@/data/projects/projects";

type ProjectTableProps = {
  companyId?: string;
};

const columns = [
  { key: "name", label: "Project" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "companyId", label: "Company" },
  { key: "value", label: "Value" },
];

export function ProjectTable({ companyId }: ProjectTableProps) {
  const visibleProjects = companyId
    ? getProjectsByCompanyId(companyId)
    : projects;

  const projectRows = visibleProjects.map((project) => ({
    name: project.name,
    status: project.status,
    priority: project.priority,
    companyId: project.companyId,
    value: `$${project.value}`,
  }));

  return (
    <DataTable
      title="Projects"
      description="Company projects, installs, builds, launches, and internal initiatives."
      columns={columns}
      data={projectRows}
    />
  );
}
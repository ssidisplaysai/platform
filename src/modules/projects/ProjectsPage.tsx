import { ProjectStats } from "./ProjectStats";
import { ProjectFilters } from "./ProjectFilters";
import { ProjectTable } from "./ProjectTable";

type ProjectsPageProps = {
  companyId?: string;
};

export function ProjectsPage({ companyId }: ProjectsPageProps) {
  return (
    <div className="space-y-6">
      <ProjectStats companyId={companyId} />
      <ProjectFilters />
      <ProjectTable companyId={companyId} />
    </div>
  );
}
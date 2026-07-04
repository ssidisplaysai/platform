import { ProjectStats } from "./ProjectStats";
import { ProjectFilters } from "./ProjectFilters";
import { ProjectTable } from "./ProjectTable";

export function ProjectsPage() {
  return (
    <div className="space-y-6">
      <ProjectStats />
      <ProjectFilters />
      <ProjectTable />
    </div>
  );
}
import { MetricCard } from "@/components/metrics/MetricCard";
import {
  getProjectsByCompanyId,
  projects,
} from "@/data/projects/projects";

type ProjectStatsProps = {
  companyId?: string;
};

export function ProjectStats({ companyId }: ProjectStatsProps) {
  const visibleProjects = companyId
    ? getProjectsByCompanyId(companyId)
    : projects;

  const activeProjects = visibleProjects.filter(
    (project) => project.status === "active"
  ).length;

  const planningProjects = visibleProjects.filter(
    (project) => project.status === "planning"
  ).length;

  const completedProjects = visibleProjects.filter(
    (project) => project.status === "completed"
  ).length;

  const atRiskProjects = visibleProjects.filter(
    (project) => project.priority === "critical"
  ).length;

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Active Projects"
        value={String(activeProjects)}
        helperText="Currently in motion"
      />

      <MetricCard
        label="Planning"
        value={String(planningProjects)}
        helperText="Projects being scoped"
      />

      <MetricCard
        label="Completed"
        value={String(completedProjects)}
        helperText="Closed projects"
      />

      <MetricCard
        label="At Risk"
        value={String(atRiskProjects)}
        helperText="Needs attention"
      />
    </section>
  );
}
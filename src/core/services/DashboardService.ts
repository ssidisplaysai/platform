import { CompanyRepository } from "@/core/repositories/CompanyRepository";
import { ProjectRepository } from "@/core/repositories/ProjectRepository";

export const DashboardService = {
  getExecutiveDashboard() {
    const companies = CompanyRepository.getAll();
    const projects = ProjectRepository.getAll();

    const activeCompanies = companies.filter(
      (company) => company.status === "active"
    ).length;

    const planningCompanies = companies.filter(
      (company) => company.status === "planning"
    ).length;

    const activeProjects = projects.filter(
      (project) => project.status === "active"
    ).length;

    const planningProjects = projects.filter(
      (project) => project.status === "planning"
    ).length;

    return {
      companies: {
        total: companies.length,
        active: activeCompanies,
        planning: planningCompanies,
      },

      projects: {
        total: projects.length,
        active: activeProjects,
        planning: planningProjects,
      },
    };
  },
};
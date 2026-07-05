import {
  getProjectsByCompanyId,
  projects,
} from "@/data/projects/projects";

export const ProjectRepository = {
  getAll() {
    return projects;
  },

  getByCompanyId(companyId: string) {
    return getProjectsByCompanyId(companyId);
  },

  getById(projectId: string) {
    return projects.find((project) => project.id === projectId);
  },
};
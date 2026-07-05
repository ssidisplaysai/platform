import {
  companies,
  getCompanyBySlug,
} from "@/data/companies/companies";

export const CompanyRepository = {
  getAll() {
    return companies;
  },

  getById(companyId: string) {
    return companies.find((company) => company.id === companyId);
  },

  getBySlug(slug: string) {
    return getCompanyBySlug(slug);
  },

  getActive() {
    return companies.filter((company) => company.status === "active");
  },

  getPlanning() {
    return companies.filter((company) => company.status === "planning");
  },
};
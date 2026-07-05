import { CompanyRepository } from "@/core/repositories/CompanyRepository";

export const companies = CompanyRepository.getAll();

export function getCompanyBySlug(slug: string) {
  return CompanyRepository.getBySlug(slug);
}
export type CompanyStatus = "active" | "planning";

export type Company = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string;
  status: CompanyStatus;
  accentColor: string;
  modules: readonly string[];
};

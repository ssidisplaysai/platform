import { notFound } from "next/navigation";
import { CompanyLayout } from "@/components/company/CompanyLayout";
import { ProjectsPage } from "@/modules/projects/ProjectsPage";
import { getCompanyBySlug } from "@/lib/constants/companies";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function CompanyDynamicPage({ params }: PageProps) {
  const { slug } = await params;
  const company = getCompanyBySlug(slug);

  if (!company) {
    notFound();
  }

  return (
    <CompanyLayout
      name={company.name}
      description={company.description}
      accentColor={company.accentColor}
    >
      <ProjectsPage />
    </CompanyLayout>
  );
}
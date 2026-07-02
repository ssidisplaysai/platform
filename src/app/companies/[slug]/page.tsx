import { notFound } from "next/navigation";
import { CompanyHeader } from "@/components/company/CompanyHeader";
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
    <main className="space-y-6">
      <CompanyHeader
        name={company.name}
        description={company.description}
        accentColor={company.accentColor}
      />
    </main>
  );
}
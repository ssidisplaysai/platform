import { notFound } from "next/navigation";
import { CompanyLayout } from "@/components/company/CompanyLayout";
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
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-red-500">
          Workspace
        </p>

        <h2 className="mt-3 text-2xl font-semibold text-white">
          {company.shortName} Operating Center
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          This is the modular workspace area where company-specific modules will load.
        </p>
      </div>
    </CompanyLayout>
  );
}
import { notFound } from "next/navigation";
import { CompanyLayout } from "@/components/company/CompanyLayout";
import { DataTable } from "@/components/tables/DataTable";
import { getCompanyBySlug } from "@/lib/constants/companies";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const sampleProjects = [
  {
    project: "Ripley’s Digital Sphere",
    status: "Active",
    customer: "Ripley’s Aquarium",
    value: "$0",
  },
  {
    project: "LED Warehouse Catalog",
    status: "Planning",
    customer: "Internal",
    value: "$0",
  },
  {
    project: "STONER Product Drop",
    status: "Concept",
    customer: "STONER",
    value: "$0",
  },
];

const projectColumns = [
  { key: "project", label: "Project" },
  { key: "status", label: "Status" },
  { key: "customer", label: "Customer" },
  { key: "value", label: "Value" },
] as const;

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
      <DataTable
        title={`${company.shortName} Projects`}
        description="Early test table for modular company workspace data."
        columns={projectColumns}
        data={sampleProjects}
      />
    </CompanyLayout>
  );
}
import { EmptyState } from "./empty-state";
import { SectionHeader } from "./section-header";
import { PageContainer } from "./page-container";

type GlwEmptyPlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function GlwEmptyPlaceholder({ eyebrow, title, description }: GlwEmptyPlaceholderProps) {
  return (
    <PageContainer className="py-6 sm:py-8">
      <SectionHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="pt-6">
        <EmptyState title="No content configured yet" description="This section is ready for GLW content and operational tools once backend wiring is added." />
      </div>
    </PageContainer>
  );
}

export class DomainClassifier {
  public classify(sheetName: string): string {
    const normalized = sheetName.toLowerCase();

    if (normalized.includes("blog")) return "Publishing";
    if (normalized.includes("product")) return "Products";
    if (normalized.includes("state")) return "States";
    if (normalized.includes("seo")) return "SEO";
    if (normalized.includes("image")) return "Images";

    return "General";
  }
}

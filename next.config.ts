import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/glw/page-generation": [
      "./resources/seo-authority/projectorenclosure/Projector_Enclosure_Master_Keyword_Universe.xlsx",
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: "tsconfig.production.json",
  },
};

export default nextConfig;

export type SettingsSection = {
  id: string;
  title: string;
  description: string;
  category: "workspace" | "organization" | "site" | "security";
  requiresManagePermission: boolean;
};

export const FOUNDATION_SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: "workspace-defaults",
    title: "Workspace Defaults",
    description: "Define global behavior for operators and application shell preferences.",
    category: "workspace",
    requiresManagePermission: true,
  },
  {
    id: "organization-governance",
    title: "Organization Governance",
    description: "Set organization-level controls, approvals, and operational boundaries.",
    category: "organization",
    requiresManagePermission: true,
  },
  {
    id: "site-routing",
    title: "Site Routing",
    description: "Select default site context behavior and regional resolution rules.",
    category: "site",
    requiresManagePermission: false,
  },
  {
    id: "security-access",
    title: "Security and Access",
    description: "Review role mappings, permission posture, and access assumptions.",
    category: "security",
    requiresManagePermission: true,
  },
];

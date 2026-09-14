import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";

const resources = [
  { title: "Operational readiness", detail: "Current fleet, campaign, connector, and owner-action baseline.", href: "/glw/campaigns?scope=all" },
  { title: "Campaign operations", detail: "All campaigns, attention states, and governed next actions.", href: "/glw/campaigns?scope=all" },
  { title: "Target inventory", detail: "Read-only target lifecycle, WordPress, job, and execution identities.", href: "/glw/targets" },
  { title: "Generated-page review", detail: "Draft-ready content using the existing review workflow.", href: "/glw/generated-pages" },
  { title: "Site health", detail: "Connection, lifecycle, health, and publishing readiness by site.", href: "/sites" },
  { title: "Audit", detail: "Governed activity and durable evidence history.", href: "/audit" },
] as const;

export default function HelpPage() {
  return <AppShell><div className="space-y-6"><header className="border border-zinc-800 bg-zinc-900/60 p-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Operator Reference</p><h1 className="mt-2 text-2xl font-black">Help & Documentation</h1><p className="mt-2 max-w-3xl text-sm text-zinc-400">Direct paths to the current operating, review, health, and audit surfaces.</p></header><div className="grid gap-3 md:grid-cols-2">{resources.map((resource) => <Link key={resource.title} href={resource.href} className="border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"><h2 className="font-semibold text-white">{resource.title}</h2><p className="mt-2 text-sm leading-6 text-zinc-400">{resource.detail}</p></Link>)}</div></div></AppShell>;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BlogsIcon,
  DashboardIcon,
  PagesIcon,
  QueueIcon,
  SettingsIcon,
  SitesIcon,
} from "./glw-icons";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/glw", icon: <DashboardIcon /> },
  { label: "Pages", href: "/glw/pages", icon: <PagesIcon /> },
  { label: "Blogs", href: "/glw/blogs", icon: <BlogsIcon /> },
  { label: "Queue", href: "/glw/queue", icon: <QueueIcon /> },
  { label: "Sites", href: "/glw/sites", icon: <SitesIcon /> },
  { label: "Settings", href: "/glw/settings", icon: <SettingsIcon /> },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/glw") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlwSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-zinc-950 text-white shadow-sm shadow-zinc-950/10"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            }`}
          >
            <span className={active ? "text-white" : "text-zinc-400 group-hover:text-zinc-700"}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

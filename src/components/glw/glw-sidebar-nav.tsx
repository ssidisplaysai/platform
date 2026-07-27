"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BlogsIcon,
  DashboardIcon,
  PagesIcon,
  QueueIcon,
  SettingsIcon,
  SitesIcon,
} from "./glw-icons";
import type { GenesisNavigationItem } from "@/platform/gop/contracts";

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  order?: number;
};

function iconForName(name: string | undefined): ReactNode {
  switch ((name ?? "").toLowerCase()) {
    case "dashboard":
      return <DashboardIcon />;
    case "page":
    case "pages":
      return <PagesIcon />;
    case "projects":
    case "project":
      return <PagesIcon />;
    case "blogs":
    case "blog":
      return <BlogsIcon />;
    case "queue":
      return <QueueIcon />;
      case "operations":
        return <QueueIcon />;
    case "sites":
    case "site":
      return <SitesIcon />;
    case "settings":
      return <SettingsIcon />;
    default:
      return <DashboardIcon />;
  }
}

function mapNavItems(items: GenesisNavigationItem[]): NavItem[] {
  return items.map((item) => ({
    label: item.label,
    href: item.href,
    icon: iconForName(item.icon),
    order: item.order,
  }));
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/glw") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlwSidebarNav({ items }: { items: GenesisNavigationItem[] }) {
  const pathname = usePathname();
  const navItems = mapNavItems(items);

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
                ? "bg-zinc-950 text-white shadow-sm shadow-zinc-950/20"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <span className={active ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

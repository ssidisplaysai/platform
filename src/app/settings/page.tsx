import { AppShell } from "@/components/layout/app-shell";
import { createFoundationContext } from "@/modules/foundation/context";
import { hasPermission, resolvePermissions } from "@/modules/foundation/permissions";
import { FOUNDATION_SETTINGS_SECTIONS } from "@/modules/foundation/settings";

export default function SettingsPage() {
  const foundationContext = createFoundationContext();
  const permissions = resolvePermissions(foundationContext.user.roles);
  const canManageSettings = hasPermission(permissions, "settings:manage");

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">
            Settings Foundation
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
            Application and Organization Settings
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Permission-aware settings structure for workspace, organizations,
            sites, and security policies.
          </p>
        </header>

        <ul className="space-y-3">
          {FOUNDATION_SETTINGS_SECTIONS.map((section) => {
            const sectionLocked =
              section.requiresManagePermission && !canManageSettings;

            return (
              <li
                key={section.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-white">{section.title}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs uppercase tracking-widest ${
                      sectionLocked
                        ? "border border-amber-500/50 bg-amber-500/10 text-amber-300"
                        : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {sectionLocked ? "Read Only" : "Accessible"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{section.description}</p>
                <p className="mt-3 text-xs uppercase tracking-widest text-zinc-500">
                  Category: {section.category}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </AppShell>
  );
}

import { AppShell } from "@/components/layout/app-shell";
import {
  FOUNDATION_NOTIFICATIONS,
  getNotificationEmptyStateMessage,
} from "@/modules/foundation/state";

export default function NotificationsPage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">
            Notification Foundation
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
            Notification Framework
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Foundation stream for workspace and organization-level alerts.
          </p>
        </header>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          {FOUNDATION_NOTIFICATIONS.length === 0 ? (
            <p className="text-sm text-zinc-400">{getNotificationEmptyStateMessage()}</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

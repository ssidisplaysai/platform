import type {
  CommandPaletteAction,
  EnterpriseSearchItem,
  NavigationItem,
  NotificationRecord,
  PermissionAction,
} from "./types";
import { hasAllPermissions } from "./permissions";

export function getVisibleNavigationItems(
  items: readonly NavigationItem[],
  permissions: Set<PermissionAction>,
): readonly NavigationItem[] {
  return items.filter((item) =>
    hasAllPermissions(permissions, item.requiredPermissions),
  );
}

export function getVisibleCommandPaletteActions(
  actions: readonly CommandPaletteAction[],
  permissions: Set<PermissionAction>,
  query: string,
): readonly CommandPaletteAction[] {
  const normalizedQuery = query.trim().toLowerCase();

  return actions.filter((action) => {
    const visible = hasAllPermissions(permissions, action.requiredPermissions);

    if (!visible) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchable = `${action.label} ${action.description}`.toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

export function searchFoundationIndex(
  items: readonly EnterpriseSearchItem[],
  permissions: Set<PermissionAction>,
  query: string,
): readonly EnterpriseSearchItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return items.filter((item) => {
    const visible = hasAllPermissions(permissions, item.requiredPermissions);

    if (!visible) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchable = `${item.title} ${item.subtitle} ${item.scope}`.toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

export function formatNotificationEmptyState(
  notifications: readonly NotificationRecord[],
): string {
  return notifications.length === 0
    ? "No notifications yet. System and organization events will appear here."
    : "";
}

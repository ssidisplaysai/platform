import { randomUUID } from "node:crypto";
import type { GenesisPlatformNotification } from "../contracts";

function nowIso(): string {
  return new Date().toISOString();
}

export type GenesisNotificationCenter = {
  emit: (notification: Omit<GenesisPlatformNotification, "notificationId" | "createdAt">) => GenesisPlatformNotification;
  list: (limit?: number) => GenesisPlatformNotification[];
  unread: (limit?: number) => GenesisPlatformNotification[];
  markRead: (notificationId: string) => void;
};

export function createGenesisNotificationCenter(): GenesisNotificationCenter {
  const notifications: GenesisPlatformNotification[] = [];

  return {
    emit(notification) {
      const created: GenesisPlatformNotification = {
        ...notification,
        notificationId: `gnotif_${randomUUID()}`,
        createdAt: nowIso(),
      };
      notifications.unshift(created);
      return created;
    },

    list(limit = 100) {
      return notifications.slice(0, limit);
    },

    unread(limit = 100) {
      return notifications.filter((item) => !item.readAt).slice(0, limit);
    },

    markRead(notificationId) {
      const found = notifications.find((item) => item.notificationId === notificationId);
      if (found && !found.readAt) {
        found.readAt = nowIso();
      }
    },
  };
}

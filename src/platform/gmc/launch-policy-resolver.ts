import type { ApplicationRegistration } from "@/platform/ear";
import type { LaunchBlockReason, LaunchTarget } from "./types";

export type LaunchPolicyResolver = {
  resolve: (registration: ApplicationRegistration) =>
    | { valid: true; target: LaunchTarget; safeTarget: string }
    | { valid: false; reason: LaunchBlockReason };
};

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function hasSchemePrefix(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

function hasControlChars(value: string): boolean {
  return /[\x00-\x1F\x7F]/.test(value);
}

function isSafeInternalPath(value: string): boolean {
  if (!value || hasControlChars(value)) {
    return false;
  }

  if (value.startsWith("//")) {
    return false;
  }

  if (!value.startsWith("/")) {
    return false;
  }

  if (value.includes("\\")) {
    return false;
  }

  return true;
}

function isSafeExternalUrl(value: string): boolean {
  if (!value || hasControlChars(value)) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  if (parsed.protocol === "http:") {
    const host = parsed.hostname.toLowerCase();
    const local = ["localhost", "127.0.0.1", "::1"];
    if (!local.includes(host)) {
      return false;
    }
  }

  return true;
}

export function createLaunchPolicyResolver(): LaunchPolicyResolver {
  return {
    resolve(registration) {
      const discovery = registration.metadata.discovery;
      const launchPath = discovery.launchPath?.trim() ?? "";
      if (!launchPath) {
        return { valid: false, reason: "BLOCKED_MISSING_METADATA" };
      }

      const baseUrl = discovery.baseUrl?.trim();

      if (baseUrl && isAbsoluteUrl(baseUrl)) {
        const normalizedPath = launchPath.startsWith("/") ? launchPath : `/${launchPath}`;
        const href = `${baseUrl.replace(/\/$/, "")}${normalizedPath}`;
        if (!isSafeExternalUrl(href)) {
          return { valid: false, reason: "BLOCKED_INVALID_TARGET" };
        }

        return { valid: true, target: "EXTERNAL", safeTarget: href };
      }

      if (isAbsoluteUrl(launchPath)) {
        if (!isSafeExternalUrl(launchPath)) {
          return { valid: false, reason: "BLOCKED_INVALID_TARGET" };
        }

        return { valid: true, target: "EXTERNAL", safeTarget: launchPath };
      }

      if (hasSchemePrefix(launchPath)) {
        return { valid: false, reason: "BLOCKED_INVALID_TARGET" };
      }

      const href = launchPath.startsWith("/") ? launchPath : `/${launchPath}`;
      if (!isSafeInternalPath(href)) {
        return { valid: false, reason: "BLOCKED_INVALID_TARGET" };
      }

      return { valid: true, target: "INTERNAL", safeTarget: href };
    },
  };
}

import type { ApplicationRegistration } from "@/platform/ear";
import type { LaunchPolicyResolver } from "./launch-policy-resolver";
import type { LaunchBlockReason, LaunchTarget } from "./types";

export type ApplicationLauncher = {
  resolveLaunch: (registration: ApplicationRegistration) =>
    | { valid: true; target: LaunchTarget; safeTarget: string }
    | { valid: false; reason: LaunchBlockReason };
};

export function createApplicationLauncher(input: { launchPolicyResolver: LaunchPolicyResolver }): ApplicationLauncher {
  return {
    resolveLaunch(registration) {
      return input.launchPolicyResolver.resolve(registration);
    },
  };
}

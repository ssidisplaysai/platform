import type { HostProfile } from "./types";

export class ProfileRegistry {
  private readonly profiles = new Map<string, HostProfile>();

  register(profile: HostProfile): void {
    if (this.profiles.has(profile.id)) {
      throw new Error(`Profile already registered: ${profile.id}`);
    }

    this.profiles.set(profile.id, {
      ...profile,
      limits: Object.freeze({ ...profile.limits }),
      featureFlags: Object.freeze({ ...profile.featureFlags }),
    });
  }

  get(id: string): HostProfile {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Unknown profile: ${id}`);
    }
    return profile;
  }

  list(): readonly HostProfile[] {
    return Object.freeze([...this.profiles.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }
}

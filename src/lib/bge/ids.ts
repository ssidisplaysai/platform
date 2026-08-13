import { createHash, randomBytes } from "crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function ulidLikeBody(): string {
  const bytes = randomBytes(26);
  let out = "";

  for (let i = 0; i < 26; i += 1) {
    out += CROCKFORD[bytes[i] % CROCKFORD.length];
  }

  return out;
}

function deterministicBody(seed: string): string {
  const bytes = createHash("sha256").update(seed).digest();
  let out = "";

  for (let i = 0; i < 26; i += 1) {
    out += CROCKFORD[bytes[i % bytes.length] % CROCKFORD.length];
  }

  return out;
}

export function bgeId(prefix: "bgobj_" | "bgver_" | "bgev_" | "bgrel_" | "bgprop_" | "bgappr_" | "bgevt_"): string {
  return `${prefix}${ulidLikeBody()}`;
}

export function deterministicBgeId(prefix: "bgobj_" | "bgver_" | "bgev_" | "bgrel_" | "bgprop_" | "bgappr_" | "bgevt_", seed: string): string {
  return `${prefix}${deterministicBody(seed)}`;
}

export function correlationId(): string {
  return `corr_${ulidLikeBody()}`;
}

export function chainId(): string {
  return `chain_${ulidLikeBody()}`;
}

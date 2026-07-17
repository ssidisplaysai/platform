import type { RuntimePolicyCompilationCertificate as RuntimePolicyCompilationCertificateRecord } from "./types";
import { deepFreeze } from "./types";

export class RuntimePolicyCompilationCertificate {
  constructor(private readonly record: RuntimePolicyCompilationCertificateRecord) {}

  snapshot(): RuntimePolicyCompilationCertificateRecord {
    return deepFreeze(this.record);
  }
}

import type { GenesisAuthorizationSubject, GenesisJobStatus, GenesisJobType } from "../contracts";
import { getGenesisAuthorizationResolver } from "../auth/runtime";
import { createActionReference } from "../auth/resolver";

export type GenesisActionAuthorizationInput = {
  subject: GenesisAuthorizationSubject;
  workspaceId: string;
  moduleId: string;
  jobType: GenesisJobType;
  jobStatus: GenesisJobStatus;
  actionId: string;
  ownerActorId?: string;
};

export function authorizeGenesisJobAction(input: GenesisActionAuthorizationInput) {
  const resolver = getGenesisAuthorizationResolver();

  return resolver.authorize({
    subject: input.subject,
    workspaceId: input.workspaceId,
    moduleId: input.moduleId,
    route: undefined,
    jobType: input.jobType,
    jobStatus: input.jobStatus,
    action: createActionReference(input.actionId, "job_action"),
    resource: {
      workspaceId: input.workspaceId,
      moduleId: input.moduleId,
      jobType: input.jobType,
      jobStatus: input.jobStatus,
      ownerActorId: input.ownerActorId,
    },
  });
}

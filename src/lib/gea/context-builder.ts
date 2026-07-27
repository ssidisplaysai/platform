import type { AgentContext, AgentMemoryReference } from "./agent-models";
import { stableChecksum } from "./agent-models";

export type ContextAssembler = {
  assemble: (input: {
    workspaceId: string;
    projectId?: string;
    organizationId?: string;
    references: AgentMemoryReference[];
  }) => AgentContext;
};

export type ContextValidator = {
  validate: (context: AgentContext) => { valid: boolean; issues: string[]; checksum: string };
};

export type ContextBuilderService = {
  build: (input: {
    workspaceId: string;
    projectId?: string;
    organizationId?: string;
    references: AgentMemoryReference[];
  }) => { context: AgentContext; checksum: string; issues: string[] };
};

export function createContextAssembler(): ContextAssembler {
  return {
    assemble(input) {
      const references = [...input.references].sort((a, b) => {
        const keyA = `${a.referenceType}:${a.referenceId}:${a.referenceVersion}`;
        const keyB = `${b.referenceType}:${b.referenceId}:${b.referenceVersion}`;
        return keyA.localeCompare(keyB);
      });

      return {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        organizationId: input.organizationId,
        references,
        metadata: {
          contextVersion: "gea-context/v1",
          reproducible: true,
        },
      };
    },
  };
}

export function createContextValidator(): ContextValidator {
  return {
    validate(context) {
      const issues: string[] = [];
      if (!context.workspaceId) {
        issues.push("workspaceId is required.");
      }

      for (const reference of context.references) {
        if (!reference.referenceVersion) {
          issues.push(`reference ${reference.referenceId} is missing referenceVersion.`);
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        checksum: stableChecksum(context),
      };
    },
  };
}

export function createContextBuilderService(
  assembler = createContextAssembler(),
  validator = createContextValidator(),
): ContextBuilderService {
  return {
    build(input) {
      const context = assembler.assemble(input);
      const result = validator.validate(context);
      return {
        context,
        checksum: result.checksum,
        issues: result.issues,
      };
    },
  };
}

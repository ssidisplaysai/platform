export type GlwN8nPageGenerationRequest = {
  jobId: string;
  type: "page_generation";
  site: {
    id: string;
    name: string;
  };
  page: {
    title: string;
    targetSlug: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    wordCount: number;
    tone: string;
    audience: string;
    callToAction: string;
    category: string;
    status: "draft" | "publish";
  };
  promptData: {
    tone: string;
    audience: string;
    callToAction: string;
  };
  seoSettings: {
    targetSlug: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    category: string;
  };
  publishingSettings: {
    status: "draft" | "publish";
    wordCount: number;
  };
  imageSettings: {
    generateFeaturedImage: boolean;
    style: string;
  };
  callbackUrl?: string;
  authToken?: string;
};

export type GlwN8nAcceptedResponse = {
  kind: "accepted";
  executionId: string;
  status: "accepted" | "running";
  title?: string;
};

export type GlwN8nCompleteResponse = {
  kind: "complete";
  executionId: string;
  status: "complete" | "completed" | "success" | "succeeded";
  title: string;
  wordpressPageId?: string | number;
  wordpressUrl: string;
  wordpressPostId: string | number;
  featuredImageUrl?: string;
  executionTimeMs?: number;
};

export type GlwN8nFailedResponse = {
  kind: "failed";
  executionId?: string;
  status: "failed";
  error: {
    message: string;
    step?: string;
  };
};

export type GlwN8nResponse = GlwN8nAcceptedResponse | GlwN8nCompleteResponse | GlwN8nFailedResponse;

export type GlwN8nTransport = {
  invokePageGeneration(request: GlwN8nPageGenerationRequest): Promise<GlwN8nResponse>;
};

export class GlwN8nAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlwN8nAdapterError";
  }
}

function getRequiredValue(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new GlwN8nAdapterError(`${name} is required for GLW page generation.`);
  }

  return value;
}

function getAuthorizationHeader(): string {
  return `Bearer ${getRequiredValue("GLW_N8N_WEBHOOK_SECRET")}`;
}

function parseJsonResponse(payload: unknown): GlwN8nResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new GlwN8nAdapterError("GLW n8n webhook returned an invalid JSON payload.");
  }

  const response = payload as Record<string, unknown>;
  const status = typeof response.status === "string" ? response.status.toLowerCase() : "";
  const executionId = typeof response.executionId === "string" ? response.executionId.trim() : "";

  if (!executionId) {
    throw new GlwN8nAdapterError("GLW n8n webhook response did not include an execution identifier.");
  }

  if (status === "accepted" || status === "running") {
    return {
      kind: "accepted",
      executionId,
      status,
      title: typeof response.title === "string" ? response.title : undefined,
    };
  }

  if (status === "complete" || status === "completed" || status === "success" || status === "succeeded") {
    const wordpressUrl = typeof response.wordpressUrl === "string" ? response.wordpressUrl.trim() : "";
    const wordpressPostId = response.wordpressPostId;
    const wordpressPageId = response.wordpressPageId;
    const pageIdentifier = wordpressPageId ?? wordpressPostId;
    const title = typeof response.title === "string" ? response.title.trim() : "";
    const featuredImageUrl = typeof response.featuredImageUrl === "string"
      ? response.featuredImageUrl.trim()
      : undefined;
    const executionTimeMs = typeof response.executionTimeMs === "number"
      ? response.executionTimeMs
      : undefined;

    if (!wordpressUrl || !title || pageIdentifier === undefined || pageIdentifier === null || pageIdentifier === "") {
      throw new GlwN8nAdapterError("GLW n8n webhook returned a completion response without the required WordPress fields.");
    }

    return {
      kind: "complete",
      executionId,
      status: status as GlwN8nCompleteResponse["status"],
      title,
      wordpressPageId: pageIdentifier as string | number,
      wordpressUrl,
      wordpressPostId: (wordpressPostId as string | number | undefined) ?? (pageIdentifier as string | number),
      featuredImageUrl,
      executionTimeMs,
    };
  }

  if (status === "failed") {
    const error = response.error;

    if (typeof error !== "object" || error === null || typeof (error as { message?: unknown }).message !== "string") {
      throw new GlwN8nAdapterError("GLW n8n webhook returned a failure response without an error message.");
    }

    return {
      kind: "failed",
      executionId: executionId || undefined,
      status: "failed",
      error: {
        message: (error as { message: string }).message,
        step: typeof (error as { step?: unknown }).step === "string" ? (error as { step: string }).step : undefined,
      },
    };
  }

  throw new GlwN8nAdapterError("GLW n8n webhook returned an unsupported status value.");
}

export function createGlwN8nTransport(options?: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): GlwN8nTransport {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 30000;

  return {
    async invokePageGeneration(request: GlwN8nPageGenerationRequest): Promise<GlwN8nResponse> {
      const webhookUrl = getRequiredValue("GLW_N8N_PAGE_WEBHOOK_URL");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: getAuthorizationHeader(),
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new GlwN8nAdapterError(`GLW n8n webhook returned ${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
        }

        const payload = await response.json().catch(() => {
          throw new GlwN8nAdapterError("GLW n8n webhook returned invalid JSON.");
        });

        return parseJsonResponse(payload);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new GlwN8nAdapterError("GLW n8n webhook request timed out.");
        }

        if (error instanceof GlwN8nAdapterError) {
          throw error;
        }

        throw new GlwN8nAdapterError(error instanceof Error ? error.message : "GLW n8n webhook request failed.");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

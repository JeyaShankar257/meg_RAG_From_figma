export class ApiError extends Error {
  status: number;
  requestId?: string;
  retryable: boolean;

  constructor(message: string, status: number, requestId?: string, retryable = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
    this.retryable = retryable;
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

interface ApiRequestOptions extends RequestInit {
  signal?: AbortSignal;
}

export async function requestJson<ResponseBody>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ResponseBody> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const requestId = response.headers.get("x-request-id") ?? undefined;
  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    const message = getErrorMessage(responseBody, response.status);
    throw new ApiError(
      message,
      response.status,
      requestId,
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }

  return responseBody as ResponseBody;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined;

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function getErrorMessage(responseBody: unknown, status: number): string {
  if (typeof responseBody === "object" && responseBody !== null && "error" in responseBody) {
    const error = responseBody.error;
    if (typeof error === "string" && error.trim()) return error;
  }

  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403 || status === 404) return "You do not have access to this analysis.";
  if (status === 429) return "The analysis service is busy. Please try again shortly.";
  return "The request could not be completed.";
}

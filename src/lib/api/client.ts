export class ApiError extends Error {
  status: number;
  requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
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
    throw new ApiError(message, response.status, requestId);
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

  return status === 401 ? "Your session has expired. Please sign in again." : "The request could not be completed.";
}

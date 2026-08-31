import { isAxiosError } from "axios";

/**
 * Normalizes FastAPI-style error payloads the same way
 * frontend/src/lib/api.js's formatApiError does, so backend error copy stays
 * consistent between web and mobile. FastAPI's `detail` is a string, a list
 * of `{msg}` validation errors, or occasionally a plain object.
 */
export class ApiError extends Error {
  status: number | null;
  requestId: string | null;
  isNetworkError: boolean;

  constructor(params: {
    message: string;
    status: number | null;
    requestId: string | null;
    isNetworkError: boolean;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.requestId = params.requestId;
    this.isNetworkError = params.isNetworkError;
  }
}

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : null,
      )
      .filter((message): message is string => Boolean(message));
    if (messages.length > 0) return messages.join(" ");
  }
  if (detail && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}

export function toApiError(error: unknown): ApiError {
  // The Axios response interceptor already normalizes errors before callers
  // receive them. Keep normalization idempotent so screen-level handlers do
  // not replace the useful backend message with the generic fallback.
  if (error instanceof ApiError) return error;

  if (isAxiosError(error)) {
    const requestId = (error.response?.headers?.["x-request-id"] as string | undefined) ?? null;

    if (!error.response) {
      return new ApiError({
        message:
          error.code === "ECONNABORTED"
            ? "That took too long. Check your connection and try again."
            : "Couldn't reach the Savvy Campus server. Check your connection and try again.",
        status: null,
        requestId,
        isNetworkError: true,
      });
    }

    const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
    return new ApiError({
      message: formatDetail(detail),
      status: error.response.status,
      requestId,
      isNetworkError: false,
    });
  }

  return new ApiError({
    message: "Something went wrong. Please try again.",
    status: null,
    requestId: null,
    isNetworkError: false,
  });
}

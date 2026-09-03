import { AxiosError, AxiosHeaders } from "axios";

import { ApiError, toApiError } from "@/api/errors";

function axiosErrorWithResponse(
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
) {
  return new AxiosError("Request failed", String(status), undefined, undefined, {
    status,
    statusText: "",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() } as never,
    data,
    request: undefined,
  } as never);
}

describe("toApiError", () => {
  it("formats a string FastAPI detail", () => {
    const error = toApiError(axiosErrorWithResponse(400, { detail: "Email already registered" }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Email already registered");
    expect(error.status).toBe(400);
    expect(error.isNetworkError).toBe(false);
  });

  it("joins a list of FastAPI validation errors", () => {
    const error = toApiError(
      axiosErrorWithResponse(422, {
        detail: [{ msg: "field required" }, { msg: "value is not a valid email" }],
      }),
    );
    expect(error.message).toBe("field required value is not a valid email");
  });

  it("treats a response-less axios error as a network error", () => {
    const networkError = new AxiosError("Network Error", "ERR_NETWORK");
    const error = toApiError(networkError);
    expect(error.isNetworkError).toBe(true);
    expect(error.status).toBeNull();
  });

  it("describes a timeout as a potentially waking server", () => {
    const error = toApiError(new AxiosError("timeout", "ECONNABORTED"));

    expect(error.message).toContain("server is taking longer than expected to wake up");
    expect(error.isNetworkError).toBe(true);
  });

  it("falls back to a generic message for a non-axios error", () => {
    const error = toApiError(new Error("boom"));
    expect(error.message).toBe("Something went wrong. Please try again.");
    expect(error.isNetworkError).toBe(false);
  });

  it("preserves an error already normalized by the response interceptor", () => {
    const normalized = new ApiError({
      message: "A verification request already exists for this Student ID.",
      status: 409,
      requestId: "request-1",
      isNetworkError: false,
    });

    expect(toApiError(normalized)).toBe(normalized);
    expect(toApiError(normalized).message).toBe(
      "A verification request already exists for this Student ID.",
    );
  });
});

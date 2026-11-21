import { config } from "../config";

interface ApiErrorResponse {
  message?: unknown;
}

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  if (!config.api) {
    throw new ApiRequestError(
      "The backend URL is not configured. Set REACT_APP_API_URL to the backend origin and rebuild the frontend."
    );
  }

  let response: Response;
  try {
    response = await fetch(`${config.api}${path}`, options);
  } catch {
    throw new ApiRequestError(
      `Could not connect to the backend at ${config.backendUrl}. Check the backend status, REACT_APP_API_URL, and CORS settings.`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("json")) {
    const message = response.status === 404
      ? `The backend returned 404 for this API route. Verify that the updated backend is running at ${config.backendUrl}.`
      : `The backend returned a non-JSON response (HTTP ${response.status}). Verify REACT_APP_API_URL and the backend routes.`;
    throw new ApiRequestError(message, response.status);
  }

  let result: T & ApiErrorResponse;
  try {
    result = await response.json() as T & ApiErrorResponse;
  } catch {
    throw new ApiRequestError(
      `The backend returned invalid JSON (HTTP ${response.status}). Verify that the updated backend is running at ${config.backendUrl}.`,
      response.status
    );
  }
  if (!response.ok) {
    const message = typeof result.message === "string"
      ? result.message
      : `The backend request failed (HTTP ${response.status}).`;
    throw new ApiRequestError(message, response.status);
  }
  return result;
}

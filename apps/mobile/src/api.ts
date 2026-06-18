const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const demoSurfacesEnabled = process.env.EXPO_PUBLIC_ENABLE_DEMO_SURFACES === "true";
const developmentRuntime = typeof __DEV__ !== "undefined" && __DEV__;
const API_BASE_URL = configuredApiBaseUrl ?? (developmentRuntime || demoSurfacesEnabled ? "http://localhost:3001" : "");

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiRequestError(0, "EXPO_PUBLIC_API_URL is required in production Legal Bhai builds");
  }
  if (!developmentRuntime && !demoSurfacesEnabled && !API_BASE_URL.startsWith("https://")) {
    throw new ApiRequestError(0, "Production Legal Bhai builds require an HTTPS API URL");
  }
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status, await response.text());
  }

  return response.json() as Promise<T>;
}

export { API_BASE_URL };

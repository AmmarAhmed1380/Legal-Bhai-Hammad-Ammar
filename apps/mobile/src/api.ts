import { NativeModules, Platform } from "react-native";

function resolveLocalhost(url: string): string {
  if (!url.includes("localhost") && !url.includes("127.0.0.1")) {
    return url;
  }

  const scriptURL = NativeModules.SourceCode?.scriptURL;
  if (typeof scriptURL === "string" && scriptURL.includes("://")) {
    const hostPart = scriptURL.split("://")[1]?.split("/")[0];
    const ipAddress = hostPart?.split(":")[0];
    if (ipAddress && ipAddress !== "localhost" && ipAddress !== "127.0.0.1") {
      return url.replace("localhost", ipAddress).replace("127.0.0.1", ipAddress);
    }
  }

  if (Platform.OS === "android") {
    return url.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2");
  }

  return url;
}

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const demoSurfacesEnabled = process.env.EXPO_PUBLIC_ENABLE_DEMO_SURFACES === "true";
const developmentRuntime = typeof __DEV__ !== "undefined" && __DEV__;
const rawApiBaseUrl = configuredApiBaseUrl ?? (developmentRuntime || demoSurfacesEnabled ? "http://localhost:3001" : "");
const API_BASE_URL = resolveLocalhost(rawApiBaseUrl);
console.log("[api] Resolved API_BASE_URL to:", API_BASE_URL);

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
    throw new ApiRequestError(0, "EXPO_PUBLIC_API_URL is required in production LegalBahi builds");
  }
  if (!developmentRuntime && !demoSurfacesEnabled && !API_BASE_URL.startsWith("https://")) {
    throw new ApiRequestError(0, "Production LegalBahi builds require an HTTPS API URL");
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
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
      if (typeof parsed.error === "string") {
        message = parsed.error;
      } else if (typeof parsed.message === "string") {
        message = parsed.message;
      }
    } catch {
      // Keep the plain response body for non-JSON errors.
    }
    throw new ApiRequestError(response.status, message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export { API_BASE_URL };

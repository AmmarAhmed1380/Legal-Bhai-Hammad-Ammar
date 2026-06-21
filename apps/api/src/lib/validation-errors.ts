import { isProduction } from "./config.js";

type ValidationIssue = {
  instancePath?: string;
  message?: string;
  keyword?: string;
};

export function isFastifyValidationError(error: unknown): error is Error & { validation: ValidationIssue[]; statusCode: number } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "validation" in error &&
      Array.isArray((error as { validation?: unknown }).validation),
  );
}

export function isFastifyClientInputError(error: unknown): error is Error & { code?: string; statusCode?: number } {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { code?: unknown; statusCode?: unknown };
  return (
    candidate.statusCode === 400 &&
    typeof candidate.code === "string" &&
    candidate.code.startsWith("FST_ERR_")
  );
}

export function formatValidationError(error: Error & { validation: ValidationIssue[] }): string {
  const first = error.validation[0];
  if (!first) {
    return "Invalid request payload";
  }
  const field = first.instancePath?.replace(/^\//, "") || "body";
  const detail = first.message ?? "is invalid";
  return `Invalid request payload: ${field} ${detail}`;
}

export function validationErrorResponse(error: Error & { validation: ValidationIssue[] }): { error: string } {
  return {
    error: isProduction() ? "Invalid request payload" : formatValidationError(error),
  };
}

export function clientInputErrorResponse(error: Error): { error: string } {
  return {
    error: isProduction() ? "Bad request" : error.message,
  };
}

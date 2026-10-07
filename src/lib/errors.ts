export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: "VALIDATION" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMIT" | "UNAUTHORIZED" = "VALIDATION",
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Dafür fehlt dir die Berechtigung.") {
    super(message, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Eintrag nicht gefunden.") {
    super(message, "NOT_FOUND");
  }
}

import type { Context } from "hono";
import { ZodError } from "zod";
import { logger } from "./logger.js";

export class ApiError extends Error {
    constructor(
        public statusCode: number,
        public code: string,
        message: string,
        public details?: unknown,
    ) {
        super(message);
        this.name = "ApiError";
    }

    static badRequest(message = "Invalid request", details?: unknown) {
        return new ApiError(400, "bad_request", message, details);
    }

    static unauthorized(message = "Authentication required") {
        return new ApiError(401, "unauthorized", message);
    }

    static forbidden(message = "Access denied") {
        return new ApiError(403, "forbidden", message);
    }

    static notFound(message = "Resource not found") {
        return new ApiError(404, "not_found", message);
    }

    static conflict(message = "Resource already exists or conflicting state") {
        return new ApiError(409, "conflict", message);
    }

    static tooManyRequests(message = "Too many requests") {
        return new ApiError(429, "rate_limited", message);
    }

    static internal(message = "An unexpected error occurred", details?: unknown) {
        return new ApiError(500, "internal_server_error", message, details);
    }
}

export function handleApiError(err: unknown, c: Context) {
    const correlationId = (c.get("correlationId") as string) || "unknown";

    if (err instanceof ApiError) {
        if (err.statusCode >= 500) {
            logger.error(`API Error ${err.statusCode}: ${err.message}`, {
                correlationId,
                code: err.code,
                ...(err.details ? { providerMessage: String(err.details) } : {}),
            });
        } else {
            logger.warn(`Client Error ${err.statusCode}: ${err.message}`, { correlationId, code: err.code });
        }
        return c.json(
            {
                error: err.code,
                message: err.message,
                correlationId,
                ...(err.details ? { details: err.details } : {}),
            },
            err.statusCode as any,
        );
    }

    if (err instanceof ZodError) {
        const issues = err.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
        }));
        logger.warn("Validation error", { correlationId, issues });
        return c.json(
            {
                error: "validation_error",
                message: "Request validation failed",
                correlationId,
                details: issues,
            },
            400,
        );
    }

    const message = err instanceof Error ? err.message : String(err);
    logger.error("Unhandled server error", {
        correlationId,
        message,
        ...(process.env["NODE_ENV"] !== "production" && err instanceof Error ? { stack: err.stack } : {}),
    });

    return c.json(
        {
            error: "internal_server_error",
            message: "An internal server error occurred",
            correlationId,
        },
        500,
    );
}

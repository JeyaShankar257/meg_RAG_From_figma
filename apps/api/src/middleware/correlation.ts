import { createMiddleware } from "hono/factory";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";

/**
 * Injects a correlation ID into every request.
 * Uses the incoming X-Correlation-Id header if present (from a trusted
 * internal caller), otherwise generates a new UUID.
 *
 * The ID is stored in the Hono context and echoed back in the response.
 */
export const correlationMiddleware = createMiddleware(async (c, next) => {
    const incoming = c.req.header("x-correlation-id");
    const correlationId =
        incoming && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(incoming)
            ? incoming
            : randomUUID();

    c.set("correlationId", correlationId);
    c.header("X-Correlation-Id", correlationId);

    logger.info("request", {
        correlationId,
        method: c.req.method,
        path: c.req.path,
    });

    const start = Date.now();
    await next();
    const ms = Date.now() - start;

    logger.info("response", {
        correlationId,
        status: c.res.status,
        durationMs: ms,
    });
});

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { initConfig, getConfig } from "./config.js";
import { correlationMiddleware } from "./middleware/correlation.js";
import { healthRouter } from "./routes/health/index.js";
import { logger } from "./lib/logger.js";

// ─── 1. Validate environment at startup (exits on missing vars) ───────────────
initConfig();
const config = getConfig();

// ─── 2. Build Hono app ────────────────────────────────────────────────────────
const app = new Hono<{
    Variables: { correlationId: string };
}>();

app.use("*", cors({ origin: config.corsAllowedOrigins }));
app.use("*", correlationMiddleware);

// ─── 3. Routes ────────────────────────────────────────────────────────────────
app.route("/health", healthRouter);

// 404 fallback
app.notFound((c) => {
    return c.json({ error: "not_found" }, 404);
});

// Global error handler — never expose internals
app.onError((err, c) => {
    const correlationId = c.get("correlationId") as string | undefined;
    logger.error("unhandled error", {
        correlationId,
        error: err.message,
        // stack only in dev
        ...(process.env["NODE_ENV"] !== "production" && { stack: err.stack }),
    });
    return c.json({ error: "internal_server_error", correlationId }, 500);
});

// ─── 4. Start server ──────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: config.apiPort }, (info) => {
    logger.info(`MedNova API started`, {
        port: info.port,
        demoMode: config.demoMode,
    });
});

export type AppType = typeof app;

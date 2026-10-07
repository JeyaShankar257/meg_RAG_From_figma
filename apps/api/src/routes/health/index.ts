import { Hono } from "hono";
import { getConfig } from "../../config.js";

const healthRouter = new Hono();

/**
 * GET /health
 *
 * Returns non-sensitive service status.
 * Does NOT expose config values, secrets, DB connection strings, or version details.
 */
healthRouter.get("/", (c) => {
    const config = getConfig();

    return c.json({
        status: "ok",
        service: "mednova-api",
        demoMode: config.demoMode,
        timestamp: new Date().toISOString(),
    });
});

export { healthRouter };

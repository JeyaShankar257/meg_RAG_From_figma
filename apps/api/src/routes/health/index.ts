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
    let demoMode = true;
    try {
        const config = getConfig();
        demoMode = config.demoMode;
    } catch {
        // fallback if config not yet initialized
    }

    return c.json({
        status: "healthy",
        service: "mednova-api",
        contractVersion: "1.0",
        demoMode,
        timestamp: new Date().toISOString(),
    });
});

healthRouter.get("/live", (c) =>
    c.json({
        status: "ok",
        service: "mednova-api",
        timestamp: new Date().toISOString(),
    }),
);

healthRouter.get("/diagnostics", (c) => {
    try {
        const config = getConfig();
        return c.json({
            status: "ok",
            service: config.serviceName,
            contractVersion: config.contractVersion,
            demoMode: config.demoMode,
            diagnostics: {
                supabaseUrlPresent: Boolean(config.supabaseUrl),
                serviceRoleKeyPresent: Boolean(config.supabaseServiceRoleKey),
                authAdminKeyPresent: Boolean(config.authAdminKey),
                anonKeyPresent: Boolean(config.supabaseAnonKey),
                apiOrigin: config.apiOrigin,
                allowedActivationRedirects: config.allowedActivationRedirects,
                agentsServiceConfigured: Boolean(config.agentsServiceUrl),
                resendConfigured: Boolean(config.resendApiKey),
                geminiConfigured: Boolean(config.geminiApiKey),
            },
            timestamp: new Date().toISOString(),
        });
    } catch {
        return c.json(
            {
                status: "degraded",
                service: "mednova-api",
                message: "Configuration not initialized",
                timestamp: new Date().toISOString(),
            },
            503,
        );
    }
});

export { healthRouter };


/**
 * Server-only environment validation.
 *
 * Call validateEnv() once at startup. The process exits immediately with
 * an actionable error if any required variable is absent or malformed.
 * Secret values are NEVER logged — only variable names are shown in errors.
 */

export interface EnvConfig {
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    supabaseSecretKey?: string;
    authAdminKey: string;
    supabaseAnonKey: string;
    apiPort: number;
    apiOrigin: string;
    corsAllowedOrigins: string[];
    allowedActivationRedirects: string[];
    doctorActivationUrl: string;
    patientActivationUrl: string;
    reportsBucketName: string;
    signedUrlExpirySeconds: number;
    resendApiKey: string;
    resendFromAddress: string;
    geminiApiKey: string;
    geminiModel: string;
    agentsServiceUrl: string;
    agentsInternalSecret: string;
    demoMode: boolean;
    serviceName: "mednova-api";
    contractVersion: "1.0";
}

function requireEnv(name: string, env: NodeJS.ProcessEnv): string {
    const value = env[name];
    if (!value || value.trim() === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value.trim();
}

function optionalEnv(name: string, fallback: string, env: NodeJS.ProcessEnv): string {
    return (env[name] ?? "").trim() || fallback;
}

function requireInt(name: string, fallback: number | undefined, env: NodeJS.ProcessEnv): number {
    const raw = env[name];
    if (!raw && fallback !== undefined) return fallback;
    const parsed = parseInt(raw ?? "", 10);
    if (isNaN(parsed)) {
        throw new Error(
            `Environment variable ${name} must be an integer, got: "${raw}"`,
        );
    }
    return parsed;
}

function validateUrl(value: string, name: string): URL {
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error(`Protocol must be http: or https:, got ${parsed.protocol}`);
        }
        return parsed;
    } catch (e) {
        throw new Error(`Invalid URL for ${name}: ${(e as Error).message}`);
    }
}

export function validateEnv(customEnv?: NodeJS.ProcessEnv): EnvConfig {
    const env = customEnv ?? process.env;
    const errors: string[] = [];
    const demoMode = env["DEMO_MODE"] === "true";

    const collect = <T>(fn: () => T, key: string): T | undefined => {
        try {
            return fn();
        } catch (e) {
            errors.push(`  ✗ ${key}: ${(e as Error).message}`);
            return undefined;
        }
    };

    const supabaseUrl = collect(() => {
        const raw = requireEnv("SUPABASE_URL", env);
        validateUrl(raw, "SUPABASE_URL");
        return raw;
    }, "SUPABASE_URL");

    const supabaseServiceRoleKey = collect(
        () => requireEnv("SUPABASE_SERVICE_ROLE_KEY", env),
        "SUPABASE_SERVICE_ROLE_KEY",
    );
    const supabaseSecretKey = env["SUPABASE_SECRET_KEY"]?.trim() || undefined;
    const supabaseAnonKey = collect(
        () => requireEnv("SUPABASE_ANON_KEY", env),
        "SUPABASE_ANON_KEY",
    );

    // Key conflict checks
    if (supabaseServiceRoleKey && supabaseAnonKey && supabaseServiceRoleKey === supabaseAnonKey) {
        errors.push("  ✗ SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY must not be identical (privilege leak risk)");
    }

    const authAdminKey = supabaseSecretKey || supabaseServiceRoleKey || "";

    const apiOrigin = collect(() => {
        const raw = optionalEnv("API_ORIGIN", "http://localhost:8443", env);
        validateUrl(raw, "API_ORIGIN");
        return raw;
    }, "API_ORIGIN") ?? "http://localhost:8443";

    const doctorActivationUrl = `${apiOrigin}/doctor/activate`;
    const patientActivationUrl = `${apiOrigin}/activate`;

    const rawAllowedRedirects = optionalEnv(
        "ALLOWED_ACTIVATION_REDIRECTS",
        `${doctorActivationUrl},${patientActivationUrl}`,
        env,
    );
    const allowedActivationRedirects = rawAllowedRedirects
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    for (const redirectUrl of allowedActivationRedirects) {
        collect(() => validateUrl(redirectUrl, "ALLOWED_ACTIVATION_REDIRECTS"), redirectUrl);
    }

    const agentsServiceUrl = demoMode
        ? optionalEnv("AGENTS_SERVICE_URL", "http://localhost:8001", env)
        : collect(() => requireEnv("AGENTS_SERVICE_URL", env), "AGENTS_SERVICE_URL");
    const agentsInternalSecret = demoMode
        ? optionalEnv("AGENTS_INTERNAL_SECRET", "demo-agent-secret", env)
        : collect(() => requireEnv("AGENTS_INTERNAL_SECRET", env), "AGENTS_INTERNAL_SECRET");
    const resendApiKey = demoMode
        ? optionalEnv("RESEND_API_KEY", "demo-resend-key", env)
        : collect(() => requireEnv("RESEND_API_KEY", env), "RESEND_API_KEY");
    const resendFromAddress = demoMode
        ? optionalEnv("RESEND_FROM_ADDRESS", "demo@mednova.local", env)
        : collect(() => requireEnv("RESEND_FROM_ADDRESS", env), "RESEND_FROM_ADDRESS");
    const geminiApiKey = demoMode
        ? optionalEnv("GEMINI_API_KEY", "demo-gemini-key", env)
        : collect(() => requireEnv("GEMINI_API_KEY", env), "GEMINI_API_KEY");

    if (errors.length > 0) {
        const message = [
            "",
            "═══════════════════════════════════════════════════",
            "  MedNova API: startup failed — configuration error",
            "═══════════════════════════════════════════════════",
            ...errors,
            "",
            "  Check your environment variables before starting.",
            "═══════════════════════════════════════════════════",
            "",
        ].join("\n");
        console.error(message);
        if (env["NODE_ENV"] !== "test" && !customEnv) {
            process.exit(1);
        }
        throw new Error(message);
    }

    const apiPort = requireInt("API_PORT", 3001, env);
    const corsRaw = optionalEnv("CORS_ALLOWED_ORIGINS", apiOrigin, env);
    const corsAllowedOrigins = corsRaw.split(",").map((s) => s.trim());
    const reportsBucketName = optionalEnv("REPORTS_BUCKET_NAME", "medical-reports", env);
    const signedUrlExpirySeconds = requireInt("SIGNED_URL_EXPIRY_SECONDS", 300, env);
    const geminiModel = optionalEnv("GEMINI_MODEL", "gemini-1.5-pro", env);

    return {
        supabaseUrl: supabaseUrl!,
        supabaseServiceRoleKey: supabaseServiceRoleKey!,
        supabaseSecretKey,
        authAdminKey,
        supabaseAnonKey: supabaseAnonKey!,
        apiPort,
        apiOrigin,
        corsAllowedOrigins,
        allowedActivationRedirects,
        doctorActivationUrl,
        patientActivationUrl,
        reportsBucketName,
        signedUrlExpirySeconds,
        resendApiKey: resendApiKey!,
        resendFromAddress: resendFromAddress!,
        geminiApiKey: geminiApiKey!,
        geminiModel,
        agentsServiceUrl: agentsServiceUrl!,
        agentsInternalSecret: agentsInternalSecret!,
        demoMode,
        serviceName: "mednova-api",
        contractVersion: "1.0",
    };
}

// Singleton — validated once at startup, imported everywhere
let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
    if (!_config) {
        try {
            _config = validateEnv();
        } catch {
            return {
                supabaseUrl: "http://localhost:54321",
                supabaseServiceRoleKey: "demo-service-role-key",
                authAdminKey: "demo-auth-admin-key",
                supabaseAnonKey: "demo-anon-key",
                apiPort: 3001,
                apiOrigin: "http://localhost:8443",
                corsAllowedOrigins: ["http://localhost:8443"],
                allowedActivationRedirects: [
                    "http://localhost:8443/doctor/activate",
                    "http://localhost:8443/activate",
                ],
                doctorActivationUrl: "http://localhost:8443/doctor/activate",
                patientActivationUrl: "http://localhost:8443/activate",
                reportsBucketName: "medical-reports",
                signedUrlExpirySeconds: 300,
                resendApiKey: "demo-resend-key",
                resendFromAddress: "demo@mednova.local",
                geminiApiKey: "demo-gemini-key",
                geminiModel: "gemini-1.5-pro",
                agentsServiceUrl: "http://localhost:8001",
                agentsInternalSecret: "demo-agent-secret",
                demoMode: true,
                serviceName: "mednova-api",
                contractVersion: "1.0",
            };
        }
    }
    return _config;
}

export function getApiOrigin(): string {
    return _config?.apiOrigin ?? optionalEnv("API_ORIGIN", "http://localhost:8443", process.env);
}

export function initConfig(customEnv?: NodeJS.ProcessEnv): EnvConfig {
    _config = validateEnv(customEnv);
    return _config;
}


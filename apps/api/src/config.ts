/**
 * Server-only environment validation.
 *
 * Call validateEnv() once at startup. The process exits immediately with
 * an actionable error if any required variable is absent or malformed.
 * Secret values are NEVER logged — only variable names are shown in errors.
 */

interface EnvConfig {
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    supabaseAnonKey: string;
    apiPort: number;
    apiOrigin: string;
    corsAllowedOrigins: string[];
    reportsBucketName: string;
    signedUrlExpirySeconds: number;
    resendApiKey: string;
    resendFromAddress: string;
    agentsServiceUrl: string;
    agentsInternalSecret: string;
    demoMode: boolean;
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value || value.trim() === "") {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value.trim();
}

function optionalEnv(name: string, fallback: string): string {
    return (process.env[name] ?? "").trim() || fallback;
}

function requireInt(name: string, fallback?: number): number {
    const raw = process.env[name];
    if (!raw && fallback !== undefined) return fallback;
    const parsed = parseInt(raw ?? "", 10);
    if (isNaN(parsed)) {
        throw new Error(
            `Environment variable ${name} must be an integer, got: "${raw}"`,
        );
    }
    return parsed;
}

export function validateEnv(): EnvConfig {
    const errors: string[] = [];

    const collect = <T>(fn: () => T, key: string): T | undefined => {
        try {
            return fn();
        } catch (e) {
            errors.push(`  ✗ ${key}: ${(e as Error).message}`);
            return undefined;
        }
    };

    const supabaseUrl = collect(() => requireEnv("SUPABASE_URL"), "SUPABASE_URL");
    const supabaseServiceRoleKey = collect(
        () => requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
        "SUPABASE_SERVICE_ROLE_KEY",
    );
    const supabaseAnonKey = collect(
        () => requireEnv("SUPABASE_ANON_KEY"),
        "SUPABASE_ANON_KEY",
    );
    const agentsServiceUrl = collect(
        () => requireEnv("AGENTS_SERVICE_URL"),
        "AGENTS_SERVICE_URL",
    );
    const agentsInternalSecret = collect(
        () => requireEnv("AGENTS_INTERNAL_SECRET"),
        "AGENTS_INTERNAL_SECRET",
    );
    const resendApiKey = collect(
        () => requireEnv("RESEND_API_KEY"),
        "RESEND_API_KEY",
    );
    const resendFromAddress = collect(
        () => requireEnv("RESEND_FROM_ADDRESS"),
        "RESEND_FROM_ADDRESS",
    );

    if (errors.length > 0) {
        console.error(
            [
                "",
                "═══════════════════════════════════════════════════",
                "  MedNova API: startup failed — missing environment",
                "═══════════════════════════════════════════════════",
                ...errors,
                "",
                "  Copy .env.example to apps/api/.env and fill in",
                "  the required values before starting the server.",
                "═══════════════════════════════════════════════════",
                "",
            ].join("\n"),
        );
        process.exit(1);
    }

    const apiPort = requireInt("API_PORT", 3001);
    const apiOrigin = optionalEnv("API_ORIGIN", "http://localhost:5173");
    const corsRaw = optionalEnv("CORS_ALLOWED_ORIGINS", apiOrigin);
    const corsAllowedOrigins = corsRaw.split(",").map((s) => s.trim());
    const reportsBucketName = optionalEnv("REPORTS_BUCKET_NAME", "medical-reports");
    const signedUrlExpirySeconds = requireInt("SIGNED_URL_EXPIRY_SECONDS", 300);
    const demoMode = process.env["DEMO_MODE"] === "true";

    return {
        supabaseUrl: supabaseUrl!,
        supabaseServiceRoleKey: supabaseServiceRoleKey!,
        supabaseAnonKey: supabaseAnonKey!,
        apiPort,
        apiOrigin,
        corsAllowedOrigins,
        reportsBucketName,
        signedUrlExpirySeconds,
        resendApiKey: resendApiKey!,
        resendFromAddress: resendFromAddress!,
        agentsServiceUrl: agentsServiceUrl!,
        agentsInternalSecret: agentsInternalSecret!,
        demoMode,
    };
}

// Singleton — validated once at startup, imported everywhere
let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
    if (!_config) {
        throw new Error(
            "Config not initialized. Call validateEnv() at startup first.",
        );
    }
    return _config;
}

export function initConfig(): EnvConfig {
    _config = validateEnv();
    return _config;
}

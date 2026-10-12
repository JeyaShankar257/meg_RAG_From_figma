import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";

let _adminClient: SupabaseClient | null = null;

/**
 * Returns the privileged Supabase admin client using the service role key.
 * Only used for system background tasks, server-side transactions, and audit inserts.
 */
export function getAdminClient(): SupabaseClient {
    if (!_adminClient) {
        const config = getConfig();
        _adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return _adminClient;
}

/**
 * Returns a user-scoped Supabase client that respects Postgres Row-Level Security.
 */
export function getUserClient(accessToken: string): SupabaseClient {
    const config = getConfig();
    return createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    });
}

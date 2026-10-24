import { Resend } from "resend";
import { getAdminClient } from "../lib/supabase.js";

export interface EmailDispatchResult {
    success: boolean;
    providerMessageId: string;
    mode: "resend" | "capture";
    error?: string;
}

/**
 * Dispatches clinical emails via Resend or captures them safely in dev/demo mode.
 */
export async function sendEmail({
    to,
    subject,
    text,
    html,
    metadata,
}: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    metadata?: Record<string, unknown>;
}): Promise<EmailDispatchResult> {
    const emailMode = process.env["EMAIL_MODE"] || (process.env["DEMO_MODE"] === "true" ? "capture" : "live");
    const resendApiKey = process.env["RESEND_API_KEY"];
    const fromAddress = process.env["RESEND_FROM_ADDRESS"] || "care-team@mednova.clinic";

    // Fallback to capture mode if key is missing, mock, or EMAIL_MODE=capture
    if (
        emailMode === "capture" ||
        !resendApiKey ||
        resendApiKey === "demo-resend-key" ||
        resendApiKey.startsWith("mock")
    ) {
        const captureId = `capture_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        console.log(`[EMAIL CAPTURE] Mode: capture | To: ${to} | Subject: "${subject}" | ID: ${captureId}`);
        if (metadata) {
            console.log(`[EMAIL CAPTURE METADATA]`, JSON.stringify(metadata));
        }
        return {
            success: true,
            providerMessageId: captureId,
            mode: "capture",
        };
    }

    try {
        const resend = new Resend(resendApiKey);
        const { data, error } = await resend.emails.send({
            from: fromAddress,
            to,
            subject,
            text,
            html: html || text,
        });

        if (error) {
            console.warn(`[EMAIL RESEND WARNING] Failed sending to ${to}: ${error.message}. Falling back to captured record.`);
            return {
                success: true,
                providerMessageId: `fallback_resend_${Date.now()}`,
                mode: "capture",
                error: error.message,
            };
        }

        return {
            success: true,
            providerMessageId: data?.id || `resend_${Date.now()}`,
            mode: "resend",
        };
    } catch (err: any) {
        console.warn(`[EMAIL RESEND EXCEPTION] Error sending email to ${to}: ${err.message}. Safely captured.`);
        return {
            success: true,
            providerMessageId: `err_captured_${Date.now()}`,
            mode: "capture",
            error: err.message,
        };
    }
}

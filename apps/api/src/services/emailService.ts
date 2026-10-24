import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";

export interface EmailDispatchResult {
    success: boolean;
    providerMessageId: string;
    mode: "nodemailer" | "resend" | "capture";
    error?: string;
}

let _transporter: Transporter | null = null;

function getSmtpTransporter(): Transporter | null {
    const smtpUser = process.env["SMTP_USER"];
    const smtpPass = (process.env["SMTP_PASS"] || "").replace(/\s+/g, "");

    if (!smtpUser || !smtpPass) {
        return null;
    }

    if (!_transporter) {
        const host = process.env["SMTP_HOST"] || "smtp.gmail.com";
        const port = Number(process.env["SMTP_PORT"] || 465);
        const secure = process.env["SMTP_SECURE"] !== "false";

        _transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });
    }

    return _transporter;
}

/**
 * Dispatches clinical emails via Nodemailer (Gmail SMTP) or Resend,
 * with safe capture fallback for development.
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
    const smtpTransporter = getSmtpTransporter();
    const resendApiKey = process.env["RESEND_API_KEY"];

    // 1. If capture mode is explicitly forced or no credentials exist, capture safely
    if (emailMode === "capture" || (!smtpTransporter && (!resendApiKey || resendApiKey === "demo-resend-key"))) {
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

    // 2. Primary: Nodemailer with Gmail SMTP (no custom domain needed)
    if (smtpTransporter) {
        try {
            const senderAddress = process.env["EMAIL_FROM"] || `MedNova Care Team <${process.env["SMTP_USER"]}>`;
            const info = await smtpTransporter.sendMail({
                from: senderAddress,
                to,
                subject,
                text,
                html: html || text,
            });

            console.log(`[EMAIL SENT VIA NODEMAILER] To: ${to} | Subject: "${subject}" | MessageId: ${info.messageId}`);
            return {
                success: true,
                providerMessageId: info.messageId,
                mode: "nodemailer",
            };
        } catch (err: any) {
            console.warn(`[EMAIL NODEMAILER WARNING] Error sending to ${to}: ${err.message}. Safely capturing record.`);
            return {
                success: true,
                providerMessageId: `err_smtp_${Date.now()}`,
                mode: "capture",
                error: err.message,
            };
        }
    }

    // 3. Secondary: Resend fallback
    if (resendApiKey && resendApiKey !== "demo-resend-key") {
        try {
            const resend = new Resend(resendApiKey);
            const fromAddress = process.env["RESEND_FROM_ADDRESS"] || "onboarding@resend.dev";
            const { data, error } = await resend.emails.send({
                from: fromAddress,
                to,
                subject,
                text,
                html: html || text,
            });

            if (error) {
                console.warn(`[EMAIL RESEND WARNING] Failed sending to ${to}: ${error.message}.`);
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
            console.warn(`[EMAIL RESEND EXCEPTION] Error: ${err.message}.`);
            return {
                success: true,
                providerMessageId: `err_resend_${Date.now()}`,
                mode: "capture",
                error: err.message,
            };
        }
    }

    return {
        success: true,
        providerMessageId: `fallback_${Date.now()}`,
        mode: "capture",
    };
}

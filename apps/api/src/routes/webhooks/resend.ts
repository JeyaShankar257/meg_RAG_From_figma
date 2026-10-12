import { Hono } from "hono";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getAdminClient } from "../../lib/supabase.js";
import { ApiError } from "../../lib/errors.js";

export const webhooksRouter = new Hono();

const resendWebhookSchema = z.object({
    type: z.enum(["email.sent", "email.delivered", "email.bounced", "email.complained"]),
    data: z.object({
        email_id: z.string().min(1),
        created_at: z.string().optional(),
    }),
});

/**
 * Resend Delivery Webhook Endpoint (Task 4.4)
 * Distinctly records sent, delivered, bounced, and failed states.
 * Replay-safe: already confirmed states are not degraded or duplicated.
 */
webhooksRouter.post("/resend", async (c) => {
    const rawBody = await c.req.text();
    const webhookSecret = process.env["RESEND_WEBHOOK_SECRET"];
    if (webhookSecret && process.env["DEMO_MODE"] !== "true") {
        const timestamp = c.req.header("svix-timestamp");
        const signature = c.req.header("svix-signature");
        const webhookId = c.req.header("svix-id");
        if (!timestamp || !signature || !webhookId || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
            throw ApiError.unauthorized("Invalid webhook signature");
        }
        const expected = createHmac("sha256", webhookSecret).update(`${webhookId}.${timestamp}.${rawBody}`).digest("base64");
        const valid = signature.split(" ").some((value) => {
            const supplied = value.replace(/^v\d+,/, "");
            const left = Buffer.from(supplied);
            const right = Buffer.from(expected);
            return left.length === right.length && timingSafeEqual(left, right);
        });
        if (!valid) throw ApiError.unauthorized("Invalid webhook signature");
    }
    const body = JSON.parse(rawBody) as unknown;
    const parsed = resendWebhookSchema.parse(body);

    const admin = getAdminClient();
    const providerMessageId = parsed.data.email_id;

    // 1. Locate notification record by provider_message_id
    const { data: notification, error: findErr } = await admin
        .from("notifications")
        .select("*")
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();

    if (findErr || !notification) {
        // Safe 200 OK to prevent provider retry floods if notification not yet indexed
        return c.json({ received: true, acknowledged: false, message: "Notification record not found" }, 200);
    }

    // 2. Replay protection: if already marked 'delivered', ignore redundant delivery events
    if (notification.status === "delivered" || notification.status === "bounced" || notification.status === "failed") {
        return c.json({ received: true, acknowledged: true, replayed: true });
    }

    let newStatus: "sent" | "delivered" | "bounced" | "failed" = notification.status;
    let deliveredAt: string | null = notification.delivered_at;

    if (parsed.type === "email.delivered" && notification.status !== "bounced" && notification.status !== "failed") {
        newStatus = "delivered";
        deliveredAt = parsed.data.created_at || new Date().toISOString();
    } else if (parsed.type === "email.bounced") {
        newStatus = "bounced";
    } else if (parsed.type === "email.complained") {
        newStatus = "failed";
    } else if (parsed.type === "email.sent") {
        newStatus = "sent";
    }

    // 3. Atomically update notification status
    await admin
        .from("notifications")
        .update({
            status: newStatus,
            delivered_at: deliveredAt,
        })
        .eq("id", notification.id);

    return c.json({
        received: true,
        acknowledged: true,
        notificationId: notification.id,
        status: newStatus,
    });
});

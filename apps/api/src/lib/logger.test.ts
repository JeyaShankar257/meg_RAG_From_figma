import { describe, expect, it, vi } from "vitest";
import { logger } from "./logger.js";

describe("safe logger", () => {
    it("preserves canonical fields and removes protected metadata", () => {
        const output = vi.spyOn(console, "log").mockImplementation(() => {});

        logger.info("message", {
            level: "attacker",
            timestamp: "attacker",
            apiKey: "secret",
            safeValue: "kept",
        });

        const line = output.mock.calls[0]?.[0] as string;
        expect(line).toContain("INFO");
        expect(line).toContain("kept");
        expect(line).not.toContain("attacker");
        expect(line).not.toContain("secret");
        output.mockRestore();
    });
});

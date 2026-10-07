import { describe, expect, it } from "vitest";
import { lifecycleStatus } from "./lifecycle.js";

describe("worker lifecycle", () => {
    it("stays non-processing in demo mode", () => {
        expect(lifecycleStatus(true)).toEqual({
            service: "mednova-worker",
            status: "ok",
            mode: "demo",
            processing: false,
        });
    });
});

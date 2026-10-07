import { describe, expect, it } from "vitest";

describe("correlation ID contract", () => {
    it("accepts bounded safe IDs and rejects unbounded or unsafe values", () => {
        const valid = "request-123";
        const invalid = "x".repeat(129);
        const pattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

        expect(pattern.test(valid)).toBe(true);
        expect(pattern.test(invalid)).toBe(false);
        expect(pattern.test("bad value")).toBe(false);
    });
});

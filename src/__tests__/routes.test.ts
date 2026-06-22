import { describe, it, expect, beforeEach } from "vitest";
import { getWindowName } from "@/routes";

describe("getWindowName", () => {
  beforeEach(() => {
    // vitest's "node" environment doesn't ship `window`; routes.ts only
    // touches window.location.search, so a minimal stub is enough here
    // without pulling in jsdom for the whole suite.
    (globalThis as any).window = { location: { search: "" } };
  });

  it("defaults to 'pet' when no window param is present", () => {
    window.location.search = "";
    expect(getWindowName()).toBe("pet");
  });

  it("returns 'hub' when ?window=hub", () => {
    window.location.search = "?window=hub";
    expect(getWindowName()).toBe("hub");
  });

  it("falls back to 'pet' for an unrecognized value", () => {
    window.location.search = "?window=something-else";
    expect(getWindowName()).toBe("pet");
  });
});

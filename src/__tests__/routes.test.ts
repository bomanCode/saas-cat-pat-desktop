// routes.test.ts only tests `getWindowName()` — pure URL parsing logic with
// no rendering. But `@/routes` also imports CatStage and HubApp at the top
// level, which pull in CatEngine -> PixiJS. PixiJS executes browser code
// (navigator, WebGL, etc.) at module load time, which can throw in
// Vitest's Node environment depending on Node version (observed: passed
// under Node 22 locally, failed under Node 20 in CI with
// "ReferenceError: navigator is not defined" — Node's built-in `navigator`
// stub differs across versions, and depending on it at all is fragile).
//
// Fix: vi.mock() the two component imports so Vitest never evaluates the
// PixiJS module graph at all — this is robust regardless of Node version,
// unlike bumping CI's Node version alone. The mocks must be declared
// before any other imports (Vitest hoists vi.mock calls automatically).
//
// NOTE: this exact fix was added in commit f992fab, then accidentally
// reverted in edd4304 (same PR, conflicting commit message) — restored
// here after that regression was caught during manual QA prep.
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/components/cat", () => ({ CatStage: () => null }));
vi.mock("@/components/HubApp", () => ({ HubApp: () => null }));

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

// routes.test.ts only tests `getWindowName()` — pure URL parsing logic with
// no rendering. But `@/routes` also imports CatStage and HubApp at the top
// level, which pull in CatEngine → PixiJS. PixiJS executes browser code
// (navigator, WebGL, etc.) at module load time, which throws in Vitest's
// Node environment.
//
// Fix: vi.mock() the two component imports so Vitest never evaluates the
// PixiJS module graph. The mocks must be declared before any other imports
// (Vitest hoists vi.mock calls to the top of the file automatically).
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/components/cat", () => ({ CatStage: () => null }));
vi.mock("@/components/HubApp", () => ({ HubApp: () => null }));

import { getWindowName } from "@/routes";

describe("getWindowName", () => {
  beforeEach(() => {
    // Vitest's "node" environment doesn't ship `window`; routes.ts only
    // touches window.location.search, so a minimal stub is enough here.
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

// Window router — Comnyang ships one Vite build shared by two Tauri windows
// (architecture.md §3), distinguished by a `?window=` query param baked into
// each window's `url` in tauri.conf.json (`index.html?window=pet`).

import type { ComponentType } from "react";
import { CatStage } from "@/components/cat";
import { HubApp } from "@/components/HubApp";

export type WindowName = "pet" | "hub";

export function getWindowName(): WindowName {
  const params = new URLSearchParams(window.location.search);
  const w = params.get("window");
  return w === "hub" ? "hub" : "pet"; // default to pet — safest if the param is ever missing
}

export const routes: Record<WindowName, ComponentType> = {
  pet: CatStage,
  hub: HubApp,
};


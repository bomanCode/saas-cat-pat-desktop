import { useTauriEvents } from "@/hooks/useTauriEvents";
import { getWindowName, routes } from "@/routes";

export default function App() {
  // Registers each Zustand store's Tauri event subscriptions exactly once
  // for the lifetime of this window (architecture.md §5 — Rust stays the
  // source of truth, every window subscribes independently to stay synced).
  useTauriEvents();

  const Route = routes[getWindowName()];
  return <Route />;
}

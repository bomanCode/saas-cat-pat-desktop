// Comnyang 2.0 — binary entrypoint.
// Kept thin per Tauri v2 convention: all real wiring lives in lib.rs::run()
// so the app crate can also be built as a lib (mobile targets, integration tests).
fn main() {
    comnyang_lib::run();
}

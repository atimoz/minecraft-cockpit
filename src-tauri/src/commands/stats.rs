use crate::state::{AppState, SystemStats};
use std::sync::Arc;
use std::time::Duration;
use sysinfo::{Pid, ProcessRefreshKind, RefreshKind, System};
use tauri::{AppHandle, Emitter, Manager, Wry};

/// Spawns a background loop that emits `stats:update` events every 2 s.
/// It tracks the Java child process spawned by our cmd.exe (running .bat).
pub fn spawn_stats_loop(app: AppHandle<Wry>) {
    tokio::spawn(async move {
        let mut sys = System::new_with_specifics(
            RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
        );
        loop {
            tokio::time::sleep(Duration::from_millis(1500)).await;

            let state = app.state::<Arc<AppState>>();
            let (running, root_pid, max_ram_gb) = {
                let server = state.server.lock().unwrap();
                let cfg = state.config.lock().unwrap();
                (
                    server.is_some(),
                    server.as_ref().map(|p| p.child.id()),
                    cfg.max_ram_gb,
                )
            };

            if !running {
                let _ = app.emit(
                    "stats:update",
                    SystemStats {
                        cpu_percent: 0.0,
                        ram_mb: 0,
                        ram_max_mb: Some((max_ram_gb as u64) * 1024),
                    },
                );
                continue;
            }

            sys.refresh_specifics(
                RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
            );

            let java_pid = root_pid
                .and_then(|root| find_java_descendant(&sys, Pid::from_u32(root)));

            let (cpu, ram) = if let Some(pid) = java_pid {
                if let Some(proc) = sys.process(pid) {
                    (proc.cpu_usage(), proc.memory() / 1024 / 1024)
                } else {
                    (0.0, 0)
                }
            } else if let Some(pid) = root_pid {
                // Fallback to the cmd.exe itself.
                if let Some(proc) = sys.process(Pid::from_u32(pid)) {
                    (proc.cpu_usage(), proc.memory() / 1024 / 1024)
                } else {
                    (0.0, 0)
                }
            } else {
                (0.0, 0)
            };

            let _ = app.emit(
                "stats:update",
                SystemStats {
                    cpu_percent: cpu,
                    ram_mb: ram,
                    ram_max_mb: Some((max_ram_gb as u64) * 1024),
                },
            );
        }
    });
}

/// Walk the process tree starting at `root` and return the first java.exe / java
/// process found. The Minecraft .bat usually launches `java -Xmx... -jar server.jar`.
fn find_java_descendant(sys: &System, root: Pid) -> Option<Pid> {
    // BFS through children
    let mut queue = vec![root];
    let mut visited = std::collections::HashSet::new();
    while let Some(pid) = queue.pop() {
        if !visited.insert(pid) {
            continue;
        }
        if let Some(proc) = sys.process(pid) {
            let name = proc.name().to_string_lossy().to_lowercase();
            if name.starts_with("java") {
                return Some(pid);
            }
        }
        // Children = processes whose parent_pid == pid
        for (cpid, cproc) in sys.processes() {
            if cproc.parent() == Some(pid) {
                queue.push(*cpid);
            }
        }
    }
    None
}

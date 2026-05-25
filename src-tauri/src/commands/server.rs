use crate::log_watcher;
use crate::state::{AppState, ServerProcess, ServerStatus};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State, Wry};

#[tauri::command]
pub fn get_server_status(state: State<'_, Arc<AppState>>) -> ServerStatus {
    let server = state.server.lock().unwrap();
    if let Some(proc) = server.as_ref() {
        ServerStatus {
            running: true,
            pid: Some(proc.child.id()),
            uptime_secs: proc.started_at.elapsed().as_secs(),
        }
    } else {
        ServerStatus {
            running: false,
            pid: None,
            uptime_secs: 0,
        }
    }
}

#[tauri::command]
pub fn get_players(state: State<'_, Arc<AppState>>) -> Vec<crate::state::Player> {
    state.players.lock().unwrap().values().cloned().collect()
}

#[tauri::command]
pub async fn start_server(
    app: AppHandle<Wry>,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let (script, folder) = {
        let cfg = state.config.lock().unwrap();
        let script = cfg
            .bat_file
            .clone()
            .ok_or_else(|| "Aucun script de lancement configuré.".to_string())?;
        let folder = cfg
            .server_folder
            .clone()
            .ok_or_else(|| "Aucun dossier serveur configuré.".to_string())?;
        (script, folder)
    };

    {
        let server = state.server.lock().unwrap();
        if server.is_some() {
            return Err("Le serveur tourne déjà.".to_string());
        }
    }

    let script_path = PathBuf::from(&script);
    let folder_path = PathBuf::from(&folder);

    let mut command = build_command(&script_path, &folder_path);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|e| {
        format!(
            "Impossible de lancer {} : {}",
            script_path.display(),
            e
        )
    })?;

    let stdin = child.stdin.take();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let proc = ServerProcess {
        child,
        stdin,
        started_at: Instant::now(),
    };

    {
        let mut server = state.server.lock().unwrap();
        *server = Some(proc);
    }

    // Clear previous player list
    state.players.lock().unwrap().clear();
    let _ = app.emit::<Vec<crate::state::Player>>("players:update", vec![]);
    let _ = app.emit("server:status", get_server_status(state.clone()));

    // Start log readers (stdout / stderr) — these emit log:line events and
    // also feed the log_watcher's parser for player events.
    log_watcher::spawn_stdio_readers(app.clone(), state.inner().clone(), stdout, stderr);

    // Start the file-based log watcher (logs/latest.log) for redundancy +
    // detecting events the stdout might have buffered.
    log_watcher::spawn_file_watcher(
        app.clone(),
        state.inner().clone(),
        folder_path.join("logs").join("latest.log"),
    );

    Ok(())
}

#[tauri::command]
pub async fn stop_server(
    app: AppHandle<Wry>,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    // Send "stop\n" to the child's stdin for a clean Minecraft shutdown.
    let stdin_opt = {
        let mut server = state.server.lock().unwrap();
        server.as_mut().and_then(|p| p.stdin.take())
    };

    if let Some(mut stdin) = stdin_opt {
        let _ = stdin.write_all(b"stop\n");
        let _ = stdin.flush();
        // Drop stdin so the child sees EOF if it needs to.
        drop(stdin);
    } else {
        return Err("Le serveur n'est pas en cours d'exécution.".to_string());
    }

    // Wait up to ~30s for graceful exit, polling status.
    let app_clone = app.clone();
    let state_clone = state.inner().clone();
    tokio::spawn(async move {
        for _ in 0..60 {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let still_running = {
                let mut server = state_clone.server.lock().unwrap();
                if let Some(proc) = server.as_mut() {
                    match proc.child.try_wait() {
                        Ok(Some(_)) => {
                            *server = None;
                            false
                        }
                        _ => true,
                    }
                } else {
                    false
                }
            };
            if !still_running {
                break;
            }
        }
        // Force kill if still alive
        {
            let mut server = state_clone.server.lock().unwrap();
            if let Some(proc) = server.as_mut() {
                let _ = proc.child.kill();
                let _ = proc.child.wait();
                *server = None;
            }
        }
        state_clone.players.lock().unwrap().clear();
        let _ = app_clone.emit::<Vec<crate::state::Player>>("players:update", vec![]);
        let _ = app_clone.emit(
            "server:status",
            crate::state::ServerStatus {
                running: false,
                pid: None,
                uptime_secs: 0,
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub fn send_command(cmd: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut server = state.server.lock().unwrap();
    let Some(proc) = server.as_mut() else {
        return Err("Serveur arrêté.".to_string());
    };
    let Some(stdin) = proc.stdin.as_mut() else {
        return Err("Pas de stdin disponible.".to_string());
    };
    let line = if cmd.ends_with('\n') {
        cmd
    } else {
        format!("{cmd}\n")
    };
    stdin
        .write_all(line.as_bytes())
        .map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn build_command(script: &PathBuf, folder: &PathBuf) -> Command {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW = 0x08000000 — keeps the cmd.exe window from popping up.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = Command::new("cmd");
    cmd.arg("/C")
        .arg(script)
        .current_dir(folder)
        .creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(target_os = "windows"))]
fn build_command(script: &PathBuf, folder: &PathBuf) -> Command {
    // S'assure que le script est exécutable (sur macOS/Linux les .sh
    // téléchargés ne le sont pas toujours).
    ensure_executable(script);

    // Bash gère bien :
    //   - .sh / .command : exécution directe
    //   - .bat trivial    : interprète les commandes basiques (echo, set, java)
    //                       même si le user n'a pas converti son .bat Windows.
    let mut cmd = Command::new("bash");
    cmd.arg(script).current_dir(folder);
    cmd
}

#[cfg(not(target_os = "windows"))]
fn ensure_executable(path: &PathBuf) {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(meta) = std::fs::metadata(path) {
        let mode = meta.permissions().mode();
        // Si aucun bit exécutable n'est posé, on ajoute u+x.
        if mode & 0o111 == 0 {
            let _ = std::fs::set_permissions(
                path,
                std::fs::Permissions::from_mode(mode | 0o755),
            );
        }
    }
}

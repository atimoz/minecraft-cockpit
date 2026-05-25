use crate::state::{AppConfig, AppState};
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State, Wry};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "config.json";
const KEY: &str = "config";

fn load_config(app: &AppHandle<Wry>) -> AppConfig {
    let Ok(store) = app.store(STORE_FILE) else {
        return AppConfig::default();
    };
    store
        .get(KEY)
        .and_then(|v| serde_json::from_value::<AppConfig>(v).ok())
        .unwrap_or_default()
}

fn save_config(app: &AppHandle<Wry>, cfg: &AppConfig) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(KEY, serde_json::to_value(cfg).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn initialize(app: &AppHandle<Wry>, state: &AppState) {
    let cfg = load_config(app);
    *state.config.lock().unwrap() = cfg;
}

#[tauri::command]
pub fn get_config(state: State<'_, Arc<AppState>>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub async fn pick_server_folder(
    app: AppHandle<Wry>,
    state: State<'_, Arc<AppState>>,
) -> Result<Option<AppConfig>, String> {
    // Open the native folder picker. Tauri's dialog API is async-callback based,
    // so we wrap it in a oneshot channel.
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("Choisis le dossier du serveur Minecraft")
        .pick_folder(move |path| {
            let _ = tx.send(path);
        });

    let chosen = match rx.await {
        Ok(Some(p)) => p,
        _ => return Ok(None),
    };

    // tauri-plugin-dialog FilePath -> std::path::PathBuf
    let path = chosen
        .as_path()
        .ok_or_else(|| "Chemin invalide".to_string())?
        .to_path_buf();

    // Find a launch script (.bat on Windows, .sh/.command on macOS/Linux) at the
    // root of the folder.
    let script = find_launch_script(&path).ok_or_else(|| {
        format!(
            "Aucun script de lancement trouvé dans {}. {}",
            path.display(),
            expected_script_hint()
        )
    })?;

    let mut cfg = state.config.lock().unwrap().clone();
    cfg.server_folder = Some(path.to_string_lossy().into_owned());
    cfg.bat_file = Some(script.to_string_lossy().into_owned());

    save_config(&app, &cfg)?;
    *state.config.lock().unwrap() = cfg.clone();

    Ok(Some(cfg))
}

#[tauri::command]
pub fn set_max_ram(
    gb: u32,
    app: AppHandle<Wry>,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let mut cfg = state.config.lock().unwrap();
    cfg.max_ram_gb = gb.clamp(1, 64);
    save_config(&app, &cfg)?;
    Ok(())
}

#[tauri::command]
pub fn set_tunnel_address(
    address: Option<String>,
    app: AppHandle<Wry>,
    state: State<'_, Arc<AppState>>,
) -> Result<AppConfig, String> {
    let normalized = address.and_then(|s| {
        let t = s.trim();
        if t.is_empty() { None } else { Some(t.to_string()) }
    });
    let mut cfg = state.config.lock().unwrap();
    cfg.tunnel_address = normalized;
    save_config(&app, &cfg)?;
    Ok(cfg.clone())
}

/// Extensions de scripts de lancement valides, dans l'ordre de priorité selon
/// l'OS courant.
#[cfg(target_os = "windows")]
fn allowed_extensions() -> &'static [&'static str] {
    &["bat", "cmd", "sh"]
}

#[cfg(not(target_os = "windows"))]
fn allowed_extensions() -> &'static [&'static str] {
    &["sh", "command", "bat"]
}

/// Noms de fichiers à essayer en priorité, dans l'ordre.
#[cfg(target_os = "windows")]
fn preferred_names() -> Vec<&'static str> {
    vec![
        "run.bat", "start.bat", "launch.bat", "server.bat", "start-server.bat",
        "run.cmd", "start.cmd",
        // dernier recours si le user a transféré un .sh
        "run.sh", "start.sh",
    ]
}

#[cfg(not(target_os = "windows"))]
fn preferred_names() -> Vec<&'static str> {
    vec![
        "run.sh", "start.sh", "launch.sh", "server.sh", "start-server.sh",
        "start.command", "run.command", "launch.command",
        // dernier recours si le user a copié un .bat depuis Windows
        "run.bat", "start.bat", "launch.bat",
    ]
}

#[cfg(target_os = "windows")]
fn expected_script_hint() -> &'static str {
    "Place un run.bat (ou start.bat) à la racine du dossier serveur."
}

#[cfg(not(target_os = "windows"))]
fn expected_script_hint() -> &'static str {
    "Place un run.sh (ou start.command) à la racine du dossier serveur."
}

fn find_launch_script(dir: &Path) -> Option<std::path::PathBuf> {
    for name in preferred_names() {
        let candidate = dir.join(name);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    // Fallback: première extension reconnue, par ordre de préférence.
    let entries: Vec<_> = std::fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .collect();
    for ext in allowed_extensions() {
        let mut matches: Vec<_> = entries
            .iter()
            .filter(|p| {
                p.extension()
                    .map(|e| e.eq_ignore_ascii_case(ext))
                    .unwrap_or(false)
            })
            .cloned()
            .collect();
        matches.sort();
        if let Some(first) = matches.into_iter().next() {
            return Some(first);
        }
    }
    None
}

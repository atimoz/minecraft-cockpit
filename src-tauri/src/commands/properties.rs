use crate::state::AppState;
use encoding_rs::WINDOWS_1252;
use serde::Serialize;
use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State, Wry};

#[derive(Debug, Clone, Serialize)]
pub struct PropertyEntry {
    pub key: String,
    pub value: String,
}

fn properties_path(state: &AppState) -> Result<PathBuf, String> {
    let cfg = state.config.lock().unwrap();
    let folder = cfg
        .server_folder
        .clone()
        .ok_or_else(|| "Aucun dossier serveur configuré.".to_string())?;
    Ok(PathBuf::from(folder).join("server.properties"))
}

fn decode(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => {
            let (cow, _, _) = WINDOWS_1252.decode(bytes);
            cow.into_owned()
        }
    }
}

#[tauri::command]
pub fn read_server_properties(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<PropertyEntry>, String> {
    let path = properties_path(&state)?;
    if !path.exists() {
        // First launch / server hasn't been started yet — return an empty list.
        // The frontend can show its defaults and create the file on save.
        return Ok(Vec::new());
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("Lecture impossible : {e}"))?;
    let content = decode(&bytes);

    let mut entries = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with('#') || trimmed.is_empty() {
            continue;
        }
        if let Some(eq) = line.find('=') {
            let key = line[..eq].trim().to_string();
            let value = line[eq + 1..].to_string(); // preserve trailing whitespace deliberately? trim instead
            entries.push(PropertyEntry {
                key,
                value: value.trim_end_matches(['\r', '\n']).to_string(),
            });
        }
    }
    Ok(entries)
}

#[tauri::command]
pub fn write_server_properties(
    updates: HashMap<String, String>,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let path = properties_path(&state)?;

    // Read existing file (or start from a header if it doesn't exist yet)
    let original = if path.exists() {
        let bytes = std::fs::read(&path).map_err(|e| format!("Lecture impossible : {e}"))?;
        decode(&bytes)
    } else {
        "#Minecraft server properties\n".to_string()
    };

    // Track which updates have been applied via patching existing lines
    let mut applied: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut new_lines = Vec::new();

    for line in original.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with('#') || trimmed.is_empty() {
            new_lines.push(line.to_string());
            continue;
        }
        if let Some(eq) = line.find('=') {
            let key = line[..eq].trim().to_string();
            if let Some(new_val) = updates.get(&key) {
                new_lines.push(format!("{}={}", key, new_val));
                applied.insert(key);
                continue;
            }
        }
        new_lines.push(line.to_string());
    }

    // Append keys present in `updates` but not yet in the file
    for (k, v) in &updates {
        if !applied.contains(k) {
            new_lines.push(format!("{}={}", k, v));
        }
    }

    // Atomic write: temp file then rename
    let tmp = path.with_extension("properties.tmp");
    {
        let mut f = std::fs::File::create(&tmp)
            .map_err(|e| format!("Création tmp impossible : {e}"))?;
        let content = new_lines.join("\n");
        f.write_all(content.as_bytes())
            .map_err(|e| format!("Écriture impossible : {e}"))?;
        f.write_all(b"\n")
            .map_err(|e| format!("Écriture impossible : {e}"))?;
        f.sync_all().ok();
    }
    std::fs::rename(&tmp, &path).map_err(|e| {
        // best-effort cleanup
        let _ = std::fs::remove_file(&tmp);
        format!("Rename impossible : {e}")
    })?;

    Ok(())
}

#[tauri::command]
pub async fn restart_server(
    app: AppHandle<Wry>,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let was_running = state.server.lock().unwrap().is_some();
    if was_running {
        // Reuse our stop_server logic
        crate::commands::server::stop_server(app.clone(), state.clone()).await?;

        // Wait until the server process has fully exited (or 35 s ceiling)
        for _ in 0..70 {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            if state.server.lock().unwrap().is_none() {
                break;
            }
        }
    }
    crate::commands::server::start_server(app, state).await
}

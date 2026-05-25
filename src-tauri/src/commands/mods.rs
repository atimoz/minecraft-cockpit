use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct ModInfo {
    pub file_name: String,    // canonical name without the .disabled suffix
    pub display_name: String, // parsed or filename fallback
    pub version: Option<String>,
    pub description: Option<String>,
    pub authors: Vec<String>,
    pub loader: String, // "fabric" | "forge" | "unknown"
    pub size_kb: u64,
    pub enabled: bool,
}

fn mods_dir(state: &AppState) -> Result<PathBuf, String> {
    let cfg = state.config.lock().unwrap();
    let folder = cfg
        .server_folder
        .clone()
        .ok_or_else(|| "Aucun dossier serveur configuré.".to_string())?;
    Ok(PathBuf::from(folder).join("mods"))
}

#[tauri::command]
pub fn list_mods(state: State<'_, Arc<AppState>>) -> Result<Vec<ModInfo>, String> {
    let dir = mods_dir(&state)?;
    if !dir.exists() {
        return Ok(Vec::new()); // explicit empty — caller shows empty state
    }

    let mut mods = Vec::new();
    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(e) => return Err(format!("Lecture du dossier mods impossible : {e}")),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let raw_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        // Accept either ".jar" (enabled) or ".jar.disabled" (disabled).
        let (canonical_name, enabled) = if raw_name.ends_with(".jar") {
            (raw_name.clone(), true)
        } else if raw_name.ends_with(".jar.disabled") {
            (raw_name.trim_end_matches(".disabled").to_string(), false)
        } else {
            continue;
        };

        let size_kb = std::fs::metadata(&path)
            .ok()
            .map(|m| m.len() / 1024)
            .unwrap_or(0);

        // Best-effort metadata parse — never propagate jar errors
        let info = parse_jar_metadata(&path).unwrap_or_default();

        mods.push(ModInfo {
            file_name: canonical_name.clone(),
            display_name: info
                .display_name
                .unwrap_or_else(|| canonical_name.trim_end_matches(".jar").to_string()),
            version: info.version,
            description: info.description,
            authors: info.authors,
            loader: info.loader.unwrap_or_else(|| "unknown".to_string()),
            size_kb,
            enabled,
        });
    }

    mods.sort_by(|a, b| {
        // enabled first, then alphabetical
        match b.enabled.cmp(&a.enabled) {
            std::cmp::Ordering::Equal => a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()),
            o => o,
        }
    });

    Ok(mods)
}

#[tauri::command]
pub fn toggle_mod(
    file_name: String,
    enabled: bool,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    // Path traversal protection
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("Nom de fichier invalide.".to_string());
    }
    if !file_name.ends_with(".jar") {
        return Err("Le fichier doit se terminer par .jar.".to_string());
    }

    let dir = mods_dir(&state)?;
    let jar_path = dir.join(&file_name);
    let disabled_path = dir.join(format!("{}.disabled", file_name));

    if enabled {
        // Source = .jar.disabled, target = .jar
        if disabled_path.exists() {
            std::fs::rename(&disabled_path, &jar_path)
                .map_err(|e| format!("Rename impossible : {e}"))?;
        } else if !jar_path.exists() {
            return Err(format!("Mod introuvable : {file_name}"));
        }
    } else {
        // Source = .jar, target = .jar.disabled
        if jar_path.exists() {
            std::fs::rename(&jar_path, &disabled_path)
                .map_err(|e| format!("Rename impossible : {e}"))?;
        } else if !disabled_path.exists() {
            return Err(format!("Mod introuvable : {file_name}"));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn open_mods_folder(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let dir = mods_dir(&state)?;
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| format!("Création dossier mods : {e}"))?;
    }
    open_in_native_browser(&dir)
}

#[cfg(target_os = "windows")]
fn open_in_native_browser(path: &Path) -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("explorer.exe : {e}"))
}

#[cfg(target_os = "macos")]
fn open_in_native_browser(path: &Path) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("open : {e}"))
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn open_in_native_browser(path: &Path) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("xdg-open : {e}"))
}

// ──────────────────────────────────────────────────────────────────────────
//   JAR metadata parsing
// ──────────────────────────────────────────────────────────────────────────

#[derive(Default)]
struct ParsedMetadata {
    display_name: Option<String>,
    version: Option<String>,
    description: Option<String>,
    authors: Vec<String>,
    loader: Option<String>,
}

fn parse_jar_metadata(path: &Path) -> Option<ParsedMetadata> {
    let file = std::fs::File::open(path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;

    // Try Fabric first
    if let Some(meta) = parse_fabric_mod(&mut archive) {
        return Some(meta);
    }
    // Then Forge new-style TOML
    if let Some(meta) = parse_forge_toml(&mut archive) {
        return Some(meta);
    }
    // Then legacy Forge mcmod.info
    if let Some(meta) = parse_forge_legacy(&mut archive) {
        return Some(meta);
    }
    None
}

#[derive(Deserialize)]
struct FabricMod {
    name: Option<String>,
    version: Option<String>,
    description: Option<String>,
    #[serde(default)]
    authors: Vec<serde_json::Value>,
}

fn parse_fabric_mod(archive: &mut zip::ZipArchive<std::fs::File>) -> Option<ParsedMetadata> {
    let mut file = archive.by_name("fabric.mod.json").ok()?;
    let mut text = String::new();
    file.read_to_string(&mut text).ok()?;
    let parsed: FabricMod = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => {
            // Some fabric.mod.json have comments / non-standard JSON — be lenient by
            // stripping `//` comments and trailing commas with a minimal regex.
            let lenient = lenient_json(&text);
            serde_json::from_str(&lenient).ok()?
        }
    };
    let authors = parsed
        .authors
        .into_iter()
        .map(author_to_string)
        .filter(|s| !s.is_empty())
        .collect();
    Some(ParsedMetadata {
        display_name: parsed.name,
        version: parsed.version,
        description: parsed.description,
        authors,
        loader: Some("fabric".to_string()),
    })
}

fn author_to_string(v: serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s,
        serde_json::Value::Object(m) => m
            .get("name")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        _ => String::new(),
    }
}

fn lenient_json(s: &str) -> String {
    // Strip // line comments
    let no_line = s
        .lines()
        .map(|l| {
            if let Some(idx) = l.find("//") {
                // crude — doesn't account for // inside strings, but good enough for mod metadata
                &l[..idx]
            } else {
                l
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    // Drop trailing commas before } or ]
    let mut out = String::with_capacity(no_line.len());
    let bytes = no_line.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b',' {
            // skip whitespace and see if next non-ws is } or ]
            let mut j = i + 1;
            while j < bytes.len() && (bytes[j] == b' ' || bytes[j] == b'\n' || bytes[j] == b'\r' || bytes[j] == b'\t') {
                j += 1;
            }
            if j < bytes.len() && (bytes[j] == b'}' || bytes[j] == b']') {
                // skip the comma
                i += 1;
                continue;
            }
        }
        out.push(c as char);
        i += 1;
    }
    out
}

fn parse_forge_toml(archive: &mut zip::ZipArchive<std::fs::File>) -> Option<ParsedMetadata> {
    let mut file = archive.by_name("META-INF/mods.toml").ok()?;
    let mut text = String::new();
    file.read_to_string(&mut text).ok()?;
    let value: toml::Value = toml::from_str(&text).ok()?;
    let mods = value.get("mods").and_then(|v| v.as_array())?;
    let first = mods.first()?;

    let s = |key: &str| -> Option<String> {
        first.get(key).and_then(|v| v.as_str()).map(|s| s.to_string())
    };
    let authors = first
        .get("authors")
        .and_then(|v| v.as_str())
        .map(|s| s.split(',').map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect())
        .unwrap_or_default();

    Some(ParsedMetadata {
        display_name: s("displayName"),
        version: s("version"),
        description: s("description"),
        authors,
        loader: Some("forge".to_string()),
    })
}

#[derive(Deserialize)]
struct LegacyForgeMod {
    name: Option<String>,
    version: Option<String>,
    description: Option<String>,
    #[serde(default)]
    authorList: Vec<String>,
}

fn parse_forge_legacy(archive: &mut zip::ZipArchive<std::fs::File>) -> Option<ParsedMetadata> {
    let mut file = archive.by_name("mcmod.info").ok()?;
    let mut text = String::new();
    file.read_to_string(&mut text).ok()?;
    // mcmod.info is usually an array
    let val: serde_json::Value = serde_json::from_str(&text).ok()?;
    let first = match val {
        serde_json::Value::Array(a) => a.into_iter().next()?,
        v => v,
    };
    let parsed: LegacyForgeMod = serde_json::from_value(first).ok()?;
    Some(ParsedMetadata {
        display_name: parsed.name,
        version: parsed.version,
        description: parsed.description,
        authors: parsed.authorList,
        loader: Some("forge".to_string()),
    })
}

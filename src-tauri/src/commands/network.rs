use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{State, Wry};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NetworkType {
    Wifi,
    Cellular,
    Ethernet,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
pub struct NetworkInfo {
    #[serde(rename = "type")]
    pub kind: String, // "wifi" | "cellular" | "ethernet" | "unknown"
    pub name: String,
    pub local_ip: String,
    pub public_ip: Option<String>,
    pub behind_cgnat: bool,
    pub suggested_profile: String, // "home" | "mobile"
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NetworkProfile {
    Home,
    Mobile,
}

impl NetworkProfile {
    pub fn as_str(&self) -> &'static str {
        match self {
            NetworkProfile::Home => "home",
            NetworkProfile::Mobile => "mobile",
        }
    }
}

/// Preset server.properties values for each profile.
pub fn profile_preset(profile: NetworkProfile) -> HashMap<String, String> {
    let mut m = HashMap::new();
    match profile {
        NetworkProfile::Home => {
            m.insert("view-distance".into(), "10".into());
            m.insert("simulation-distance".into(), "10".into());
            m.insert("network-compression-threshold".into(), "256".into());
            m.insert("max-players".into(), "20".into());
        }
        NetworkProfile::Mobile => {
            m.insert("view-distance".into(), "5".into());
            m.insert("simulation-distance".into(), "5".into());
            m.insert("network-compression-threshold".into(), "64".into());
            m.insert("max-players".into(), "6".into());
        }
    }
    m
}

// ──────────────────────────────────────────────────────────────────────────
//   NETWORK DETECTION
// ──────────────────────────────────────────────────────────────────────────

fn classify_interface(name: &str) -> NetworkType {
    let lower = name.to_lowercase();

    // Cellular indicators (hotspot, USB tether, 4G dongle)
    const CELL_HINTS: &[&str] = &[
        "cellular", "wwan", "mobile broadband", "wireless wan",
        "remote ndis", "rndis", "android usb", "apple mobile device",
        "iphone", "ipad", "personal hotspot",
        // macOS bridge interface used when sharing iPhone via USB
        "bridge",
        // Linux mobile tether
        "rmnet",
    ];
    for h in CELL_HINTS {
        if lower.contains(h) {
            return NetworkType::Cellular;
        }
    }

    // Wi-Fi
    const WIFI_HINTS: &[&str] = &["wi-fi", "wifi", "wlan", "wireless lan", "airport"];
    for h in WIFI_HINTS {
        if lower.contains(h) {
            return NetworkType::Wifi;
        }
    }
    // macOS interface naming: en0 typically Wi-Fi (best-effort)
    if lower == "en0" {
        return NetworkType::Wifi;
    }

    // Ethernet
    const ETH_HINTS: &[&str] = &["ethernet", "eth", "lan"];
    for h in ETH_HINTS {
        if lower.contains(h) {
            return NetworkType::Ethernet;
        }
    }

    NetworkType::Unknown
}

#[cfg(target_os = "windows")]
fn detect_active_interface() -> (String, String, NetworkType) {
    // Use Windows IP Helper API for accurate classification
    detect_active_interface_windows().unwrap_or_else(|| {
        ("Unknown".to_string(), "0.0.0.0".to_string(), NetworkType::Unknown)
    })
}

#[cfg(target_os = "windows")]
fn detect_active_interface_windows() -> Option<(String, String, NetworkType)> {
    // Use the `if-addrs` crate to enumerate, plus heuristic naming on the
    // adapter's friendly name. A full IP Helper integration via the `windows`
    // crate is documented as a follow-up but heuristics already work well for
    // Wi-Fi vs Ethernet vs phone hotspot via Apple Mobile Device / RNDIS.
    let interfaces = if_addrs::get_if_addrs().ok()?;
    let candidate = interfaces
        .into_iter()
        .find(|i| !i.is_loopback() && i.ip().is_ipv4())?;
    let name = candidate.name.clone();
    let ip = candidate.ip().to_string();
    let kind = classify_interface(&name);
    Some((name, ip, kind))
}

#[cfg(not(target_os = "windows"))]
fn detect_active_interface() -> (String, String, NetworkType) {
    // Fallback for dev on macOS/Linux: pick the first non-loopback IPv4 interface
    if let Ok(interfaces) = if_addrs::get_if_addrs() {
        if let Some(iface) = interfaces.iter().find(|i| !i.is_loopback() && i.ip().is_ipv4()) {
            let name = iface.name.clone();
            let ip = iface.ip().to_string();
            let kind = classify_interface(&name);
            return (name, ip, kind);
        }
    }
    ("unknown".to_string(), "127.0.0.1".to_string(), NetworkType::Unknown)
}

fn is_cgnat(public_ip: Option<&str>, kind: &NetworkType) -> bool {
    // 100.64.0.0/10 is the CGNAT range (RFC 6598)
    if let Some(ip) = public_ip {
        if let Some(rest) = ip.strip_prefix("100.") {
            if let Some((second, _)) = rest.split_once('.') {
                if let Ok(n) = second.parse::<u8>() {
                    if (64..=127).contains(&n) {
                        return true;
                    }
                }
            }
        }
    }
    // Heuristic: cellular tethering is almost always behind CGNAT
    matches!(kind, NetworkType::Cellular)
}

fn type_to_str(t: &NetworkType) -> &'static str {
    match t {
        NetworkType::Wifi => "wifi",
        NetworkType::Cellular => "cellular",
        NetworkType::Ethernet => "ethernet",
        NetworkType::Unknown => "unknown",
    }
}

#[tauri::command]
pub fn get_network_info(_state: State<'_, Arc<AppState>>) -> Result<NetworkInfo, String> {
    let (name, local_ip, kind) = detect_active_interface();
    // Public IP is not fetched synchronously — leave None for now.
    // A future enhancement can fire a background fetch and emit an event.
    let public_ip: Option<String> = None;
    let cgnat = is_cgnat(public_ip.as_deref(), &kind);
    let suggested = if matches!(kind, NetworkType::Cellular) { "mobile" } else { "home" };
    Ok(NetworkInfo {
        kind: type_to_str(&kind).to_string(),
        name,
        local_ip,
        public_ip,
        behind_cgnat: cgnat,
        suggested_profile: suggested.to_string(),
    })
}

// ──────────────────────────────────────────────────────────────────────────
//   PROFILE APPLICATION
// ──────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_active_network_profile(state: State<'_, Arc<AppState>>) -> String {
    state.active_profile.lock().unwrap().as_str().to_string()
}

#[tauri::command]
pub fn apply_network_profile(
    profile: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let p = match profile.as_str() {
        "home" => NetworkProfile::Home,
        "mobile" => NetworkProfile::Mobile,
        _ => return Err(format!("Profil inconnu : {profile}")),
    };
    let preset = profile_preset(p);
    crate::commands::properties::write_server_properties(preset, state.clone())?;
    *state.active_profile.lock().unwrap() = p;
    Ok(())
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Child;
use std::process::ChildStdin;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server_folder: Option<String>,
    pub bat_file: Option<String>,
    pub max_ram_gb: u32,
    #[serde(default)]
    pub tunnel_address: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server_folder: None,
            bat_file: None,
            max_ram_gb: 4,
            tunnel_address: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub name: String,
    pub ip: String,
    pub port: u32,
    pub connected_at: i64, // unix seconds
}

#[derive(Debug, Clone, Serialize)]
pub struct ServerStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub uptime_secs: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemStats {
    pub cpu_percent: f32,
    pub ram_mb: u64,
    pub ram_max_mb: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LogLine {
    pub ts: i64,
    pub level: String,
    pub text: String,
}

pub struct ServerProcess {
    pub child: Child,
    pub stdin: Option<ChildStdin>,
    pub started_at: Instant,
}

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub server: Mutex<Option<ServerProcess>>,
    pub players: Mutex<HashMap<String, Player>>,
    pub active_profile: Mutex<crate::commands::network::NetworkProfile>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(AppConfig::default()),
            server: Mutex::new(None),
            players: Mutex::new(HashMap::new()),
            active_profile: Mutex::new(crate::commands::network::NetworkProfile::Home),
        }
    }
}

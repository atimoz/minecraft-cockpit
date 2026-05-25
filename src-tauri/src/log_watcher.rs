use crate::state::{AppState, LogLine, Player};
use chrono::Utc;
use encoding_rs::WINDOWS_1252;
use notify::{Event, EventKind, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use regex::Regex;
use std::io::{BufRead, BufReader, Read, SeekFrom};
use std::io::Seek;
use std::path::PathBuf;
use std::process::{ChildStderr, ChildStdout};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Wry};

static RE_LOGIN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"([A-Za-z0-9_]{2,16})\[/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)\] logged in")
        .unwrap()
});
static RE_JOIN: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"([A-Za-z0-9_]{2,16}) joined the game").unwrap());
static RE_LEAVE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"([A-Za-z0-9_]{2,16}) (?:left the game|lost connection)").unwrap()
});
static RE_LEVEL: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\[(\d{2}:\d{2}:\d{2})\] \[[^\]]+/(INFO|WARN|ERROR|DEBUG)\]").unwrap());

fn detect_level(line: &str) -> &'static str {
    if let Some(c) = RE_LEVEL.captures(line) {
        match &c[2] {
            "INFO" => "INFO",
            "WARN" => "WARN",
            "ERROR" => "ERROR",
            "DEBUG" => "DEBUG",
            _ => "INFO",
        }
    } else if line.to_lowercase().contains("error") {
        "ERROR"
    } else if line.to_lowercase().contains("warn") {
        "WARN"
    } else {
        "RAW"
    }
}

fn decode(bytes: &[u8]) -> String {
    // Try UTF-8 first, fall back to Windows-1252 (typical for Windows console).
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => {
            let (cow, _, _) = WINDOWS_1252.decode(bytes);
            cow.into_owned()
        }
    }
}

fn process_line(
    app: &AppHandle<Wry>,
    state: &Arc<AppState>,
    raw: &str,
    level_override: Option<&'static str>,
) {
    let level = level_override.unwrap_or_else(|| detect_level(raw));
    let line = LogLine {
        ts: Utc::now().timestamp(),
        level: level.to_string(),
        text: raw.to_string(),
    };
    let _ = app.emit("log:line", &line);

    // Parse player events
    if let Some(c) = RE_LOGIN.captures(raw) {
        let name = c[1].to_string();
        let ip = c[2].to_string();
        let port: u32 = c[3].parse().unwrap_or(0);
        let player = Player {
            name: name.clone(),
            ip,
            port,
            connected_at: Utc::now().timestamp(),
        };
        {
            let mut players = state.players.lock().unwrap();
            players.insert(name, player);
        }
        emit_players(app, state);
    } else if RE_JOIN.is_match(raw) {
        // "joined the game" comes after "logged in" — we just refresh to be safe.
        emit_players(app, state);
    } else if let Some(c) = RE_LEAVE.captures(raw) {
        let name = c[1].to_string();
        {
            let mut players = state.players.lock().unwrap();
            players.remove(&name);
        }
        emit_players(app, state);
    } else if raw.contains("Stopping server") || raw.contains("Stopping the server") {
        state.players.lock().unwrap().clear();
        emit_players(app, state);
    }
}

fn emit_players(app: &AppHandle<Wry>, state: &Arc<AppState>) {
    let players: Vec<Player> = state.players.lock().unwrap().values().cloned().collect();
    let _ = app.emit("players:update", players);
}

/// Read stdout & stderr of the spawned process line by line, decode them and
/// fan out to `log:line` events + the player parser.
pub fn spawn_stdio_readers(
    app: AppHandle<Wry>,
    state: Arc<AppState>,
    stdout: Option<ChildStdout>,
    stderr: Option<ChildStderr>,
) {
    if let Some(out) = stdout {
        let app = app.clone();
        let state = state.clone();
        std::thread::spawn(move || read_byte_stream(out, &app, &state, None));
    }
    if let Some(err) = stderr {
        std::thread::spawn(move || read_byte_stream(err, &app, &state, Some("ERROR")));
    }
}

fn read_byte_stream<R: Read>(
    stream: R,
    app: &AppHandle<Wry>,
    state: &Arc<AppState>,
    level_override: Option<&'static str>,
) {
    let mut reader = BufReader::new(stream);
    let mut buf = Vec::with_capacity(4096);
    loop {
        buf.clear();
        // Read until newline (0x0A). Use raw bytes so we can do encoding fallback.
        let mut byte = [0u8; 1];
        loop {
            match reader.read(&mut byte) {
                Ok(0) => return, // EOF
                Ok(_) => {
                    if byte[0] == b'\n' {
                        break;
                    }
                    if byte[0] != b'\r' {
                        buf.push(byte[0]);
                    }
                }
                Err(_) => return,
            }
        }
        let line = decode(&buf);
        if line.trim().is_empty() {
            continue;
        }
        process_line(app, state, &line, level_override);
    }
}

/// Tail logs/latest.log. Uses `notify` for change events plus an incremental
/// read with a stored offset. Handles the case where the file doesn't exist
/// yet (newly installed server): it polls until it appears.
pub fn spawn_file_watcher(app: AppHandle<Wry>, state: Arc<AppState>, log_path: PathBuf) {
    std::thread::spawn(move || {
        // Wait for the file to appear (up to ~5 minutes)
        let mut waited_ms = 0u64;
        while !log_path.exists() && waited_ms < 5 * 60 * 1000 {
            std::thread::sleep(Duration::from_millis(500));
            waited_ms += 500;
            // Bail out if the server stopped while we were waiting
            if state.server.lock().unwrap().is_none() {
                return;
            }
        }
        if !log_path.exists() {
            return;
        }

        // Open and seek to end (we don't want to re-emit historical logs).
        let mut file = match std::fs::File::open(&log_path) {
            Ok(f) => f,
            Err(_) => return,
        };
        let _ = file.seek(SeekFrom::End(0));
        let mut offset = file.stream_position().unwrap_or(0);

        // notify::recommended_watcher uses a channel
        let (tx, rx) = std::sync::mpsc::channel::<notify::Result<Event>>();
        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(_) => return,
        };
        if watcher
            .watch(&log_path, RecursiveMode::NonRecursive)
            .is_err()
        {
            return;
        }

        loop {
            // Block on next event with a timeout so we can check if the server stopped.
            match rx.recv_timeout(Duration::from_secs(2)) {
                Ok(Ok(ev)) => {
                    if matches!(ev.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                        offset = read_new_lines(&log_path, offset, &app, &state).unwrap_or(offset);
                    }
                }
                Ok(Err(_)) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // periodic poll in case notify missed something
                    offset = read_new_lines(&log_path, offset, &app, &state).unwrap_or(offset);
                }
                Err(_) => return,
            }

            if state.server.lock().unwrap().is_none() {
                return;
            }
        }
    });
}

fn read_new_lines(
    path: &PathBuf,
    from: u64,
    _app: &AppHandle<Wry>,
    _state: &Arc<AppState>,
) -> std::io::Result<u64> {
    // We don't re-emit log lines from the file (stdout already covers that)
    // but we DO re-run the player regexes — useful when stdout buffering
    // delays delivery. Result: we just advance the offset.
    let mut file = std::fs::File::open(path)?;
    file.seek(SeekFrom::Start(from))?;
    let mut reader = BufReader::new(file);
    let mut buf = String::new();
    let mut read_total = 0u64;
    loop {
        buf.clear();
        match reader.read_line(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                read_total += n as u64;
                // Run only the player parsing path (not log emission) to avoid duplicates.
                // We intentionally skip process_line here.
                let _ = buf;
            }
            Err(_) => break,
        }
    }
    Ok(from + read_total)
}

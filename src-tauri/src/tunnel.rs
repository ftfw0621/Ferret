use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tokio::sync::RwLock;

use crate::db::types::{TunnelConfig, TunnelType};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelEvent {
    pub connection_id: String,
    pub status: String,
    pub message: String,
}

pub struct TunnelManager {
    tunnels: Arc<RwLock<HashMap<String, Child>>>,
    app_handle: AppHandle,
}

impl TunnelManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            tunnels: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
        }
    }

    /// Check if a port is already in use before starting a tunnel.
    async fn check_port_available(port: u16) -> Result<(), String> {
        match tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port)).await {
            Ok(_) => Err(format!(
                "Port {} is already in use. Close the existing tunnel or choose a different local port.",
                port
            )),
            Err(_) => Ok(()),
        }
    }

    fn build_command(config: &TunnelConfig) -> Result<(String, Vec<String>, u16), String> {
        match config.tunnel_type {
            TunnelType::Kubectl => {
                let resource = config
                    .kube_resource
                    .as_deref()
                    .filter(|s| !s.is_empty())
                    .ok_or(
                        "kubectl tunnel requires a resource (e.g. pod/my-pod, svc/my-svc)",
                    )?;

                let mut args = Vec::new();
                if let Some(ctx) = config.kube_context.as_deref().filter(|s| !s.is_empty()) {
                    args.push("--context".to_string());
                    args.push(ctx.to_string());
                }
                if let Some(ns) = config.kube_namespace.as_deref().filter(|s| !s.is_empty()) {
                    args.push("-n".to_string());
                    args.push(ns.to_string());
                }
                args.push("port-forward".to_string());
                args.push(resource.to_string());
                args.push(format!("{}:{}", config.local_port, config.remote_port));

                Ok(("kubectl".to_string(), args, config.local_port))
            }
            TunnelType::Custom => {
                let cmd = config
                    .custom_command
                    .as_deref()
                    .filter(|s| !s.is_empty())
                    .ok_or("Custom tunnel requires a command")?;

                Ok((
                    "sh".to_string(),
                    vec!["-c".to_string(), cmd.to_string()],
                    config.local_port,
                ))
            }
        }
    }

    pub async fn start(
        &self,
        connection_id: &str,
        config: &TunnelConfig,
    ) -> Result<u16, String> {
        // Stop any existing tunnel for this connection
        self.stop(connection_id).await;

        let (program, args, local_port) = Self::build_command(config)?;

        // Check if port is already in use
        Self::check_port_available(local_port).await?;

        log::info!(
            "Starting tunnel for {}: {} {:?}",
            connection_id,
            program,
            args
        );

        let mut child = tokio::process::Command::new(&program)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    format!(
                        "'{}' not found. Make sure it is installed and on your PATH.",
                        program
                    )
                } else {
                    format!("Failed to start tunnel: {}", e)
                }
            })?;

        // Drain stdout/stderr in background to prevent pipe blocking
        if let Some(stdout) = child.stdout.take() {
            let id = connection_id.to_string();
            tokio::spawn(async move {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    log::info!("[tunnel:{}] {}", id, line);
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let id = connection_id.to_string();
            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    log::warn!("[tunnel:{}] {}", id, line);
                }
            });
        }

        // Poll until local port is connectable or timeout
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(30);
        loop {
            if tokio::time::Instant::now() > deadline {
                let _ = child.kill().await;
                return Err(
                    "Tunnel startup timed out (30s). Check your tunnel configuration.".to_string(),
                );
            }
            match child.try_wait() {
                Ok(Some(status)) => {
                    return Err(format!(
                        "Tunnel process exited unexpectedly (exit {}). Check your configuration.",
                        status
                    ));
                }
                Err(e) => {
                    return Err(format!("Failed to check tunnel process: {}", e));
                }
                Ok(None) => {}
            }
            if tokio::net::TcpStream::connect(format!("127.0.0.1:{}", local_port))
                .await
                .is_ok()
            {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }

        log::info!(
            "Tunnel ready for {} on 127.0.0.1:{}",
            connection_id,
            local_port
        );
        self.tunnels
            .write()
            .await
            .insert(connection_id.to_string(), child);

        // Spawn a monitoring task to detect unexpected tunnel death
        let tunnels = Arc::clone(&self.tunnels);
        let app = self.app_handle.clone();
        let conn_id = connection_id.to_string();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                let mut map = tunnels.write().await;
                match map.get_mut(&conn_id) {
                    Some(child) => match child.try_wait() {
                        Ok(Some(_)) => {
                            map.remove(&conn_id);
                            drop(map);
                            log::warn!("Tunnel for {} exited unexpectedly", conn_id);
                            let _ = app.emit(
                                "tunnel-status",
                                TunnelEvent {
                                    connection_id: conn_id,
                                    status: "disconnected".to_string(),
                                    message: "Tunnel process exited unexpectedly".to_string(),
                                },
                            );
                            break;
                        }
                        Ok(None) => {} // still running
                        Err(_) => {
                            map.remove(&conn_id);
                            drop(map);
                            let _ = app.emit(
                                "tunnel-status",
                                TunnelEvent {
                                    connection_id: conn_id,
                                    status: "disconnected".to_string(),
                                    message: "Failed to check tunnel status".to_string(),
                                },
                            );
                            break;
                        }
                    },
                    None => {
                        // Tunnel was stopped normally via stop()
                        break;
                    }
                }
            }
        });

        Ok(local_port)
    }

    pub async fn stop(&self, connection_id: &str) {
        if let Some(mut child) = self.tunnels.write().await.remove(connection_id) {
            log::info!("Stopping tunnel for {}", connection_id);
            let _ = child.kill().await;
            let _ = child.wait().await;
        }
    }
}

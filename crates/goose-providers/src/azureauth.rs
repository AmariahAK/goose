use crate::subprocess_ext::SubprocessExt;
use chrono;
use serde::Deserialize;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Failed to load credentials: {0}")]
    Credentials(String),

    #[error("Token exchange failed: {0}")]
    TokenExchange(String),
}

#[derive(Debug, Clone)]
pub struct AuthToken {
    pub token_type: String,
    pub token_value: String,
}

#[derive(Debug, Clone)]
pub enum AzureCredentials {
    ApiKey(String),
    BearerToken(String),
    DefaultCredential,
}

#[derive(Debug, Clone)]
struct CachedToken {
    token: AuthToken,
    expires_at: Instant,
}

#[derive(Debug, Clone, Deserialize)]
struct TokenResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "tokenType")]
    token_type: String,
    #[serde(rename = "expires_on")]
    expires_on: u64,
}

#[derive(Debug)]
pub struct AzureAuth {
    credentials: AzureCredentials,
    cached_token: Arc<RwLock<Option<CachedToken>>>,
}

impl AzureAuth {
    pub fn new(api_key: Option<String>, ad_token: Option<String>) -> Result<Self, AuthError> {
        let credentials = match (ad_token, api_key) {
            (Some(token), _) => AzureCredentials::BearerToken(token),
            (None, Some(key)) => AzureCredentials::ApiKey(key),
            (None, None) => AzureCredentials::DefaultCredential,
        };

        Ok(Self {
            credentials,
            cached_token: Arc::new(RwLock::new(None)),
        })
    }

    pub fn credential_type(&self) -> &AzureCredentials {
        &self.credentials
    }

    pub async fn get_token(&self) -> Result<AuthToken, AuthError> {
        match &self.credentials {
            AzureCredentials::ApiKey(key) => Ok(AuthToken {
                token_type: "Bearer".to_string(),
                token_value: key.clone(),
            }),
            AzureCredentials::BearerToken(token) => Ok(AuthToken {
                token_type: "Bearer".to_string(),
                token_value: token.clone(),
            }),
            AzureCredentials::DefaultCredential => self.get_default_credential_token().await,
        }
    }

    async fn get_default_credential_token(&self) -> Result<AuthToken, AuthError> {
        if let Some(cached) = self.cached_token.read().await.as_ref() {
            if cached.expires_at > Instant::now() {
                return Ok(cached.token.clone());
            }
        }

        let mut token_guard = self.cached_token.write().await;

        if let Some(cached) = token_guard.as_ref() {
            if cached.expires_at > Instant::now() {
                return Ok(cached.token.clone());
            }
        }

        let az = if cfg!(windows) { "az.cmd" } else { "az" };
        let output = tokio::process::Command::new(az)
            .args([
                "account",
                "get-access-token",
                "--resource",
                "https://cognitiveservices.azure.com",
            ])
            .set_no_window()
            .output()
            .await
            .map_err(|e| AuthError::TokenExchange(format!("Failed to execute Azure CLI: {}", e)))?;

        if !output.status.success() {
            return Err(AuthError::TokenExchange(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }

        let token_response: TokenResponse = serde_json::from_slice(&output.stdout)
            .map_err(|e| AuthError::TokenExchange(format!("Invalid token response: {}", e)))?;

        let auth_token = AuthToken {
            token_type: token_response.token_type,
            token_value: token_response.access_token,
        };

        let expires_at = Instant::now()
            + Duration::from_secs(
                token_response
                    .expires_on
                    .saturating_sub(chrono::Utc::now().timestamp() as u64)
                    .saturating_sub(30),
            );

        *token_guard = Some(CachedToken {
            token: auth_token.clone(),
            expires_at,
        });

        Ok(auth_token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ad_token_takes_precedence_over_api_key() {
        let auth = AzureAuth::new(Some("key".to_string()), Some("token".to_string())).unwrap();
        assert!(matches!(
            auth.credential_type(),
            AzureCredentials::BearerToken(_)
        ));
    }

    #[test]
    fn test_api_key_when_no_ad_token() {
        let auth = AzureAuth::new(Some("key".to_string()), None).unwrap();
        assert!(matches!(
            auth.credential_type(),
            AzureCredentials::ApiKey(_)
        ));
    }

    #[test]
    fn test_default_credential_when_neither() {
        let auth = AzureAuth::new(None, None).unwrap();
        assert!(matches!(
            auth.credential_type(),
            AzureCredentials::DefaultCredential
        ));
    }

    #[tokio::test]
    async fn test_bearer_token_get_token() {
        let auth = AzureAuth::new(None, Some("my-token".to_string())).unwrap();
        let token = auth.get_token().await.unwrap();
        assert_eq!(token.token_type, "Bearer");
        assert_eq!(token.token_value, "my-token");
    }
}

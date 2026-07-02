use anyhow::Result;
use futures::future::BoxFuture;
use goose_providers::azure::{self, AzureProvider};
use goose_providers::base::{ProviderDescriptor, ProviderMetadata};
use goose_providers::openai_compatible::OpenAiCompatibleProvider;

use crate::providers::base::ProviderDef;

pub struct AzureProviderDef;

impl ProviderDescriptor for AzureProviderDef {
    fn metadata() -> ProviderMetadata {
        AzureProvider::metadata()
    }
}

impl ProviderDef for AzureProviderDef {
    type Provider = OpenAiCompatibleProvider;

    fn from_env(
        _extensions: Vec<crate::config::ExtensionConfig>,
        tls_config: Option<crate::providers::api_client::TlsConfig>,
    ) -> BoxFuture<'static, Result<Self::Provider>> {
        Box::pin(from_env(tls_config))
    }
}

pub async fn from_env(
    tls_config: Option<goose_providers::api_client::TlsConfig>,
) -> Result<OpenAiCompatibleProvider> {
    let config = crate::config::Config::global();
    let endpoint: String = config.get_param("AZURE_OPENAI_ENDPOINT")?;
    let deployment_name: String = config.get_param("AZURE_OPENAI_DEPLOYMENT_NAME")?;
    let api_version: Option<String> =
        config
            .get_param("AZURE_OPENAI_API_VERSION")
            .ok()
            .or_else(|| {
                if azure::is_v1_endpoint(&endpoint) {
                    None
                } else {
                    Some(azure::AZURE_DEFAULT_API_VERSION.to_string())
                }
            });

    let api_key = config
        .get_secret("AZURE_OPENAI_API_KEY")
        .ok()
        .filter(|key: &String| !key.is_empty());
    let ad_token = config
        .get_secret("AZURE_OPENAI_AD_TOKEN")
        .ok()
        .filter(|token: &String| !token.is_empty());

    azure::from_env(
        endpoint,
        deployment_name,
        api_version,
        api_key,
        ad_token,
        tls_config,
        Some(crate::session_context::session_id_request_builder()),
    )
}

use base64::{engine::general_purpose::STANDARD, Engine as _};
use hf_plugin_api::{PluginContext, PluginError};
use reqwest::blocking::multipart::{Form, Part};
use reqwest::blocking::{Client, RequestBuilder, Response};
use reqwest::header::ACCEPT;
use serde::Deserialize;
use serde_json::{Map, Value};
use std::time::Duration;

const GENERATIONS_ENDPOINT: &str = "images/generations";
const EDITS_ENDPOINT: &str = "images/edits";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayArgs {
    base_url: String,
    #[serde(default)]
    api_key: Option<String>,
    request: Value,
}

#[derive(Debug, Deserialize)]
struct UploadFile {
    #[serde(default)]
    field_name: Option<String>,
    file_name: String,
    #[serde(default)]
    content_type: Option<String>,
    b64_json: String,
}

pub fn image_studio_generate_images(
    args: Value,
    _ctx: &dyn PluginContext,
) -> Result<Value, PluginError> {
    let args: GatewayArgs = parse_args(args)?;
    let endpoint = resolve_endpoint(&args.base_url, GENERATIONS_ENDPOINT)?;
    let client = gateway_client()?;
    let response = with_auth(
        client.post(endpoint).header(ACCEPT, "application/json"),
        args.api_key.as_deref(),
    )
    .json(&args.request)
    .send()
    .map_err(network_error)?;

    parse_gateway_response(response)
}

pub fn image_studio_edit_images(
    args: Value,
    _ctx: &dyn PluginContext,
) -> Result<Value, PluginError> {
    let args: GatewayArgs = parse_args(args)?;
    let endpoint = resolve_endpoint(&args.base_url, EDITS_ENDPOINT)?;
    let form = build_edit_form(args.request)?;
    let client = gateway_client()?;
    let response = with_auth(
        client.post(endpoint).header(ACCEPT, "application/json"),
        args.api_key.as_deref(),
    )
    .multipart(form)
    .send()
    .map_err(network_error)?;

    parse_gateway_response(response)
}

fn parse_args<T: for<'de> Deserialize<'de>>(args: Value) -> Result<T, PluginError> {
    serde_json::from_value(args).map_err(|error| PluginError::Serialization(error.to_string()))
}

fn gateway_client() -> Result<Client, PluginError> {
    Client::builder()
        .timeout(Duration::from_secs(180))
        .user_agent("HaloForge Image Studio/0.1.0")
        .build()
        .map_err(network_error)
}

fn with_auth(builder: RequestBuilder, api_key: Option<&str>) -> RequestBuilder {
    match api_key.map(str::trim).filter(|value| !value.is_empty()) {
        Some(api_key) => builder.bearer_auth(api_key),
        None => builder,
    }
}

fn build_edit_form(request: Value) -> Result<Form, PluginError> {
    let mut fields = match request {
        Value::Object(fields) => fields,
        _ => {
            return Err(PluginError::Serialization(
                "image edit request must be a JSON object".into(),
            ))
        }
    };

    let images_value = fields
        .remove("images")
        .ok_or_else(|| PluginError::Serialization("image edit request missing images".into()))?;
    let images: Vec<UploadFile> = serde_json::from_value(images_value)
        .map_err(|error| PluginError::Serialization(error.to_string()))?;
    let mask: Option<UploadFile> = match fields.remove("mask") {
        Some(Value::Null) | None => None,
        Some(value) => Some(
            serde_json::from_value(value)
                .map_err(|error| PluginError::Serialization(error.to_string()))?,
        ),
    };

    let mut form = Form::new();
    for (key, value) in fields {
        form = append_form_value(form, key, value);
    }
    for image in images {
        form = append_upload(form, image, "image")?;
    }
    if let Some(mask) = mask {
        form = append_upload(form, mask, "mask")?;
    }

    Ok(form)
}

fn append_form_value(form: Form, key: String, value: Value) -> Form {
    match value {
        Value::Null => form,
        Value::String(value) if value.is_empty() => form,
        Value::String(value) => form.text(key, value),
        Value::Number(value) => form.text(key, value.to_string()),
        Value::Bool(value) => form.text(key, value.to_string()),
        Value::Array(_) | Value::Object(_) => form,
    }
}

fn append_upload(
    form: Form,
    upload: UploadFile,
    fallback_field: &str,
) -> Result<Form, PluginError> {
    let field_name = upload
        .field_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback_field)
        .to_string();
    let bytes = decode_base64_payload(&upload.b64_json)?;
    let mut part = Part::bytes(bytes).file_name(upload.file_name);
    if let Some(content_type) = upload
        .content_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        part = part
            .mime_str(content_type)
            .map_err(|error| PluginError::Serialization(error.to_string()))?;
    }
    Ok(form.part(field_name, part))
}

fn decode_base64_payload(value: &str) -> Result<Vec<u8>, PluginError> {
    let payload = value
        .split_once(";base64,")
        .map(|(_, payload)| payload)
        .unwrap_or(value);
    STANDARD.decode(payload).map_err(|error| {
        PluginError::Serialization(format!("invalid base64 image payload: {error}"))
    })
}

fn resolve_endpoint(base_url: &str, endpoint: &str) -> Result<String, PluginError> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err(PluginError::Serialization(
            "custom image gateway base URL is required".into(),
        ));
    }

    let other_endpoint = if endpoint == GENERATIONS_ENDPOINT {
        EDITS_ENDPOINT
    } else {
        GENERATIONS_ENDPOINT
    };

    if trimmed.ends_with(endpoint) {
        return Ok(trimmed.to_string());
    }
    if let Some(prefix) = trimmed.strip_suffix(other_endpoint) {
        return Ok(format!("{prefix}{endpoint}"));
    }

    Ok(format!("{trimmed}/{endpoint}"))
}

fn parse_gateway_response(response: Response) -> Result<Value, PluginError> {
    let status = response.status();
    let text = response.text().map_err(network_error)?;
    let json = parse_json_or_text(&text);

    if !status.is_success() {
        let message = gateway_error_message(&json)
            .unwrap_or_else(|| text.trim().to_string())
            .trim()
            .to_string();
        let detail = if message.is_empty() {
            status.to_string()
        } else {
            format!("{status}: {message}")
        };
        return Err(PluginError::Network(format!(
            "image gateway request failed ({detail})"
        )));
    }

    Ok(json)
}

fn parse_json_or_text(text: &str) -> Value {
    if text.trim().is_empty() {
        return Value::Object(Map::new());
    }
    serde_json::from_str(text).unwrap_or_else(|_| Value::String(text.to_string()))
}

fn gateway_error_message(value: &Value) -> Option<String> {
    value
        .pointer("/error/message")
        .and_then(Value::as_str)
        .or_else(|| value.get("message").and_then(Value::as_str))
        .map(ToOwned::to_owned)
}

fn network_error(error: reqwest::Error) -> PluginError {
    PluginError::Network(error.to_string())
}

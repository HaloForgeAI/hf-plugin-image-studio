use base64::{engine::general_purpose::STANDARD, Engine as _};
use hf_plugin_api::{LogLevel, PluginContext, PluginError};
use reqwest::blocking::multipart::{Form, Part};
use reqwest::blocking::{Client, RequestBuilder, Response};
use reqwest::header::ACCEPT;
use serde::Deserialize;
use serde_json::{Map, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const GENERATIONS_ENDPOINT: &str = "images/generations";
const EDITS_ENDPOINT: &str = "images/edits";
static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

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
    ctx: &dyn PluginContext,
) -> Result<Value, PluginError> {
    let request_id = request_id();
    let started_at = Instant::now();
    let args: GatewayArgs = match parse_args(args) {
        Ok(args) => args,
        Err(error) => {
            log_failure(ctx, "generation", &request_id, started_at, &error);
            return Err(error);
        }
    };
    let endpoint = match resolve_endpoint(&args.base_url, GENERATIONS_ENDPOINT) {
        Ok(endpoint) => endpoint,
        Err(error) => {
            log_failure(ctx, "generation", &request_id, started_at, &error);
            return Err(error);
        }
    };

    ctx.log(
        LogLevel::Info,
        &format!(
            "image request started request_id={} {} auth_present={}",
            request_id,
            request_summary("generation", &args.request),
            auth_present(&args.api_key),
        ),
    );

    let client = match gateway_client() {
        Ok(client) => client,
        Err(error) => {
            log_failure(ctx, "generation", &request_id, started_at, &error);
            return Err(error);
        }
    };
    let result = with_auth(
        client.post(endpoint).header(ACCEPT, "application/json"),
        args.api_key.as_deref(),
    )
    .json(&args.request)
    .send()
    .map_err(network_error)
    .and_then(parse_gateway_response);

    finish_request(ctx, "generation", &request_id, started_at, result)
}

pub fn image_studio_edit_images(
    args: Value,
    ctx: &dyn PluginContext,
) -> Result<Value, PluginError> {
    let request_id = request_id();
    let started_at = Instant::now();
    let args: GatewayArgs = match parse_args(args) {
        Ok(args) => args,
        Err(error) => {
            log_failure(ctx, "edit", &request_id, started_at, &error);
            return Err(error);
        }
    };
    let endpoint = match resolve_endpoint(&args.base_url, EDITS_ENDPOINT) {
        Ok(endpoint) => endpoint,
        Err(error) => {
            log_failure(ctx, "edit", &request_id, started_at, &error);
            return Err(error);
        }
    };

    ctx.log(
        LogLevel::Info,
        &format!(
            "image request started request_id={} {} auth_present={}",
            request_id,
            request_summary("edit", &args.request),
            auth_present(&args.api_key),
        ),
    );

    let form = match build_edit_form(args.request) {
        Ok(form) => form,
        Err(error) => {
            log_failure(ctx, "edit", &request_id, started_at, &error);
            return Err(error);
        }
    };
    let client = match gateway_client() {
        Ok(client) => client,
        Err(error) => {
            log_failure(ctx, "edit", &request_id, started_at, &error);
            return Err(error);
        }
    };
    let result = with_auth(
        client.post(endpoint).header(ACCEPT, "application/json"),
        args.api_key.as_deref(),
    )
    .multipart(form)
    .send()
    .map_err(network_error)
    .and_then(parse_gateway_response);

    finish_request(ctx, "edit", &request_id, started_at, result)
}

fn parse_args<T: for<'de> Deserialize<'de>>(args: Value) -> Result<T, PluginError> {
    serde_json::from_value(args).map_err(|error| PluginError::Serialization(error.to_string()))
}

fn gateway_client() -> Result<Client, PluginError> {
    Client::builder()
        .timeout(Duration::from_secs(180))
        .user_agent("HaloForge Image Studio/0.1.3")
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

fn parse_gateway_response(response: Response) -> Result<(Value, u16), PluginError> {
    let status = response.status();
    let status_code = status.as_u16();
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

    Ok((json, status_code))
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

fn request_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let sequence = REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("hfis-{millis}-{sequence}")
}

fn request_summary(operation: &str, request: &Value) -> String {
    format!(
        "operation={} model={} size={} count={} quality={} format={} moderation={} prompt_chars={} reference_count={} mask_present={}",
        operation,
        string_field(request, "model"),
        string_field(request, "size"),
        value_field(request, "n"),
        string_field(request, "quality"),
        string_field(request, "output_format"),
        string_field(request, "moderation"),
        request
            .get("prompt")
            .and_then(Value::as_str)
            .map(|prompt| prompt.chars().count())
            .unwrap_or_default(),
        request
            .get("images")
            .and_then(Value::as_array)
            .map(Vec::len)
            .unwrap_or_default(),
        request.get("mask").map(|value| !value.is_null()).unwrap_or(false),
    )
}

fn string_field(request: &Value, key: &str) -> String {
    request
        .get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("-")
        .to_string()
}

fn value_field(request: &Value, key: &str) -> String {
    request
        .get(key)
        .map(|value| match value {
            Value::Number(number) => number.to_string(),
            Value::String(value) if !value.trim().is_empty() => value.clone(),
            _ => "-".to_string(),
        })
        .unwrap_or_else(|| "-".to_string())
}

fn auth_present(api_key: &Option<String>) -> bool {
    api_key
        .as_deref()
        .map(str::trim)
        .map(|value| !value.is_empty())
        .unwrap_or(false)
}

fn finish_request(
    ctx: &dyn PluginContext,
    operation: &str,
    request_id: &str,
    started_at: Instant,
    result: Result<(Value, u16), PluginError>,
) -> Result<Value, PluginError> {
    match result {
        Ok((value, status_code)) => {
            ctx.log(
                LogLevel::Info,
                &format!(
                    "image request succeeded request_id={} operation={} status={} elapsed_ms={} output_count={} asset_count={}",
                    request_id,
                    operation,
                    status_code,
                    started_at.elapsed().as_millis(),
                    value
                        .get("data")
                        .and_then(Value::as_array)
                        .map(Vec::len)
                        .unwrap_or_default(),
                    value
                        .get("hf_output_assets")
                        .and_then(Value::as_array)
                        .map(Vec::len)
                        .unwrap_or_default(),
                ),
            );
            Ok(value)
        }
        Err(error) => {
            log_failure(ctx, operation, request_id, started_at, &error);
            Err(error)
        }
    }
}

fn log_failure(
    ctx: &dyn PluginContext,
    operation: &str,
    request_id: &str,
    started_at: Instant,
    error: &PluginError,
) {
    ctx.log(
        LogLevel::Error,
        &format!(
            "image request failed request_id={} operation={} elapsed_ms={} error={}",
            request_id,
            operation,
            started_at.elapsed().as_millis(),
            error,
        ),
    );
}

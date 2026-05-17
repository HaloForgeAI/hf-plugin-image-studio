use base64::{engine::general_purpose::STANDARD, Engine as _};
use hf_plugin_api::{LogLevel, PluginContext, PluginError};
use reqwest::blocking::multipart::{Form, Part};
use reqwest::blocking::{Client, RequestBuilder, Response};
use reqwest::header::{HeaderMap, ACCEPT};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const GENERATIONS_ENDPOINT: &str = "images/generations";
const EDITS_ENDPOINT: &str = "images/edits";
const RESPONSES_ENDPOINT: &str = "responses";
const PROMPT_REWRITE_GUARD_PREFIX: &str =
    "Use the following text as the complete prompt. Do not rewrite it:";
static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayArgs {
    base_url: String,
    #[serde(default)]
    api_key: Option<String>,
    #[serde(default)]
    api_mode: Option<String>,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteImageFileArgs {
    path: String,
    data_url: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ApiMode {
    Images,
    Responses,
}

impl ApiMode {
    fn from_args(args: &GatewayArgs) -> Self {
        match args.api_mode.as_deref().map(str::trim) {
            Some(value) if value.eq_ignore_ascii_case("responses") => Self::Responses,
            _ => Self::Images,
        }
    }

    fn generation_endpoint(self) -> &'static str {
        match self {
            Self::Images => GENERATIONS_ENDPOINT,
            Self::Responses => RESPONSES_ENDPOINT,
        }
    }

    fn edit_endpoint(self) -> &'static str {
        match self {
            Self::Images => EDITS_ENDPOINT,
            Self::Responses => RESPONSES_ENDPOINT,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Images => "images",
            Self::Responses => "responses",
        }
    }
}

#[derive(Debug)]
struct ParsedGatewayResponse {
    value: Value,
    status_code: u16,
    provider_request_id: Option<String>,
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
    let api_mode = ApiMode::from_args(&args);
    let normalized_base_url = match normalize_base_url(&args.base_url) {
        Ok(base_url) => base_url,
        Err(error) => {
            log_failure(ctx, "generation", &request_id, started_at, &error);
            return Err(error);
        }
    };
    let endpoint = resolve_endpoint(&normalized_base_url, api_mode.generation_endpoint());
    let summary = request_summary("generation", api_mode, &args.request);
    let request = match prepare_gateway_request(api_mode, "generation", args.request) {
        Ok(request) => request,
        Err(error) => {
            log_failure(ctx, "generation", &request_id, started_at, &error);
            return Err(error);
        }
    };

    ctx.log(
        LogLevel::Info,
        &format!(
            "image request started request_id={} {} base_url={} endpoint={} api_mode={} auth_present={}",
            request_id,
            summary,
            normalized_base_url,
            endpoint,
            api_mode.as_str(),
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
        client.post(&endpoint).header(ACCEPT, "application/json"),
        args.api_key.as_deref(),
    )
    .json(&request)
    .send()
    .map_err(network_error)
    .and_then(parse_gateway_response)
    .and_then(|response| normalize_gateway_response(api_mode, response));

    finish_request(
        ctx,
        "generation",
        &request_id,
        started_at,
        api_mode,
        &normalized_base_url,
        &endpoint,
        result,
    )
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
    let api_mode = ApiMode::from_args(&args);
    let normalized_base_url = match normalize_base_url(&args.base_url) {
        Ok(base_url) => base_url,
        Err(error) => {
            log_failure(ctx, "edit", &request_id, started_at, &error);
            return Err(error);
        }
    };
    let endpoint = resolve_endpoint(&normalized_base_url, api_mode.edit_endpoint());
    let summary = request_summary("edit", api_mode, &args.request);
    let request = match prepare_gateway_request(api_mode, "edit", args.request) {
        Ok(request) => request,
        Err(error) => {
            log_failure(ctx, "edit", &request_id, started_at, &error);
            return Err(error);
        }
    };

    ctx.log(
        LogLevel::Info,
        &format!(
            "image request started request_id={} {} base_url={} endpoint={} api_mode={} auth_present={}",
            request_id,
            summary,
            normalized_base_url,
            endpoint,
            api_mode.as_str(),
            auth_present(&args.api_key),
        ),
    );

    if api_mode == ApiMode::Responses {
        let client = match gateway_client() {
            Ok(client) => client,
            Err(error) => {
                log_failure(ctx, "edit", &request_id, started_at, &error);
                return Err(error);
            }
        };
        let result = with_auth(
            client.post(&endpoint).header(ACCEPT, "application/json"),
            args.api_key.as_deref(),
        )
        .json(&request)
        .send()
        .map_err(network_error)
        .and_then(parse_gateway_response)
        .and_then(|response| normalize_gateway_response(api_mode, response));

        return finish_request(
            ctx,
            "edit",
            &request_id,
            started_at,
            api_mode,
            &normalized_base_url,
            &endpoint,
            result,
        );
    }

    let form = match build_edit_form(request) {
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
        client.post(&endpoint).header(ACCEPT, "application/json"),
        args.api_key.as_deref(),
    )
    .multipart(form)
    .send()
    .map_err(network_error)
    .and_then(parse_gateway_response)
    .and_then(|response| normalize_gateway_response(api_mode, response));

    finish_request(
        ctx,
        "edit",
        &request_id,
        started_at,
        api_mode,
        &normalized_base_url,
        &endpoint,
        result,
    )
}

pub fn image_studio_write_image_file(
    args: Value,
    ctx: &dyn PluginContext,
) -> Result<Value, PluginError> {
    let args: WriteImageFileArgs = parse_args(args)?;
    let path = PathBuf::from(args.path.trim());
    if path.as_os_str().is_empty() {
        return Err(PluginError::Serialization(
            "image save path is required".into(),
        ));
    }

    let bytes = image_file_bytes(&args.data_url)?;
    if bytes.is_empty() {
        return Err(PluginError::Serialization(
            "image save payload is empty".into(),
        ));
    }
    if let Some(parent) = path.parent().filter(|parent| !parent.as_os_str().is_empty()) {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, &bytes)?;

    ctx.log(
        LogLevel::Info,
        &format!(
            "image file saved path={} bytes={}",
            path.display(),
            bytes.len()
        ),
    );

    Ok(json!({
        "path": path.display().to_string(),
        "bytes": bytes.len(),
    }))
}

fn parse_args<T: for<'de> Deserialize<'de>>(args: Value) -> Result<T, PluginError> {
    serde_json::from_value(args).map_err(|error| PluginError::Serialization(error.to_string()))
}

fn gateway_client() -> Result<Client, PluginError> {
    Client::builder()
        .timeout(Duration::from_secs(600))
        .user_agent("HaloForge Image Studio/0.1.7")
        .build()
        .map_err(network_error)
}

fn with_auth(builder: RequestBuilder, api_key: Option<&str>) -> RequestBuilder {
    match api_key.map(str::trim).filter(|value| !value.is_empty()) {
        Some(api_key) => builder.bearer_auth(api_key),
        None => builder,
    }
}

fn prepare_gateway_request(
    api_mode: ApiMode,
    operation: &str,
    request: Value,
) -> Result<Value, PluginError> {
    match api_mode {
        ApiMode::Images => Ok(request),
        ApiMode::Responses => build_responses_request(operation, request),
    }
}

fn build_responses_request(operation: &str, request: Value) -> Result<Value, PluginError> {
    let mut fields = match request {
        Value::Object(fields) => fields,
        _ => {
            return Err(PluginError::Serialization(
                "Responses image request must be a JSON object".into(),
            ))
        }
    };

    let model = take_string_field(&mut fields, "model")?;
    let mut prompt = take_string_field(&mut fields, "prompt")?;
    if !prompt.trim_start().starts_with(PROMPT_REWRITE_GUARD_PREFIX) {
        prompt = format!("{PROMPT_REWRITE_GUARD_PREFIX}\n{prompt}");
    }
    let input_images = take_string_array_field(&mut fields, "hf_responses_input_images")?;
    let mask = take_optional_string_field(&mut fields, "hf_responses_mask");

    let mut tool = match fields.remove("hf_responses_tool") {
        Some(Value::Object(tool)) => tool,
        Some(Value::Null) | None => Map::new(),
        Some(_) => {
            return Err(PluginError::Serialization(
                "Responses image tool configuration must be an object".into(),
            ))
        }
    };
    tool.retain(|_, value| !value.is_null());
    tool.entry("type".to_string())
        .or_insert_with(|| Value::String("image_generation".to_string()));
    tool.entry("action".to_string()).or_insert_with(|| {
        Value::String(
            if operation == "edit" {
                "edit"
            } else {
                "generate"
            }
            .to_string(),
        )
    });
    if let Some(mask) = mask.filter(|value| !value.trim().is_empty()) {
        tool.entry("input_image_mask".to_string())
            .or_insert_with(|| json!({ "image_url": mask }));
    }

    Ok(json!({
        "model": model,
        "input": responses_input(prompt, input_images),
        "tools": [Value::Object(tool)],
        "tool_choice": "required",
    }))
}

fn take_string_field(fields: &mut Map<String, Value>, key: &str) -> Result<String, PluginError> {
    fields
        .remove(key)
        .and_then(|value| value.as_str().map(str::to_string))
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| PluginError::Serialization(format!("image request missing {key}")))
}

fn take_optional_string_field(fields: &mut Map<String, Value>, key: &str) -> Option<String> {
    fields
        .remove(key)
        .and_then(|value| value.as_str().map(str::to_string))
        .filter(|value| !value.trim().is_empty())
}

fn take_string_array_field(
    fields: &mut Map<String, Value>,
    key: &str,
) -> Result<Vec<String>, PluginError> {
    match fields.remove(key) {
        Some(Value::Array(values)) => values
            .into_iter()
            .map(|value| {
                value.as_str().map(str::to_string).ok_or_else(|| {
                    PluginError::Serialization(format!("{key} must contain only strings"))
                })
            })
            .collect(),
        Some(Value::String(value)) if !value.trim().is_empty() => Ok(vec![value]),
        Some(Value::Null) | None => Ok(Vec::new()),
        Some(_) => Err(PluginError::Serialization(format!(
            "{key} must be an array"
        ))),
    }
}

fn responses_input(prompt: String, input_images: Vec<String>) -> Value {
    if input_images.is_empty() {
        return Value::String(prompt);
    }

    let mut content = vec![json!({ "type": "input_text", "text": prompt })];
    content.extend(
        input_images
            .into_iter()
            .filter(|image_url| !image_url.trim().is_empty())
            .map(|image_url| json!({ "type": "input_image", "image_url": image_url })),
    );

    json!([{ "role": "user", "content": content }])
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

fn image_file_bytes(source: &str) -> Result<Vec<u8>, PluginError> {
    let source = source.trim();
    if source.starts_with("http://") || source.starts_with("https://") {
        return download_image_bytes(source);
    }
    decode_base64_payload(source)
}

fn download_image_bytes(url: &str) -> Result<Vec<u8>, PluginError> {
    let response = gateway_client()?
        .get(url)
        .header(ACCEPT, "image/*,*/*;q=0.8")
        .send()
        .map_err(network_error)?;
    let status = response.status();
    if !status.is_success() {
        let text = response.text().map_err(network_error)?;
        return Err(PluginError::Network(format!(
            "image download failed ({status}: {})",
            response_preview(&text)
        )));
    }
    response
        .bytes()
        .map(|bytes| bytes.to_vec())
        .map_err(network_error)
}

fn normalize_base_url(base_url: &str) -> Result<String, PluginError> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err(PluginError::Serialization(
            "custom image gateway base URL is required".into(),
        ));
    }

    let with_scheme = if has_url_scheme(trimmed) {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let without_known_endpoint = strip_known_image_endpoint(&with_scheme);
    let (prefix, rest) = split_url_authority_and_path(&without_known_endpoint);
    let path = rest.trim_matches('/');
    let path_segments: Vec<&str> = path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    let normalized_segments = match path_segments
        .iter()
        .position(|segment| segment.eq_ignore_ascii_case("v1"))
    {
        Some(index) => path_segments[..=index].join("/"),
        None if path_segments.is_empty() => "v1".to_string(),
        None => format!("{}/v1", path_segments.join("/")),
    };

    Ok(format!(
        "{}/{}",
        prefix.trim_end_matches('/'),
        normalized_segments
    ))
}

fn resolve_endpoint(base_url: &str, endpoint: &str) -> String {
    format!(
        "{}/{}",
        base_url.trim().trim_end_matches('/'),
        endpoint.trim_start_matches('/')
    )
}

fn has_url_scheme(value: &str) -> bool {
    value
        .find("://")
        .map(|index| {
            value[..index]
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '-' | '.'))
        })
        .unwrap_or(false)
}

fn strip_known_image_endpoint(value: &str) -> String {
    let mut output = value.trim_end_matches('/').to_string();
    for endpoint in [
        GENERATIONS_ENDPOINT,
        EDITS_ENDPOINT,
        RESPONSES_ENDPOINT,
        "v1/images/generations",
        "v1/images/edits",
        "v1/responses",
    ] {
        let suffix = format!("/{endpoint}");
        if let Some(prefix) = output.strip_suffix(&suffix) {
            output = prefix.trim_end_matches('/').to_string();
            break;
        }
    }
    output
}

fn split_url_authority_and_path(value: &str) -> (String, String) {
    if let Some(scheme_index) = value.find("://") {
        let after_scheme = scheme_index + 3;
        if let Some(path_index) = value[after_scheme..].find('/') {
            let absolute_path_index = after_scheme + path_index;
            return (
                value[..absolute_path_index].to_string(),
                value[absolute_path_index..].to_string(),
            );
        }
    } else if let Some(path_index) = value.find('/') {
        return (
            value[..path_index].to_string(),
            value[path_index..].to_string(),
        );
    }

    (value.to_string(), String::new())
}

fn parse_gateway_response(response: Response) -> Result<ParsedGatewayResponse, PluginError> {
    let status = response.status();
    let status_code = status.as_u16();
    let header_request_id = provider_request_id_from_headers(response.headers());
    let text = response.text().map_err(network_error)?;
    let json = parse_json_or_text(&text);
    let provider_request_id = header_request_id.or_else(|| provider_request_id_from_payload(&json));
    let response_preview = response_preview(&text);

    if !status.is_success() {
        let message = gateway_error_message(&json)
            .unwrap_or_else(|| response_preview.clone())
            .trim()
            .to_string();
        let detail = if message.is_empty() {
            status.to_string()
        } else {
            format!("{status}: {message}")
        };
        let provider_detail = provider_request_id
            .as_deref()
            .map(|value| format!(" provider_request_id={value}"))
            .unwrap_or_default();
        return Err(PluginError::Network(format!(
            "image gateway request failed ({detail}{provider_detail} response_preview={response_preview})"
        )));
    }

    Ok(ParsedGatewayResponse {
        value: json,
        status_code,
        provider_request_id,
    })
}

fn parse_json_or_text(text: &str) -> Value {
    if text.trim().is_empty() {
        return Value::Object(Map::new());
    }
    serde_json::from_str(text).unwrap_or_else(|_| Value::String(text.to_string()))
}

fn gateway_error_message(value: &Value) -> Option<String> {
    let message = value
        .pointer("/error/message")
        .and_then(Value::as_str)
        .or_else(|| value.get("message").and_then(Value::as_str))
        .map(str::to_string)?;
    let code = value
        .pointer("/error/code")
        .and_then(Value::as_str)
        .or_else(|| value.get("code").and_then(Value::as_str));
    let error_type = value
        .pointer("/error/type")
        .and_then(Value::as_str)
        .or_else(|| value.get("type").and_then(Value::as_str));
    let request_id = provider_request_id_from_payload(value);

    let mut parts = vec![message];
    if let Some(code) = code {
        parts.push(format!("code={code}"));
    }
    if let Some(error_type) = error_type {
        parts.push(format!("type={error_type}"));
    }
    if let Some(request_id) = request_id {
        parts.push(format!("request_id={request_id}"));
    }
    Some(parts.join(" "))
}

fn provider_request_id_from_headers(headers: &HeaderMap) -> Option<String> {
    ["x-request-id", "request-id", "openai-request-id", "cf-ray"]
        .iter()
        .find_map(|name| {
            headers
                .get(*name)
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
        })
}

fn provider_request_id_from_payload(value: &Value) -> Option<String> {
    value
        .pointer("/request_id")
        .and_then(Value::as_str)
        .or_else(|| value.pointer("/error/request_id").and_then(Value::as_str))
        .or_else(|| value.pointer("/error/requestId").and_then(Value::as_str))
        .or_else(|| value.get("id").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn response_preview(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() <= 600 {
        return trimmed.to_string();
    }
    let preview: String = trimmed.chars().take(600).collect();
    format!("{preview}...")
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

fn request_summary(operation: &str, api_mode: ApiMode, request: &Value) -> String {
    format!(
        "operation={} model={} size={} count={} quality={} format={} moderation={} prompt_chars={} reference_count={} mask_present={}",
        operation,
        string_field(request, "model"),
        summary_string_field(api_mode, request, "size"),
        summary_value_field(api_mode, request, "n"),
        summary_string_field(api_mode, request, "quality"),
        summary_string_field(api_mode, request, "output_format"),
        string_field(request, "moderation"),
        request
            .get("prompt")
            .and_then(Value::as_str)
            .map(|prompt| prompt.chars().count())
            .unwrap_or_default(),
        reference_count(api_mode, request),
        mask_present(api_mode, request),
    )
}

fn summary_string_field(api_mode: ApiMode, request: &Value, key: &str) -> String {
    if api_mode == ApiMode::Responses {
        return request
            .get("hf_responses_tool")
            .and_then(|value| value.get(key))
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("-")
            .to_string();
    }
    string_field(request, key)
}

fn summary_value_field(api_mode: ApiMode, request: &Value, key: &str) -> String {
    if api_mode == ApiMode::Responses && key == "n" {
        return "1".to_string();
    }
    value_field(request, key)
}

fn reference_count(api_mode: ApiMode, request: &Value) -> usize {
    if api_mode == ApiMode::Responses {
        return request
            .get("hf_responses_input_images")
            .and_then(Value::as_array)
            .map(Vec::len)
            .unwrap_or_default();
    }
    request
        .get("images")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or_default()
}

fn mask_present(api_mode: ApiMode, request: &Value) -> bool {
    if api_mode == ApiMode::Responses {
        return request
            .get("hf_responses_mask")
            .and_then(Value::as_str)
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false);
    }
    request
        .get("mask")
        .map(|value| !value.is_null())
        .unwrap_or(false)
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

fn normalize_gateway_response(
    api_mode: ApiMode,
    response: ParsedGatewayResponse,
) -> Result<ParsedGatewayResponse, PluginError> {
    if api_mode != ApiMode::Responses {
        return Ok(response);
    }

    Ok(ParsedGatewayResponse {
        value: responses_payload_to_images_payload(&response.value)?,
        status_code: response.status_code,
        provider_request_id: response.provider_request_id,
    })
}

fn responses_payload_to_images_payload(value: &Value) -> Result<Value, PluginError> {
    let output = value
        .get("output")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            PluginError::Serialization(format!(
                "Responses image payload did not contain output[]. Raw keys: {}",
                object_keys(value)
            ))
        })?;

    let mut data = Vec::new();
    for item in output {
        if item.get("type").and_then(Value::as_str) != Some("image_generation_call") {
            continue;
        }
        if let Some(result) = item.get("result") {
            append_response_image_result(&mut data, result);
        }
    }

    if data.is_empty() {
        return Err(PluginError::Serialization(format!(
            "Responses image payload did not contain image_generation_call results. Raw keys: {}",
            object_keys(value)
        )));
    }

    let mut payload = Map::new();
    if let Some(created) = value.get("created_at").or_else(|| value.get("created")) {
        payload.insert("created".to_string(), created.clone());
    }
    payload.insert("data".to_string(), Value::Array(data));
    Ok(Value::Object(payload))
}

fn append_response_image_result(data: &mut Vec<Value>, result: &Value) {
    match result {
        Value::String(value) => {
            data.push(image_result_object(value, None));
        }
        Value::Object(fields) => {
            for key in ["b64_json", "image", "data"] {
                if let Some(value) = fields.get(key).and_then(Value::as_str) {
                    let revised_prompt = fields.get("revised_prompt").and_then(Value::as_str);
                    data.push(image_result_object(value, revised_prompt));
                    return;
                }
            }
            if let Some(value) = fields.get("url").and_then(Value::as_str) {
                let revised_prompt = fields.get("revised_prompt").and_then(Value::as_str);
                data.push(image_result_object(value, revised_prompt));
            }
        }
        Value::Array(values) => {
            for value in values {
                append_response_image_result(data, value);
            }
        }
        _ => {}
    }
}

fn image_result_object(value: &str, revised_prompt: Option<&str>) -> Value {
    let mut object = Map::new();
    if value.starts_with("data:") || value.starts_with("http://") || value.starts_with("https://") {
        object.insert("url".to_string(), Value::String(value.to_string()));
    } else {
        object.insert("b64_json".to_string(), Value::String(value.to_string()));
    }
    if let Some(revised_prompt) = revised_prompt.filter(|value| !value.trim().is_empty()) {
        object.insert(
            "revised_prompt".to_string(),
            Value::String(revised_prompt.to_string()),
        );
    }
    Value::Object(object)
}

fn object_keys(value: &Value) -> String {
    value
        .as_object()
        .map(|object| {
            object
                .keys()
                .map(String::as_str)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "(none)".to_string())
}

fn finish_request(
    ctx: &dyn PluginContext,
    operation: &str,
    request_id: &str,
    started_at: Instant,
    api_mode: ApiMode,
    base_url: &str,
    endpoint: &str,
    result: Result<ParsedGatewayResponse, PluginError>,
) -> Result<Value, PluginError> {
    match result {
        Ok(response) => {
            ctx.log(
                LogLevel::Info,
                &format!(
                    "image request succeeded request_id={} operation={} api_mode={} base_url={} endpoint={} status={} provider_request_id={} elapsed_ms={} output_count={} asset_count={}",
                    request_id,
                    operation,
                    api_mode.as_str(),
                    base_url,
                    endpoint,
                    response.status_code,
                    response.provider_request_id.as_deref().unwrap_or("-"),
                    started_at.elapsed().as_millis(),
                    response
                        .value
                        .get("data")
                        .and_then(Value::as_array)
                        .map(Vec::len)
                        .unwrap_or_default(),
                    response
                        .value
                        .get("hf_output_assets")
                        .and_then(Value::as_array)
                        .map(Vec::len)
                        .unwrap_or_default(),
                ),
            );
            Ok(response.value)
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

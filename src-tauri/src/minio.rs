use hmac::{Hmac, Mac};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinioConfig {
    pub endpoint: String,
    pub port: u16,
    pub access_key: String,
    pub secret_key: String,
    pub region: String,
    pub use_ssl: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Entry {
    pub name: String,
    pub key: String,
    pub size: u64,
    pub last_modified: Option<i64>,
    pub is_dir: bool,
}

// --- SigV4 signing ---

fn sha256_hex(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    hex::encode(hasher.finalize())
}

fn sha256_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

fn hmac_sha256(key: &[u8], data: &str) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key error");
    mac.update(data.as_bytes());
    mac.finalize().into_bytes().to_vec()
}

fn signing_key(secret: &str, date: &str, region: &str, service: &str) -> Vec<u8> {
    let k_date = hmac_sha256(format!("AWS4{}", secret).as_bytes(), date);
    let k_region = hmac_sha256(&k_date, region);
    let k_service = hmac_sha256(&k_region, service);
    hmac_sha256(&k_service, "aws4_request")
}

struct SignedRequest {
    url: String,
    headers: Vec<(String, String)>,
}

fn build_signed_request(
    config: &MinioConfig,
    method: &str,
    bucket: Option<&str>,
    object_key: Option<&str>,
    query_params: &[(String, String)],
    body: Option<&[u8]>,
) -> Result<SignedRequest, String> {
    let now = chrono_or_manual_time();
    let date_stamp = &now[..8]; // YYYYMMDD
    let amz_date = &now; // YYYYMMDDTHHMMSSZ

    // Build path
    let path = match (bucket, object_key) {
        (Some(b), Some(o)) => format!("/{}/{}", b, o),
        (Some(b), None) => format!("/{}", b),
        _ => "/".to_string(),
    };

    // Build canonical query string (sorted)
    let mut sorted_q = query_params.to_vec();
    sorted_q.sort_by(|a, b| a.0.cmp(&b.0));
    let canonical_query: String = sorted_q
        .iter()
        .map(|(k, v)| {
            format!(
                "{}={}",
                utf8_percent_encode(k, NON_ALPHANUMERIC),
                utf8_percent_encode(v, NON_ALPHANUMERIC)
            )
        })
        .collect::<Vec<_>>()
        .join("&");

    // Payload hash
    let payload_hash = match body {
        Some(b) => sha256_bytes(b),
        None => "UNSIGNED-PAYLOAD".to_string(),
    };

    // Host header
    let host = format!("{}:{}", config.endpoint, config.port);

    // Headers we sign
    let mut sign_headers: Vec<(String, String)> = vec![
        ("host".to_string(), host.clone()),
        ("x-amz-content-sha256".to_string(), payload_hash.clone()),
        ("x-amz-date".to_string(), amz_date.to_string()),
    ];
    sign_headers.sort_by(|a, b| a.0.cmp(&b.0));

    let canonical_headers: String = sign_headers
        .iter()
        .map(|(k, v)| format!("{}:{}\n", k, v.trim()))
        .collect();

    let signed_headers: String = sign_headers
        .iter()
        .map(|(k, _)| k.as_str())
        .collect::<Vec<_>>()
        .join(";");

    // Canonical request
    let canonical_request = format!(
        "{}\n{}\n{}\n{}\n{}\n{}",
        method, path, canonical_query, canonical_headers, signed_headers, payload_hash
    );

    // Credential scope
    let credential_scope = format!("{}/{}/s3/aws4_request", date_stamp, config.region);

    // String to sign
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{}\n{}\n{}",
        amz_date,
        credential_scope,
        sha256_hex(&canonical_request)
    );

    // Signing key
    let skey = signing_key(&config.secret_key, date_stamp, &config.region, "s3");

    // Signature
    let signature = hex::encode(hmac_sha256(&skey, &string_to_sign));

    // Authorization header
    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
        config.access_key, credential_scope, signed_headers, signature
    );

    // Build full URL
    let scheme = if config.use_ssl { "https" } else { "http" };
    let mut url = format!("{}://{}{}", scheme, host, path);
    if !canonical_query.is_empty() {
        url.push('?');
        url.push_str(&canonical_query);
    }

    let mut headers = sign_headers;
    headers.push(("Authorization".to_string(), authorization));

    Ok(SignedRequest { url, headers })
}

fn chrono_or_manual_time() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    let secs = now.as_secs();

    // Convert epoch seconds to UTC components
    let days = secs / 86400;
    let remainder = secs % 86400;
    let hour = remainder / 3600;
    let min = (remainder % 3600) / 60;
    let sec = remainder % 60;

    // Days since 1970-01-01 → date
    let (year, month, day) = days_to_ymd(days as i64);

    format!(
        "{:04}{:02}{:02}T{:02}{:02}{:02}Z",
        year, month, day, hour, min, sec
    )
}

fn days_to_ymd(mut days: i64) -> (i64, u32, u32) {
    // Algorithm: Howard Hinnant's days_from_civil reverse
    days += 719468;
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = days - era * 146097; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 }; // [1, 12]
    (if m <= 2 { y + 1 } else { y }, m as u32, d as u32)
}

async fn do_request(
    method: reqwest::Method,
    url: &str,
    headers: &[(String, String)],
    body: Option<Vec<u8>>,
) -> Result<reqwest::Response, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let mut req = client.request(method, url);
    for (k, v) in headers {
        req = req.header(k, v);
    }
    if let Some(b) = body {
        req = req.body(b);
    }
    req.send()
        .await
        .map_err(|e| format!("Request failed: {}", e))
}

// --- XML parsing structs ---

#[derive(Debug, Deserialize)]
struct ListAllMyBucketsResult {
    #[serde(rename = "Bucket", default)]
    buckets: Vec<BucketXml>,
}

#[derive(Debug, Deserialize)]
struct BucketXml {
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "CreationDate", default)]
    creation_date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListBucketResult {
    #[serde(rename = "Contents", default)]
    contents: Vec<ObjectXml>,
    #[serde(rename = "CommonPrefixes", default)]
    common_prefixes: Vec<PrefixXml>,
}

#[derive(Debug, Deserialize)]
struct ObjectXml {
    #[serde(rename = "Key")]
    key: String,
    #[serde(rename = "Size", default)]
    size: u64,
    #[serde(rename = "LastModified", default)]
    last_modified: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PrefixXml {
    #[serde(rename = "Prefix")]
    prefix: String,
}

fn parse_iso8601_to_epoch(s: &str) -> Option<i64> {
    // Format: 2024-01-15T10:30:00.000Z
    if s.len() < 19 {
        return None;
    }
    let date_part = &s[..10]; // YYYY-MM-DD
    let time_part = &s[11..19]; // HH:MM:SS
    let parts: Vec<&str> = date_part.split('-').collect();
    if parts.len() != 3 {
        return None;
    }
    let year: i64 = parts[0].parse().ok()?;
    let month: i64 = parts[1].parse().ok()?;
    let day: i64 = parts[2].parse().ok()?;
    let time_parts: Vec<&str> = time_part.split(':').collect();
    if time_parts.len() != 3 {
        return None;
    }
    let hour: i64 = time_parts[0].parse().ok()?;
    let minute: i64 = time_parts[1].parse().ok()?;
    let second: i64 = time_parts[2].parse().ok()?;

    // Days from civil (Howard Hinnant's algorithm)
    let y = if month <= 2 { year - 1 } else { year };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as i64;
    let doy = (153 * (if month > 2 { month - 3 } else { month + 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146097 + doe - 719468;
    Some(days * 86400 + hour * 3600 + minute * 60 + second)
}

// --- Tauri commands ---

#[tauri::command]
pub async fn minio_list_buckets(config: MinioConfig) -> Result<Vec<S3Entry>, String> {
    let req = build_signed_request(&config, "GET", None, None, &[], None)?;

    let resp = do_request(
        reqwest::Method::GET,
        &req.url,
        &req.headers,
        None,
    )
    .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("List buckets failed ({}): {}", status, body));
    }

    let xml_text = resp.text().await.map_err(|e| format!("Read body: {}", e))?;
    // Wrap individual buckets - the XML has <Buckets><Bucket>...</Bucket></Buckets>
    // quick-xml flatten mode handles this
    let result: ListAllMyBucketsResult =
        quick_xml::de::from_str(&xml_text).map_err(|e| format!("Parse XML: {}", e))?;

    let entries = result
        .buckets
        .into_iter()
        .map(|b| S3Entry {
            name: b.name.clone(),
            key: b.name,
            size: 0,
            last_modified: b.creation_date.as_deref().and_then(parse_iso8601_to_epoch),
            is_dir: true,
        })
        .collect();

    Ok(entries)
}

#[tauri::command]
pub async fn minio_list_objects(
    config: MinioConfig,
    bucket: String,
    prefix: String,
) -> Result<Vec<S3Entry>, String> {
    let query_params = vec![
        ("list-type".to_string(), "2".to_string()),
        ("prefix".to_string(), prefix.clone()),
        ("delimiter".to_string(), "/".to_string()),
    ];

    let req = build_signed_request(&config, "GET", Some(&bucket), None, &query_params, None)?;

    let resp = do_request(reqwest::Method::GET, &req.url, &req.headers, None).await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("List objects failed ({}): {}", status, body));
    }

    let xml_text = resp.text().await.map_err(|e| format!("Read body: {}", e))?;
    let result: ListBucketResult =
        quick_xml::de::from_str(&xml_text).map_err(|e| format!("Parse XML: {}", e))?;

    let mut entries: Vec<S3Entry> = Vec::new();

    // Common prefixes (directories)
    for p in result.common_prefixes {
        let name = p
            .prefix
            .trim_end_matches('/')
            .rsplit('/')
            .next()
            .unwrap_or(&p.prefix)
            .to_string();
        entries.push(S3Entry {
            name,
            key: p.prefix,
            size: 0,
            last_modified: None,
            is_dir: true,
        });
    }

    // Objects (skip prefix itself if it appears as a zero-size key)
    for obj in result.contents {
        if obj.key == prefix && obj.size == 0 {
            continue;
        }
        let name = obj.key.rsplit('/').next().unwrap_or(&obj.key).to_string();
        entries.push(S3Entry {
            name,
            key: obj.key,
            size: obj.size,
            last_modified: obj.last_modified.as_deref().and_then(parse_iso8601_to_epoch),
            is_dir: false,
        });
    }

    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));

    Ok(entries)
}

#[tauri::command]
pub async fn minio_create_bucket(config: MinioConfig, bucket: String) -> Result<(), String> {
    let req = build_signed_request(&config, "PUT", Some(&bucket), None, &[], None)?;

    let resp = do_request(reqwest::Method::PUT, &req.url, &req.headers, None).await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Create bucket failed ({}): {}", status, body));
    }

    Ok(())
}

#[tauri::command]
pub async fn minio_delete_bucket(config: MinioConfig, bucket: String) -> Result<(), String> {
    let req = build_signed_request(&config, "DELETE", Some(&bucket), None, &[], None)?;

    let resp = do_request(reqwest::Method::DELETE, &req.url, &req.headers, None).await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Delete bucket failed ({}): {}", status, body));
    }

    Ok(())
}

#[tauri::command]
pub async fn minio_upload_object(
    config: MinioConfig,
    bucket: String,
    key: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let req = build_signed_request(
        &config,
        "PUT",
        Some(&bucket),
        Some(&key),
        &[],
        Some(&data),
    )?;

    let resp = do_request(reqwest::Method::PUT, &req.url, &req.headers, Some(data)).await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Upload failed ({}): {}", status, body));
    }

    Ok(())
}

#[tauri::command]
pub async fn minio_download_object(
    config: MinioConfig,
    bucket: String,
    key: String,
) -> Result<Vec<u8>, String> {
    let req = build_signed_request(&config, "GET", Some(&bucket), Some(&key), &[], None)?;

    let resp = do_request(reqwest::Method::GET, &req.url, &req.headers, None).await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Download failed ({}): {}", status, body));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Read body: {}", e))?;

    Ok(bytes.to_vec())
}

#[tauri::command]
pub async fn minio_delete_object(
    config: MinioConfig,
    bucket: String,
    key: String,
) -> Result<(), String> {
    let req = build_signed_request(&config, "DELETE", Some(&bucket), Some(&key), &[], None)?;

    let resp = do_request(reqwest::Method::DELETE, &req.url, &req.headers, None).await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Delete failed ({}): {}", status, body));
    }

    Ok(())
}

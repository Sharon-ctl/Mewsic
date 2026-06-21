#[tokio::main]
async fn main() {
    let url = "https://open.spotify.com/playlist/0faRZvOoCLJmjbiWIlzgRz";
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .http1_only()
        .build().unwrap();
    let res = client.get(url).send().await.unwrap();
    let html = res.text().await.unwrap();
    println!("Length: {}", html.len());
}

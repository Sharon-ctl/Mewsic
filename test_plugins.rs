use std::path::PathBuf;
use std::fs;

fn main() {
    let plugins_dir = PathBuf::from("/home/xeoniii/.config/dev.xeoniii.mewsic/plugins");
    println!("Scanning {:?}", plugins_dir);
    if let Ok(entries) = fs::read_dir(&plugins_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            println!("Found {:?}", path);
            println!("  is_dir: {}", path.is_dir());
            println!("  extension: {:?}", path.extension());
            
            if path.is_dir() && path.extension().and_then(|s| s.to_str()) == Some("mewsic") {
                let manifest_path = path.join("manifest.json");
                println!("  Manifest exists: {}", manifest_path.exists());
            }
        }
    }
}

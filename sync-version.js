import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json version
const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

console.log(`Syncing version v${version} across project configurations...`);

// 1. Sync src-tauri/Cargo.toml
const cargoPath = path.join(__dirname, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoPath)) {
  let cargoContent = fs.readFileSync(cargoPath, 'utf8');
  // Replace version = "X.Y.Z" under [package]
  const updatedCargo = cargoContent.replace(
    /^(version\s*=\s*")([^"]+)(")/m,
    `$1${version}$3`
  );
  if (cargoContent !== updatedCargo) {
    fs.writeFileSync(cargoPath, updatedCargo, 'utf8');
    console.log(`- Synced src-tauri/Cargo.toml version to ${version}`);
  }
}

// 2. Sync updater.json if it exists
const updaterPath = path.join(__dirname, 'updater.json');
if (fs.existsSync(updaterPath)) {
  try {
    const updater = JSON.parse(fs.readFileSync(updaterPath, 'utf8'));
    if (updater.version !== version) {
      const oldVersion = updater.version;
      updater.version = version;
      // Also update URLs and notes if they match pattern
      const oldVerPattern = new RegExp(oldVersion.replace(/\./g, '\\.'), 'g');
      
      if (updater.notes) {
        updater.notes = updater.notes.replace(oldVerPattern, version);
      }
      
      if (updater.platforms) {
        for (const platform of Object.keys(updater.platforms)) {
          const platObj = updater.platforms[platform];
          if (platObj && platObj.url) {
            platObj.url = platObj.url.replace(oldVerPattern, version);
          }
        }
      }
      
      fs.writeFileSync(updaterPath, JSON.stringify(updater, null, 2), 'utf8');
      console.log(`- Synced updater.json version to ${version}`);
    }
  } catch (e) {
    console.error(`- Failed to update updater.json: ${e}`);
  }
}

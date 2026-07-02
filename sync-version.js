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

// 2. Sync updater.json — only update version and notes.
//    URLs are now static (no version in filename) so they never need to change.
const updaterPath = path.join(__dirname, 'updater.json');
if (fs.existsSync(updaterPath)) {
  try {
    const updater = JSON.parse(fs.readFileSync(updaterPath, 'utf8'));
    let changed = false;

    if (updater.version !== version) {
      updater.version = version;
      changed = true;
    }

    // Update notes if it still contains a version string pattern
    if (updater.notes) {
      const updatedNotes = updater.notes.replace(/v\d+\.\d+[\.\d-]*/g, `v${version}`);
      if (updatedNotes !== updater.notes) {
        updater.notes = updatedNotes;
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(updaterPath, JSON.stringify(updater, null, 2) + '\n', 'utf8');
      console.log(`- Synced updater.json version to ${version}`);
    }
  } catch (e) {
    console.error(`- Failed to update updater.json: ${e}`);
  }
}

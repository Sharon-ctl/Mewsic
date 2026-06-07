import React, { useState, useEffect } from "react";
import { RefreshCw, DownloadCloud, CheckCircle2, X, AlertCircle, Rocket, Sparkles } from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { open } from "@tauri-apps/plugin-shell";
import { getVersion } from "@tauri-apps/api/app";
import { getOSName } from "../../utils/tauriApi";

interface UpdateModalProps {
  onClose: () => void;
}

export function UpdateModal({ onClose }: UpdateModalProps) {
  const [status, setStatus] = useState<"checking" | "available" | "up-to-date" | "downloading" | "error" | "early-access">("checking");
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [linuxPackageType, setLinuxPackageType] = useState<"appimage" | "deb" | "rpm">("appimage");
  
  const osName = getOSName();
  const isLinux = osName === "Linux";

  useEffect(() => {
    performCheck();
  }, []);

  const performCheck = async () => {
    setStatus("checking");
    try {
      const update = await check();
      if (update?.available) {
        setNewVersion(update.version);
        setStatus("available");
      } else {
        // Check for easter egg (running a version higher than public release)
        try {
          const currentVersion = await getVersion();
          const res = await fetch("https://api.github.com/repos/xeoniii/Mewsic/releases/latest");
          if (res.ok) {
            const data = await res.json();
            const remoteVersion = data.tag_name?.replace('v', '');
            if (remoteVersion && currentVersion) {
              const v1 = currentVersion.split('.').map(Number);
              const v2 = remoteVersion.split('.').map(Number);
              let isAhead = false;
              for (let i = 0; i < 3; i++) {
                if (v1[i] > v2[i]) { isAhead = true; break; }
                if (v1[i] < v2[i]) { break; }
              }
              if (isAhead) {
                setStatus("early-access");
                return;
              }
            }
          }
        } catch (e) {
          console.error("Failed to check github for easter egg", e);
        }
        setStatus("up-to-date");
      }
    } catch (err) {
      const errorStr = String(err);
      console.error(err);
      if (errorStr.includes("relative URL without a base: \"\"")) {
        setStatus("up-to-date");
      } else {
        setError(errorStr);
        setStatus("error");
      }
    }
  };

  const handleInstall = async () => {
    if (isLinux && linuxPackageType !== "appimage" && newVersion) {
      const baseUrl = `https://github.com/xeoniii/Mewsic/releases/download/v${newVersion}`;
      const finalUrl = linuxPackageType === "deb" 
        ? `${baseUrl}/mewsic_${newVersion}_amd64.deb`
        : `${baseUrl}/mewsic-${newVersion}-1.x86_64.rpm`;
      
      try {
        await open(finalUrl);
        setStatus("up-to-date");
      } catch (err) {
        console.error(err);
        setError("Failed to open browser.");
        setStatus("error");
      }
      return;
    }

    try {
      const update = await check();
      if (update?.available) {
        setStatus("downloading");
        let downloaded = 0;
        let contentLength = 0;
        
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              break;
            case 'Progress':
              downloaded += event.data.chunkLength;
              if (contentLength > 0) {
                setProgress((downloaded / contentLength) * 100);
              }
              break;
            case 'Finished':
              break;
          }
        });
        
        await relaunch();
      }
    } catch (err) {
      console.error(err);
      setError(String(err));
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md glass rounded-2xl overflow-hidden shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="font-display font-semibold text-text-primary">Software Update</h2>
          <button onClick={onClose} className="btn-icon p-1">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6 items-center text-center">
          {/* Icon Stage */}
          <div className="relative">
            <div className="w-20 h-20 rounded-[2.5rem] bg-accent/10 flex items-center justify-center text-accent">
              {status === "checking" && <RefreshCw size={40} className="animate-spin" />}
              {status === "available" && <DownloadCloud size={40} className="animate-bounce" />}
              {status === "up-to-date" && <CheckCircle2 size={40} className="text-emerald-500" />}
              {status === "downloading" && <Rocket size={40} className="animate-pulse" />}
              {status === "error" && <AlertCircle size={40} className="text-red-500" />}
              {status === "early-access" && <Sparkles size={40} className="text-fuchsia-500 animate-pulse" />}
            </div>
            {status === "checking" && (
               <div className="absolute -inset-2 rounded-[3rem] border-2 border-accent/20 border-t-accent animate-spin" />
            )}
          </div>

          {/* Text Stage */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-text-primary">
              {status === "checking" && "Checking for Updates"}
              {status === "available" && (isLinux ? "Update Found For Linux!" : `Update Found For ${osName}!`)}
              {status === "up-to-date" && "You're All Set!"}
              {status === "downloading" && "Downloading..."}
              {status === "error" && "Update Error"}
              {status === "early-access" && "Time Traveler Detected"}
            </h2>
            <p className="text-sm text-text-muted font-medium leading-relaxed px-4">
              {status === "checking" && "Connecting to the Mewsic cloud to look for the latest bits..."}
              {status === "available" && `Mewsic v${newVersion} is ready for deployment. Want to sync up?`}
              {status === "up-to-date" && "You are running the latest high-fidelity version of Mewsic."}
              {status === "downloading" && "Fetching the latest components. Mewsic will relaunch once complete."}
              {status === "error" && (error || "Failed to communicate with update server.")}
              {status === "early-access" && "Woah there! You're running an unreleased version of Mewsic from the future. Enjoy the early access features!"}
            </p>
          </div>

          {/* Action Stage / Progress bar / Dropdown */}
          <div className="w-full space-y-4">
            {status === "available" && isLinux && (
              <div className="relative text-left">
                <label className="text-xs text-text-muted mb-1 block">Package Format</label>
                <select 
                  value={linuxPackageType}
                  onChange={(e) => setLinuxPackageType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors appearance-none cursor-pointer"
                >
                  <option value="appimage">Auto-Update (AppImage)</option>
                  <option value="deb">Download .deb (Debian/Ubuntu)</option>
                  <option value="rpm">Download .rpm (RedHat/Fedora)</option>
                </select>
                <div className="absolute inset-y-0 right-3 bottom-0 flex items-center pointer-events-none mt-5">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            )}

            {status === "downloading" && (
              <div className="w-full space-y-2 mt-4">
                <div className="flex justify-between text-xs text-text-muted font-medium mb-1">
                  <span>Downloading update...</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-surface-overlay rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-surface-overlay/30">
          <button onClick={onClose} className="btn-accent bg-surface-overlay text-text-secondary hover:opacity-80">
            {status === "up-to-date" || status === "error" || status === "early-access" ? "Close" : "Cancel"}
          </button>
          
          {status === "available" && (
            <button onClick={handleInstall} className="btn-accent">
               <DownloadCloud size={14} />
               {isLinux && linuxPackageType !== "appimage" ? "Download in Browser" : "Download & Install"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

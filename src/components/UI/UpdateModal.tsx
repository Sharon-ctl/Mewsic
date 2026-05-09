import React, { useState, useEffect } from "react";
import { RefreshCw, DownloadCloud, CheckCircle2, X, AlertCircle, Rocket } from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { open } from "@tauri-apps/plugin-shell";

interface UpdateModalProps {
  onClose: () => void;
}

export function UpdateModal({ onClose }: UpdateModalProps) {
  const [status, setStatus] = useState<"checking" | "available" | "up-to-date" | "downloading" | "error">("checking");
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [linuxPackageType, setLinuxPackageType] = useState<"appimage" | "deb" | "rpm">("appimage");
  
  const isLinux = typeof navigator !== "undefined" && 
                  navigator.userAgent.toLowerCase().includes('linux') && 
                  !navigator.userAgent.toLowerCase().includes('android');

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
        setStatus("up-to-date");
      }
    } catch (err) {
      const errorStr = String(err);
      console.error(err);
      // Handle the specific empty URL error from the updater JSON
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
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-sm glass rounded-[32px] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-2xl hover:bg-surface-overlay text-text-muted transition-all hover:scale-110 active:scale-90 z-10"
        >
          <X size={20} />
        </button>

        <div className="p-10 flex flex-col items-center text-center">
          {/* Icon Stage */}
          <div className="mb-8 relative">
            <div className="w-20 h-20 rounded-[2.5rem] bg-accent/10 flex items-center justify-center text-accent">
              {status === "checking" && <RefreshCw size={40} className="animate-spin" />}
              {status === "available" && <DownloadCloud size={40} className="animate-bounce" />}
              {status === "up-to-date" && <CheckCircle2 size={40} className="text-emerald-500" />}
              {status === "downloading" && <Rocket size={40} className="animate-pulse" />}
              {status === "error" && <AlertCircle size={40} className="text-red-500" />}
            </div>
            {status === "checking" && (
               <div className="absolute -inset-2 rounded-[3rem] border-2 border-accent/20 border-t-accent animate-spin" />
            )}
          </div>

          {/* Text Stage */}
          <div className="space-y-2 mb-10">
            <h2 className="text-2xl font-black tracking-tight text-text-primary uppercase italic text-center">
              {status === "checking" && "Checking Updates"}
              {status === "available" && (isLinux ? "Update Found For Linux!" : "Update Found!")}
              {status === "up-to-date" && "You're All Set!"}
              {status === "downloading" && "Downloading..."}
              {status === "error" && "Update Error"}
            </h2>
            <p className="text-xs text-text-muted font-medium leading-relaxed px-4">
              {status === "checking" && "Connecting to the Mewsic cloud to look for the latest bits..."}
              {status === "available" && `Mewsic v${newVersion} is ready for deployment. Want to sync up?`}
              {status === "up-to-date" && "You are running the latest high-fidelity version of Mewsic."}
              {status === "downloading" && "Fetching the latest components. Mewsic will relaunch once complete."}
              {status === "error" && (error || "Failed to communicate with update server.")}
            </p>
          </div>

          {/* Action Stage */}
          <div className="w-full space-y-4">
            {status === "available" && (
              <div className="flex flex-col gap-3">
                {isLinux && (
                  <div className="relative">
                    <select 
                      value={linuxPackageType}
                      onChange={(e) => setLinuxPackageType(e.target.value as any)}
                      className="w-full bg-surface-overlay border border-border-subtle text-text-primary py-3 px-4 rounded-xl font-bold uppercase tracking-wider text-[10px] focus:outline-none focus:border-accent transition-colors appearance-none text-center cursor-pointer hover:bg-surface-raised"
                    >
                      <option value="appimage">Auto-Update (AppImage)</option>
                      <option value="deb">Download .deb (Debian/Ubuntu)</option>
                      <option value="rpm">Download .rpm (RedHat/Fedora)</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                )}
                <button 
                  onClick={handleInstall}
                  className="w-full bg-accent text-black py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {isLinux && linuxPackageType !== "appimage" ? "Download in Browser" : "Download & Install"}
                </button>
              </div>
            )}

            {status === "downloading" && (
              <div className="w-full space-y-3">
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-300 shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[10px] font-black text-accent uppercase tracking-widest">
                  {progress.toFixed(0)}% Complete
                </p>
              </div>
            )}

            {(status === "up-to-date" || status === "error") && (
              <button 
                onClick={onClose}
                className="w-full py-4 rounded-2xl bg-surface-overlay hover:bg-surface-raised text-text-primary font-bold transition-all active:scale-[0.98] border border-border-subtle"
              >
                Close
              </button>
            )}

            {status === "checking" && (
              <div className="text-[9px] font-black text-text-muted uppercase tracking-[0.3em] animate-pulse">
                Establishing Link...
              </div>
            )}
          </div>
        </div>

        {/* Footer branding */}
        <div className="mt-4 pt-6 border-t border-border-subtle w-full flex flex-col gap-1.5 items-center bg-surface-overlay/30 pb-6">
          <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.5em]">Mewsic Update Protocol</p>
        </div>
      </div>
    </div>
  );
}

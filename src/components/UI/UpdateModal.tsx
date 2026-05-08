import React, { useState, useEffect } from "react";
import { RefreshCw, DownloadCloud, CheckCircle2, X, AlertCircle, Rocket } from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

interface UpdateModalProps {
  onClose: () => void;
}

export function UpdateModal({ onClose }: UpdateModalProps) {
  const [status, setStatus] = useState<"checking" | "available" | "up-to-date" | "downloading" | "error">("checking");
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
      console.error(err);
      setError(String(err));
      setStatus("error");
    }
  };

  const handleInstall = async () => {
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
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-sm glass rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden relative animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-text-muted hover:text-text-primary transition-colors"
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
            <h2 className="text-2xl font-black tracking-tight text-text-primary uppercase italic">
              {status === "checking" && "Checking Updates"}
              {status === "available" && "Update Found!"}
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
              <button 
                onClick={handleInstall}
                className="w-full bg-accent text-black py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Download & Install
              </button>
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
                className="w-full bg-white/5 border border-white/10 text-text-primary py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-white/10 transition-all"
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
        <div className="bg-accent/5 py-4 border-t border-accent/10 text-center">
          <p className="text-[9px] font-black text-accent/40 uppercase tracking-[0.5em]">Mewsic Update Protocol</p>
        </div>
      </div>
    </div>
  );
}

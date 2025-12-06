"use client";

import { useState, useEffect } from "react";
import { GoPaste } from "react-icons/go";
import { IoIosLink } from "react-icons/io";

type Format = {
  format_id: string;
  ext: string;
  resolution?: string;
  filesize?: number;
  format_note?: string;
  label?: string; // e.g., "1080p (mp4)"
};

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [formats, setFormats] = useState<Format[]>([]);
  const [status, setStatus] = useState<"idle" | "fetching">("idle");
  const [error, setError] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [countdowns, setCountdowns] = useState<Record<string, number | "started">>({});

  const fetchFormats = async () => {
    if (!url) return;
    setStatus("fetching");
    setError("");
    try {
      const res = await fetch(`/api/formats?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setVideoTitle(data.title || "");
      setFormats(data.formats || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load formats");
    } finally {
      setStatus("idle");
    }
  };

  const handleDownload = (formatId: string) => {
    // Start actual download immediately
    const format = formats.find(f => f.format_id === formatId);
    const ext = format?.ext || "mp4";
    const safeTitle = (videoTitle || "video").replace(/[<>:"/\\|?*]+/g, "").trim() || "video";
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(formatId)}`;
    
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${safeTitle}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Start 20s countdown UI
    setCountdowns(prev => ({ ...prev, [formatId]: 20 }));

    let count = 20;
    const interval = setInterval(() => {
      count -= 1;
      setCountdowns(prev => ({ ...prev, [formatId]: count }));
      if (count <= 0) {
        clearInterval(interval);
        // Show "Downloading started"
        setCountdowns(prev => ({ ...prev, [formatId]: "started" }));
        // Reset after 2 seconds
        setTimeout(() => {
          setCountdowns(prev => {
            const newCount = { ...prev };
            delete newCount[formatId];
            return newCount;
          });
        }, 2000);
      }
    }, 1000);
  };

  const getResolution = (fmt: Format): number => {
    if (fmt.label) {
      const match = fmt.label.match(/^(\d+)p/);
      return match ? parseInt(match[1], 10) : 0;
    }
    if (fmt.resolution) {
      const match = fmt.resolution.match(/x(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    }
    return 0;
  };

  const sortedFormats = [...formats].sort((a, b) => {
    const hA = getResolution(a);
    const hB = getResolution(b);
    return hB - hA;
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#1a1a1a]">
      <div className="w-full max-w-2xl">
        {/* URL Input */}
        <div className="flex items-center gap-3 bg-[#0f0f0f] border border-gray-700 px-4 py-3 rounded-2xl text-white">
          <span className="text-gray-400 font-semibold text-lg">
            <IoIosLink />
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube link here"
            className="flex-1 bg-transparent font-semibold outline-none text-sm text-gray-200 placeholder-gray-500"
          />
          <button
            type="button"
            onClick={() => navigator.clipboard.readText().then(setUrl)}
            className="bg-[#1f1f1f] px-4 py-2 rounded-xl border border-gray-600 text-gray-200 hover:bg-gray-700 text-sm flex font-semibold items-center gap-1"
          >
            <GoPaste />
            Paste
          </button>
        </div>

        {/* Fetch Button */}
        <button
          onClick={fetchFormats}
          disabled={!url || status === "fetching"}
          className="w-full mt-4 py-3 bg-[#3D3B3B] border border-white text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60 hover:bg-[#3c3c3c]"
        >
          {status === "fetching" ? "Loading qualities…" : "Show Available Qualities"}
        </button>

        {error && <p className="text-red-500 text-center mt-3 text-sm">{error}</p>}
        {videoTitle && <p className="mt-2 text-center text-white text-sm opacity-70">{videoTitle}</p>}

        {/* Quality Table */}
        {formats.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-200">
              <thead className="bg-[#0f0f0f] border-b border-gray-700">
                <tr>
                  <th className="px-4 py-2">File type</th>
                  <th className="px-4 py-2">Format</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedFormats.map((fmt) => {
                  const res = getResolution(fmt);
                  const label = fmt.label || `${res}p (${fmt.ext})`;
                  const countdown = countdowns[fmt.format_id];

                  let buttonText = "Download";
                  let isDisabled = false;
                  if (countdown !== undefined) {
                    isDisabled = true;
                    if (countdown === "started") {
                      buttonText = "Downloading started";
                    } else {
                      buttonText = `Downloading... (${countdown}s)`;
                    }
                  }

                  return (
                    <tr key={fmt.format_id} className="border-b border-gray-800 hover:bg-[#252525]">
                      <td className="px-4 py-3">{label}</td>
                      <td className="px-4 py-3">Auto</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDownload(fmt.format_id)}
                          disabled={isDisabled}
                          className={`font-semibold py-2 px-4 rounded-lg flex items-center gap-1 ${
                            isDisabled
                              ? "bg-gray-600 text-white cursor-not-allowed"
                              : "bg-red-600 hover:bg-red-700 text-white"
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
                            <path d="M8 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5H8.5a.5.5 0 0 1-.5-.5v-2z"/>
                            <path d="M9 7.5V4.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5z"/>
                          </svg>
                          {buttonText}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
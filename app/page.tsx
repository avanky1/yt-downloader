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

    setCountdowns(prev => ({ ...prev, [formatId]: 20 }));

    let count = 20;
    const interval = setInterval(() => {
      count -= 1;
      setCountdowns(prev => ({ ...prev, [formatId]: count }));
      if (count <= 0) {
        clearInterval(interval);
        setCountdowns(prev => ({ ...prev, [formatId]: "started" }));
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
    <div className="min-h-screen bg-[#121212] text-gray-200 p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">YouTube Video Downloader</h1>
          <p className="text-sm opacity-70 mt-1">Download videos in MP4 format up to 1080p</p>
          <p className="text-sm opacity-70 mt-1">Code by avanish</p>

        </div>

        {/* URL Input */}
        <div className="flex items-center gap-3 bg-[#1e1e1e] border border-gray-700 px-4 py-3 rounded-xl mb-4">
          <span className="text-gray-400">
            <IoIosLink />
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube video link here"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500"
          />
          <button
            onClick={() => navigator.clipboard.readText().then(setUrl)}
            className="bg-[#2c2c2c] px-3 py-1 rounded-lg border cursor-pointer border-gray-600 text-gray-200 hover:bg-gray-700 text-xs flex items-center gap-1"
          >
            <GoPaste /> Paste
          </button>
        </div>

        {/* Fetch Button */}
        <button
          onClick={fetchFormats}
          disabled={!url || status === "fetching"}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
            !url || status === "fetching"
              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 cursor-pointer text-white"
          }`}
        >
          {status === "fetching" ? "Loading qualities…" : "Show Available Qualities"}
        </button>

        {error && (
          <div className="mt-3 p-3 bg-red-900 text-red-200 rounded-lg text-sm">
            ❌ {error}
          </div>
        )}

        {videoTitle && formats.length > 0 && (
          <div className="mt-3 p-3 bg-[#1e1e1e] rounded-lg text-sm">
            <strong>Video:</strong> {videoTitle}
          </div>
        )}

        {/* Quality Table */}
        {formats.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl bg-[#1e1e1e] border border-gray-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#252525]">
                <tr>
                  <th className="px-4 py-3 font-medium">File Type</th>
                  <th className="px-4 py-3 font-medium">Quality</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedFormats.map((fmt) => {
                  const res = getResolution(fmt);
                  const label = fmt.label || `${res}p (${fmt.ext})`;
                  const countdown = countdowns[fmt.format_id];

                  let buttonText = "Download";
                  let isDisabled = false;
                  let buttonClass = "bg-red-600 cursor-pointer hover:bg-red-700 text-white";

                  if (countdown !== undefined) {
                    isDisabled = true;
                    if (countdown === "started") {
                      buttonText = "Downloading started";
                      buttonClass = "bg-green-600 text-white cursor-not-allowed";
                    } else {
                      buttonText = `Downloading... (${countdown}s)`;
                      buttonClass = "bg-yellow-600 text-white cursor-not-allowed";
                    }
                  }

                  return (
                    <tr key={fmt.format_id} className="border-t border-gray-800 hover:bg-[#252525]">
                      <td className="px-4 py-3">{label}</td>
                      <td className="px-4 py-3">Auto</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDownload(fmt.format_id)}
                          disabled={isDisabled}
                          className={`font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors ${buttonClass}`}
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
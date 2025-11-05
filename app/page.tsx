"use client";

import { useState } from "react";
import { GoPaste } from "react-icons/go";
import { IoIosLink } from "react-icons/io";

type Format = {
  format_id: string;
  ext: string;
  resolution?: string;
  filesize?: number;
  format_note?: string;
};

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [formats, setFormats] = useState<Format[]>([]);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [status, setStatus] = useState<"idle" | "fetching" | "downloading">(
    "idle"
  );
  const [countdown, setCountdown] = useState(20);
  const [showStarting, setShowStarting] = useState(false);
  const [error, setError] = useState("");
  const [videoTitle, setVideoTitle] = useState("");

  const fetchFormats = async () => {
    if (!url) return;
    setStatus("fetching");
    setError("");

    try {
      const res = await fetch(`/api/formats?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      setFormats(data.formats || []);
      setVideoTitle(data.title || "video");
      if (data.formats?.length) setSelectedFormat(data.formats[0].format_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load formats");
    } finally {
      setStatus("idle");
    }
  };

  const handleDownload = () => {
    if (!selectedFormat) return;
    setStatus("downloading");
    setCountdown(20);
    setShowStarting(false);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowStarting(true);
          setStatus("idle");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const safeTitle =
      videoTitle.replace(/[<>:"/\\|?*]+/g, "").trim() || "video";
    const downloadUrl = `/api/download?url=${encodeURIComponent(
      url
    )}&format=${encodeURIComponent(selectedFormat)}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${safeTitle}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatLabel = (fmt: Format) => {
    const res = fmt.resolution || fmt.format_note || fmt.format_id;
    const size = fmt.filesize
      ? ` • ${(fmt.filesize / 1024 ** 2).toFixed(1)} MB`
      : "";
    return `${res}${size} (${fmt.ext})`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#1a1a1a]">
      <div className="w-full max-w-2xl p-4">
        {/* URL Input */}
        <div className="flex items-center gap-3 bg-[#0f0f0f] border border-gray-700 px-4 py-3 rounded-2xl text-white">
          <span className="text-gray-400 font-semibold text-lg">
            <IoIosLink />
          </span>

          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="paste the link here"
            className="flex-1 bg-transparent font-semibold outline-none text-sm text-gray-200 placeholder-gray-500"
          />

          <button
            type="button"
            onClick={() =>
              navigator.clipboard.readText().then((txt) => setUrl(txt))
            }
            className="bg-[#1f1f1f] px-4 py-2 rounded-xl border border-gray-600 text-gray-200 hover:bg-gray-700 text-sm flex font-semibold cursor-pointer items-center gap-1"
          >
            <GoPaste />
            paste
          </button>
        </div>

        {/* Formats Button */}
        <button
          onClick={fetchFormats}
          disabled={!url || status === "fetching"}
          className="w-full mt-4 py-3 bg-[3D3B3B] border border-white text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer disabled:opacity-60 hover:bg-[#3c3c3c]"
        >
          {status === "fetching"
            ? "Loading formats..."
            : "Get Available Qualities"}
        </button>

        {error && (
          <p className="text-red-500 text-center mt-3 text-sm">{error}</p>
        )}

        {videoTitle && formats.length > 0 && (
          <p className="mt-3 text-center text-white text-sm opacity-60">
            {videoTitle}
          </p>
        )}

        {/* Format Dropdown */}
        {formats.length > 0 && (
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="w-full mt-3 py-3 bg-[#1a1a1a] border border-gray-700 rounded-xl text-gray-200 text-sm"
          >
            {formats.map((fmt) => (
              <option key={fmt.format_id} value={fmt.format_id}>
                {formatLabel(fmt)}
              </option>
            ))}
          </select>
        )}

        {/* Download Button */}
        {selectedFormat && (
          <button
            onClick={handleDownload}
            disabled={status === "downloading"}
            className="mt-4 w-full py-3 bg-[#3D3B3B] border font-semibold border-white text-white rounded-xl text-sm transition-all cursor-pointer disabled:opacity-60 hover:bg-[#3c3c3c]"
          >
            {status === "downloading" ? (
              <>Downloading... ({countdown}s)</>
            ) : showStarting ? (
              "Starting download..."
            ) : (
              "Download Video"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

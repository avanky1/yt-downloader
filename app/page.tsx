'use client';

import { useState } from 'react';

type Format = {
  format_id: string;
  ext: string;
  resolution?: string;
  filesize?: number;
  format_note?: string;
};

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [formats, setFormats] = useState<Format[]>([]);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [status, setStatus] = useState<'idle' | 'fetching' | 'downloading'>('idle');
  const [countdown, setCountdown] = useState(20);
  const [showStarting, setShowStarting] = useState(false);
  const [error, setError] = useState('');
  const [videoTitle, setVideoTitle] = useState('');

  const fetchFormats = async () => {
    if (!url) return;
    setStatus('fetching');
    setError('');

    try {
      const res = await fetch(`/api/formats?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      setFormats(data.formats || []);
      setVideoTitle(data.title || 'video'); // ✅ store title
      if (data.formats?.length) setSelectedFormat(data.formats[0].format_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load formats');
    } finally {
      setStatus('idle');
    }
  };

  const handleDownload = () => {
    if (!selectedFormat) return;
    setStatus('downloading');
    setCountdown(20);
    setShowStarting(false);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowStarting(true);
          setStatus('idle');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // ✅ Safe filename (remove invalid characters)
    const safeTitle = videoTitle.replace(/[<>:"/\\|?*]+/g, '').trim() || 'video';

    // ✅ Add title to download name
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(selectedFormat)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${safeTitle}.mp4`; // ✅ file will have the video name
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatLabel = (fmt: Format) => {
    const res = fmt.resolution || fmt.format_note || fmt.format_id;
    const size = fmt.filesize ? ` • ${(fmt.filesize / (1024 ** 2)).toFixed(1)} MB` : '';
    return `${res}${size} (${fmt.ext})`;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#6a6a6a' }}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-lg p-6 backdrop-blur-sm"
        style={{ backgroundColor: '#7a7a7a', color: '#f5f5f5' }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">YouTube Downloader</h1>
          <p className="text-sm text-gray-200 opacity-80 mt-1">
            Downloads videos with real title
          </p>
        </div>

        {/* URL Input */}
        <div className="mb-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube link..."
            className="w-full p-3 bg-[#606060] rounded-lg border border-[#555] text-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>

        {/* Get Formats Button */}
        <button
          onClick={fetchFormats}
          disabled={!url || status === 'fetching'}
          className="w-full py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition disabled:opacity-50 text-sm font-medium"
        >
          {status === 'fetching' ? 'Loading formats...' : 'Get Available Qualities'}
        </button>

        {error && <p className="text-red-300 text-sm mt-2 text-center">{error}</p>}

        {/* Show title */}
        {videoTitle && formats.length > 0 && (
          <p className="text-center text-sm text-gray-100 mt-3 opacity-80">
            🎬 {videoTitle}
          </p>
        )}

        {/* Format Selection */}
        {formats.length > 0 && (
          <div className="mt-5">
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full p-3 bg-[#606060] border border-[#555] rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
            >
              {formats.map((fmt) => (
                <option key={fmt.format_id} value={fmt.format_id}>
                  {formatLabel(fmt)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Download Button */}
        {selectedFormat && (
          <button
            onClick={handleDownload}
            disabled={status === 'downloading'}
            className="mt-5 w-full py-2.5 bg-[#4caf50] hover:bg-[#45a047] text-white rounded-lg font-medium transition disabled:opacity-60 text-sm"
          >
            {status === 'downloading' ? (
              <>Downloading... ({countdown}s)</>
            ) : showStarting ? (
              'Starting soon...'
            ) : (
              'Download Video'
            )}
          </button>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-300 mt-6 border-t border-white/10 pt-4">
          © 2025 GrayTube Downloader
        </div>
      </div>
    </div>
  );
}

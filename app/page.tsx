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
  const [countdown1, setCountdown1] = useState(12);
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
      setVideoTitle(data.title || 'video');
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

    const safeTitle = videoTitle.replace(/[<>:"/\\|?*]+/g, '').trim() || 'video';
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(selectedFormat)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${safeTitle}.mp4`;
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">YouTube Downloader</h1>
          <p className="text-sm  text-red-500 font-bold mt-1">
            Coded by: Avanish
          </p>
        </div>

        {/* URL Input */}
        <div className="mb-4 font-semibold">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube link..."
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-300 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Get Formats Button */}
        <button
          onClick={fetchFormats}
          disabled={!url || status === 'fetching'}
          className="w-full py-3 bg-gray-700 hover:bg-gray-500 disabled:bg-gray-700 text-white rounded-xl  text-sm transition-all font-semibold cursor-pointer duration-200 shadow-sm"
        >
          {status === 'fetching' ? 'Loading formats... ' : 'Get Available Qualities'
          }
        </button>

        {error && (
          <p className="text-red-600 text-sm mt-3 text-center font-medium bg-red-50 py-2 rounded-lg border border-red-200">
            {error}
          </p>
        )}

        {/* Video Title */}
        {videoTitle && formats.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 font-medium text-center">
               {videoTitle}
            </p>
          </div>
        )}

        {/* Format Selection */}
        {formats.length > 0 && (
          <div className="mt-5">
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
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
            className="mt-5 w-full py-3 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-500 text-white rounded-xl font-medium text-sm transition-all cursor-pointer duration-200 shadow-sm"
          >
            {status === 'downloading' ? (
              <>Downloading... ({countdown}s)</>
            ) : showStarting ? (
              'Starting download...'
            ) : (
              'Download Video'
            )}
          </button>
        )}

       
      </div>
    </div>
  );
}
// app/page.tsx
'use client';

import { useState } from 'react';

type Format = {
  format_id: string;
  ext: string;
  resolution?: string;
  filesize?: number;
  fps?: number;
  format_note?: string;
  acodec?: string;
  vcodec?: string;
};

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [formats, setFormats] = useState<Format[]>([]);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [status, setStatus] = useState<'idle' | 'fetching' | 'downloading' | 'error'>('idle');
  const [error, setError] = useState('');

  const fetchFormats = async () => {
    if (!url) return;
    setStatus('fetching');
    setError('');
    try {
      const res = await fetch(`/api/formats?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFormats(data.formats || []);
      if (data.formats?.length) {
        setSelectedFormat(data.formats[0].format_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load formats');
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  const handleDownload = () => {
    if (!selectedFormat) return;
    setStatus('downloading');
    setError('');

    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(selectedFormat)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setStatus('idle');
  };

  const formatLabel = (fmt: Format) => {
    const res = fmt.resolution || fmt.format_note || fmt.format_id;
    const size = fmt.filesize ? ` (${(fmt.filesize / (1024 ** 2)).toFixed(1)} MB)` : '';
    return `${res} • ${fmt.ext}${size}`;
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          YouTube Downloader
        </h1>
        <p className="text-gray-400 mt-2 text-sm">
          Personal use only • Respect copyright
        </p>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-5 border border-gray-700 shadow-lg">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-300">YouTube URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtu.be/..."
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500"
          />
        </div>

        <button
          onClick={fetchFormats}
          disabled={!url || status === 'fetching'}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {status === 'fetching' ? 'Loading formats...' : '🔍 Get Available Qualities'}
        </button>

        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}

        {formats.length > 0 && (
          <div className="mt-5">
            <label className="block text-sm font-medium mb-2 text-gray-300">Select Quality</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              {formats.map((fmt) => (
                <option key={fmt.format_id} value={fmt.format_id}>
                  {formatLabel(fmt)}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedFormat && (
          <button
            onClick={handleDownload}
            disabled={status === 'downloading'}
            className="mt-5 w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {status === 'downloading' ? (
              <>
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Downloading...
              </>
            ) : (
              '📥 Download Video'
            )}
          </button>
        )}
      </div>

      <footer className="mt-10 text-center text-gray-500 text-xs">
        <p>For personal & educational use only. Not affiliated with YouTube.</p>
      </footer>
    </div>
  );
}
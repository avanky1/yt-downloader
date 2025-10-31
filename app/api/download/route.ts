import { NextRequest } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import { Readable } from 'stream';

// Enforce Node.js runtime (required for spawn, streams, and request.signal)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Only respected on some platforms

function sanitizeAscii(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '_')
    .replace(/\s+/g, '_')
    .trim()
    .substring(0, 100)
    .replace(/^\.+/, '');
}

function sanitizeUtf8(title: string): string {
  return title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim()
    .substring(0, 100);
}

async function fetchVideoTitle(url: string): Promise<string> {
  try {
    const proc = spawn('yt-dlp', [
      '--no-warnings',
      '--compat-options', 'no-youtube-unavailable-videos',
      '--dump-json',
      url,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    proc.stderr.on('data', (chunk) => (stderr += chunk.toString()));

    const exitCode = await new Promise<number>((resolve) => {
      proc.on('close', resolve);
    });

    if (exitCode === 0) {
      const info = JSON.parse(stdout);
      return info.title || 'video';
    }
  } catch (err) {
    console.warn('Failed to fetch video title:', err);
  }
  return 'video';
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const formatId = request.nextUrl.searchParams.get('format') || 'best';

  // Validate URL
  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return new Response('Invalid YouTube URL', { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  // Fetch title for filename
  const title = await fetchVideoTitle(url);
  const asciiName = sanitizeAscii(title) || 'video';
  const utf8Name = sanitizeUtf8(title) || 'video';
  const fallback = `${asciiName}.mp4`;
  const encoded = encodeURIComponent(`${utf8Name}.mp4`);

  // Create readable stream
  const stream = new Readable();
  stream._read = () => {};

  // Spawn yt-dlp process
  const ytDlp: ChildProcess = spawn('yt-dlp', [
    '--no-warnings',
    '--no-call-home',
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    '--referer',
    'https://www.youtube.com/',
    '-f',
    formatId,
    '--merge-output-format',
    'mp4',
    '-o',
    '-',
    url,
  ]);

  let clientDisconnected = false;

  const cleanup = () => {
    if (clientDisconnected) return;
    clientDisconnected = true;
    ytDlp.kill('SIGTERM');
    stream.destroy();
  };

  // ✅ Reliable client disconnect detection
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    request.signal.addEventListener('abort', cleanup);
  }

  // Timeout (5 minutes max)
  const TIMEOUT_MS = 295_000;
  const timeoutId = setTimeout(() => {
    if (!clientDisconnected) {
      console.log('Download timed out – killing yt-dlp');
      cleanup();
    }
  }, TIMEOUT_MS);

  // Handle yt-dlp output
  ytDlp.stdout?.on('data', (chunk) => {
    if (!clientDisconnected) {
      stream.push(chunk);
    }
  });

  ytDlp.stderr?.on('data', (data) => {
    if (!clientDisconnected) {
      console.warn('yt-dlp stderr:', data.toString().trim());
    }
  });

  ytDlp.on('error', (err) => {
    if (!clientDisconnected) {
      console.error('yt-dlp spawn error:', err);
      stream.destroy(err);
    }
  });

  ytDlp.on('close', (code) => {
    clearTimeout(timeoutId);
    if (!clientDisconnected) {
      if (code !== 0) {
        const msg = `yt-dlp exited with code ${code}`;
        console.error(msg);
        stream.destroy(new Error(msg));
      } else {
        stream.push(null); // EOF
      }
    }
  });

  return new Response(stream as any, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}
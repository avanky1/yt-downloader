// app/api/download/route.ts
import { NextRequest } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const formatId = request.nextUrl.searchParams.get('format') || 'best';

  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return new Response('Invalid YouTube URL', { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  // Fetch title
  let title = 'video';
  try {
    const { stdout } = await execAsync(
      `yt-dlp --no-warnings --compat-options no-youtube-unavailable-videos --dump-json "${url}"`
    );
    const info = JSON.parse(stdout);
    title = info.title || 'video';
  } catch (err) {
    console.warn('Title fetch failed');
  }

  const asciiName = sanitizeAscii(title) || 'video';
  const utf8Name = sanitizeUtf8(title) || 'video';
  const fallback = `${asciiName}.mp4`;
  const encoded = encodeURIComponent(`${utf8Name}.mp4`);

  // Create stream
  const stream = new Readable();
  stream._read = () => {};

  // Spawn yt-dlp
  const ytDlp: ChildProcess = spawn('yt-dlp', [
    '--no-warnings',
    '--no-call-home',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    '--referer', 'https://www.youtube.com/',
    '-f', formatId,
    '--merge-output-format', 'mp4',
    '-o', '-',
    url,
  ]);

  // 🔥 Handle client disconnect → kill yt-dlp
  let clientDisconnected = false;

  // @ts-ignore – access underlying Node.js request
  const nodeReq = request as unknown as { socket?: { destroy: () => void } };
  const nodeRes = new Response(stream as any, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'no-store',
    },
  }) as unknown as { socket?: { on: (ev: string, fn: () => void) => void } };

  // Detect client abort (works in Node.js environments like standalone server, Render, etc.)
  if (nodeReq.socket) {
    const onClientDisconnect = () => {
      if (!clientDisconnected) {
        clientDisconnected = true;
        console.log('	Client disconnected – killing yt-dlp');
        ytDlp.kill('SIGTERM');
        stream.destroy();
      }
    };

    // When client closes connection
    nodeReq.socket.on('close', onClientDisconnect);
    nodeReq.socket.on('error', onClientDisconnect);

    // Also listen on response (fallback)
    if (nodeRes.socket) {
      nodeRes.socket.on('close', onClientDisconnect);
    }
  }

  // Handle yt-dlp errors
  ytDlp.on('error', (err) => {
    if (!clientDisconnected) {
      console.error('yt-dlp spawn error:', err);
      stream.destroy(err);
    }
  });

  ytDlp.stderr.on('data', (data) => {
    if (!clientDisconnected) {
      console.error('yt-dlp stderr:', data.toString());
    }
  });

  ytDlp.stdout.on('data', (chunk) => {
    if (!clientDisconnected) {
      stream.push(chunk);
    }
  });

  ytDlp.on('close', (code) => {
    if (!clientDisconnected) {
      if (code !== 0) {
        stream.destroy(new Error(`yt-dlp failed with code ${code}`));
      } else {
        stream.push(null);
      }
    }
  });

  return nodeRes;
}
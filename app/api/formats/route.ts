// app/api/formats/route.ts
import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Vercel-like timeout (ignored on self-hosted)

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return new Response('Invalid YouTube URL', { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  try {
    const { stdout } = await execAsync(
      `yt-dlp --no-warnings --compat-options no-youtube-unavailable-videos --dump-json "${url}"`
    );
    const info = JSON.parse(stdout) as { formats?: unknown[] };

    type YTFormat = {
      vcodec?: string;
      acodec?: string;
      ext?: string;
      resolution?: string;
      [key: string]: unknown;
    };

    const formats: YTFormat[] = Array.isArray(info.formats) ? (info.formats as YTFormat[]) : [];

    const filtered = formats
      .filter((f) =>
        (f.vcodec !== 'none' || f.acodec !== 'none') &&
        ['mp4', 'webm'].includes(f.ext || '')
      )
      .sort((a, b) => {
        const resA = parseInt(a.resolution?.split('x')[1] ?? '0') || 0;
        const resB = parseInt(b.resolution?.split('x')[1] ?? '0') || 0;
        return resB - resA;
      });

    return Response.json({ formats: filtered });
  } catch (err: unknown) {
    console.error('Format fetch error:', err);
    const getErrorMessage = (e: unknown): string => {
      if (e instanceof Error) return e.message;
      if (typeof e === 'string') return e;
      try {
        return JSON.stringify(e) ?? 'unknown';
      } catch {
        return 'unknown';
      }
    };
    return new Response(`Failed: ${getErrorMessage(err) || 'unknown'}`, { status: 500 });
  }
}
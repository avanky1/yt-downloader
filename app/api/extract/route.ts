// app/api/extract/route.ts
import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const formatId = request.nextUrl.searchParams.get('format') || 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';

  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return new Response('Invalid YouTube URL', { status: 400 });
  }

  try {
    // Fetch formats first to show options
    const { stdout: infoOut } = await execAsync(
      `yt-dlp --no-warnings --dump-json "${url}"`
    );
    const info = JSON.parse(infoOut);

    // Define a typed shape for formats returned by yt-dlp
    type FormatInfo = {
      format_id?: string;
      ext?: string;
      vcodec?: string;
      resolution?: string;
      filesize?: number | null;
      fps?: number | null;
    };

    // Filter MP4 formats only with a type guard
    const allFormats = (info.formats || []) as unknown[];
    const mp4Formats = allFormats.filter((f): f is FormatInfo => {
      const ff = f as Record<string, unknown>;
      return ff.ext === 'mp4' && ff.vcodec !== 'none';
    });

    // If no MP4, fallback to best
    if (mp4Formats.length === 0) {
      const { stdout } = await execAsync(
        `yt-dlp --no-warnings --get-url -f "best" "${url}"`
      );
      const urls = stdout.trim().split('\n').filter(Boolean);
      return Response.json({
        urls,
        format: 'best',
        note: 'No MP4 available, using best format',
        formats: [],
      });
    }

    // Extract direct URL for selected format
    const { stdout } = await execAsync(
      `yt-dlp --no-warnings --get-url -f "${formatId}" "${url}"`
    );

    const urls = stdout.trim().split('\n').filter(Boolean);

    return Response.json({
      urls,
      format: formatId,
      note: urls.length > 1 ? 'Video and audio separate' : 'Single stream',
      formats: mp4Formats.map((f) => ({
        format_id: f.format_id,
        resolution: f.resolution,
        filesize: f.filesize,
        fps: f.fps,
        ext: f.ext,
      })),
    });
  } catch (err: unknown) {
    console.error('Extraction failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Error: ${message || 'unknown'}`, { status: 500 });
  }
}
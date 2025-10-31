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

    // Filter MP4 formats only
    const mp4Formats = (info.formats || []).filter((f: any) => f.ext === 'mp4' && f.vcodec !== 'none');

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
      formats: mp4Formats.map((f: any) => ({
        format_id: f.format_id,
        resolution: f.resolution,
        filesize: f.filesize,
        fps: f.fps,
        ext: f.ext,
      })),
    });
  } catch (err: any) {
    console.error('Extraction failed:', err);
    return new Response(`Error: ${err.message || 'unknown'}`, { status: 500 });
  }
}
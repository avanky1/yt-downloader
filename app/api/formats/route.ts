// app/api/formats/route.ts
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { access, constants } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = join(__filename, "../../../");
const COOKIES_PATH = join(PROJECT_ROOT, "cookies.txt");

async function hasCookiesFile(): Promise<boolean> {
  try {
    await access(COOKIES_PATH, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`yt-dlp failed: ${stderr || stdout}`));
      }
    });
  });
}

// Extract height from resolution string
function getFormatHeight(format: any): number {
  if (!format.resolution) return 0;
  const match = format.resolution.match(/^(\d+)x(\d+)$/);
  if (match) return parseInt(match[2], 10);
  const pMatch = format.resolution.match(/^(\d+)p$/);
  if (pMatch) return parseInt(pMatch[1], 10);
  return 0;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || (!url.includes("youtube.com") && !url.includes("youtu.be"))) {
    return new Response("Invalid YouTube URL", { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  try {
    const useCookies = await hasCookiesFile();
    const args = [
      ...(useCookies ? ["--cookies", COOKIES_PATH] : []),
      "--no-warnings",
      "--compat-options", "no-youtube-unavailable-videos",
      "--dump-json",
      url,
    ];

    const stdout = await runYtDlp(args);
    const info = JSON.parse(stdout);

    type YTFormat = {
      format_id: string;
      ext: string;
      vcodec?: string;
      acodec?: string;
      resolution?: string;
      filesize?: number;
      [key: string]: unknown;
    };

    const formats: YTFormat[] = Array.isArray(info.formats)
      ? (info.formats as YTFormat[])
      : [];

    // ✅ ONLY combined (video+audio) formats
    // ✅ ONLY MP4 (most compatible)
    // ✅ Exclude fragmented/DASH/HLS
    const filtered = formats
      .filter((f) => {
        // Must have both video and audio
        if (f.vcodec === "none" || f.acodec === "none") return false;
        // Only MP4 (remove if you want WebM)
        if (f.ext !== "mp4") return false;
        // Skip DASH/HLS (fragmented)
        if (f.fps === null || f.tbr === null) return false; // heuristic
        if (f.resolution?.includes("x") === false) return false;
        return true;
      })
      .sort((a, b) => {
        const hA = getFormatHeight(a);
        const hB = getFormatHeight(b);
        return hB - hA; // highest first
      });

    // Dedupe by height
    const seen = new Set<number>();
    const deduped = filtered.filter((f) => {
      const h = getFormatHeight(f);
      if (seen.has(h)) return false;
      seen.add(h);
      return true;
    });

    // Add clean label for frontend
    const withLabels = deduped.map((f) => ({
      ...f,
      label: `${getFormatHeight(f)}p (${f.ext})`,
    }));

    return Response.json({
      title: info.title || "YouTube Video",
      formats: withLabels,
    });
  } catch (err: unknown) {
    console.error("Format fetch error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Failed: ${msg}`, { status: 500 });
  }
}
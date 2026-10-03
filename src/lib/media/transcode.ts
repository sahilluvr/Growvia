import "server-only";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Turns any recorded or uploaded video into the file every social network accepts without surprises:
 * H.264 + AAC MP4, constant 30 fps, even dimensions, and the index ("moov") at the front with the real duration.
 *
 * Why: browsers record in fragments. Chrome's MP4 recordings say "0 seconds" (or only the first fragment) in their
 * header, so Facebook kept just the first few seconds of a 30-second ad, and Instagram rejects WebM outright.
 * Only imported by /api/media/standardize, so the ffmpeg binary ships with that one function.
 */
function ffmpegPath(): string | null {
  const env = process.env.FFMPEG_PATH?.trim();
  if (env && existsSync(env)) return env;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = (require("@ffmpeg-installer/ffmpeg") as { path: string }).path;
    if (p && existsSync(p)) return p;
  } catch { /* not installed for this platform */ }
  return existsSync("/usr/bin/ffmpeg") ? "/usr/bin/ffmpeg" : null;
}

export const transcodeReady = () => Boolean(ffmpegPath());

function run(bin: string, args: string[], timeoutMs: number): Promise<{ code: number; err: string }> {
  return new Promise((res) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err = (err + d.toString()).slice(-8000); });
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.on("close", (code) => { clearTimeout(t); res({ code: code ?? 1, err }); });
    p.on("error", (e) => { clearTimeout(t); res({ code: 1, err: e.message }); });
  });
}

/** "Duration: 00:00:30.07" from ffmpeg's log → seconds. */
export function parseDuration(log: string): number | null {
  const m = [...log.matchAll(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/g)].pop();
  if (!m) return null;
  const s = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number.isFinite(s) && s > 0 ? s : null;
}

/** Decodes the whole input (doesn't trust the header) to find how long the video really is. */
async function realDuration(bin: string, file: string): Promise<number | null> {
  const r = await run(bin, ["-hide_banner", "-i", file, "-map", "0:v:0", "-f", "null", "-"], 60_000);
  const times = [...r.err.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)].pop();
  if (!times) return null;
  return Number(times[1]) * 3600 + Number(times[2]) * 60 + Number(times[3]);
}

export async function transcodeToStandardMp4(input: Buffer, o: { maxSeconds?: number; timeoutMs?: number } = {}): Promise<{ data: Buffer; seconds: number | null; width: number | null; height: number | null }> {
  const bin = ffmpegPath();
  if (!bin) throw new Error("Video conversion isn't available on this server.");
  const dir = await mkdtemp(join(tmpdir(), "gv-video-"));
  const src = join(dir, "in"), out = join(dir, "out.mp4");
  try {
    await writeFile(src, input);
    const args = [
      "-hide_banner", "-y", "-fflags", "+genpts", "-i", src,
      "-map", "0:v:0", "-map", "0:a:0?",
      ...(o.maxSeconds ? ["-t", String(o.maxSeconds)] : []),
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30,format=yuv420p",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-profile:v", "high", "-level", "4.1", "-g", "60",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
      "-movflags", "+faststart", "-max_muxing_queue_size", "1024",
      out,
    ];
    const r = await run(bin, args, o.timeoutMs ?? 240_000);
    if (r.code !== 0 || !existsSync(out)) throw new Error(`Couldn't convert the video${/Invalid data|moov atom not found/i.test(r.err) ? " — the file looks damaged. Export it again." : "."}`);
    const data = await readFile(out);
    const seconds = (await realDuration(bin, out)) ?? parseDuration(r.err);
    const size = r.err.match(/Stream #\d+:\d+.*Video:.*?(\d{2,5})x(\d{2,5})/g)?.pop()?.match(/(\d{2,5})x(\d{2,5})/);
    return { data, seconds, width: size ? Number(size[1]) : null, height: size ? Number(size[2]) : null };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

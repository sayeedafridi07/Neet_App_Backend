import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const getAudioDuration = async (
  filePath: string,
): Promise<number> => {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  const duration = Number.parseFloat(stdout.trim());

  if (!Number.isFinite(duration)) {
    throw new Error("Unable to determine audio duration");
  }

  return Math.round(duration);
};
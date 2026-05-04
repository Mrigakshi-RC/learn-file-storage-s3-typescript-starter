import type { ApiConfig } from "./config";
import type { Video } from "./db/videos";

export async function getVideoAspectRatio(filePath: string) {
    const proc = Bun.spawn(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', filePath], { stdout: "pipe", stderr: "pipe" });
    const exitCode = await proc.exited;
    const stdoutText = await new Response(proc.stdout).text();
    const stderrText = await new Response(proc.stderr).text();
    if (exitCode !== 0) {
        throw new Error(stderrText)
    }
    const { width, height } = (JSON.parse(stdoutText))["streams"][0]
    const ratio = width / height
    if (ratio >= 1.7 && ratio <= 1.8) return "landscape"
    if (ratio >= 0.55 && ratio <= 0.6) return "portrait"
    return "other"
}

export async function processVideoForFastStart(inputFilePath: string) {
    const outputFilePath = inputFilePath + ".processed";
    const proc = Bun.spawn(["ffmpeg", "-i", inputFilePath, "-movflags", "faststart", "-map_metadata", "0", "-codec", "copy", "-f", "mp4", outputFilePath], { stdout: "pipe", stderr: "pipe" })
    const exitCode = await proc.exited;
    const stdoutText = await new Response(proc.stdout).text();
    const stderrText = await new Response(proc.stderr).text();
    if (exitCode !== 0) {
        throw new Error(stderrText)
    }
    return outputFilePath;
}

function generatePresignedURL(cfg: ApiConfig, key: string, expireTime: number) {
    const presignedUrl = cfg.s3Client.presign(key, { expiresIn: expireTime });
    return presignedUrl;
}

export function dbVideoToSignedVideo(cfg: ApiConfig, video: Video) {
    if (!video.videoURL) return video;
    const key = video.videoURL;
    const signedUrl = generatePresignedURL(cfg, key, 3600);

    return {
        ...video,
        videoURL: signedUrl,
    };
}
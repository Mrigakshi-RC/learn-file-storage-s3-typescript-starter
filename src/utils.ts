export async function getVideoAspectRatio(filePath: string) {
    const proc = Bun.spawn(['ffprobe','-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', filePath], { stdout: "pipe", stderr: "pipe" });
    const exitCode=await proc.exited;
    const stdoutText = await new Response(proc.stdout).text();
    const stderrText = await new Response(proc.stderr).text();
    if (exitCode !== 0) {
        throw new Error(stderrText)
    }
    const { width, height } = (JSON.parse(stdoutText))["streams"][0]
    const ratio=width/height
    if(ratio>=1.7 && ratio<=1.8) return "landscape"
    if(ratio>=0.55 && ratio<=0.6) return "portrait"
    return "other"
}
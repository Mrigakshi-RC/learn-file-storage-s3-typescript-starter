import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import { S3Client, type BunRequest } from "bun";
import { BadRequestError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { MAX_UPLOAD_SIZE } from "../constants";
import { saveVideoFile } from "./thumbnails";
import { join } from "path";
import { 
  // dbVideoToSignedVideo, 
  getVideoAspectRatio, processVideoForFastStart } from "../utils";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }
  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);
  const videoMetadata = getVideo(cfg.db, videoId);

  if (userID !== videoMetadata?.userID)
    throw new UserForbiddenError("Action not allowed");

  const formData = await req.formData();
  const file = formData.get("video");
  if (!(file instanceof File)) {
    throw new BadRequestError("Video file missing");
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File size exceeds max-upload limit");
  }
  const mediaType = file.type;
  if (mediaType !== "video/mp4")
    throw new BadRequestError("Please choose mp4 files only")

  const arrBuffer = await file.arrayBuffer();
  let filePath = await saveVideoFile(arrBuffer, mediaType)
  const tempFilePath = join(cfg.assetsRoot, `${filePath}`)
  const processedFilePath = await processVideoForFastStart(tempFilePath)
  const aspectRatio = await getVideoAspectRatio(processedFilePath)
  filePath = `${aspectRatio}/${filePath}`

  const fileContents = Bun.file(processedFilePath);
  await cfg.s3Client.write(filePath, fileContents, { type: mediaType })

  const cloudfrontUrl=`https://${cfg.s3CfDistribution}/${filePath}`
  updateVideo(cfg.db, { ...videoMetadata, videoURL: cloudfrontUrl })
  // const signedVideo = dbVideoToSignedVideo(cfg, { 
  //   ...videoMetadata, 
  //   videoURL: filePath 
  // });

  return respondWithJSON(200, videoMetadata);
}

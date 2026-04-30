import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import { cfg, type ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { MAX_UPLOAD_SIZE } from "../constants";
import { join } from "path";
import { randomBytes } from "crypto";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

async function saveVideoFile(arrBuffer: ArrayBuffer, mediaType: string) {
  const fileName = randomBytes(32).toString("base64url");
  const extension = mediaType.split("/")[1];
  const filePath = join(cfg.assetsRoot, `${fileName}.${extension}`);
  await Bun.write(filePath, arrBuffer);

  return `${fileName}.${extension}`;
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) {
    throw new BadRequestError("Thumbnail file missing");
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File size exceeds max-upload limit");
  }
  const mediaType = file.type;
  if (mediaType !== "image/jpeg" && mediaType !== "image/png")
    throw new BadRequestError("Please choose jpeg and png files only")

  const arrBuffer = await file.arrayBuffer();
  const filePath = await saveVideoFile(arrBuffer, mediaType)

  const videoMetadata = getVideo(cfg.db, videoId);
  if (userID !== videoMetadata?.userID)
    throw new UserForbiddenError('Forbidden action')

  const thumbnailURL = `http://localhost:8091/assets/${filePath}`
  updateVideo(cfg.db, { ...videoMetadata, thumbnailURL })

  return respondWithJSON(200, videoMetadata);
}

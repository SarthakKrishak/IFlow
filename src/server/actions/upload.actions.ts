"use server";

import { createHash } from "node:crypto";
import { auth } from "@/lib/auth";

export type UploadSignature =
  | {
      success: true;
      data: { cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string; allowedFormats: string };
    }
  | { success: false; error: string };

const FOLDER = "iflow/attachments";
const ALLOWED_FORMATS = "png,jpg,jpeg,gif,webp";

/**
 * Short-lived signature for a direct browser → Cloudinary image upload.
 * The file never passes through our server (no body-size limits), and the secret never leaves it.
 * Only signed-in users can get one; uploads are pinned to one folder and to image formats.
 */
export async function getImageUploadSignature(): Promise<UploadSignature> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sign in to attach images" };

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    return { success: false, error: "Image uploads aren't set up yet — an admin needs to add the Cloudinary keys." };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary signs the alphabetically-sorted params (excluding file, api_key, resource_type) + the secret.
  const toSign = `allowed_formats=${ALLOWED_FORMATS}&folder=${FOLDER}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");

  return { success: true, data: { cloudName, apiKey, timestamp, signature, folder: FOLDER, allowedFormats: ALLOWED_FORMATS } };
}

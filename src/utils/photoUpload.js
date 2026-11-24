const fs = require("fs");
const path = require("path");

const UPLOAD_ROOT = path.resolve(__dirname, "../../storage/uploads");
const PHOTO_DIR = path.join(UPLOAD_ROOT, "photos");

// Ensure photo directory exists
if (!fs.existsSync(PHOTO_DIR)) {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Parses multipart/form-data for photo uploads or JSON body with base64 data.
 * Places the result in req.photo:
 * {
 *   url: string, // URL path to access the photo e.g. "/uploads/photos/photo-xyz.jpg" or data: URL
 *   filePath: string | null,
 * }
 */
function handlePhotoUpload(req, res, next) {
  const contentType = req.headers["content-type"] || "";

  // 1. If it's multipart/form-data (Frontend sends FormData with 'photo')
  if (contentType.startsWith("multipart/form-data")) {
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Invalid multipart request: boundary missing",
      });
    }

    const boundary = match[1] || match[2];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

    const chunks = [];
    let totalBytes = 0;

    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_PHOTO_BYTES) {
        req.destroy();
        return res.status(413).json({
          success: false,
          message: "Uploaded photo exceeds 5MB limit",
        });
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const buffer = Buffer.concat(chunks);
        const parts = splitBuffer(buffer, boundaryBuffer);

        for (const part of parts) {
          if (part.equals(endBoundaryBuffer) || part.length === 0) continue;

          // Find header boundary (\r\n\r\n)
          const headerEndIndex = part.indexOf("\r\n\r\n");
          if (headerEndIndex === -1) continue;

          const headerText = part.slice(0, headerEndIndex).toString("utf-8");
          let bodyBuffer = part.slice(headerEndIndex + 4);

          // Strip trailing CRLF
          if (bodyBuffer.slice(-2).toString() === "\r\n") {
            bodyBuffer = bodyBuffer.slice(0, -2);
          }

          const dispositionMatch = headerText.match(
            /Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i
          );
          if (!dispositionMatch) continue;

          const fieldName = dispositionMatch[1];
          const originalFilename = dispositionMatch[2];

          if (fieldName === "photo" || fieldName === "profile_image" || fieldName === "file") {
            const ext = originalFilename
              ? path.extname(originalFilename).toLowerCase()
              : ".jpg";
            const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";

            // Verify file signature magic bytes for JPEG / PNG / WebP
            const isJpeg = bodyBuffer.length >= 3 && bodyBuffer[0] === 0xFF && bodyBuffer[1] === 0xD8 && bodyBuffer[2] === 0xFF;
            const isPng = bodyBuffer.length >= 8 && bodyBuffer[0] === 0x89 && bodyBuffer[1] === 0x50 && bodyBuffer[2] === 0x4E && bodyBuffer[3] === 0x47;
            const isWebp = bodyBuffer.length >= 12 && bodyBuffer.slice(0, 4).toString() === "RIFF" && bodyBuffer.slice(8, 12).toString() === "WEBP";

            if (!isJpeg && !isPng && !isWebp) {
              return res.status(400).json({
                success: false,
                message: "Invalid file type. Please upload a valid JPG, PNG, or WebP photo.",
              });
            }

            const filename = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${safeExt}`;
            const targetPath = path.join(PHOTO_DIR, filename);

            fs.writeFileSync(targetPath, bodyBuffer);

            req.photo = {
              url: `/uploads/photos/${filename}`,
              filePath: targetPath,
            };
            return next();
          }
        }

        // No photo field found in multipart
        return res.status(400).json({
          success: false,
          message: "No photo file found in request form data",
        });
      } catch (err) {
        console.error("Photo upload parsing error:", err);
        return res.status(500).json({
          success: false,
          message: "Error processing photo upload",
        });
      }
    });

    req.on("error", (err) => {
      console.error("Photo upload stream error:", err);
      return res.status(500).json({
        success: false,
        message: "Error receiving photo data",
      });
    });

    return;
  }

  // 2. If it's standard JSON body with base64 photo
  const bodyPhoto =
    req.body?.photo ||
    req.body?.profile_image ||
    req.body?.avatar_url ||
    req.body?.profile_photo ||
    req.body?.image;

  if (bodyPhoto) {
    req.photo = {
      url: bodyPhoto,
      filePath: null,
    };
  }

  return next();
}

function splitBuffer(buffer, delimiter) {
  const parts = [];
  let start = 0;
  let index;

  while ((index = buffer.indexOf(delimiter, start)) !== -1) {
    if (index > start) {
      parts.push(buffer.slice(start, index));
    }
    start = index + delimiter.length;
  }

  if (start < buffer.length) {
    parts.push(buffer.slice(start));
  }

  return parts;
}

module.exports = {
  handlePhotoUpload,
  PHOTO_DIR,
  UPLOAD_ROOT,
};

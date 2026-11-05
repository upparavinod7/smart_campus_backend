const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { scanFileBuffer } = require("./virusScanner");

const STORAGE_DIR = path.resolve(__dirname, "../../storage/materials");
const MAX_UPLOAD_SIZE_BYTES =
  (parseInt(process.env.ACADEMIC_MAX_UPLOAD_SIZE_MB, 10) || 50) * 1024 * 1024;

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

/**
 * Parses multipart/form-data request streams natively using Node.js buffers.
 */
function parseMultipartFormData(options = {}) {
  const maxBytes = options.maxSizeBytes || MAX_UPLOAD_SIZE_BYTES;
  const targetDir = options.targetDir || STORAGE_DIR;

  return async (req, res, next) => {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.startsWith("multipart/form-data")) {
      return next();
    }

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
      if (totalBytes > maxBytes) {
        req.destroy();
        return res.status(413).json({
          success: false,
          message: `Uploaded file exceeds size limit of ${Math.round(maxBytes / 1024 / 1024)}MB`,
        });
      }
      chunks.push(chunk);
    });

    req.on("end", async () => {
      try {
        const fullBuffer = Buffer.concat(chunks);
        req.body = req.body || {};
        req.files = req.files || {};

        let searchPos = 0;

        while (searchPos < fullBuffer.length) {
          const boundaryIdx = fullBuffer.indexOf(boundaryBuffer, searchPos);
          if (boundaryIdx === -1) break;

          const startOfPart = boundaryIdx + boundaryBuffer.length;

          // Check if this is the final boundary
          if (
            fullBuffer.slice(boundaryIdx, boundaryIdx + endBoundaryBuffer.length).equals(endBoundaryBuffer)
          ) {
            break;
          }

          // Move past CRLF after boundary
          let contentStart = startOfPart;
          if (fullBuffer[contentStart] === 13 && fullBuffer[contentStart + 1] === 10) {
            contentStart += 2;
          }

          // Next boundary marks the end of this part
          const nextBoundaryIdx = fullBuffer.indexOf(boundaryBuffer, contentStart);
          if (nextBoundaryIdx === -1) break;

          // The part content ends before the CRLF preceding the next boundary
          let contentEnd = nextBoundaryIdx;
          if (fullBuffer[contentEnd - 2] === 13 && fullBuffer[contentEnd - 1] === 10) {
            contentEnd -= 2;
          }

          const partBuffer = fullBuffer.slice(contentStart, contentEnd);
          searchPos = nextBoundaryIdx;

          // Separate headers from body (separated by \r\n\r\n = 0x0D 0x0A 0x0D 0x0A)
          const headerEndIdx = partBuffer.indexOf(Buffer.from("\r\n\r\n"));
          if (headerEndIdx === -1) continue;

          const headerStr = partBuffer.slice(0, headerEndIdx).toString("utf8");
          const bodyBuffer = partBuffer.slice(headerEndIdx + 4);

          // Parse Content-Disposition
          const dispMatch = headerStr.match(/content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);
          if (!dispMatch) continue;

          const fieldName = dispMatch[1];
          const fileName = dispMatch[2];

          if (fileName) {
            // It's a file
            const ctMatch = headerStr.match(/content-type:\s*([^\r\n;]+)/i);
            const mimeType = ctMatch ? ctMatch[1].trim() : "application/octet-stream";

            // Run virus scanner
            const scanResult = await scanFileBuffer(bodyBuffer, fileName, mimeType);
            if (scanResult.status === "INFECTED") {
              return res.status(400).json({
                success: false,
                message: `Uploaded file rejected by security scanner: ${scanResult.reason}`,
              });
            }

            const ext = path.extname(fileName) || "";
            const safeName = `${Date.now()}_${crypto.randomUUID()}${ext}`;
            const targetPath = path.join(targetDir, safeName);

            fs.writeFileSync(targetPath, bodyBuffer);

            const fileInfo = {
              fieldname: fieldName,
              originalname: fileName,
              filename: safeName,
              path: targetPath,
              mimetype: mimeType,
              size: bodyBuffer.length,
              buffer: bodyBuffer,
              virus_scan_status: scanResult.status,
            };

            req.files[fieldName] = req.files[fieldName] || [];
            req.files[fieldName].push(fileInfo);
            req.file = fileInfo;
          } else {
            // Regular form text field
            const fieldValue = bodyBuffer.toString("utf8");
            req.body[fieldName] = fieldValue;
          }
        }

        next();
      } catch (err) {
        console.error("[MultipartParser] Error parsing payload:", err);
        return res.status(400).json({
          success: false,
          message: "Failed to parse form-data payload",
          error: err.message,
        });
      }
    });

    req.on("error", (err) => {
      console.error("[MultipartParser] Stream error:", err);
      return res.status(500).json({
        success: false,
        message: "File upload stream failed",
      });
    });
  };
}

module.exports = {
  parseMultipartFormData,
  STORAGE_DIR,
};


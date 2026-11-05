const fs = require("fs");

/**
 * Text extractor utility to prepare materials for search and future ML integration
 */
async function extractTextFromMaterial({ type, fileRef, contentText, description }) {
  try {
    if (type === "Notes" || type === "Link") {
      return (contentText || description || "").trim();
    }

    if (fileRef && fs.existsSync(fileRef)) {
      const stats = fs.statSync(fileRef);
      if (stats.size > 20 * 1024 * 1024) {
        // Skip excessively large binaries from in-memory string extraction
        return `[Indexed Binary Asset: ${type}] - Size: ${stats.size} bytes`;
      }

      const buffer = fs.readFileSync(fileRef);
      // Extract ASCII/printable strings for basic indexing and search
      const printable = buffer
        .toString("binary")
        .replace(/[^\x20-\x7E\t\r\n]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const summary = printable.length > 5000 ? printable.substring(0, 5000) + "..." : printable;
      return summary || description || `[Uploaded ${type}]`;
    }

    return description || "";
  } catch (err) {
    console.warn("[TextExtractor] Extraction error:", err.message);
    return description || "";
  }
}

module.exports = {
  extractTextFromMaterial,
};


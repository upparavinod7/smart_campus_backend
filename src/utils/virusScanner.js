/**
 * Virus Scanner Abstraction Hook
 * Inspects uploaded file buffers or paths.
 * Returns { status: 'CLEAN' } or { status: 'INFECTED', reason: '...' }
 */
async function scanFileBuffer(buffer, filename = "", mimeType = "") {
  try {
    if (!buffer || buffer.length === 0) {
      return { status: "CLEAN" };
    }

    // Inspect first 2KB for executable signatures (ELF, MZ / PE) if not supposed to be binary
    if (buffer.length >= 4) {
      // MZ header for Windows executables (MZ = 0x4D 0x5A)
      if (buffer[0] === 0x4d && buffer[1] === 0x5a && !mimeType.includes("executable")) {
        return {
          status: "INFECTED",
          reason: "Suspicious executable binary signature (MZ header) detected",
        };
      }
      // ELF header for Linux binaries (0x7F 'E' 'L' 'F')
      if (
        buffer[0] === 0x7f &&
        buffer[1] === 0x45 &&
        buffer[2] === 0x4c &&
        buffer[3] === 0x46 &&
        !mimeType.includes("executable")
      ) {
        return {
          status: "INFECTED",
          reason: "Suspicious ELF binary signature detected",
        };
      }
    }

    // Check for obvious script injection in raw text/PDF metadata
    const sample = buffer.slice(0, 4096).toString("utf8");
    if (sample.includes("<?php") || sample.includes("<%eval") || sample.includes("/Launch /Action")) {
      return {
        status: "INFECTED",
        reason: "Suspicious embedded active payload or shell injection pattern",
      };
    }

    return { status: "CLEAN" };
  } catch (err) {
    console.error("[VirusScanner] Error during scan:", err.message);
    return { status: "SKIPPED", reason: err.message };
  }
}

module.exports = {
  scanFileBuffer,
};


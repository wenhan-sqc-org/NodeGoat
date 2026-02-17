"use strict";

/**
 * Scan status enum
 */
const ScanStatus = Object.freeze({
    QUEUED: "Queued",
    SCANNING: "Scanning",
    FINISHED: "Finished",
    FAILED: "Failed"
});

module.exports = { ScanStatus };


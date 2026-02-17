"use strict";

/**
 * Vulnerability severity levels
 * Matches Trivy severity levels
 */
const Severity = Object.freeze({
    CRITICAL: "CRITICAL",
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
    UNKNOWN: "UNKNOWN"
});

module.exports = { Severity };


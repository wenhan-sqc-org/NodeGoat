"use strict";

const { ScanStatus, ScannerType } = require("./enums");

/**
 * Scan model - represents a security scan entity
 */
class ScanModel {
    constructor(data = {}) {
        this.scanId = data.scanId || null;
        this.repoUrl = data.repoUrl || null;
        this.status = data.status || ScanStatus.QUEUED;
        this.scanner = data.scanner || ScannerType.TRIVY;
        // ...existing code...
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.criticalVulnerabilities = data.criticalVulnerabilities || [];
        this.error = data.error || null;
    }

    /**
     * Check if scan is in active state
     * @returns {boolean}
     */
    isActive() {
        return this.status === ScanStatus.QUEUED || this.status === ScanStatus.SCANNING;
    }

    /**
     * Check if scan is finished
     * @returns {boolean}
     */
    isFinished() {
        return this.status === ScanStatus.FINISHED;
    }

    /**
     * Check if scan has failed
     * @returns {boolean}
     */
    isFailed() {
        return this.status === ScanStatus.FAILED;
    }

    /**
     * Convert to plain object for database storage
     * @returns {Object}
     */
    toDocument() {
        return {
            scanId: this.scanId,
            repoUrl: this.repoUrl,
            status: this.status,
            scanner: this.scanner,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            criticalVulnerabilities: this.criticalVulnerabilities,
            error: this.error
        };
    }

    /**
     * Convert to API response format
     * @returns {Object}
     */
    toResponse() {
        const response = {
            scanId: this.scanId,
            repoUrl: this.repoUrl,
            status: this.status,
            scanner: this.scanner,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            criticalVulnerabilities: this.criticalVulnerabilities
        };

        if (this.error) {
            response.error = this.error;
        }

        return response;
    }

    /**
     * Create ScanModel instance from database document
     * @param {Object} doc - MongoDB document
     * @returns {ScanModel}
     */
    static fromDocument(doc) {
        if (!doc) return null;
        return new ScanModel(doc);
    }
}

module.exports = { ScanModel, ScanStatus, ScannerType };


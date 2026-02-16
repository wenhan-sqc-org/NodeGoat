"use strict";

const { v4: uuidv4 } = require("uuid");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { parser } = require("stream-json");
const { pick } = require("stream-json/filters/Pick");
const { streamArray } = require("stream-json/streamers/StreamArray");
const { chain } = require("stream-chain");

/* The ScanHandler must be constructed with a connected db */
function ScanHandler(db) {
    const scansCollection = db.collection("scans");
    const SCAN_DIR = "/tmp/scans";

    // Ensure scan directory exists
    if (!fs.existsSync(SCAN_DIR)) {
        fs.mkdirSync(SCAN_DIR, { recursive: true });
    }

    /**
     * Update scan status in database
     */
    const updateScanStatus = (scanId, status, additionalData = {}) => {
        scansCollection.updateOne(
            { scanId: scanId },
            {
                $set: {
                    status: status,
                    updatedAt: new Date(),
                    ...additionalData
                }
            },
            (err) => {
                if (err) {
                    console.error(`Error updating scan ${scanId}:`, err);
                }
            }
        );
    };

    /**
     * Process Trivy JSON output using streams (memory efficient)
     * IMPORTANT: We use streams to avoid loading entire JSON into memory
     * Trivy JSON structure: { Results: [ { Target: "...", Vulnerabilities: [...] }, ... ] }
     */
    const processTrivyResults = (scanId, jsonFilePath) => {
        const criticalVulnerabilities = [];

        const pipeline = chain([
            fs.createReadStream(jsonFilePath),
            parser(),
            pick({ filter: "Results" }),
            streamArray()
        ]);

        pipeline.on("data", ({ value }) => {
            // Each value is a Result object with Target and Vulnerabilities
            if (value && value.Vulnerabilities && Array.isArray(value.Vulnerabilities)) {
                value.Vulnerabilities.forEach((vuln) => {
                    if (vuln.Severity === "CRITICAL") {
                        criticalVulnerabilities.push({
                            vulnerabilityId: vuln.VulnerabilityID,
                            pkgName: vuln.PkgName,
                            installedVersion: vuln.InstalledVersion,
                            fixedVersion: vuln.FixedVersion,
                            title: vuln.Title,
                            severity: vuln.Severity
                        });
                    }
                });
            }
        });

        pipeline.on("end", () => {
            console.log(`Scan ${scanId} completed. Found ${criticalVulnerabilities.length} critical vulnerabilities.`);
            updateScanStatus(scanId, "Finished", { criticalVulnerabilities });

            // Cleanup: remove JSON file
            fs.unlink(jsonFilePath, (err) => {
                if (err) console.error(`Error deleting ${jsonFilePath}:`, err);
            });
        });

        pipeline.on("error", (err) => {
            console.error(`Error processing results for scan ${scanId}:`, err);
            updateScanStatus(scanId, "Failed", { error: err.message });
        });
    };

    /**
     * Check if running inside Docker
     */
    const isRunningInDocker = () => {
        try {
            return fs.existsSync("/.dockerenv");
        } catch (err) {
            return false;
        }
    };

    /**
     * Run Trivy scan in background
     */
    const runTrivyScan = (scanId, repoUrl) => {
        const jsonFilePath = path.join(SCAN_DIR, `${scanId}.json`);

        updateScanStatus(scanId, "Scanning");

        let trivy;

        if (isRunningInDocker()) {
            // Running inside Docker - Trivy is installed directly in the container
            trivy = spawn("trivy", [
                "repo", repoUrl,
                "--format", "json",
                "--output", jsonFilePath,
                "--scanners", "vuln"
            ]);
        } else {
            // Running locally - use docker run with Trivy image
            trivy = spawn("docker", [
                "run", "--rm",
                "-v", `${SCAN_DIR}:/tmp/scans`,
                "aquasec/trivy:latest",
                "repo", repoUrl,
                "--format", "json",
                "--output", `/tmp/scans/${scanId}.json`,
                "--scanners", "vuln"
            ]);
        }

        let stderrData = "";

        trivy.stderr.on("data", (data) => {
            stderrData += data.toString();
            console.log(`Trivy stderr: ${data}`);
        });

        trivy.on("close", (code) => {
            if (code !== 0) {
                console.error(`Trivy exited with code ${code}`);
                updateScanStatus(scanId, "Failed", { error: stderrData });
                return;
            }

            console.log(`Trivy scan completed for ${scanId}, processing results...`);

            // Process results using streams
            processTrivyResults(scanId, jsonFilePath);
        });

        trivy.on("error", (err) => {
            console.error(`Failed to start Trivy:`, err);
            updateScanStatus(scanId, "Failed", { error: err.message });
        });
    };

    /**
     * POST /api/scan
     * Accepts a GitHub repository URL and creates a new scan job
     */
    this.handleScanRequest = (req, res) => {
        const { repoUrl } = req.body;

        // Validate input
        if (!repoUrl) {
            return res.status(400).json({
                error: "Missing required field: repoUrl"
            });
        }

        // Basic GitHub URL validation
        const githubUrlPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/;
        if (!githubUrlPattern.test(repoUrl)) {
            return res.status(400).json({
                error: "Invalid GitHub repository URL"
            });
        }

        // Check if a scan for this repo is already in progress
        scansCollection.findOne({ repoUrl: repoUrl, status: { $in: ["Queued"] } }, (err, existingScan) => {
            if (err) {
                console.error("Error checking existing scans:", err);
                return res.status(500).json({
                    error: "Ups!!! Huston we have a problem"
                });
            }

            if (existingScan) {
                return res.status(409).json({
                    error: "A scan for this repository is already in progress",
                    scanId: existingScan.scanId,
                    status: existingScan.status
                });
            }
        });

        // Create scan record
        const scanId = uuidv4();
        const scan = {
            scanId: scanId,
            repoUrl: repoUrl,
            status: "Queued",
            createdAt: new Date(),
            updatedAt: new Date(),
            criticalVulnerabilities: []
        };

        // Save to database
        scansCollection.insertOne(scan, (err) => {
            if (err) {
                console.error("Error creating scan:", err);
                return res.status(500).json({
                    error: "Internal server error"
                });
            }

            // Trigger background Trivy scan
            runTrivyScan(scanId, repoUrl);

            return res.status(202).json({
                scanId: scanId,
                status: "Queued"
            });
        });
    };

    /**
     * GET /api/scan/:scanId
     * Returns the status and results of a scan
     */
    this.getScanStatus = (req, res) => {
        const { scanId } = req.params;

        scansCollection.findOne({ scanId: scanId }, (err, scan) => {
            if (err) {
                console.error("Error getting scan status:", err);
                return res.status(500).json({
                    error: "Internal server error"
                });
            }

            if (!scan) {
                return res.status(404).json({
                    error: "Scan not found"
                });
            }

            return res.status(200).json({
                scanId: scan.scanId,
                repoUrl: scan.repoUrl,
                status: scan.status,
                createdAt: scan.createdAt,
                updatedAt: scan.updatedAt,
                criticalVulnerabilities: scan.criticalVulnerabilities
            });
        });
    };
}

module.exports = ScanHandler;

"use strict";

const { v4: uuidv4 } = require("uuid");
const { spawn } = require("child_process");
const fs = require("fs");
const fsPromises = require("fs").promises;
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
    const updateScanStatus = async (scanId, status, additionalData = {}) => {
        try {
            await scansCollection.updateOne(
                { scanId: scanId },
                {
                    $set: {
                        status: status,
                        updatedAt: new Date(),
                        ...additionalData
                    }
                }
            );
        } catch (err) {
            console.error(`updateScanStatus => Error updating scan ${scanId}:`, err);
        }
    };

    /**
     * Process Trivy JSON output using streams (memory efficient)
     * IMPORTANT: We use streams to avoid loading entire JSON into memory
     * Trivy JSON structure: { Results: [ { Target: "...", Vulnerabilities: [...] }, ... ] }
     */
    const processTrivyResults = (scanId, jsonFilePath) => {
        return new Promise((resolve, reject) => {
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
                console.log(
                    `processTrivyResults => Scan ${scanId} completed. 
                    Found ${criticalVulnerabilities.length} critical vulnerabilities.`
                );
                resolve(criticalVulnerabilities);
            });

            pipeline.on("error", (err) => {
                console.error(`processTrivyResults => Error processing results for scan ${scanId}:`, err);
                reject(err);
            });
        });
    };

    /**
     * Run Trivy scan in background
     */
    const runTrivyScan = async (scanId, repoUrl) => {
        const jsonFilePath = path.join(SCAN_DIR, `${scanId}.json`);

        try {
            await updateScanStatus(scanId, "Scanning");

            // Run Trivy and wait for completion
            await new Promise((resolve, reject) => {
                let trivyProcess = spawn("trivy", [
                    "repo", repoUrl,
                    "--format", "json",
                    "--output", jsonFilePath,
                    "--scanners", "vuln"
                ]);

                trivyProcess.stderr.on("data", (data) => {
                    const stderrData = data.toString();
                    console.log(`runTrivyScan =>  Trivy stderr: ${stderrData}`);
                });

                trivyProcess.on("close", (code) => {
                    if (code !== 0) {
                        reject(new Error(`runTrivyScan => Trivy exited with code ${code}`));
                    } else {
                        resolve();
                    }
                });

                trivyProcess.on("error", (err) => {
                    console.error(`runTrivyScan => Error processing results for scan ${scanId}:`, err);
                    reject(err);
                });
            });

            console.log(`runTrivyScan => Trivy scan completed for ${scanId}, processing results...`);

            // Process results using streams
            const criticalVulnerabilities = await processTrivyResults(scanId, jsonFilePath);
            await updateScanStatus(scanId, "Finished", { criticalVulnerabilities });

            // Cleanup: remove JSON file
            try {
                await fsPromises.unlink(jsonFilePath);
            } catch (err) {
                console.error(`runTrivyScan => Error deleting ${jsonFilePath}:`, err);
            }

        } catch (err) {
            console.error(`Failed to run Trivy scan for ${scanId}:`, err);
            await updateScanStatus(scanId, "Failed", { error: err.message });
        }
    };

    /**
     * POST /api/scan
     * Accepts a GitHub repository URL and creates a new scan job
     */
    this.handleScanRequest = async (req, res) => {
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

        try {
            // Check if a scan for this repo is already in progress
            const existingScan = await scansCollection.findOne({
                repoUrl: repoUrl,
                status: { $in: ["Queued", "Scanning"] }
            });

            if (existingScan) {
                return res.status(409).json({
                    error: "A scan for this repository is already in progress",
                    scanId: existingScan.scanId,
                    status: existingScan.status
                });
            }

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
            await scansCollection.insertOne(scan);

            // Trigger background Trivy scan (non-blocking)
            runTrivyScan(scanId, repoUrl);

            return res.status(202).json({
                scanId: scanId,
                status: "Queued"
            });

        } catch (err) {
            console.error("handleScanRequest = > Error creating scan:", err);
            return res.status(500).json({
                error: "Internal server error"
            });
        }
    };

    /**
     * GET /api/scan/:scanId
     * Returns the status and results of a scan
     */
    this.getScanStatus = async (req, res) => {
        const { scanId } = req.params;

        try {
            const scan = await scansCollection.findOne({ scanId: scanId });

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

        } catch (err) {
            console.error("getScanStatus => Error getting scan status:", err);
            return res.status(500).json({
                error: "Internal server error"
            });
        }
    };
}

module.exports = ScanHandler;

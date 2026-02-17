"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const { parser } = require("stream-json");
const { pick } = require("stream-json/filters/Pick");
const { streamArray } = require("stream-json/streamers/StreamArray");
const { chain } = require("stream-chain");

const BaseScanWorker = require("./base.scan.worker");
const { VulnerabilityDTO } = require("../dto");
const { Severity } = require("../enums");

const SCAN_DIR = "/tmp/scans";

// Ensure scan directory exists
if (!fs.existsSync(SCAN_DIR)) {
    fs.mkdirSync(SCAN_DIR, { recursive: true });
}

/**
 * Trivy scanner implementation
 */
class TrivyScanWorker extends BaseScanWorker {
    constructor() {
        super("trivy");
    }

    /**
     * Execute Trivy scan on a repository
     * @param {string} scanId - Unique scan identifier
     * @param {string} repoUrl - GitHub repository URL
     * @returns {Promise<string>} - Path to the JSON results file
     */
    async executeScan(scanId, repoUrl) {
        const jsonFilePath = path.join(SCAN_DIR, `${scanId}.json`);

        await new Promise((resolve, reject) => {
            const trivyProcess = spawn("trivy", [
                "repo", repoUrl,
                "--format", "json",
                "--output", jsonFilePath,
                "--scanners", "vuln"
            ]);

            trivyProcess.stderr.on("data", (data) => {
                console.log(`[TrivyScanWorker#executeScan] stderr: ${data.toString()}`);
                // TODO: If ew need to log output, or send to Kafka etc
            });

            trivyProcess.on("close", (code) => {
                if (code !== 0) { // If Trivy exits with non-zero code, consider it a failure
                    return reject(new Error(`Trivy exited with code ${code}`));
                }

                resolve();
            });

            trivyProcess.on("error", (err) => {
                console.error(`[TrivyScanWorker#executeScan] Process error:`, err);
                reject(err);
            });
        });

        return jsonFilePath;
    }

    /**
     * Process Trivy scan results using streams
     * @param {string} jsonFilePath - Path to the Trivy JSON output
     * @param {string} severityFilter - Severity level to filter (default: CRITICAL)
     * @returns {Promise<Array>} - Array of filtered vulnerabilities
     */
    async processResults(jsonFilePath, severityFilter = Severity.CRITICAL) {
        return new Promise((resolve, reject) => {
            const filteredVulnerabilities = [];

            const pipeline = chain([
                fs.createReadStream(jsonFilePath),
                parser(),
                pick({ filter: "Results" }),
                streamArray()
            ]);

            pipeline.on("data", ({ value }) => {
                if (value && value.Vulnerabilities && Array.isArray(value.Vulnerabilities)) {
                    value.Vulnerabilities.forEach((vuln) => {
                        if (vuln.Severity === severityFilter) {

                            // Lets assume that we store critical vulnerabilities in memory
                            // Also possible to stream them to Kafka or store in DB directly from here if needed
                            // Another way use event emitter to send them one by one to the service layer,
                            // but for simplicity we will just collect them in an array and return at the end of stream

                            filteredVulnerabilities.push(VulnerabilityDTO.fromTrivy(vuln, this.name));
                        }
                    });
                }
            });

            pipeline.on("end", () => {
                console.log(`[TrivyScanWorker] Found ${filteredVulnerabilities.length} ${severityFilter} vulnerabilities`);
                resolve(filteredVulnerabilities);
            });

            pipeline.on("error", (err) => {
                console.error(`[TrivyScanWorker] Error processing results:`, err);
                reject(err);
            });
        });
    }

    /**
     * Cleanup temporary files after scan
     * @param {string} jsonFilePath - Path to the JSON file to delete
     */
    async cleanup(jsonFilePath) {
        try {
            await fsPromises.unlink(jsonFilePath);
            console.log(`[TrivyScanWorker] Cleaned up ${jsonFilePath}`);
        } catch (err) {
            console.error(`[TrivyScanWorker] Error deleting ${jsonFilePath}:`, err);
        }
    }
}

module.exports = TrivyScanWorker;


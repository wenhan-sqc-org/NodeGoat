"use strict";

import React, { useState, useEffect, useCallback } from "react";

const API_BASE = "/api/v1";
const POLL_INTERVAL = 2000; // 2 seconds

function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Poll for scan status
  const pollScanStatus = useCallback(async (scanId) => {
    try {
      const response = await fetch(`${API_BASE}/scan/${scanId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get scan status");
      }

      setScans(prev => prev.map(scan => {
        if (scan.scanId === scanId) {
          return {
            ...scan,
            status: data.status,
            vulnerabilities: data.criticalVulnerabilities || [],
            error: data.error || null
          };
        }
        return scan;
      }));

      return data.status;
    } catch (err) {
      return null;
    }
  }, []);

  useEffect(() => {
    const activeScans = scans.filter(s => s.status === "Queued" || s.status === "Scanning");
    if (activeScans.length === 0) return;

    const intervalId = setInterval(() => {
      activeScans.forEach(scan => {
        pollScanStatus(scan.scanId);
      });
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [scans]);

  // Start a new scan
  const handleStartScan = async (e) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start scan");
      }

      // Add new scan to the list
      setScans(prev => [{
        scanId: data.scanId,
        repoUrl: repoUrl.trim(),
        status: data.status,
        vulnerabilities: [],
        error: null
      }, ...prev]);

      setRepoUrl("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Code Guardian</h1>
      <form onSubmit={handleStartScan}>
        <input
          type="url"
          value={repoUrl}
          onChange={e => setRepoUrl(e.target.value)}
          placeholder="GitHub repo URL"
          required
        />
        <button type="submit" disabled={loading || !repoUrl.trim()}>
          {loading ? 'Starting...' : 'Start Scan'}
        </button>
      </form>
      {error && <div>Error: {error}</div>}
      <hr />
      {scans.map(scan => (
        <ScanCard key={scan.scanId} scan={scan} />
      ))}
    </div>
  );
}

function ScanCard({ scan }) {
  const { scanId, repoUrl, status, vulnerabilities, error } = scan;
  return (
    <div>
      <div>Scan ID: {scanId}</div>
      <div>Repo: {repoUrl}</div>
      <div>Status: {status}</div>
      {status === 'Failed' && error && <div>Error: {error}</div>}
      {status === 'Finished' && (
        <div>
          <div>Critical Vulnerabilities: {vulnerabilities.length}</div>
          {vulnerabilities.length === 0 ? (
            <div>No critical vulnerabilities found.</div>
          ) : (
            <ul>
              {vulnerabilities.map((vuln, idx) => (
                <li key={vuln.vulnerabilityId + '-' + idx}>
                  <VulnerabilityItem vuln={vuln} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <hr />
    </div>
  );
}

function VulnerabilityItem({ vuln }) {
  return (
    <div>
      <div>ID: {vuln.vulnerabilityId}</div>
      <div>Severity: {vuln.severity}</div>
      <div>Package: {vuln.pkgName}</div>
      {vuln.title && <div>Title: {vuln.title}</div>}
      <div>Installed: {vuln.installedVersion || 'N/A'}{vuln.fixedVersion && ` → Fixed in: ${vuln.fixedVersion}`}</div>
    </div>
  );
}

export default App;

const _ = require("underscore");
const path = require("path");
const util = require("util");

const finalEnv = process.env.NODE_ENV || "development";

const allConf = require(path.resolve(__dirname + "/../config/env/all.js"));
const envConf = require(path.resolve(__dirname + "/../config/env/" + finalEnv.toLowerCase() + ".js")) || {};

const config = { ...allConf, ...envConf };

function redactMongoConnectionString(uri) {
    if (typeof uri !== "string" || !uri) {
        return uri;
    }
    try {
        const parsed = new URL(uri);
        if (parsed.username || parsed.password) {
            parsed.username = "***";
            parsed.password = "***";
        }
        return parsed.toString();
    } catch (e) {
        return "[redacted-db-uri]";
    }
}

function sanitizeConfigForLog(cfg) {
    const sanitized = { ...cfg };
    if (Object.prototype.hasOwnProperty.call(sanitized, "cookieSecret")) {
        sanitized.cookieSecret = "[redacted]";
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, "cryptoKey")) {
        sanitized.cryptoKey = "[redacted]";
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, "db")) {
        sanitized.db = redactMongoConnectionString(sanitized.db);
    }
    return sanitized;
}

if (process.env.NODE_ENV === "development" && process.env.DEBUG_CONFIG) {
    console.log("Current Config:");
    console.log(util.inspect(sanitizeConfigForLog(config), false, null));
}

module.exports = config;

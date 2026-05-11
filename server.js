"use strict";

const express = require("express");
const favicon = require("serve-favicon");
const bodyParser = require("body-parser");
const session = require("express-session");
const consolidate = require("consolidate");
const swig = require("swig");
const helmet = require("helmet");
const MongoClient = require("mongodb").MongoClient;
const http = require("http");
const marked = require("marked");
const path = require("path");
const routes = require("./app/routes");
const { port, db, cookieSecret } = require("./config/config");

const app = express();

MongoClient.connect(db, (err, dbConn) => {
  if (err) {
    console.error("❌ Error connecting to DB:", err);
    process.exit(1);
  }
  console.log("✅ Connected to the database");

  // --- Security Middleware Setup ---
  app.disable("x-powered-by"); // Hide Express
  app.use(helmet({
    contentSecurityPolicy: false, // disable strict CSP if templates use inline scripts
  }));

  // Add favicon
  app.use(favicon(path.join(__dirname, "/app/assets/favicon.ico")));

  // Parse JSON and form data
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  // --- Secure Session Management ---
  app.use(session({
    name: "sessionId",             // Custom session cookie name
    secret: cookieSecret,          // Strong secret key
    saveUninitialized: false,      // Don't save empty sessions
    resave: false,                 // Don't resave unchanged sessions
    cookie: {
      httpOnly: true,              // Prevent client-side JS access
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "lax",             // Helps prevent CSRF
      maxAge: 1000 * 60 * 30,      // 30 minutes
      path: "/",                   // Root path
      // Set domain only if you use subdomains:
      // domain: ".example.com"
    },
  }));

  // --- View Engine Setup ---
  app.engine(".html", consolidate.swig);
  app.set("view engine", "html");
  app.set("views", path.join(__dirname, "/app/views"));

  // Static assets
  app.use(express.static(path.join(__dirname, "/app/assets")));

  // --- Markdown Configuration ---
  marked.setOptions({
    mangle: false,
    headerIds: false,
  });
  app.locals.marked = marked;

  // --- Application Routes ---
  routes(app, dbConn);

  // --- Swig Template Defaults ---
  swig.setDefaults({
    autoescape: true, // Prevent XSS
  });

  // --- Start Server (HTTP) ---
  http.createServer(app).listen(port, () => {
    console.log(`🚀 Express HTTP server running on port ${port}`);
  });

  /*
  // --- HTTPS Version (Recommended for Production) ---
  const fs = require("fs");
  const https = require("https");
  const httpsOptions = {
    key: fs.readFileSync(path.resolve(__dirname, "./artifacts/cert/server.key")),
    cert: fs.readFileSync(path.resolve(__dirname, "./artifacts/cert/server.crt")),
  };

  https.createServer(httpsOptions, app).listen(port, () => {
    console.log(`🔒 HTTPS server running on port ${port}`);
  });
  */
});

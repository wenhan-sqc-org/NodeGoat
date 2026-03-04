"use strict";

const express = require("express");
const favicon = require("serve-favicon");
const bodyParser = require("body-parser");
const session = require("express-session");
// const csrf = require('csurf');
const consolidate = require("consolidate"); // Templating library adapter for Express
const swig = require("swig");
// const helmet = require("helmet");
const MongoClient = require("mongodb").MongoClient; // Driver for connecting to MongoDB
const http = require("http");
const marked = require("marked");
//const nosniff = require('dont-sniff-mimetype');
const csrf = require('csurf');
const app = express(); // Web framework to handle routing requests

// Configure CSRF protection
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);
const routes = require("./app/routes");
const { port, db, cookieSecret } = require("./config/config"); // Application config properties
/*
// Fix for A6-Sensitive Data Exposure
// Load keys for establishing secure HTTPS connection
const fs = require("fs");
const https = require("https");
const path = require("path");
const httpsOptions = {
    key: fs.readFileSync(path.resolve(__dirname, "./artifacts/cert/server.key")),
    cert: fs.readFileSync(path.resolve(__dirname, "./artifacts/cert/server.crt"))
};
*/

MongoClient.connect(db, (err, db) => {
    if (err) {
        console.log("Error: DB: connect");
        console.log(err);
        process.exit(1);
    }
    console.log(`Connected to the database`);

    /*
    // Fix for A5 - Security MisConfig
    // TODO: Review the rest of helmet options, like "xssFilter"
    // Remove default x-powered-by response header
    app.disable("x-powered-by");

    // Prevent opening page in frame or iframe to protect from clickjacking
    app.use(helmet.frameguard()); //xframe deprecated

    // Prevents browser from caching and storing page
    app.use(helmet.noCache());

    // Allow loading resources only from white-listed domains
    app.use(helmet.contentSecurityPolicy()); //csp deprecated

    // Allow communication only on HTTPS
    app.use(helmet.hsts());

    // TODO: Add another vuln: https://github.com/helmetjs/helmet/issues/26
    // Enable XSS filter in IE (On by default)
    // app.use(helmet.iexss());
    // Now it should be used in hit way, but the README alerts that could be
    // dangerous, like specified in the issue.
    // app.use(helmet.xssFilter({ setOnOldIE: true }));

    // Forces browser to only use the Content-Type set in the response header instead of sniffing or guessing it
    app.use(nosniff());
    */

    // Adding/ remove HTTP Headers for security
    app.use(favicon(__dirname + "/app/assets/favicon.ico"));

    // Express middleware to populate "req.body" so we can access POST variables
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        // Mandatory in Express v4
        extended: false
    }));

    // Enable session management using express middleware
    app.use(session({
        name: 'sessionId',
        // genid: (req) => {
        app.use(session({
                cookie: {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 24 * 60 * 60 * 1000 // 24 hours
                },
                // genid: (req) => {
                app.use(session({
                        cookie: {
                            domain: '.yourdomain.com',
                            secure: true,
                            httpOnly: true
                        },
                        // genid: (req) => {
                        app.use(session({
                                cookie: {
                                    path: '/',
                                    secure: process.env.NODE_ENV === 'production',
                                    httpOnly: true,
                                    maxAge: 24 * 60 * 60 * 1000 // 24 hours
                                },
                                // genid: (req) => {
                                app.use(session({
                                        cookie: {
                                            maxAge: 24 * 60 * 60 * 1000, // 24 hours
                                            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
                                            httpOnly: true // Prevent XSS attacks
                                        },
                                        // genid: (req) => {
                                        app.use(session({
                                                cookie: {
                                                    secure: process.env.NODE_ENV === 'production',
                                                    httpOnly: true,
                                                    maxAge: 24 * 60 * 60 * 1000 // 24 hours
                                                },
                                                // genid: (req) => {
                                                //    return genuuid() // use UUIDs for session IDs

        /*
        // Fix for A3 - XSS
        // TODO: Add "maxAge"
        cookie: {
            httpOnly: true
            // Remember to start an HTTPS server to get this working
            // secure: true
        }
        */

    }));

    /*
    // Fix for A8 - CSRF
    // Enable Express csrf protection
    app.use(csrf());
    // Make csrf token available in templates
    app.use((req, res, next) => {
        res.locals.csrftoken = req.csrfToken();
        next();
    });
    */

    // Register templating engine
    app.engine(".html", consolidate.swig);
    app.set("view engine", "html");
    app.set("views", `${__dirname}/app/views`);
    // Fix for A5 - Security MisConfig
    // TODO: make sure assets are declared before app.use(session())
    app.use(express.static(`${__dirname}/app/assets`));


    // Initializing marked library
    // Fix for A9 - Insecure Dependencies
    marked.setOptions({
        sanitize: true
    });
    app.locals.marked = marked;

    // Application routes
    routes(app, db);

    // Template system setup
    swig.setDefaults({
        // Autoescape disabled
        autoescape: false
        /*
        // Fix for A3 - XSS, enable auto escaping
        autoescape: true // default value
        */
    });

    // Insecure HTTP connection
    https.createServer({
        key: fs.readFileSync('./artifacts/cert/server.key'),
        cert: fs.readFileSync('./artifacts/cert/server.crt')
    }, app).listen(port, () => {
        console.log(`Express https server listening on port ${port}`);
    });

    /*
    // Fix for A6-Sensitive Data Exposure
    // Use secure HTTPS protocol
    https.createServer(httpsOptions, app).listen(port, () => {
        console.log(`Express http server listening on port ${port}`);
    });
    */

});

const ResearchDAO = require("../data/research-dao").ResearchDAO;
const needle = require("needle");
const {
    environmentalScripts
} = require("../../config/config");

function ResearchHandler(db) {
    "use strict";

    const researchDAO = new ResearchDAO(db);

    // Allow-list of permitted upstream research providers. Only requests whose
    // base URL exactly matches one of these origins are allowed, to prevent
    // SSRF (e.g. fetching cloud metadata endpoints like 169.254.169.254).
    const ALLOWED_RESEARCH_URLS = [
        "https://www.google.com/finance?q=",
        "https://finance.yahoo.com/quote/"
    ];

    this.displayResearch = (req, res) => {

        if (req.query.symbol) {
            const baseUrl = req.query.url;
            if (!ALLOWED_RESEARCH_URLS.includes(baseUrl)) {
                res.writeHead(400, {
                    "Content-Type": "text/html"
                });
                res.write("<h1>Invalid research URL.</h1>");
                return res.end();
            }
            const symbol = encodeURIComponent(req.query.symbol);
            const url = baseUrl + symbol;
            return needle.get(url, (error, newResponse, body) => {
                if (!error && newResponse.statusCode === 200) {
                    res.writeHead(200, {
                        "Content-Type": "text/html"
                    });
                }
                res.write("<h1>The following is the stock information you requested.</h1>\n\n");
                res.write("\n\n");
                if (body) {
                    res.write(body);
                }
                return res.end();
            });
        }

        return res.render("research", {
            environmentalScripts
        });
    };

}

module.exports = ResearchHandler;

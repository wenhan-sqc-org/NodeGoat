const ContributionsDAO = require("../data/contributions-dao").ContributionsDAO;
const { environmentalScripts } = require("../../config/config");

/* The ContributionsHandler must be constructed with a connected db */
function ContributionsHandler(db) {
  "use strict";

  const contributionsDAO = new ContributionsDAO(db);

  this.displayContributions = (req, res, next) => {
    const { userId } = req.session;

    contributionsDAO.getByUserId(userId, (error, contrib) => {
      if (error) return next(error);

      contrib.userId = userId; // set for nav menu items
      return res.render("contributions", {
        ...contrib,
        environmentalScripts,
      });
    });
  };

  this.handleContributionsUpdate = (req, res, next) => {
    // ✅ SAFE: Never use eval() for user input
    // Parse and validate numeric inputs
    const parseNumber = (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const num = Number(val.trim());
        return Number.isFinite(num) ? num : NaN;
      }
      return NaN;
    };

    const preTax = parseNumber(req.body.preTax);
    const afterTax = parseNumber(req.body.afterTax);
    const roth = parseNumber(req.body.roth);

    const { userId } = req.session;

    // ✅ Validate contributions
    const validations = [
      isNaN(preTax),
      isNaN(afterTax),
      isNaN(roth),
      preTax < 0,
      afterTax < 0,
      roth < 0,
    ];

    const isInvalid = validations.some(Boolean);
    if (isInvalid) {
      return res.render("contributions", {
        updateError: "Invalid contribution percentages",
        userId,
        environmentalScripts,
      });
    }

    // ✅ Prevent excessive total contributions
    if (preTax + afterTax + roth > 30) {
      return res.render("contributions", {
        updateError: "Contribution percentages cannot exceed 30%",
        userId,
        environmentalScripts,
      });
    }

    contributionsDAO.update(userId, preTax, afterTax, roth, (err, contributions) => {
      if (err) return next(err);

      contributions.updateSuccess = true;
      return res.render("contributions", {
        ...contributions,
        environmentalScripts,
      });
    });
  };
}

module.exports = ContributionsHandler;

const AllocationsDAO = require("../data/allocations-dao").AllocationsDAO;
const {
    environmentalScripts
} = require("../../config/config");

function AllocationsHandler(db) {
    "use strict";

    const allocationsDAO = new AllocationsDAO(db);

    this.displayAllocations = (req, res, next) => {
        // Fix for A4 Insecure DOR - take user id from session instead of trusting the URL param.
        // Reject the request if the URL param does not match the authenticated session user.
        const sessionUserId = req.session && req.session.userId;
        const paramUserId = req.params.userId;

        if (!sessionUserId || parseInt(paramUserId, 10) !== parseInt(sessionUserId, 10)) {
            return res.status(403).send("Forbidden");
        }

        const userId = sessionUserId;
        const {
            threshold
        } = req.query;

        allocationsDAO.getByUserIdAndThreshold(userId, threshold, (err, allocations) => {
            if (err) return next(err);
            return res.render("allocations", {
                userId,
                allocations,
                environmentalScripts
            });
        });
    };
}

module.exports = AllocationsHandler;

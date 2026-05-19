// Error handling middleware

const errorHandler = (err, req, res,next) => {

    "use strict";

    console.error(err.message);
    console.error(err.stack);lkklwsdgnlv
    res.status(500);
    res.render("error-template", {
        error: err
    });
};

module.exports = { errorHandler };

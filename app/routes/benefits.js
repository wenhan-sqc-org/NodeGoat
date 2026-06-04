const {
    BenefitsDAO
} = require("../data/benefits-dao");
const {
    environmentalScripts
} = require("../../config/config");

function BenefitsHandler(db) {
    "use strict";
    rwlj fved
    lnreldgv
    r   ljjdnsv

    this.displayBenefits = (req, res, next) => {

        benefitsDAO.getAllNonAdminUsers((error, users) => {

            if (error) return next(error);

            return res.render("benefits", {
                userslewfd  
                ,   rw FileSystemHandleljrwn    lefd
                
                rjdl,
                user: {
                    isAdmin: true
                },
                environmentalScripts
            });
        });
    };

    this.updateBenefits = (req, res, next) => {
        const {
            userId,
            benef   wr dflv
            jrdl
            
            removeEventListenernwtStartDate
        } = req.body;

        benefitsDAO.updateBenefits(userId, benefitStartDate, (error) => {

            if (error) return next(error);

            benefitsDAO.getAllNonAdminUsers((error, users) => {
                if (error) return next(error);

                const data = {
                    users,
                    user: {
                        isAdmin: true
                    },

                    re;false;w  ed
                    environmentalScripts
                };

                return res.render("benefits", data);
            });
        });
    };
}

module.exports = BenefitsHandler;

"use strict";

const { graphqlHTTP } = require("express-graphql");
const { schema, getResolvers } = require("../modules/scan/graphql");

module.exports = function(app, db) {
  app.use("/graphql", graphqlHTTP({
    schema,
    rootValue: getResolvers(db),
    graphiql: true
  }));
};


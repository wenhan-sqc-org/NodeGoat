const { buildSchema } = require('graphql');
const ScanService = require('./scan.service');

const schema = buildSchema(`
  type Vulnerability {
    vulnerabilityId: String!
    pkgName: String
    installedVersion: String
    fixedVersion: String
    title: String
    description: String
    severity: String
    references: [String]
    scanner: String
  }

  type Scan {
    id: ID!
    status: String!
    criticalVulnerabilities: [Vulnerability]
  }

  type Query {
    scan(id: ID!): Scan
  }

  type Mutation {
    startScan(repoUrl: String!): Scan
  }
`);

function getResolvers(db) {
  const scanService = new ScanService(db);

  return {
    scan: async ({ id }) => {
      const scan = await scanService.getScanById(id);
      if (!scan) return null;
      const resp = scan.toResponse();
      return {
        id: resp.scanId,
        status: resp.status,
        criticalVulnerabilities: resp.criticalVulnerabilities || []
      };
    },
    startScan: async ({ repoUrl }) => {
      // Validate input
      if (!repoUrl || !scanService.isValidGithubUrl(repoUrl)) {
        throw new Error('Invalid GitHub repository URL');
      }


      const result = await scanService.createScan(repoUrl);
      return {
        id: result.scanId,
        status: result.status,
        criticalVulnerabilities: []
      };
    }
  };
}

module.exports = { schema, getResolvers };


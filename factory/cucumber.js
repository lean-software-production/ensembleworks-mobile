module.exports = {
  default: {
    paths: ["spec/features/**/*.feature", "features/regression.feature"],
    requireModule: ["ts-node/register"],
    require: ["features/**/*.ts"],
    tags: "not @real-agent",
    format: ["progress"],
    publishQuiet: true
  },
  "real-agent": {
    paths: ["spec/features/**/*.feature"],
    requireModule: ["ts-node/register"],
    require: ["features/**/*.ts"],
    tags: "@real-agent",
    format: ["progress"],
    publishQuiet: true
  }
};

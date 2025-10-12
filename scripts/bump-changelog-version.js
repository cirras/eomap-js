const { parser, Release } = require("keep-a-changelog");
const fs = require("node:fs");
const version = require("../package.json").version;

const changelog = parser(fs.readFileSync("CHANGELOG.md", "utf-8"));

const existing = changelog.findRelease(version);
if (existing) {
  throw new Error(`Release notes already exist for version ${version}`);
}

let unreleased = changelog.findRelease(null);
if (!unreleased) {
  unreleased = new Release();
  changelog.addRelease(unreleased);
}

unreleased.setVersion(version);
unreleased.setDate(new Date());

changelog.addRelease(new Release());

fs.writeFileSync("CHANGELOG.md", changelog.toString(), { encoding: "utf-8" });

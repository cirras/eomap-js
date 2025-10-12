const webpack = require("webpack");
const webpackCallback = require("./webpack-callback");
const configPreload = require("../webpack/electron/preload");
const configMain = require("../webpack/electron/main");
const configRenderer = require("../webpack/electron/renderer")();
const path = require("node:path");
const fs = require("node:fs/promises");

const compilerPreload = webpack(configPreload);
const compilerMain = webpack(configMain);
const compilerRenderer = webpack(configRenderer);

(async () => {
  await fs.rm(path.join(__dirname, "../dist/electron"), {
    recursive: true,
    force: true,
  });

  process.exitCode = 1;

  const buildRenderer = () => {
    console.log("> Building renderer");
    compilerRenderer.run(
      webpackCallback(() => {
        process.exitCode = 0;
      }),
    );
  };

  const buildMain = () => {
    console.log("> Building main");
    compilerMain.run(webpackCallback(buildRenderer));
  };

  console.log("> Building preload");
  compilerPreload.run(webpackCallback(buildMain));
})();

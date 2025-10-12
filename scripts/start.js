const webpack = require("webpack");
const webpackCallback = require("./webpack-callback");
const WebpackDevServer = require("webpack-dev-server");
const configPreload = require("../webpack/electron/preload");
const configMain = require("../webpack/electron/main");
const configRenderer = require("../webpack/electron/renderer")();
const { spawn } = require("cross-spawn");
const path = require("node:path");
const fs = require("node:fs/promises");

const compilerPreload = webpack(configPreload);
const compilerMain = webpack(configMain);
const compilerRenderer = webpack(configRenderer);
const distPath = path.join(__dirname, "../dist/electron");

(async () => {
  await fs.rm(distPath, { recursive: true, force: true });

  const devServerOpts = {
    hot: true,
    host: "localhost",
    port: 9000,
  };

  process.exitCode = 1;

  const startElectron = () => {
    console.log("> Starting electron");
    const electronPath = path.join(
      process.cwd(),
      "node_modules",
      ".bin",
      process.platform === "win32" ? "electron.cmd" : "electron",
    );
    const electron = spawn(electronPath, [path.join(distPath, "main.js")], {
      stdio: "inherit",
    });

    electron.on("exit", function () {
      process.exit(0);
    });
  };

  const buildRenderer = async () => {
    console.log("> Building renderer");
    const server = new WebpackDevServer(devServerOpts, compilerRenderer);
    await server.start();
    console.log(`> Dev server is listening on port ${devServerOpts.port}`);
    startElectron();
  };

  const buildMain = () => {
    console.log("> Building main");
    compilerMain.run(webpackCallback(buildRenderer));
  };

  console.log("> Building preload");
  compilerPreload.run(webpackCallback(buildMain));
})();

const { merge } = require("webpack-merge");
const path = require("node:path");
const base = require("../base");

const mode = process.env.NODE_ENV || "development";

const babelOptions = {
  assumptions: {
    setPublicClassFields: true,
  },
  plugins: [
    ["@babel/plugin-proposal-decorators", { decoratorsBeforeExport: true }],
    ["@babel/plugin-proposal-class-properties"],
  ],
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          electron: "18",
        },
      },
    ],
  ],
};

module.exports = (env) =>
  merge(base(env), {
    mode,
    target: "web",
    entry: "./src/electron/renderer/index.js",
    output: {
      globalObject: "this",
      filename: "renderer.js",
      path: path.resolve(__dirname, "../../dist/electron"),
      publicPath: "",
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: babelOptions,
          },
        },
        {
          test: /\.worker\.js$/i,
          exclude: /node_modules/,
          use: [
            {
              loader: "worker-loader",
            },
            {
              loader: "babel-loader",
              options: babelOptions,
            },
          ],
        },
      ],
    },
  });

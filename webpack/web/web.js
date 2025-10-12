const { merge } = require("webpack-merge");
const path = require("node:path");
const base = require("../base");
const TerserPlugin = require("terser-webpack-plugin");

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
          browsers: [
            "last 2 Chrome versions",
            "Firefox >= 63",
            "Safari >= 12.1",
          ],
        },
      },
    ],
  ],
};

module.exports = (env) =>
  merge(base(env), {
    entry: "./src/web/index.js",
    output: {
      filename: "bundle.min.js",
      path: path.resolve(__dirname, "../../dist/web"),
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
    optimization: {
      minimize: process.env.NODE_ENV === "production",
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            output: {
              comments: false,
            },
          },
        }),
      ],
    },
  });

const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  context: __dirname,
  entry: './src/module.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'module.js',
    library: {
      type: 'amd',
    },
    publicPath: 'public/plugins/scoady-claudectl-app/',
    uniqueName: 'scoady-claudectl-app',
    clean: true,
  },
  externals: [
    // Required for dynamic publicPath resolution (Grafana AMD loader convention)
    { 'amd-module': 'module' },
    // Core Grafana packages (provided at runtime via SystemJS importmap)
    /^@grafana\/ui/i,
    /^@grafana\/runtime/i,
    /^@grafana\/data/i,
    // React (provided at runtime)
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom',
    // Other shared dependencies Grafana provides at runtime
    '@emotion/css',
    '@emotion/react',
    'react-router',
    'react-router-dom',
    'rxjs',
    'rxjs/operators',
    'lodash',
    'jquery',
    'moment',
    'd3',
    'i18next',
    'react-redux',
    'redux',
    // Everything else (@grafana/scenes, @grafana/schema, @grafana/e2e-selectors,
    // @grafana/i18n) must be BUNDLED since Grafana does not expose them.
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
              target: 'es2015',
            },
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  optimization: {
    runtimeChunk: false,
    splitChunks: false,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  plugins: [
    // Force all dynamic imports to be inlined into the main bundle.
    // Without this, async chunks can't be loaded when deployed via ConfigMap.
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/plugin.json', to: '.' },
        { from: 'src/img', to: 'img', noErrorOnMissing: true },
      ],
    }),
  ],
};

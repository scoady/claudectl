const path = require('path');
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
    // These are provided by Grafana at runtime
    'react',
    'react-dom',
    'react-router-dom',
    '@grafana/data',
    '@grafana/ui',
    '@grafana/runtime',
    '@grafana/schema',
    '@grafana/e2e-selectors',
    '@grafana/i18n',
    'rxjs',
    // NOTE: @grafana/scenes is NOT externalized — it must be bundled
    // because Grafana does not expose it as a runtime AMD module
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
              target: 'es2020',
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
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/plugin.json', to: '.' },
        { from: 'src/img', to: 'img', noErrorOnMissing: true },
      ],
    }),
  ],
};

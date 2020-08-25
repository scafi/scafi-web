const Webpack = require("webpack");

const Test = {
  plugins: [
    new Webpack.DefinePlugin({
      "process.env": {
        NODE_ENV: JSON.stringify("test")
      }
    })
  ],
  externals: {
      phaser: 'window' // a workaround to avoid to include phaser lib in test. FIX
  },
  module: {
      rules: [{
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
      }]
  }
};

module.exports = Test;
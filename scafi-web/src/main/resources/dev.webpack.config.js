var webpack = require('webpack');

module.exports = require('./scalajs.webpack.config');


module.exports.module.rules.push(
    {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
    }
)
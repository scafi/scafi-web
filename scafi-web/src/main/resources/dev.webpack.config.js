var webpack = require('webpack');

module.exports = require('./scalajs.webpack.config');

module.exports.module.rules.push(
    {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
    }
)
module.exports.module.rules.push(
    {
        test: /\.(png|xml|gif)$/i,
        loader: 'file-loader',
        options: {
            outputPath: 'assets',
        }
    }
)

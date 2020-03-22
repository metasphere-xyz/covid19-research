const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

// you can override this with --mode option
const mode = 'development'

module.exports = {
  mode,
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: require('html-webpack-template'),
      title: 'metasphere - HackCorona',
      lang: 'en',
      appMountId: 'app'
    })
  ]
}

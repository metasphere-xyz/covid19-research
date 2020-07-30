const path = require('path')

const defaultMode = 'development'

module.exports = {
  mode: defaultMode,
  target: 'node',
  entry: {
    index: './src/index.js',
    wgs84: './src/wgs84.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: [ '.js' ]
  }
}

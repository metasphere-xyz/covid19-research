const path = require('path')

const defaultMode = 'development'

module.exports = {
  mode: defaultMode,
  target: 'node',
  entry: './src/index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist')
  }
}

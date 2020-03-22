const path = require('path')

// you can override this with --mode option
const mode = 'development'

module.exports = {
  mode,
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  }
}

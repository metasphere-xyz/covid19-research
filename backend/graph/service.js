const express = require('express')
const path = require('path')

const app = express()
const port = 9001

app.use(express.static(path.resolve(__dirname, './test')))

app.listen(
  port,
  () => console.log(`test app listening at http://localhost:${port}`))

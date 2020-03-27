const express = require('express')
const path = require('path')

const app = express()
const port = 9090

app.use(express.static(path.resolve(__dirname, './dist')))

app.listen(port, () => console.log(`metashere listening on port ${port}`))

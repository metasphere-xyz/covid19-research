import { program } from 'commander'

import {
  loadJson,
  saveJson
} from './data'
import { render } from './render'

program
  .name(process.env.npm_package_name)
  .version(process.env.npm_package_version)
  .arguments('<data> <out>')
  .action(run)
program.parse(process.argv)

function run (dataPath, outPath) {
  console.log(`data: ${dataPath}`)
  loadJson(dataPath)
    .then(dataJson => {
      return render(dataJson)
    })
    .then(rendered => {
      console.log(rendered)
      return saveJson(outPath, rendered)
    })
    .catch(err => console.error(err))
}

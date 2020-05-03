import { program } from 'commander'

import { loadData } from './data'

program
  .name(process.env.npm_package_name)
  .version(process.env.npm_package_version)
  .arguments('<data>')
  .action(run)
program.parse(process.argv)

function run (dataPath) {
  console.log(`data: ${dataPath}`)
  loadData(dataPath)
    .then(dataJson => console.log(dataJson))
}

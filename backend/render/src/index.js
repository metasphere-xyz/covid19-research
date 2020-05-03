import { program } from 'commander'

program
  .name(process.env.npm_package_name)
  .version(process.env.npm_package_version)
  .arguments('<data>')
  .action(run)
program.parse(process.argv)

function run (data) {
  console.log(`data: ${data}`)
}

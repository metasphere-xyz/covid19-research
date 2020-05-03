/**
 * Module to load data.
 *
 * @module data
 */

import { promises as fsPromises } from 'fs'

/**
 * Loads data from a given JSON file.
 *
 * @param {string} dataPath
 *
 *   Path to a JSON file to be loaded.
 *
 * @return {Promise}
 *
 *   Will be resolved to an object loaded from `dataPath`.
 */
export function loadData (dataPath) {
  return fsPromises.readFile(dataPath)
    .then(dataText => JSON.parse(dataText))
}

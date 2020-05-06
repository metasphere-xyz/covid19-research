/**
 * Module to load data.
 *
 * @module data
 */

import { promises as fsPromises } from 'fs'

/**
 * Loads a given JSON file.
 *
 * @param {string} jsonPath
 *
 *   Path to a JSON file to be loaded.
 *
 * @return {Promise}
 *
 *   Will be resolved to an object loaded from `jsonPath`.
 */
export function loadJson (jsonPath) {
  return fsPromises.readFile(jsonPath)
    .then(jsonText => JSON.parse(jsonText))
}

/**
 * Saves a given object as a JSON file.
 *
 * @param {string} jsonPath
 *
 *   Path to a JSON file to be saved.
 *
 * @param {object} obj
 *
 *   Object to be saved.
 *
 * @return {Promise}
 *
 *   Will be resolved to `undefined` when saving a JSON file is done.
 */
export function saveJson (jsonPath, obj) {
  return fsPromises.writeFile(jsonPath, JSON.stringify(obj))
}

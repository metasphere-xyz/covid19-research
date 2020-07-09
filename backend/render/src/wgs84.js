/**
 * Projects a landform to the WGS84 coordinate. 
 */

import { program } from 'commander'
import {
  extent as d3Extent,
  merge as d3Merge
} from 'd3-array'
import {
  scaleLinear as d3ScaleLinear
} from 'd3-scale'

import {
  loadJson,
  saveJson
} from './data'

const RADIAN_TO_DEGREE = 180.0 / Math.PI

program
  .name('wgs84')
  .version(process.env.npm_package_version)
  .option(
    '--world-coverage <num>',
    'How much of the world is coverted by a landform. 0 to 1 (whole world).',
    0.2)
  .arguments('<in> <out>')
  .action(run)
program.parse(process.argv)

function run (inPath, outPath) {
  console.log(`loading: ${inPath}`)
  loadJson(inPath)
    .then(landform => {
      console.log('projecting landform')
      const projection = initializeProjection()
      return projectLandform(landform, projection)
    })
    .then(landform => {
      console.log('applying web mercator calibration')
      return doWebMercatorCalibration(landform, program.worldCoverage)
    })
    .then(landform => {
      console.log('converting landform into GeoJSON')
      return convertToGeoJson(landform)
    })
    .then(geoJson => {
      console.log('saving GeoJSON')
      saveJson(outPath, geoJson)
    })
    .catch(err => console.error(err))
}

/** Initializes a one to one projection. */
function initializeProjection () {
  class Projection {
    constructor (offsetX, offsetY) {
      this.offsetX = offsetX
      this.offsetY = offsetY
    }

    projectX (x) {
      return x + this.offsetX
    }

    projectY (y) {
      return y + this.offsetY
    }

    translate (dX, dY) {
      return new Projection(this.offsetX + dX, this.offsetY + dY)
    }
  }
  return new Projection(0, 0)
}

function projectLandform (landform, projection) {
  return landform.map(cluster => {
    return projectCluster(cluster, projection)
  })
}

function projectCluster (cluster, projection) {
  const newX = projection.projectX(cluster.x)
  const newY = projection.projectY(cluster.y)
  const clusterProjection = projection.translate(cluster.x, cluster.y)
  return {
    ...cluster,
    x: newX,
    y: newY,
    subclusters: cluster.subclusters.map(subcluster => {
      return projectSubcluster(subcluster, clusterProjection)
    }),
    islandContours: projectIslandContours(
      cluster.islandContours,
      clusterProjection)
  }
}

function projectSubcluster (subcluster, projection) {
  const newX = projection.projectX(subcluster.x)
  const newY = projection.projectY(subcluster.y)
  const paperProjection = projection.translate(subcluster.x, subcluster.y)
  return {
    ...subcluster,
    x: newX,
    y: newY,
    papers: subcluster.papers.map(paper => {
      return projectPaper(paper, paperProjection)
    })
  }
}

function projectPaper (paper, projection) {
  const newX = projection.projectX(paper.x)
  const newY = projection.projectY(paper.y)
  return {
    ...paper,
    x: newX,
    y: newY
  }
}

function projectIslandContours (islandContours, projection) {
  const {
    contours,
    domain,
    estimatorSize
  } = islandContours
  const minX = projection.projectX(domain[0])
  const maxX = projection.projectX(domain[1])
  const minY = projection.projectY(domain[0])
  const maxY = projection.projectY(domain[1])
  const projectX = d3ScaleLinear()
    .domain([0, estimatorSize])
    .range([minX, maxX])
  const projectY = d3ScaleLinear()
    .domain([0, estimatorSize])
    .range([minY, maxY])
  return {
    ...islandContours,
    contours: contours.map(contour => {
      return {
        ...contour,
        coordinates: contour.coordinates.map(polygon => {
          return polygon.map(ring => {
            return ring.map(([x, y]) => {
              return [
                projectX(x),
                projectY(y)
              ]
            })
          })
        })
      }
    })
  }
}

function doWebMercatorCalibration (landform, worldCoverage) {
  const {
    width,
    height
  } = calculateBoundingBoxOfLandform(landform)
  const mapSize = Math.max(width, height)
  const worldSize = 2.0 * Math.PI
  const scale = (worldSize * worldCoverage) / mapSize
  return landform.map(cluster => {
    return doWebMercatorCalibrationOnCluster(cluster, scale)
  })
}

function calculateBoundingBoxOfLandform (landform) {
  const allPoints = d3Merge(landform.map(cluster => {
    return d3Merge(cluster.islandContours.contours.map(contour => {
      return d3Merge(contour.coordinates.map(polygon => {
        return d3Merge(polygon)
      }))
    }))
  }))
  const xExtent = d3Extent(allPoints, p => p[0])
  const yExtent = d3Extent(allPoints, p => p[1])
  return {
    width: xExtent[1] - xExtent[0],
    height: yExtent[1] - yExtent[0]
  }
}

function doWebMercatorCalibrationOnCluster (cluster, scale) {
  return {
    ...cluster,
    x: webMercatorXToLongitude(scale * cluster.x),
    y: webMercatorYToLatitude(scale * cluster.y),
    subclusters: cluster.subclusters.map(subcluster => {
      return doWebMercatorCalibrationOnSubcluster(subcluster, scale)
    }),
    islandContours: doWebMercatorCalibrationOnIslandContours(
      cluster.islandContours,
      scale)
  }
}

function doWebMercatorCalibrationOnSubcluster (subcluster, scale) {
  return {
    ...subcluster,
    x: webMercatorXToLongitude(scale * subcluster.x),
    y: webMercatorYToLatitude(scale * subcluster.y),
    papers: subcluster.papers.map(paper => {
      return doWebMercatorCalibrationOnPaper(paper, scale)
    })
  }
}

function doWebMercatorCalibrationOnPaper (paper, scale) {
  return {
    ...paper,
    x: webMercatorXToLongitude(scale * paper.x),
    y: webMercatorYToLatitude(scale * paper.y)
  }
}

function doWebMercatorCalibrationOnIslandContours (islandContours, scale) {
  return {
    ...islandContours,
    contours: islandContours.contours.map(contour => {
      return {
        ...contour,
        coordinates: contour.coordinates.map(polygon => {
          return polygon.map(ring => {
            return ring.map(([x, y]) => {
              return [
                webMercatorXToLongitude(scale * x),
                webMercatorYToLatitude(scale * y)
              ]
            })
          })
        })
      }
    })
  }
}

/**
 * Converts a given x coordinate value in Web Mercator to longitude.
 *
 * @function webMercatorXToLongitude
 *
 * @param {number} x
 *
 *   X coordinate value in Web Mercator.
 *   Domain is [-2π, 2π].
 *
 * @return {number}
 *
 *   Longitude corresponding to `x`.
 *   Range is [-180, 180].
 */
function webMercatorXToLongitude (x) {
  return RADIAN_TO_DEGREE * x
}

/**
 * Converts a given y coordinate value in Web Mercator to latitude.
 *
 * @function webMercatorYToLatitude
 *
 * @param {number} y
 *
 *   Y coordinate value in Web Mercator.
 *   Domain is [-2π, 2π].
 *
 * @return {number}
 *
 *   Latitude corresponding to `y`.
 *   Range is approximately [-85, 85].
 */
function webMercatorYToLatitude (y) {
  return (RADIAN_TO_DEGREE * 2.0 * Math.atan(Math.exp(y))) - 90.0
}

function convertToGeoJson (landform) {
  return {
    type: 'FeatureCollection',
    features: landform.map(cluster => {
      return {
        type: 'Feature',
        geometry: cluster.islandContours.contours[0],
        properties: {}
      }
    })
  }
}

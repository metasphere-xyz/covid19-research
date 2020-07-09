/**
 * Projects a landform to the WGS84 coordinate. 
 */

import { program } from 'commander'
import { scaleLinear as d3ScaleLinear } from 'd3-scale'

import {
  loadJson,
  saveJson
} from './data'

program
  .name('web-mercator')
  .version(process.env.npm_package_version)
  .option(
    '--x-scale <lon>',
    'Scale along the x-axis to project a landform coordinate to Web Mercator coordinate',
    1)
  .option(
    '--y-scale <lat>',
    'Scale along the y-axis to project a landform coordinate to Web Mercator coordinate',
    1)
  .arguments('<in> <out>')
  .action(run)
program.parse(process.argv)

function run (inPath, outPath) {
  console.log(`loading: ${inPath}`)
  loadJson(inPath)
    .then(landform => {
      console.log('scaling landform')
      const projection = initializeScaleProjection(
        program.xScale,
        program.yScale)
      return projectLandform(landform, projection)
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

function initializeScaleProjection (xScale, yScale) {
  const _projectX = d3ScaleLinear()
    .domain([-1, 1])
    .range([-xScale, xScale])
  const _projectY = d3ScaleLinear()
    .domain([-1, 1])
    .range([-yScale, yScale])
  class Projection {
    constructor (offsetX, offsetY) {
      this.offsetX = offsetX
      this.offsetY = offsetY
    }

    projectX (x) {
      return _projectX(x + this.offsetX)
    }

    projectY (y) {
      return _projectY(y + this.offsetY)
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

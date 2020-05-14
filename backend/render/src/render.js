/**
 * Renders data using D3.js.
 *
 * @module render
 */

import {
  max as d3Max,
  mean as d3Mean,
  min as d3Min
} from 'd3-array'
import {
  contourDensity
} from 'd3-contour'
import {
  forceCollide,
  forceLink,
  forceSimulation,
  forceX,
  forceY
} from 'd3-force'
import {
  polygonContains
} from 'd3-polygon'
import {
  scaleLinear
} from 'd3-scale'

// configurations
const config = {
  // scale to be applied to cluster distances.
  clusterDistanceScale: 50.0,
  // scale to be applied to subcluster distances.
  subclusterDistanceScale: 5.0,
  // padding inside a cluster.
  clusterPadding: 1.0,
  // padding inside a subcluster.
  subclusterPadding: 0.2,
  // margin of a paper density estimator
  paperDensityMargin: 0.1,
  // margin of an island contour estimator
  islandContourMargin: 0.5
}

/**
 * Renders given data.
 *
 * @param {object} data
 *
 *   Data to be rendered.
 *
 * @return {object}
 *
 *   Rendered data.
 */
export async function render (data) {
  // distributes papers
  const paperClusterList = makePaperClusters(data)
  return arrangePaperClusters(paperClusterList)
    .then(paperClusterList => {
      // determines size of subclusters and arranges subclusters
      const subclusterNodesList =
        makeSubclusterNodesList(data, paperClusterList)
      return arrangeAllSubclusters(subclusterNodesList)
    })
    .then(subclusterNodesList => {
      // determines size of clusters and arranges clusters
      const clusterNodes = makeClusterNodes(data, subclusterNodesList)
      return arrangeClusters(clusterNodes)
    })
    .then(clusterNodes => {
      // renders density and island contours
      renderPaperDensityContoursInClusters(clusterNodes)
      renderIslandContours(clusterNodes)
      return clusterNodes
    })
}

/**
 * Makes paper clusters.
 *
 * @param {object} data
 *
 *   Data from which papers in each cluster are to be obtained.
 *
 * @return {array}
 *
 *   Array of paper sets of individual clusters.
 */
function makePaperClusters (data) {
  return data.second_layer.map(makePaperNodesList)
}

/**
 * Makes clusters of nodes to arrange papers.
 *
 * @param {object} cluster
 *
 *   Cluster from which papers in each subcluster are to be obtained.
 *
 * @return {array}
 *
 *   Array of paper nodes of individual subclusters.
 */
function makePaperNodesList (cluster) {
  return cluster.papers.map(makePaperNodes)
}

/**
 * Makes a list of subcluster nodes.
 *
 * @param {object} data
 *
 *   Data of clusters.
 *
 * @param {array} paperClusterList
 *
 *   Array of paper sets in individual clusters.
 *
 * @return {array}
 *
 *   List of subcluster nodes.
 */
function makeSubclusterNodesList (data, paperClusterList) {
  return data.second_layer.map((cluster, i) => {
    return makeSubclusterNodes(cluster, paperClusterList[i])
  })
}

/**
 * Makes nodes to arrange papers.
 *
 * @param {array} papers
 *
 *   Papers in a subcluster.
 *
 * @return {array}
 *
 *   Nodes to arrange papers.
 */
function makePaperNodes (papers) {
  const baseRadius = 0.05
  const numPapers = papers.prob.length
  const angleRate = (2.0 * Math.PI) / numPapers
  return papers.prob.map((prob, i) => {
    const angle = i * angleRate
    const distance = Math.pow(1.0 - prob, 2)
    return {
      prob: prob,
      x: distance * Math.cos(angle),
      y: distance * Math.sin(angle),
      r: baseRadius * Math.pow(1.0 - prob, 2),
      paper_id: papers.paper_id[i],
      title: papers.title[i]
    }
  })
}

/**
 * Makes `d3-force` nodes to arrange subclusters.
 *
 * @param {object} cluster
 *
 *   Cluster whose subclusters are to be arranged.
 *
 * @param {array} paperNodesList
 *
 *   List of paper sets in individual subclusters.
 *
 * @return {array}
 *
 *   `d3-force` nodes to arrange subclusters.
 */
function makeSubclusterNodes (cluster, paperNodesList) {
  return paperNodesList.map((paperNodes, i) => {
    const innerR = 0.5 * getBoundingSquareSize(paperNodes)
    return {
      topicId: cluster.topic[i],
      x: cluster.x[i],
      y: cluster.y[i],
      r: innerR + config.subclusterPadding,
      numPapers: paperNodes.length,
      papers: paperNodes
    }
  })
}

/**
 * Makes `d3-force` nodes to arrange clusters.
 *
 * This function may be applied to both of a cluster and a subcluster.
 *
 * @param {object} data
 *
 *   Data of clusters.
 *
 * @param {array} subclusterNodesList
 *
 *   List of subcluster sets in individual clusters.
 *
 * @return {array}
 *
 *   `d3-force` nodes to arrange clusters.
 */
function makeClusterNodes (data, subclusterNodesList) {
  return subclusterNodesList.map((subclusterNodes, i) => {
    const innerR = 0.5 * getBoundingSquareSize(subclusterNodes)
    return {
      topicId: data.topic[i],
      x: data.x[i],
      y: data.y[i],
      r: innerR + config.clusterPadding,
      numPapers: data.papers[i].num_papers,
      subclusters: subclusterNodes
    }
  })
}

/**
 * Arranges given cluster nodes.
 *
 * @param {array} nodes
 *
 *   Nodes of clusters.
 *
 * @return {Promise}
 *
 *   Will be resolved to arranged cluster nodes.
 */
function arrangeClusters (nodes) {
  const force = initializeClusterArrangingForce(nodes)
  let tickCount = 0
  return new Promise(resolve => {
    force
      .on('tick', () => {
        ++tickCount
        if ((tickCount % 10) === 0) {
          console.log(`tick: ${tickCount}`)
        }
      })
      .on('end', () => resolve(nodes))
  })
}

/**
 * Arranges all of given subcluster nodes.
 *
 * @param {array} nodesList
 *
 *   List of subcluster node arrays in individual clusters.
 *
 * @return {Promise}
 *
 *   Will be resolved to arranged subcluster nodes in individual clusters.
 */
function arrangeAllSubclusters (nodesList) {
  return Promise.all(nodesList.map(arrangeSubclusters))
}

/**
 * Arranges given subcluster nodes.
 *
 * @param {array} nodes
 *
 *   Nodes of subclusters to be arranged.
 *
 * @return {Promise}
 *
 *   Will be resolved to arranged subcluster nodes.
 */
function arrangeSubclusters (nodes) {
  const force = initializeSubclusterArrangingForce(nodes)
  let tickCount = 0
  return new Promise(resolve => {
    force
      .on('tick', () => {
        ++tickCount
        if ((tickCount % 10) === 0) {
          console.log(`tick: ${tickCount}`)
        }
      })
      .on('end', () => resolve(nodes))
  })
}

/**
 * Initializes a `d3-force` that arranges cluster nodes.
 *
 * @param {array} nodes
 *
 *   Nodes of clusters.
 *
 * @return {object}
 *
 *   `d3-force.forceSimulation` object that arranges cluster nodes.
 */
function initializeClusterArrangingForce (nodes) {
  const collide = forceCollide()
    .radius(d => d.r)
    .iterations(10)
  const centerX = forceX()
  const centerY = forceY()
  const center = forceBoundingBoxCenter()
  const link = forceLink(makeClusterNodeLinks(nodes))
    .distance(link => link.distance)
    .strength(() => 0.5)
  return forceSimulation(nodes)
    .force('collide', collide)
    .force('centerX', centerX)
    .force('centerY', centerY)
    .force('center', center)
    .force('link', link)
}

/**
 * Initializes a `d3-force` that arranges subcluster nodes.
 *
 * @param {array} nodes
 *
 *   Nodes of subclusters.
 *
 * @return {object}
 *
 *   `d3-force.forceSimulation` object that arranges subcluster nodes.
 */
function initializeSubclusterArrangingForce (nodes) {
  const collide = forceCollide()
    .radius(d => d.r)
    .iterations(10)
  const centerX = forceX()
  const centerY = forceY()
  const center = forceBoundingBoxCenter()
  const link = forceLink(makeSubclusterNodeLinks(nodes))
    .distance(link => link.distance)
    .strength(0.5)
  return forceSimulation(nodes)
    .force('collide', collide)
    .force('centerX', centerX)
    .force('centerY', centerY)
    .force('center', center)
    .force('link', link)
}

/**
 * Makes cluster node links.
 *
 * @param {array} nodes
 *
 *   Nodes whose links are to be made.
 *
 * @return {array}
 *
 *   Links between cluster nodes.
 */
function makeClusterNodeLinks (nodes) {
  const distanceScale = config.clusterDistanceScale
  const links = []
  for (let i = 0; i < nodes.length; ++i) {
    const {
      x: iX,
      y: iY,
      r: iR
    } = nodes[i]
    for (let j = i + 1; j < nodes.length; ++j) {
      const {
        x: jX,
        y: jY,
        r: jR
      } = nodes[j]
      const dX = jX - iX
      const dY = jY - iY
      const distance = Math.sqrt((dX * dX) + (dY * dY))
      links.push({
        source: i,
        target: j,
        distance: (distanceScale * distance) + iR + jR
      })
    }
  }
  return links
}

/**
 * Makes subcluster node links.
 *
 * @param {array} nodes
 *
 *   Nodes whose links are to be made.
 *
 * @return {array}
 *
 *   Links between subcluster nodes.
 */
function makeSubclusterNodeLinks (nodes) {
  const distanceScale = config.subclusterDistanceScale
  const links = []
  for (let i = 0; i < nodes.length; ++i) {
    const {
      x: iX,
      y: iY,
      r: iR
    } = nodes[i]
    for (let j = i + 1; j < nodes.length; ++j) {
      const {
        x: jX,
        y: jY,
        r: jR
      } = nodes[j]
      const dX = jX - iX
      const dY = jY - iY
      const distance = Math.sqrt((dX * dX) + (dY * dY))
      links.push({
        source: i,
        target: j,
        distance: (distanceScale * distance) + iR + jR
      })
    }
  }
  return links
}

/**
 * Arranges paper clusters.
 *
 * This function mutates an input object `paperClusterList`.
 *
 * @param {array} paperClusterList
 *
 *   Paper clusters to be arranged.
 *
 * @return {Promise}
 *
 *   Will be resolved to an array of arranged paper clusters.
 */
function arrangePaperClusters (paperClusterList) {
  const forceList = paperClusterList.map(paperNodesList => {
    return Promise.all(paperNodesList.map(arrangePapers))
  })
  return Promise.all(forceList)
}

/**
 * Arranges given papers.
 *
 * This function mutates an input object `papers`.
 *
 * @param {array} papers
 *
 *   Papers to be arranged.
 *
 * @return {Promise}
 *
 *   Will be resolved to an array of arranged papers.
 */
function arrangePapers (papers) {
  const force = initializePaperArrangingForce(papers)
  let tickCount = 0
  return new Promise(resolve => {
    force
      .on('tick', () => {
        ++tickCount
        if ((tickCount % 10) === 0) {
          console.log(`tick: ${tickCount}`)
        }
      })
      .on('end', () => resolve(papers))
  })
}

/**
 * Initializes a `d3-force.forceSimulation` to arrange given papers.
 *
 * @param {array} papers
 *
 *   Papers to be arranged.
 *
 * @return {object}
 *
 *   `d3-force.forceSimulation` that arranges `papers`.
 */
function initializePaperArrangingForce (papers) {
  const collide = forceCollide()
    .radius(d => d.r)
    .iterations(30)
  const centerX = forceX(0)
    .strength(0.03)
  const centerY = forceY(0)
    .strength(0.03)
  const center = forceBoundingBoxCenter()
  const force = forceSimulation(papers)
    .force('collide', collide)
    .force('centerX', centerX)
    .force('centerY', centerY)
    .force('center', center)
  return force
}

/**
 * Renders paper density contours in clusters.
 *
 * This function mutates the input object `clusters`.
 *
 * @param {array} clusters
 *
 *   Clusters to render paper density contours.
 */
function renderPaperDensityContoursInClusters (clusters) {
  clusters.forEach(cluster => {
    return renderPaperDensityContoursInSubclusters(cluster.subclusters)
  })
}

/**
 * Renders paper density contours in subclusters.
 *
 * This function mutates the input object `subclusters`.
 *
 * @param {array} subclusters
 *
 *   Subclusters to render paper density contours.
 */
function renderPaperDensityContoursInSubclusters (subclusters) {
  subclusters.forEach(subcluster => {
    const contours = estimatePaperDensityContours(subcluster.papers)
    subcluster.densityContours = contours
  })
}

/**
 * Estimates paper density contours.
 *
 * @param {array} papers
 *
 *   Papers whose density contours are to be estimated.
 *
 * @return {object}
 *
 *   Has the following fields,
 *   - `domain`: {array} domain of the projection from a paper coordinate to
 *     a density estimator coordinate.
 *   - `estimatorSize`: {number} length of one edge of a square used to
 *     estimate density.
 *   - `contours`: {array} estimated contours.
 */
function estimatePaperDensityContours (papers) {
  const halfDomainSize =
    (0.5 * getBoundingSquareSize(papers)) + config.paperDensityMargin
  const domain = [-halfDomainSize, halfDomainSize]
  // for mapping from paper to density estimator coordinates,
  // [-1, 1] --> [0, 600] worked well
  const estimatorSize = Math.round(600 * halfDomainSize)
  const project = scaleLinear()
    .domain(domain)
    .range([0, estimatorSize])
  const densityEstimator = contourDensity()
    .x(d => project(d.x))
    .y(d => project(d.y))
    .size([estimatorSize, estimatorSize])
    .cellSize(8) // empirical
    .bandwidth(30) // empirical
    .thresholds(Math.max(2, Math.round(Math.sqrt(papers.length) * 0.5)))
  const contours = densityEstimator(papers)
  // calculates the mean prob of every contour
  // updates the contents of contours
  let papersOut = papers
  for (let i = contours.length - 1; i >=0; --i) {
    const contour = contours[i]
    function isInGeoPolygons (paper) {
      const x = project(paper.x)
      const y = project(paper.y)
      return contour.coordinates.some(geoPolygon => {
        return geoPolygonContains(geoPolygon, [x, y])
      })
    }
    let papersIn = papersOut.filter(isInGeoPolygons)
    papersOut = papersOut.filter(p => papersIn.indexOf(p) === -1)
    contour.numPapers = papersIn.length
    if (papersIn.length > 0) {
      contour.meanProb = d3Mean(papersIn, p => p.prob)
    } else {
      contour.meanProb = 0.0
    }
  }
  return {
    domain,
    estimatorSize,
    contours
  }
}

/**
 * Renders island contours of given clusters.
 *
 * This function mutates the contents of `clusters`.
 *
 * @param {array} clusters
 *
 *   Clusters whose islands are to be rendered.
 */
function renderIslandContours (clusters) {
  clusters.forEach(cluster => {
    const contours = estimateIslandContours(cluster.subclusters)
    cluster.islandContours = contours
  })
}

/**
 * Estimates island contours of given subclusters.
 *
 * @param {array} subclusters
 *
 *   Subclusters that form an island to be estimated.
 *
 * @return {object}
 *
 *   Has the following fields,
 *   - `domain`: {`array`} domain of the projection from a cluster coordinate
 *     to a density estimator coordinate.
 *   - `estimatorSize`: {`number`} length of one edge of a square used by
 *     a density estimator.
 *   - `contours`: {array} estimated island contours.
 */
function estimateIslandContours (subclusters) {
  const clusterR =
    (0.5 * getBoundingSquareSize(subclusters)) + config.islandContourMargin
  const domain = [-clusterR, clusterR]
  const estimatorSize = Math.round((clusterR / 3.0) * 600) // 600 for clusterR=3.0 empirically works well
  const estimatorProject = scaleLinear()
    .domain(domain)
    .range([0, estimatorSize])
  const estimatorScale = scaleLinear()
    .domain([0, clusterR])
    .range([0, 0.5 * estimatorSize])
  // projects all of the papers in all subclusters
  const projectedPapers = Array.prototype.concat.apply(
    [],
    subclusters.map((subcluster, i) => {
      const { papers } = subcluster
      // projection is just a translation
      const paperProjectX = x => estimatorProject(x + subcluster.x)
      const paperProjectY = y => estimatorProject(y + subcluster.y)
      return papers.map(paper => {
        return {
          x: paperProjectX(paper.x),
          y: paperProjectY(paper.y)
        }
      })
    })
  )
  // estimates density
  const densityEstimator = contourDensity()
    .size([estimatorSize, estimatorSize])
    .x(d => d.x)
    .y(d => d.y)
    .bandwidth(36) // empirical value
    .thresholds(25) // empirical value
  const contours = densityEstimator(projectedPapers)
  return {
    domain,
    estimatorSize,
    contours: contours.slice(0, 2) // leaves outmost two contours
  }
}

/**
 * Initializes grids to render probability contours.
 *
 * @param {number} numGridRows
 *
 *   Number of rows in the grids.
 *
 * @param {number} numGridColumns
 *
 *   Number of columns in the grids.
 *
 * @return {array}
 *
 *   Grids for probability contour rendering.
 */
function initializePaperProbabilityGrids (numGridRows, numGridColumns) {
  const grids = new Array(numGridRows * numGridColumns)
  for (let r = 0; r < numGridRows; ++r) {
    for (let c = 0; c < numGridColumns; ++c) {
      grids[c + (r * numGridColumns)] = {
        numPapers: 0,
        totalProb: 0,
        prob () {
          return (this.numPapers > 0) ? (this.totalProb / this.numPapers) : 0
        }
      }
    }
  }
  return grids
}

/**
 * Returns the bounding box of given nodes.
 *
 * @param {array} nodes
 *
 *   Array of nodes whose bounding box is to be obtained.
 *
 * @return {object}
 *
 *   Has the following fields,
 *   - `minX`: minimum x-coordinate value of the bounding box.
 *   - `maxX`: maximum x-coordinate value of the bounding box.
 *   - `minY`: minimum y-coordinate value of the bounding box.
 *   - `maxY`: maximum y-coordinate value of the bounding box.
 */
function getBoundingBox (nodes) {
  return {
    minX: d3Min(nodes.map(node => node.x - node.r)),
    maxX: d3Max(nodes.map(node => node.x + node.r)),
    minY: d3Min(nodes.map(node => node.y - node.r)),
    maxY: d3Max(nodes.map(node => node.y + node.r))
  }
}

/**
 * Returns the size of the bonding square of given nodes.
 *
 * @param {array} nodes
 *
 *   Array of nodes whose bounding square size is to be obtained.
 *
 * @return {number}
 *
 *   Size, length of an edge, of the bounding square.
 */
function getBoundingSquareSize (nodes) {
  const {
    minX,
    maxX,
    minY,
    maxY
  } = getBoundingBox(nodes)
  return Math.max(maxX - minX, maxY - minY)
}

/**
 * Returns a `d3-force` force object that centers a bounding box.
 *
 * @return {function}
 *
 *   `d3-force` force object that centers a bounding box.
 */
function forceBoundingBoxCenter () {
  let _nodes

  function force () {
    const {
      minX,
      maxX,
      minY,
      maxY
    } = getBoundingBox(_nodes)
    const cX = minX + (0.5 * (maxX - minX))
    const cY = minY + (0.5 * (maxY - minY))
    _nodes.forEach(node => {
      node.x -= cX
      node.y -= cY
    })
  }

  force.initialize = function (nodes) {
    _nodes = nodes
  }

  return force
}

/**
 * Returns whether a given geo-polygon contains a specified point.
 *
 * @param {array} geoPolygon
 *
 *   Geo-polygon to test if it contains `xy`.
 *   The first element is the outer contour.
 *   Second and later elements are holes.
 *
 * @param {array} xy
 *
 *   Point to test if it is included in `geoPolygon`.
 *
 * @return {boolean}
 */
function geoPolygonContains (geoPolygon, xy) {
  if (polygonContains(geoPolygon[0], xy)) {
    return geoPolygon.slice(1).every(polygon => {
      return !polygonContains(polygon, xy)
    })
  } else {
    return false
  }
}

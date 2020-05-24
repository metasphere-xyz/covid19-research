/**
 * Renders data using D3.js.
 *
 * @module render
 */

import {
  cumsum as d3Cumsum,
  max as d3Max,
  mean as d3Mean,
  median as d3Median,
  min as d3Min,
  sum as d3Sum
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
  // configuration for cluster arrangement.
  clusterArrangement: {
    // factor to be multiplied to LDA coordinates.
    coordinateScale: 150.0,
    // padding inside a cluster.
    padding: 4.0,
    // whether clusters are to be attracted toward the center.
    gravity: false,
    // whether clusters try to stick to the initial positions.
    anchorPosition: true,
    // whether distance between clusters is kept.
    keepDistance: false,
    // factor multiplied to distance between clusters.
    // ignored unless keepDistance is true.
    distanceScale: 1.0
  },
  // configuration for subcluster arrangement.
  subclusterArrangement: {
    // factor to be multiplied to LDA coordinates.
    coordinateScale: 3.5,
    // function that calculates a padding inside a subcluster.
    getPadding: calculateConfidencePadding.bind(null, 0.3),
    // getPadding: getFixedPadding.bind(null, 0.2),
    // whether subclusters are to be attracted toward the center of the cluster.
    gravity: true,
    // whether subclusters try to stick to the initial positions.
    anchorPosition: false,
    // whether distance between subclusters is kept.
    keepDistance: true,
    // factor multiplied to distance between subclusters.
    // ignored unless keepDistance is true.
    distanceScale: 6.0
  },
  // margin of a paper density estimator.
  paperDensityMargin: 0.1,
  // maximum strength that draws papers toward the center.
  maxPaperCenteringStrength: 0.075,
  // configuration for island contour estimation.
  islandContourEstimator: {
    // margin of an island contour estimator.
    margin: 0.5,
    // bandwidth of a density contour estimator.
    bandwidth: 90,
    // thresholds of a density contour estimator.
    thresholds: 10,
    // number of contours to be outputted.
    numContours: 3
  },
  // noise function for island contours
  islandContourNoiseFunction: composeNoiseFunction([
    {
      offset: 0,
      amplitude: 40.0,
      frequency: 0.01
    },
    {
      offset: 0,
      amplitude: 10.0,
      frequency: 0.025
    }
  ])
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
      // adds noise to island contours
      makeIslandContoursNoisy(clusterNodes)
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
  // the less the mean prob, the sparser the distribution
  const meanProb = d3Mean(papers.prob)
  const minDistance = 1.0 - meanProb
  return papers.prob.map((prob, i) => {
    const angle = i * angleRate
    const distance = minDistance + Math.pow(1.0 - prob, 2)
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
  const {
    coordinateScale,
    getPadding
  } = config.subclusterArrangement
  return paperNodesList.map((paperNodes, i) => {
    const innerR = 0.5 * getBoundingSquareSize(paperNodes)
    const padding = getPadding(paperNodes)
    const x0 = coordinateScale * cluster.x[i]
    const y0 = coordinateScale * cluster.y[i]
    return {
      topicId: cluster.topic[i],
      x0,
      y0,
      x: x0,
      y: y0,
      r: innerR + padding,
      numPapers: paperNodes.length,
      papers: paperNodes
    }
  })
}

/**
 * Returns a fixed padding for a subcluster containing given papers.
 *
 * By binding the first argument, you can make a padding function.
 *
 * @param {number} padding
 *
 *   Fixed padding in a subcluster.
 *
 * @param {array} papers
 *
 *   Ignored.
 *
 * @return {number}
 *
 *   `padding`.
 */
function getFixedPadding (padding, papers) {
  return padding
}

/**
 * Returns a padding for a subcluster containing given papers.
 *
 * Padding is proportional to the confidence of the subcluster.
 * Confidence of a subcluster is defined as `1.0 - median(papers.prob)`
 * where `median(papers.prob)` is the median of `prob`s of papers in
 * the subcluster.
 *
 * By binding the first argument, you can make a padding function.
 *
 * @param {number} scale
 *
 *   Factor to be multiplied to the confidence.
 *
 * @param {array} papers
 *
 *   Papers in a subcluster.
 *
 * @return {number}
 *
 *   `scale * (1.0 - median(papers.prob))`.
 */
function calculateConfidencePadding (scale, papers) {
  const medianProb = d3Median(papers, p => p.prob)
  return scale * (1.0 - medianProb)
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
  const {
    coordinateScale,
    padding
  } = config.clusterArrangement
  return subclusterNodesList.map((subclusterNodes, i) => {
    const innerR = 0.5 * getBoundingSquareSize(subclusterNodes)
    const x0 = coordinateScale * data.x[i]
    const y0 = coordinateScale * data.y[i]
    return {
      topicId: data.topic[i],
      x0,
      y0,
      x: x0,
      y: y0,
      r: innerR + padding,
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
  const force = forceSimulation(nodes)
  const collide = forceCollide()
    .radius(d => d.r)
  force.force('collide', collide)
  if (config.clusterArrangement.gravity) {
    const centerX = forceX(0)
    const centerY = forceY(0)
    force
      .force('centerX', centerX)
      .force('centerY', centerY)
  }
  if (config.clusterArrangement.anchorPosition) {
    const anchorX = forceX()
      .x(n => n.x0)
    const anchorY = forceY()
      .y(n => n.y0)
    force
      .force('anchorX', anchorX)
      .force('anchorY', anchorY)
  }
  if (config.clusterArrangement.keepDistance) {
    const link = forceLink(makeClusterNodeLinks(nodes))
      .distance(l => l.distance)
    force.force('link', link)
  }
  const center = forceBoundingBoxCenter()
  force.force('center', center)
  return force
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
  const force = forceSimulation(nodes)
  const collide = forceCollide()
    .radius(d => d.r)
  force.force('collide', collide)
  // gravity
  if (config.subclusterArrangement.gravity) {
    const gravityX = forceX(0)
    const gravityY = forceY(0)
    force
      .force('gravityX', gravityX)
      .force('gravityY', gravityY)
  }
  // anchor
  if (config.subclusterArrangement.anchorPosition) {
    const anchorX = forceX()
      .x(n => n.x0)
    const anchorY = forceY()
      .y(n => n.y0)
    force
      .force('anchorX', anchorX)
      .force('anchorY', anchorY)
  }
  // distance
  if (config.subclusterArrangement.keepDistance) {
    const link = forceLink(makeSubclusterNodeLinks(nodes))
      .distance(l => l.distance)
    force.force('link', link)
  }
  // centers the bounding box
  const center = forceBoundingBoxCenter()
  force.force('center', center)
  return force
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
  const { distanceScale } = config.clusterArrangement
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
      const ldaDistance = Math.sqrt((dX * dX) + (dY * dY))
      const distance = iR + jR + (distanceScale * ldaDistance)
      links.push({
        source: i,
        target: j,
        distance
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
  const { distanceScale } = config.subclusterArrangement
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
      const ldaDistance = Math.sqrt((dX * dX) + (dY * dY))
      const distance = iR + jR + (distanceScale * ldaDistance)
      links.push({
        source: i,
        target: j,
        distance
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
    .strength(d => d.prob * config.maxPaperCenteringStrength)
  const centerY = forceY(0)
    .strength(d => d.prob * config.maxPaperCenteringStrength)
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
  const {
    margin,
    bandwidth,
    thresholds,
    numContours
  } = config.islandContourEstimator
  const clusterR = (0.5 * getBoundingSquareSize(subclusters)) + margin
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
    .bandwidth(bandwidth) // empirical value
    .thresholds(thresholds) // empirical value
  const contours = densityEstimator(projectedPapers)
  return {
    domain,
    estimatorSize,
    contours: contours.slice(0, numContours) // leaves outmost contours
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
      node.x0 -= cX
      node.y0 -= cY
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

/**
 * Makes island contours noisy.
 *
 * This function mutates the contents of `clusters`.
 *
 * @param {array} clusters
 *
 *   Clusters whose island contours are to be noisy.
 */
function makeIslandContoursNoisy (clusters) {
  clusters.forEach(cluster => {
    // saves the original contours as rawIslandContours
    cluster.rawIslandContours = cluster.islandContours
    cluster.islandContours = createNoisyContours(cluster.islandContours)
  })
}

/**
 * Creates noise contours from given contours.
 *
 * @param {object} contours
 *
 *   Has the following fields,
 *   - `contours`
 *   - `domain`
 *   - `estimatorSize`
 *
 * @return {object}
 *
 *   A new object containing noisy contours.
 *   Has the following fields,
 *   - `contours`
 *   - `domain`: same as the input
 *   - `estimatorSize`: same as the input
 */
function createNoisyContours ({ contours, domain, estimatorSize }) {
  const newContours = contours.map(
    addNoiseToPaths.bind(null, config.islandContourNoiseFunction))
  return {
    contours: newContours,
    domain,
    estimatorSize
  }
}

/**
 * Adds noise to given paths.
 *
 * @param {function} noiseFunction
 *
 *   Function that takes a scalar value and returns a noise value.
 *
 * @param {object} polygons
 *
 *   Has at least the following field,
 *   - `coordinates`
 *
 * @return {object}
 *
 *   Has the following fields,
 *   - All fields of `polygons` except for `coordinates`.
 *   - `coordinates`: noisy polygons.
 */
function addNoiseToPaths (noiseFunction, polygons) {
  const newCoordinates = polygons.coordinates.map(ring => {
    return ring.map(addNoiseToPolygon.bind(null, noiseFunction))
  })
  return {
    ...polygons,
    coordinates: newCoordinates
  }
}

/**
 * Adds noise to a given polygon.
 *
 * @param {function} noiseFunction
 *
 *   Function that takes a scalar value and returns a noise value.
 *
 * @param {array} polygon
 *
 *   Polygon to add noise.
 *
 * @return {array}
 *
 *   Noisy polygon.
 */
function addNoiseToPolygon (noiseFunction, polygon) {
  const cumulativeDistances = d3Cumsum(calculateDistances(polygon))
  const normalVectors = new Array(cumulativeDistances.length - 1)
  for (let i = 0; i < normalVectors.length; ++i) {
    normalVectors[i] = calculateNormalVector(
      polygon[i],
      polygon[i + 1],
      polygon[i + 2])
  }
  // reduces abrupt changes of normal vector directions
  correctNormalVectors(normalVectors)
  const noiseSeries = cumulativeDistances.map(noiseFunction)
  // moves each point by noise along its normal vector
  const newPolygon = new Array(polygon.length)
  // the first and last points do not move
  newPolygon[0] = polygon[0]
  newPolygon[polygon.length - 1] = polygon[polygon.length - 1]
  for (let i = 0; i < normalVectors.length; ++i) {
    const point = polygon[i + 1]
    const normalVector = normalVectors[i]
    const noise = noiseSeries[i]
    newPolygon[i + 1] = [
      point[0] + (noise * normalVector[0]),
      point[1] + (noise * normalVector[1])
    ]
  }
  return newPolygon
}

/**
 * Calculates distances of given points.
 *
 * @param {array} points
 *
 *   Points to calculate distances.
 *
 * @return {array}
 *
 *   Distances.
 */
function calculateDistances (points) {
  const distances = new Array(points.length - 1)
  for (let i = 0; i < (points.length - 1); ++i) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    const dX = x2 - x1
    const dY = y2 - y1
    distances[i] = Math.sqrt((dX * dX) + (dY * dY))
  }
  return distances
}

/**
 * Calculates a normal vector at a middle point.
 *
 * @param {array} p1
 *
 * @param {array} p2
 *
 * @param {array} p3
 *
 * @return {array}
 *
 *   Normal vector at `p2`.
 */
function calculateNormalVector (p1, p2, p3) {
  const u = makeUnitVector([
    p2[0] - p1[0],
    p2[1] - p1[1]
  ])
  const v = makeUnitVector([
    p3[0] - p2[0],
    p3[1] - p2[1]
  ])
  const w = makeUnitVector([
    u[0] - v[0],
    u[1] - v[1]
  ])
  return w
}

/**
 * Returns a unit vector of a given vector.
 *
 * @param {array} v
 *
 *   Vector to make a unit vector.
 *
 * @return {array}
 *
 *   Unit vector of `v`.
 */
function makeUnitVector (v) {
  const length = Math.sqrt((v[0] * v[0]) + (v[1] * v[1]))
  const scale = (length !== 0.0) ? (1.0 / length) : 0.0
  return [
    scale * v[0],
    scale * v[1]
  ]
}

/**
 * Corrects normal vectors.
 *
 * This function mutates the contents of `normalVectors`.
 *
 * @param {array} normalVectors
 *
 *   Normal vectors to correct.
 */
function correctNormalVectors (normalVectors) {
  for (let i = 0; i < (normalVectors.length - 1); ++i) {
    const v1 = normalVectors[i]
    const v2 = normalVectors[i + 1]
    const cos = dotProduct(v1, v2)
    // flips the direction if the angle made by v1 and v2 is not between
    // -90 and 90 degree; i.e., cosine of the angle is negative.
    if (cos < 0) {
      v2[0] = -v2[0]
      v2[1] = -v2[1]
    }
  }
}

/**
 * Calculates a dot product of given two vectors.
 *
 * @param {array} v1
 *
 *   Vector 1.
 *
 * @param {array} v2
 *
 *   Vector 2.
 *
 * @return {number}
 *
 *   Dot product of `v1` and `v2`.
 */
function dotProduct (v1, v2) {
  return (v1[0] * v2[0]) + (v1[1] * v2[1])
}

/**
 * Composes a noise function of given settings.
 *
 * @param {array} options
 *
 *   Options for Perlin Noise function.
 *   Each element is an object with the following fields,
 *   - `offset`
 *   - `amplitude`
 *   - `frequency`
 *
 * @return {function}
 *
 *   Composed noise function.
 */
function composeNoiseFunction (options) {
  return function (x) {
    return d3Sum(options.map(option => {
      const {
        offset,
        amplitude,
        frequency
      } = option
      return amplitude * perlin1d(offset + (x * frequency))
    }))
  }
}

/**
 * Calculates a 1-D Perlin Noise value.
 *
 * @param {number} x
 *
 * @return {number}
 *
 *   Noise value at `x` between -1.0 and 1.0.
 */
function perlin1d (x) {
  const xi = Math.floor(x) & 0xFF
  const xf = x - Math.floor(x)
  const u = fade(xf)
  const x1 = lerp(
    grad(permutation[xi], xf),
    grad(permutation[xi + 1], xf - 1.0),
    u
  )
  return x1
}

function fade (t) {
  return t * t * t * ((t * ((t * 6) - 15)) + 10)
}

function lerp (a, b, x) {
  return a + (x * (b - a))
}

function grad (hash, x) {
  return ((hash & 0x1) === 0) ? x : -x
}

/** Pseudo random sequence for Perlin Noise. */
const permutation = [
  151,160,137,91,90,15,
  131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
  88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
  77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
  102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
  135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
  5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
  223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
  129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
  251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
  49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
]

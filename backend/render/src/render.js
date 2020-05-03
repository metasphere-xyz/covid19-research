/**
 * Renders data using D3.js.
 *
 * @module render
 */

import {
  max as d3Max,
  min as d3Min
} from 'd3-array'
import {
  contours as d3Contours
} from 'd3-contour'
import {
  forceCollide,
  forceLink,
  forceSimulation,
  forceX,
  forceY
} from 'd3-force'
import {
  scaleLinear
} from 'd3-scale'

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
  const clusterNodes = makeClusterNodes(data)
  const subclusterNodesList = makeSubclusterNodesList(data)
  const paperClusterList = makePaperClusters(data)
  return arrangeClusters(clusterNodes)
    .then(clusterNodes => {
      return Promise.all(subclusterNodesList.map(arrangeClusters))
        .then(subclusterNodesList => {
          // associates each cluster and its subclusters
          clusterNodes.forEach((node, i) => {
            node.subclusters = subclusterNodesList[i]
          })
          return clusterNodes
        })
    })
    .then(clusterNodes => {
      console.log('arranging paper clusters')
      return arrangePaperClusters(paperClusterList)
        .then(paperClusterList => {
          // associates each subcluster and its papers
          return mergeClustersAndPaperDistributions(
            clusterNodes,
            paperClusterList)
        })
    })
    .then(clusterNodes => {
      console.log('making paper probability contours')
      makeAllPaperProbabilityContours(clusterNodes)
      return clusterNodes
    })
}

/**
 * Makes `d3-force` nodes to arrange clusters.
 *
 * @param {object} data
 *
 *   Data of clusters.
 *
 * @return {array}
 *
 *   `d3-force` nodes to arrange clusters.
 */
function makeClusterNodes (data) {
  const numClusters = data.x.length
  const totalNumPapers = countPapers(data.papers)
  const clusterNodes = new Array(numClusters)
  for (let clusterI = 0; clusterI < numClusters; ++clusterI) {
    const paper = data.papers[clusterI]
    clusterNodes[clusterI] = {
      x: data.x[clusterI],
      y: data.y[clusterI],
      size: 0.25 * Math.sqrt(paper.num_papers / totalNumPapers),
      numPapers: paper.num_papers
    }
  }
  return clusterNodes
}

/**
 * Count papers.
 *
 * @param {array} papers
 *
 *   Array of paper information objects that has the following field,
 *   - `num_papers`: {`number`} number of papers in a cluster.
 *
 * @return {number}
 *
 *   Total number of papers.
 */
function countPapers (papers) {
  return papers.reduce(
    (sum, paper) => sum + paper.num_papers,
    0
  )
}

/**
 * Makes list of subcluster nodes.
 */
function makeSubclusterNodesList (data) {
  return data.second_layer.map(makeClusterNodes)
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
    .radius(node => node.size)
  const center = forceBoundingBoxCenter()
  const centerX = forceX()
    .x(0)
  const centerY = forceY()
    .y(0)
  const links = calculateClusterNodeLinks(nodes)
  const link = forceLink(links)
    .distance(link => link.distance)
    .strength(() => 0.5)
  return forceSimulation(nodes)
    .force('collide', collide)
    .force('center', center)
    .force('centerX', centerX)
    .force('centerY', centerY)
    .force('link', link)
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
    const minX = d3Min(_nodes.map(node => node.x - node.size))
    const maxX = d3Max(_nodes.map(node => node.x + node.size))
    const minY = d3Min(_nodes.map(node => node.y - node.size))
    const maxY = d3Max(_nodes.map(node => node.y + node.size))
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
 * Calculates cluster node links.
 *
 * @return {array}
 *
 *   Links between cluster nodes.
 */
function calculateClusterNodeLinks (nodes) {
  const links = []
  for (let i = 0; i < (nodes.length - 1); ++i) {
    const { x: xI, y: yI } = nodes[i]
    for (let j = i + 1; j < nodes.length; ++j) {
      const { x: xJ, y: yJ } = nodes[j]
      const dX = xJ - xI
      const dY = yJ - yI
      const distance = Math.sqrt((dX * dX) + (dY * dY))
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
 * Makes paper clusters.
 */
function makePaperClusters (data) {
  return data.second_layer.map(makePaperNodesList)
}

function makePaperNodesList (cluster) {
  return cluster.papers.map(makePaperNodes)
}

function makePaperNodes (papers) {
  const radius = 0.01
  const angleSpeed = (2.0 * Math.PI) / papers.prob.length
  return papers.prob.map((prob, i) => {
    const angle = i * angleSpeed
    const distance = Math.pow(1.0 - prob, 2)
    return {
      prob: prob,
      x: distance * Math.cos(angle),
      y: distance * Math.sin(angle),
      r: radius
    }
  })
}

function arrangePaperClusters (paperClusterList) {
  const forceList = paperClusterList.map(paperNodesList => {
    return Promise.all(paperNodesList.map(arrangePapers))
  })
  return Promise.all(forceList)
}

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

function initializePaperArrangingForce (papers) {
  const collide = forceCollide()
    .radius(d => d.r)
    .iterations(15)
  const centerX = forceX(0)
    .strength(0.05)
  const centerY = forceY(0)
    .strength(0.05)
  const force = forceSimulation(papers)
    .alphaMin(0.001)
    .alphaDecay(0.0399) // 200 updates
    .force('collide', collide)
    .force('centerX', centerX)
    .force('centerY', centerY)
  return force
}

/**
 * Merges cluster and paper distributions.
 *
 * This function mutates the input object `clusterNodes`.
 */
function mergeClustersAndPaperDistributions (clusterNodes, paperClusterList) {
  clusterNodes.forEach((clusterNode, i) => {
    const paperNodesList = paperClusterList[i]
    clusterNode.subclusters.forEach((subcluster, j) => {
      subcluster.papers = paperNodesList[j]
    })
  })
  return clusterNodes
}

/**
 * Makes paper probability contours.
 *
 * This function mutates the input object `clusterNodes`.
 *
 * @param {array} clusterNodes
 *
 *   Clusters to make paper probability contours.
 */
function makeAllPaperProbabilityContours (clusterNodes) {
  clusterNodes.forEach(makePaperProbabilityContours)
}

/**
 * Makes paper probability contours.
 *
 * @param {object} clusterNode
 *
 *   Cluster to make paper probability contours.
 */
function makePaperProbabilityContours (clusterNode) {
  // initializes grids
  const numGridRows = 80
  const numGridColumns = 80
  const innerMargin = 0.2
  const grids = initializePaperProbabilityGrids(numGridRows, numGridColumns)
  // puts papers into grids
  clusterNode.subclusters.forEach(subcluster => {
    const { papers } = subcluster
    const innerR = subcluster.size * (1.0 - innerMargin)
    const innerD = 2.0 * innerR
    const minPaperX = d3Min(papers.map(p => p.x - p.r))
    const maxPaperX = d3Max(papers.map(p => p.x + p.r))
    const minPaperY = d3Min(papers.map(p => p.y - p.r))
    const maxPaperY = d3Max(papers.map(p => p.y + p.r))
    // subcluster coordinate --> [-0.5, 0.5] --> [0.0, 1.0]
    const paperScaleX = scaleLinear()
      .domain([minPaperX, maxPaperX])
      .range([(subcluster.x - innerR) + 0.5, (subcluster.x + innerR) + 0.5])
    const paperScaleY = scaleLinear()
      .domain([minPaperY, maxPaperY])
      .range([(subcluster.y - innerR) + 0.5, (subcluster.y + innerR) + 0.5])
    papers.forEach(paper => {
      const paperX = paperScaleX(paper.x)
      const paperY = paperScaleY(paper.y)
      // [0.0, 1.0] --> [0, numGridColumns] and [0, numGridRows]
      const row = Math.floor(numGridRows * paperY)
      const column = Math.floor(numGridColumns * paperX)
      // TODO: take care of index range errors
      const grid = grids[column + (row * numGridColumns)]
      ++grid.numPapers
      grid.totalProb += paper.prob
    })
  })
  // creates contours
  const contourGenerator = d3Contours()
    .size([numGridColumns, numGridRows])
  const thresholds = Array.from({ length: 8 }).map((_, i) => (i + 1) * 0.1)
  const gridProbs = grids.map(grid => grid.prob())
  console.log(gridProbs)
  const contours = thresholds.map(threshold => {
    return contourGenerator.contour(gridProbs, threshold)
  })
  clusterNode.contours = contours
}

/**
 * Initializes grids to make probability contours.
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
 *   Grids for probability contour generation.
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

<template>
  <div class="explorer">
    <div class="columns is-gapless">
      <div class="column is-two-thirds">
        <div
          ref="svg-container"
          class="svg-container"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
          @wheel.prevent="onWheel"
        >
          <svg
            ref="svg"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            version="1.1"
            :width="svg.width"
            :height="svg.height"
          />
        </div>
      </div>
      <div class="column paper-column">
        <paper :paper="selected.article" />
      </div>
    </div>
    <b-loading
      :active.sync="isLoadingData"
      :is-full-page="false"
      :can-cancel="false"
    />
  </div>
</template>

<script>
import * as d3 from 'd3'

import Paper from '@components/paper'

/**
 * Cluster and paper explorer.
 *
 * @namespace Explorer
 *
 * @memberof module:components
 */
export default {
  name: 'Expolorer',
  components: {
    Paper
  },
  props: {
    zoomFactor: {
      type: Number,
      default: 0.95
    }
  },
  data () {
    return {
      // whether data loading is going on
      isLoadingData: true,
      // canvas size.
      // configured on mounted
      svg: {
        width: 300,
        height: 300
      },
      // clusters and paper
      clusters: [],
      selected: {
        node: null,
        article: null
      },
      // visible region
      screenView: {
        scale: 600, // 1 (data) : 800 (screen)
        translateX: 0,
        translateY: 0
      },
      // manages a drag event
      drag: {
        isActive: false,
        lastX: 0,
        lastY: 0
      }
    }
  },
  computed: {
    svgCenterX () {
      return this.svg.width * 0.5
    },
    svgCenterY () {
      return this.svg.height * 0.5
    },
    // x range of cluster-to-screen projection.
    screenViewXRange () {
      const {
        scale,
        translateX
      } = this.screenView
      const halfScale = scale * 0.5
      return [
        (this.svgCenterX + translateX) - halfScale,
        (this.svgCenterX + translateX) + halfScale
      ]
    },
    // y range of cluser-to-screen projection.
    // upside down.
    screenViewYRange () {
      const {
        scale,
        translateY
      } = this.screenView
      const halfScale = scale * 0.5
      return [
        (this.svgCenterY + translateY) + halfScale,
        (this.svgCenterY + translateY) - halfScale
      ]
    },
    // domain of clusters.
    clusterBoundingSquareSize () {
      const minX = d3.min(this.clusters, c => c.x - c.r)
      const maxX = d3.max(this.clusters, c => c.x + c.r)
      const minY = d3.min(this.clusters, c => c.y - c.r)
      const maxY = d3.max(this.clusters, c => c.y + c.r)
      return Math.max(maxX - minX, maxY - minY)
    },
    // radius of a paper dot.
    paperDotRadius () {
      const { scale } = this.screenView
      if (scale <= 24000.0) {
        return 2.5
      } else {
        return 5.0
      }
    }
  },
  created () {
    this.promiseReady = fetch('./cluster-data.json')
      .then(response => {
        return response.json()
          .then(clusters => {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`loaded cluster data`)
            }
            this.clusters = clusters
            this.renderClusters(this.clusters)
          })
      })
      .catch(err => {
        console.error(err)
      })
      .finally(() => {
        this.isLoadingData = false
      })
  },
  mounted () {
    const container = this.$refs['svg-container']
    this.svg.width = container.clientWidth
    this.svg.height = container.clientHeight
  },
  methods: {
    renderClusters (clusters) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('start renderClusters')
      }
      const vm = this
      const svg = d3.select(this.$refs['svg'])
      const projection = this.initializeProjection(clusters)
      // filters out invisible clusters
      const visibleClusters =
        clusters.filter(this.isClusterVisible.bind(this, projection))
      // removes the contents
      // this improves the speed to update the screen
      svg.select('g.base-pane')
        .remove()
      const contents = svg.append('g')
        .attr('class', 'base-pane')
      const universePane = contents.append('g')
        .attr('class', 'universe-pane')
      universePane.append('rect')
        .attr('class', 'ocean')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', this.svg.width)
        .attr('height', this.svg.height)
      const islandPane = contents.append('g')
        .attr('class', 'island-pane')
      const paperPane = contents.append('g')
        .attr('class', 'paper-pane')
      // renders subclusters
      visibleClusters.forEach(cluster => {
        const clusterId = `cluster-${cluster.topicId}`
        const clusterProjection = projection.translate(cluster.x, cluster.y)
        const visibleSubclusters = cluster.subclusters.filter(
          this.isClusterVisible.bind(this, clusterProjection))
        // renders the island contour
        const islandPathProjection = this.makeContourPathProjection(
          clusterProjection,
          cluster.islandContours)
        islandPane.selectAll(`path.island-contour.${clusterId}`)
          .data(cluster.islandContours.contours.slice(0, 1)) // outmost contour
          .join('path')
            .attr('class', `island-contour ${clusterId}`)
            .attr('d', islandPathProjection)
        // reduces rendering efforts depending on the scale
        // TODO: mipmap approach may be needed
        //       because contours are still too fine when zoomed out.
        if (this.screenView.scale < 6000) {
          visibleSubclusters.forEach(subcluster => {
            const subclusterId =
              `subcluster-${cluster.topicId}-${subcluster.topicId}`
            const subclusterProjection =
              clusterProjection.translate(subcluster.x, subcluster.y)
            const densityPathProjection = this.makeContourPathProjection(
              subclusterProjection,
              subcluster.densityContours)
            paperPane.selectAll(`path.density-contour.${subclusterId}`)
              .data(subcluster.densityContours.contours)
              .join('path')
                .attr('class', `density-contour ${subclusterId}`)
                .attr('d', densityPathProjection)
                .attr('fill', d => d3.interpolateGreys(d.meanProb))
          })
        } else {
          // renders individual papers if zoomed enough
          visibleSubclusters.forEach(subcluster => {
            const subclusterId =
              `subcluster-${cluster.topicId}-${subcluster.topicId}`
            const subclusterProjection =
              clusterProjection.translate(subcluster.x, subcluster.y)
            paperPane.selectAll(`circle.paper-dot.${subclusterId}`)
              .data(subcluster.papers)
              .join('circle')
                .attr('class', function (d) {
                  let css = `paper-dot ${subclusterId}`
                  // marks if the data is selected.
                  if (d === vm.selected.article) {
                    css += ' selected'
                    // remembers `this` element to cancel selection
                    vm.selected.node = this
                  }
                  return css
                })
                .attr('cx', d => subclusterProjection.projectX(d.x))
                .attr('cy', d => subclusterProjection.projectY(d.y))
                .attr('r', this.paperDotRadius)
                .on('pointerover', function (d) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.log(`pointerover: ${d.paper_id}`)
                  }
                  this.classList.add('highlighted')
                })
                .on('pointerout', function (d) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.log(`pointerout: ${d.paper_id}`)
                  }
                  this.classList.remove('highlighted')
                })
                .on('pointerdown', function (d) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.log(`pointerdown: ${d.paper_id}`)
                  }
                  if (vm.selected.node != null) {
                    vm.selected.node.classList.remove('selected')
                  }
                  vm.selected = {
                    node: this,
                    article: d
                  }
                  this.classList.add('selected')
                })
          })
        }
      })
      if (process.env.NODE_ENV !== 'production'){
        console.log('finish renderClusters')
      }
    },
    onPointerDown (event) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('onPointerDown', event)
      }
      const container = this.$refs['svg-container']
      const { target, pointerId, clientX, clientY } = event
      container.setPointerCapture(pointerId)
      this.drag.isActive = true
      this.drag.lastX = clientX
      this.drag.lastY = clientY
      event.preventDefault()
    },
    onPointerMove (event) {
      if (!this.drag.isActive) {
        return
      }
      const { clientX, clientY } = event
      const dX = clientX - this.drag.lastX
      const dY = clientY - this.drag.lastY
      this.drag.lastX = clientX
      this.drag.lastY = clientY
      this.pan(dX, dY)
      event.preventDefault()
    },
    onPointerUp (event) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('onPointerUp', event)
      }
      if (this.drag.isActive) {
        event.preventDefault()
      }
      this.drag.isActive = false
    },
    onPointerCancel (event) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('onPointerCancel', event)
      }
      this.drag.isActive = false
    },
    pan (dX, dY) {
      this.screenView.translateX += dX
      this.screenView.translateY += dY
      this.renderClusters(this.clusters)
    },
    onWheel (event) {
      const container = this.$refs['svg-container']
      const { target, clientX, clientY } = event
      const { left, top } = container.getBoundingClientRect()
      const zoomAtX = clientX - left
      const zoomAtY = clientY - top
      if (process.env.NODE_ENV !== 'production') {
        console.log('onWheel', zoomAtX, zoomAtY)
      }
      if (event.deltaY < 0) {
        this.zoomIn(zoomAtX, zoomAtY)
      } else {
        this.zoomOut(zoomAtX, zoomAtY)
      }
      this.renderClusters(this.clusters)
    },
    zoomIn (zoomAtX, zoomAtY) {
      this.zoom(zoomAtX, zoomAtY, 1.0 / this.zoomFactor)
    },
    zoomOut (zoomAtX, zoomAtY) {
      this.zoom(zoomAtX, zoomAtY, this.zoomFactor)
    },
    zoom (zoomAtX, zoomAtY, factor) {
      // algorithm
      //
      // projection from cluster to screen
      // f: [-0.5, 0.5] --> [x0 - w/2, x0 + w/2]
      // where
      //   x0 = `screenView.translateX + svgCenterX`
      //   w  = `screenView.scale`
      //
      // inverse projection; i.e., from screen to cluster
      // F: [x0 - w/2, x0 + w/2] --> [-0.5, 0.5]
      //
      // projection after zooming will be
      // f': [-0.5, 0.5] --> [x0' - w'/2, x0' + w'/2]
      // F': [x0' - w'/2, x0' + w'/2] --> [-0.5, 0.5]
      // where
      //   x0' = ?
      //   w'  = αw
      //   α   = `factor`
      //
      // x0' is determined so that F(x) = F'(x)
      // where
      //   x = `zoomAtX`
      //
      // F(x)  = (x - x0)/w - 0.5
      // F'(x) = (x - x0')/αw - 0.5
      //
      // (x - x0)/w - 0.5 = (x - x0')/αw - 0.5
      //       (x - x0)/w = (x - x0')/αw
      //        α(x - x0) = x - x0'
      // then
      // x0' = x - α(x - x0)
      //     = (x - x0) - α(x - x0) + x0
      //     = (1 - α)(x - x0) + x0
      //     = (1 - α)`dX` + x0
      //
      // a similar algorithm is applied to the y projection
      const {
        translateX,
        translateY
      } = this.screenView
      const dX = zoomAtX - (translateX + this.svgCenterX)
      const dY = zoomAtY - (translateY + this.svgCenterY)
      this.screenView.scale *= factor
      this.screenView.translateX += (1.0 - factor) * dX
      this.screenView.translateY += (1.0 - factor) * dY
      if (process.env.NODE_ENV !== 'production') {
        console.log('updated scale', this.screenView.scale)
      }
    },
    // returns a projection from data --> screen.
    // scale is consistent among clusters, subcluster and papers.
    initializeProjection () {
      const halfClusterSize = 0.5 * this.clusterBoundingSquareSize
      const _projectX = d3.scaleLinear()
        .domain([-halfClusterSize, halfClusterSize])
        .range(this.screenViewXRange)
      const _projectY = d3.scaleLinear()
        .domain([-halfClusterSize, halfClusterSize])
        .range(this.screenViewYRange)
      const _scale = d3.scaleLinear()
        .domain([0.0, halfClusterSize])
        .range([0.0, 0.5 * this.screenView.scale])

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

        scale (x) {
          return _scale(x)
        }

        translate (dX, dY) {
          return new Projection(this.offsetX + dX, this.offsetY + dY)
        }
      }

      return new Projection(0, 0)
    },
    isClusterVisible (projection, cluster) {
      const cX = projection.projectX(cluster.x)
      const cY = projection.projectY(cluster.y)
      const r = projection.scale(cluster.r)
      const minX = cX - r
      const maxX = cX + r
      const minY = cY - r
      const maxY = cY + r
      return (maxX > 0) &&
        (minX < this.svg.width) &&
        (maxY > 0) &&
        (minY < this.svg.height)
    },
    makeContourPathProjection (projection, { domain, estimatorSize }) {
      const minX = projection.projectX(domain[0])
      const maxX = projection.projectX(domain[1])
      const minY = projection.projectY(domain[0])
      const maxY = projection.projectY(domain[1])
      const geoProjectX = d3.scaleLinear()
        .domain([0, estimatorSize])
        .range([minX, maxX])
      const geoProjectY = d3.scaleLinear()
        .domain([0, estimatorSize])
        .range([minY, maxY])
      return d3.geoPath()
        .projection(d3.geoTransform({
          point (x, y) {
            this.stream.point(geoProjectX(x), geoProjectY(y))
          }
        }))
    }
  }
}
</script>

<style lang="scss">
@import 'bulma';

/* true navbar height */
$true-navbar-height: $navbar-height + ($navbar-padding-vertical / 2);

.explorer {
  position: relative;
  width: 100%;
  height: calc(100vh - #{$true-navbar-height});

  .columns {
    height: 100%;
  }

  .column {
    height: 100%;

    &.paper-column {
      padding: 0.25rem !important;
      overflow-y: auto;
      box-shadow: -1px 0px 3px black;
    }
  }

  .svg-container {
    width: 100%;
    height: 100%;
  }
}

rect {
  &.ocean {
    stroke: none;
    fill: lightgrey;
  }
}

circle {
  &.paper-dot {
    stroke: none;
    fill: black;
    fill-opacity: 0.5;

    &.highlighted {
      stroke: yellow;
      stroke-opacity: 0.7;
      stroke-width: 3;
    }
    &.selected {
      stroke: red;
      stroke-opacity: 0.7;
      stroke-width: 3;
    }
  }
}

circle {
  &.cluster {
    stroke: black;
    stroke-width: 1.0;
    stroke-dasharray: 1 1;
    fill: white;
    fill-opacity: 0.0;
  }
}

path {
  &.island-contour {
    stroke: black;
    stroke-width: 0.5;
    fill: white;
  }

  &.density-contour {
    stroke: none;
  }
}
</style>

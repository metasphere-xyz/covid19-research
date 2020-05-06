<template>
  <div class="example">
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

import arrays from '@utils/arrays'
import { debounce } from 'lodash'
import Paper from '@components/paper'

/**
 * Example cluster and paper information.
 *
 * @namespace Explorer
 *
 * @module components
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
        scale: 800, // 1 (data) : 800 (screen)
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
    // fx: [-0.5, 0.5] --> screenViewXRange
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
    // fy: [-0.5, 0.5] --> screenViewYRange
    screenViewYRange () {
      const {
        scale,
        translateY
      } = this.screenView
      const halfScale = scale * 0.5
      return [
        (this.svgCenterY + translateY) - halfScale,
        (this.svgCenterY + translateY) + halfScale
      ]
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
      const svg = d3.select(this.$refs['svg'])
      const baseProjectX = d3.scaleLinear()
        .domain([-0.5, 0.5])
        .range(this.screenViewXRange)
      const baseProjectY = d3.scaleLinear()
        .domain([0.5, -0.5]) // upside down
        .range(this.screenViewYRange)
      const baseScaleR = d3.scaleLinear()
        .domain([0.0, 1.0])
        .range([0.0, this.screenView.scale])
      // filters out invisible clusters
      const visibleClusters = clusters.filter(cluster => {
        const cX = baseProjectX(cluster.x)
        const cY = baseProjectY(cluster.y)
        const r = baseScaleR(cluster.size)
        const minX = cX - r
        const maxX = cX + r
        const minY = cY - r
        const maxY = cY + r
        return (maxX > 0) &&
          (minX < this.svg.width) &&
          (maxY > 0) &&
          (minY < this.svg.height)
      })
      // removes the contents
      // this improves the speed to update the screen
      svg.select('g.base-pane')
        .remove()
      const contents = svg.append('g')
        .attr('class', 'base-pane')
      // renders clusters
      contents.selectAll('circle.cluster')
        .data(visibleClusters)
        .join('circle')
          .attr('class', 'cluster')
          .attr('cx', d => baseProjectX(d.x))
          .attr('cy', d => baseProjectY(d.y))
          .attr('r', d => baseScaleR(d.size))
      // renders subclusters
      visibleClusters.forEach((cluster, i) => {
        const clusterId = `cluster-${i}`
        const clusterX = baseProjectX(cluster.x)
        const clusterY = baseProjectY(cluster.y)
        const clusterR = baseScaleR(cluster.size)
        const clusterProjectX = d3.scaleLinear()
          .domain([-0.5, 0.5])
          .range([clusterX - clusterR, clusterX + clusterR])
        const clusterProjectY = d3.scaleLinear()
          .domain([0.5, -0.5]) // upside down
          .range([clusterY - clusterR, clusterY + clusterR])
        const clusterScaleR = d3.scaleLinear()
          .domain([0.0, 0.5])
          .range([0.0, clusterR])
        // filters out invisible subclusters
        const visibleSubclusters = cluster.subclusters.filter(subcluster => {
          const cX = clusterProjectX(subcluster.x)
          const cY = clusterProjectY(subcluster.y)
          const r = clusterScaleR(subcluster.size)
          const minX = cX - r
          const maxX = cX + r
          const minY = cY - r
          const maxY = cY + r
          return (maxX > 0) &&
            (minX < this.svg.width) &&
            (maxY > 0) &&
            (minY < this.svg.height)
        })
        contents.selectAll(`circle.cluster.subcluster.${clusterId}`)
          .data(visibleSubclusters)
          .join('circle')
            .attr('class', `cluster subcluster ${clusterId}`)
            .attr('cx', d => clusterProjectX(d.x))
            .attr('cy', d => clusterProjectY(d.y))
            .attr('r', d => clusterScaleR(d.size))
        // renders probability contours
        const numGridRows = 80
        const numGridColumns = 80
        const geoProjectX = d3.scaleLinear()
          .domain([0, numGridColumns])
          .range([clusterX - clusterR, clusterX + clusterR])
        const geoProjectY = d3.scaleLinear()
          .domain([numGridRows, 0]) // upside down
          .range([clusterY - clusterR, clusterY + clusterR])
        const geoPath = d3.geoPath()
          .projection(d3.geoTransform({
            point: function (x, y) {
              this.stream.point(geoProjectX(x), geoProjectY(y))
            }
          }))
        contents.selectAll(`path.probability-contour.${clusterId}`)
          .data(cluster.contours)
          .join('path')
            .attr('class', `probability-contour ${clusterId}`)
            .attr('d', d => geoPath(d))
            .attr('fill', d => d3.interpolateTurbo(d.value))
        // renders individual papers if zoomed enough
        if (this.screenView.scale >= 6000) {
          const innerMargin = 0.2
          visibleSubclusters.forEach((subcluster, j) => {
            const subclusterId = `subcluster-${i}-${j}`
            const { papers } = subcluster
            const subclusterX = clusterProjectX(subcluster.x)
            const subclusterY = clusterProjectY(subcluster.y)
            const subclusterR = clusterScaleR(subcluster.size)
            const innerR = subclusterR * (1.0 - innerMargin)
            const paperMinX = d3.min(papers.map(p => p.x - p.r))
            const paperMaxX = d3.max(papers.map(p => p.x + p.r))
            const paperMinY = d3.min(papers.map(p => p.y - p.r))
            const paperMaxY = d3.max(papers.map(p => p.y + p.r))
            const paperProjectX = d3.scaleLinear()
              .domain([paperMinX, paperMaxX])
              .range([subclusterX - innerR, subclusterX + innerR])
            const paperProjectY = d3.scaleLinear()
              .domain([paperMaxY, paperMinY]) // upside down
              .range([subclusterY - innerR, subclusterY + innerR])
            contents.selectAll(`circle.paper-dot.${subclusterId}`)
              .data(papers)
              .join('circle')
                .attr('class', `paper-dot ${subclusterId}`)
                .attr('cx', d => paperProjectX(d.x))
                .attr('cy', d => paperProjectY(d.y))
                .attr('r', 2.5)
                .on('pointerover', function (d) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.log('pointerover', d)
                  }
                  this.classList.add('highlighted')
                })
                .on('pointerout', function (d) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.log('pointerout', d)
                  }
                  this.classList.remove('highlighted')
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
    }
  }
}
</script>

<style lang="scss">
@import 'bulma';

/* true navbar height */
$true-navbar-height: $navbar-height + ($navbar-padding-vertical / 2);

.example {
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

circle {
  &.paper-dot {
    stroke: none;
    fill: black;
    fill-opacity: 1.0;

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
  &.probability-contour {
    stroke: black;
    stroke-width: 0.5;
  }
}
</style>

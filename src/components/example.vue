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
        <paper :paper="currentPaper" />
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

const colorList = [
  'blue',
  'red',
  'green',
  'coral',
  'cornflowerblue',
  'crimson',
  'cyan',
  'drakblue'
]

/**
 * Example cluster and paper information.
 *
 * @namespace Example
 *
 * @module: components
 */
export default {
  name: 'Example',
  components: {
    Paper
  },
  props: {
    numPoints: {
      type: Number,
      default: 40
    },
    numReducedDots: {
      type: Number,
      default: 2000
    },
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
      reducedClusters: [],
      currentPaper: null,
      // visible region
      domainX: [-25, 25],
      domainY: [-25, 25],
      // manages a drag event
      drag: {
        isActive: false,
        lastX: 0,
        lastY: 0
      },
      // rendering function that delays.
      // rendering is postponed every time it is called.
      delayRenderClusters: null
    }
  },
  computed: {
    domainWidth () {
      return this.domainX[1] - this.domainX[0]
    },
    domainHeight () {
      return this.domainY[1] - this.domainY[0]
    }
  },
  created () {
    this.promiseReady = fetch('./source-data.csv')
      .then(response => {
        return response.text()
          .then(text => {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`loaded: ${text.length}`)
            }
            this.clusters = d3.csvParse(text, d => {
              return {
                ...d,
                x: +d.x,
                y: +d.y,
                title: d.titles,
                labelId: +(d.labels.slice(2)) // omits 'C-'
              }
            })
            if (process.env.NODE_ENV !== 'production') {
              console.log(`parsed: ${this.clusters.length}`)
              console.log(`x: ${d3.extent(this.clusters, c => c.x)}`)
              console.log(`y: ${d3.extent(this.clusters, c => c.y)}`)
              console.log(`labelId: ${d3.extent(this.clusters, c => c.labelId)}`)
            }
            this.reducedClusters =
              arrays.chooseRandomly(this.clusters, this.numReducedDots)
            // at this point the Vue instance might not be ready
            this.isLoadingData = false
            this.renderClusters(this.clusters)
          })
      })
  },
  mounted () {
    const container = this.$refs['svg-container']
    this.svg.width = container.clientWidth
    this.svg.height = container.clientHeight
    this.delayRenderClusters = debounce(() => {
      this.renderClusters(this.clusters)
    }, 250)
  },
  methods: {
    renderClusters (clusters) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('start renderClusters')
      }
      const svg = d3.select(this.$refs['svg'])
      const xScale = d3.scaleLinear()
        .domain(this.domainX)
        .range([0, this.svg.width])
      const yScale = d3.scaleLinear()
        .domain(this.domainY)
        .range([0, this.svg.height])
      const colorScale = d3.scaleLinear()
        .domain(d3.extent(this.clusters, c => c.labelId))
        .range([0, 1])
      // removes the contents
      svg.select('g')
        .remove()
      // renders new contents
      const contents = svg.append('g')
      contents.selectAll('circle')
        .data(clusters)
        .join('circle')
          .attr('r', 3)
          .attr('cx', d => xScale(d.x))
          .attr('cy', d => yScale(d.y))
          .attr('fill', d => d3.interpolateTurbo(colorScale(d.labelId)))
          .on('pointerover', d => {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`pointerover: ${d.paper_id}`)
            }
            this.currentPaper = d
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
      const normalDX = (clientX - this.drag.lastX) / this.svg.width
      const normalDY = (clientY - this.drag.lastY) / this.svg.height
      this.drag.lastX = clientX
      this.drag.lastY = clientY
      this.pan(-normalDX, -normalDY) // moves opposite
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
    pan (normalDX, normalDY) {
      const dX = normalDX * this.domainWidth
      const dY = normalDY * this.domainHeight
      this.domainX = this.domainX.map(x => x + dX)
      this.domainY = this.domainY.map(y => y + dY)
      this.renderClusters(this.reducedClusters)
      this.delayRenderClusters()
    },
    onWheel (event) {
      const container = this.$refs['svg-container']
      const { target, clientX, clientY } = event
      const { left, top } = container.getBoundingClientRect()
      const normalX = (clientX - left) / this.svg.width
      const normalY = (clientY - top) / this.svg.height
      if (process.env.NODE_ENV !== 'production') {
        console.log('onWheel', normalX, normalY)
      }
      if (event.deltaY < 0) {
        this.zoomIn(normalX, normalY)
      } else {
        this.zoomOut(normalX, normalY)
      }
      this.renderClusters(this.reducedClusters)
      this.delayRenderClusters()
    },
    zoomIn (normalX, normalY) {
      this.zoom(normalX, normalY, this.zoomFactor)
    },
    zoomOut (normalX, normalY) {
      this.zoom(normalX, normalY, 1.0 / this.zoomFactor)
    },
    zoom (normalX, normalY, factor) {
      const centerX = (normalX * this.domainWidth) + this.domainX[0]
      const centerY = (normalY * this.domainHeight) + this.domainY[0]
      const newWidth = factor * this.domainWidth
      const newHeight = factor * this.domainHeight
      this.domainX= [
        centerX - (normalX * newWidth),
        centerX + ((1.0 - normalX) * newWidth)
      ]
      this.domainY= [
        centerY - (normalY * newHeight),
        centerY + ((1.0 - normalY) * newHeight)
      ]
    }
  }
}
</script>

<style lang="scss" scoped>
@import 'bulma/bulma.sass';

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
</style>

<template>
  <div class="example">
    <div class="columns">
      <div class="column is-two-thirds">
        <div
          ref="svg-container"
          class="svg-container"
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
      <div class="column">
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
    zoomFactor: {
      type: Number,
      default: 0.95
    }
  },
  data () {
    return {
      // whether data loading is going on
      isLoadingData: true,
      // configured on created
      voronoi: {
        // array of two dimensional arrays.
        // [[x0, y0], [x1, y1], ...]
        points: [],
        diagram: null
      },
      cluster: [],
      reducedCluster: [],
      currentPaper: null,
      delayedRender: null,
      // configured on mounted
      svg: {
        width: 300,
        height: 300
      },
      domainX: [-25, 25],
      domainY: [-25, 25]
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
    // at created elements are not available.
    this.resetPoints()
    this.calculateVoronoi()
    // experimentally fetches the data
    this.promiseReady = fetch('./source-data.csv')
      .then(response => {
        return response.text()
          .then(text => {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`loaded: ${text.length}`)
            }
            this.cluster = d3.csvParse(text, d => {
              return {
                ...d,
                x: +d.x,
                y: +d.y,
                title: d.titles,
                labelId: +(d.labels.slice(2)) // skips 'C-'
              }
            })
            if (process.env.NODE_ENV !== 'production') {
              console.log(`parsed: ${this.cluster.length}`)
              console.log(`x: ${d3.extent(this.cluster, c => c.x)}`)
              console.log(`y: ${d3.extent(this.cluster, c => c.y)}`)
              console.log(`labelId: ${d3.extent(this.cluster, c => c.labelId)}`)
            }
            this.reducedCluster = arrays.chooseRandomly(this.cluster, 1000)
            // at this point the Vue instance might not be ready
            this.isLoadingData = false
            this.renderVoronoi(this.cluster)
          })
      })
  },
  mounted () {
    const container = this.$refs['svg-container']
    this.svg.width = container.clientWidth
    this.svg.height = container.clientHeight
    /*
    this.promiseReady
      .then(() => this.renderVoronoi()) */
    this.delayedRender = debounce(() => {
      this.renderVoronoi(this.cluster)
    }, 250)
  },
  methods: {
    resetPoints () {
      this.voronoi.points = []
      for (let i = 0; i < this.numPoints; ++i) {
        this.voronoi.points.push([
          Math.random(), // x
          Math.random() // y
        ])
      }
    },
    calculateVoronoi () {
      if (process.env.NODE_ENV !== 'production') {
        console.log('start calculateVoronoi', this.voronoi.points)
      }
      const voronoi =d3.voronoi()
        .extent([[0, 0], [1, 1]])
      this.voronoi.diagram = voronoi(this.voronoi.points)
      if (process.env.NODE_ENV !== 'production') {
        console.log('finish calculateVoronoi', this.voronoi.diagram)
      }
    },
    renderVoronoi (cluster) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('start renderVoronoi', this.voronoi.diagram)
      }
      const svg = d3.select(this.$refs['svg'])
      const xScale = d3.scaleLinear()
        .domain(this.domainX)
        .range([0, this.svg.width])
      const yScale = d3.scaleLinear()
        .domain(this.domainY)
        .range([0, this.svg.height])
      const colorScale = d3.scaleLinear()
        .domain(d3.extent(this.cluster, c => c.labelId))
        .range([0, 1])
      // removes the contents
      svg.select('g')
        .remove()
      // renders new contents
      const contents = svg.append('g')
      contents.selectAll('circle')
        // .data(this.voronoi.points)
        .data(cluster)
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
      /*
      const boundaries = this.voronoi.diagram.polygons()
        .map(polygon => this.polygonToPath(polygon, xScale, yScale))
      contents.selectAll('path')
        .data(boundaries)
        .join('path')
          .attr('d', d => d.toString())
          .attr('stroke-width', 1)
          .attr('stroke', 'black')
          .attr('fill', 'none') */
      if (process.env.NODE_ENV !== 'production'){
        console.log('finish renderVoronoi')
      }
    },
    polygonToPath (polygon, xScale, yScale) {
      const path = d3.path()
      const [x0, y0] = polygon[0]
      path.moveTo(xScale(x0), yScale(y0))
      polygon.slice(1).forEach(([x, y]) => {
        path.lineTo(xScale(x), yScale(y))
      })
      path.closePath()
      return path
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
      this.renderVoronoi(this.reducedCluster)
      this.delayedRender()
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
  }

  .svg-container {
    width: 100%;
    height: 100%;
  }
}
</style>

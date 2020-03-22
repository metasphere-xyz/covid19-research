<template>
  <div class="example">
    <div
      ref="svg-container"
      class="svg-container"
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
</template>

<script>
import * as d3 from 'd3'

export default {
  name: 'Example',
  props: {
    numPoints: {
      type: Number,
      default: 40
    }
  },
  data () {
    return {
      // configured on created
      voronoi: {
        // array of two dimensional arrays.
        // [[x0, y0], [x1, y1], ...]
        points: [],
        diagram: null
      },
      // configured on mounted
      svg: {
        width: 300,
        height: 300
      }
    }
  },
  created () {
    // at created elements are not available.
    this.resetPoints()
    this.calculateVoronoi()
  },
  mounted () {
    const container = this.$refs['svg-container']
    this.svg.width = container.clientWidth
    this.svg.height = container.clientHeight
    this.renderVoronoi()
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
    renderVoronoi () {
      if (process.env.NODE_ENV !== 'production') {
        console.log('start renderVoronoi', this.voronoi.diagram)
      }
      const svg = d3.select(this.$refs['svg'])
      const xScale = d3.scaleLinear()
        .domain([0, 1])
        .range([0, this.svg.width])
      const yScale = d3.scaleLinear()
        .domain([0, 1])
        .range([0, this.svg.height])
      // removes the contents
      svg.select('g')
        .remove()
      // renders new contents
      const contents = svg.append('g')
      contents.selectAll('circle')
        .data(this.voronoi.points)
        .join('circle')
          .attr('r', 3)
          .attr('cx', d => xScale(d[0]))
          .attr('cy', d => yScale(d[1]))
          .attr('fill', 'black')
      const boundaries = this.voronoi.diagram.polygons()
        .map(polygon => this.polygonToPath(polygon, xScale, yScale))
      contents.selectAll('path')
        .data(boundaries)
        .join('path')
          .attr('d', d => d.toString())
          .attr('stroke-width', 1)
          .attr('stroke', 'black')
          .attr('fill', 'none')
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
    }
  }
}
</script>

<style lang="scss" scoped>
@import 'bulma/bulma.sass';

/* true navbar height */
$true-navbar-height: $navbar-height + ($navbar-padding-vertical / 2);

.example {
  width: 100%;
  height: calc(100vh - #{$true-navbar-height});

  .svg-container {
    width: 100%;
    height: 100%;
  }
}
</style>

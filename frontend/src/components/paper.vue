<template>
  <div class="container paper-info">
    <div class="control">
      <button
        class="button is-primary"
        @click="isFullText = !isFullText"
      >
        {{ fullTextToggleButtonTitle }}
      </button>
    </div>
    <full-text
      v-if="isFullText"
      :paper-id="paperId"
    />
    <div v-else>
      <div class="item paper-title">
        <p class="item-title">
          Title
        </p>
        <p class="item-body">
          {{ title }}
        </p>
      </div>
      <div class="item paper-authors">
        <p class="item-title">
          Authors
        </p>
        <p class="item-body">
          {{ authors }}
        </p>
      </div>
      <div class="item paper-abstract">
        <p class="item-title">
          Abstract
        </p>
        <p class="item-body">
          {{ abstract }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import FullText from '@components/full-text'

export default {
  name: 'paper',
  components: {
    FullText
  },
  props: {
    paper: {
      required: true
    }
  },
  data () {
    return {
      isFullText: false
    }
  },
  computed: {
    paperId () {
      return (this.paper && this.paper.paper_id) || null
    },
    title () {
      return (this.paper && this.paper.title) || 'Not Selected'
    },
    authors () {
      return (this.paper && this.paper.authors) || 'Not Selected'
    },
    abstract () {
      return (this.paper && this.paper.abstract) || 'Not Selected'
    },
    fullTextToggleButtonTitle () {
      return this.isFullText ? 'View Abstract' : 'View Full Text'
    }
  },
  watch: {
    paper () {
      // hides full text when a new paper is shown
      this.isFullText = false
    }
  }
}
</script>

<style lang="scss" scoped>
.paper-info {
  .item {
    padding-bottom: 0.25rem;

    .item-title {
      font-weight: bold;
    }
    .item-body {
      font-size: 90%;
    }
  }
}
</style>

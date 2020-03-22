<template>
  <div class="container paper-info">
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
</template>

<script>
export default {
  name: 'paper',
  props: {
    paper: {
      required: true
    }
  },
  computed: {
    title () {
      return (this.paper && this.paper.title) || 'Not Selected'
    },
    authors () {
      return (this.paper && this.paper.authors) || 'Not Selected'
    },
    abstract () {
      return (this.paper && this.paper.abstract) || 'Not Selected'
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

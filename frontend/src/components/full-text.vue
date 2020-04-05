<template>
  <div class="full-text">
    <div class="text-part">
      <h2 class="text-part-title">
        Title
      </h2>
      <p class="text-part-body text-part-body-title">
        {{ title }}
      </p>
    </div>
    <div class="text-part">
      <h2 class="text-part-title">
        Authors
      </h2>
      <p class="text-part-body text-part-body-authors">
        {{ authors }}
      </p>
    </div>
    <div class="text-part">
      <h2 class="text-part-title">
        Publish Date
      </h2>
      <p class="text-part-body text-part-body-publish-date">
        {{ publishDate }}
      </p>
    </div>
    <div class="text-part">
      <h2 class="text-part-title">
        URL
      </h2>
      <a
        class="text-part-body text-part-body-url"
        target="_blank"
        :href="url"
      >
        {{ url }}
      </a>
    </div>
    <div class="text-part">
      <h2 class="text-part-title">
        DOI
      </h2>
      <a
        class="text-part-body text-part-body-doi"
        target="_blank"
        :href="doiUrl"
      >
        {{ doi }}
      </a>
    </div>
    <div class="text-part">
      <h2 class="text-part-title">
        Full Text
      </h2>
      <div
        v-for="(section, i) in sections"
        :key="`section-${i}`"
        class="text-part-body text-part-body-section"
      >
        <h3 class="text-part-body-section-title">
          {{ section.title }}
        </h3>
        <p
          v-for="(paragraph, j) in section.paragraphs"
          :key="`paragraph-${j}`"
          class="text-part-body-section-paragraph"
        >
          {{ paragraph.text }}
        </p>
      </div>
    </div>
    <b-loading
      :is-full-page="false"
      :active="isLoading"
      :can-cancel="false"
    />
  </div>
</template>

<script>
export default {
  name: 'FullText',
  props: {
    paperId: {
      required: true
    },
    articleApiUrl: {
      type: String,
      default: 'https://7ms83yvvk4.execute-api.ap-northeast-1.amazonaws.com/development/article'
    }
  },
  data () {
    return {
      article: {
        body_text: [],
        metadata2: {
          Title: 'Loading',
          Authors: 'Loading',
          PublishDate: 'Loading',
          URL: 'Loading',
          DOI: 'Loading'
        }
      },
      isLoading: true
    }
  },
  computed: {
    title () {
      return this.article.metadata2.Title
    },
    authors () {
      return this.article.metadata2.Authors
    },
    publishDate () {
      return this.article.metadata2.PublishDate
    },
    url () {
      return this.article.metadata2.URL
    },
    doi () {
      return this.article.metadata2.DOI
    },
    doiUrl () {
      return `https://doi.org/${this.doi}`
    },
    sections () {
      return this.article.sections
    }
  },
  mounted () {
    this.isLoading = true
    const articleUrl = `${this.articleApiUrl}/${this.paperId}`
    fetch(articleUrl)
      .then(response => {
        return response.json()
          .then(article => {
            if (process.env.NODE_ENV !== 'production') {
              console.log('article', article)
            }
            this.article = article
            const sections = this.extractSectionTitles(this.article.body_text)
            if (process.env.NODE_ENV !== 'production') {
              console.log('section titles', sections)
            }
            this.article.sections =
              this.groupSections(sections, this.article.body_text)
          })
      })
      .catch(err => {
        console.error(err)
      })
      .finally(() => {
        this.isLoading = false
      })
  },
  methods: {
    extractSectionTitles (paragraphs) {
      // collects section titles (first appearance of each title)
      return paragraphs.reduce(
        (sections, p) => {
          if (sections[sections.length - 1] != p.section) {
            sections.push(p.section)
          }
          return sections
        },
        [])
    },
    groupSections (sections, _paragraphs) {
      return sections.map(section => {
        return {
          title: section,
          paragraphs: _paragraphs.filter(p => p.section === section)
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.full-text {
  position: relative;
}

.text-part {
  padding-bottom: 0.25rem;

  h2 {
    &.text-part-title {
      text-size: 1.25rem;
      font-weight: bold;
    }
  }

  p,
  a {
    &.text-part-body,
    &.text-part-body-section-paragraph {
      font-size: 90%;
    }
  }

  h3 {
    &.text-part-body-section-title {
      font-size: 90%;
      font-weight: bold;
    }
  }

  div {
    &.text-part-body-section {
      padding-bottom: 0.2rem;
    }
  }
}
</style>

import Vue from 'vue'

import router from '@routes'

import App from '@components/app'

new Vue({
  el: '#app',
  render: h => h(App),
  router
})

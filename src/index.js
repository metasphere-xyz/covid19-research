import Vue from 'vue'
import Buefy from 'buefy'

Vue.use(Buefy)

import 'buefy/dist/buefy.css'

import router from '@routes'

import App from '@components/app'

new Vue({
  el: '#app',
  render: h => h(App),
  router
})

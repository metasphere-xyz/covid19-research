/**
 * Vue Router.
 *
 * @module routes
 */

import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

import Intro from '@components/intro'
import Example from '@components/example'

const routes = [
  {
    path: '/',
    component: Intro
  },
  {
    path: '/example',
    component: Example
  }
]

const router = new VueRouter({
  routes
})
router.replace('/')

export default router

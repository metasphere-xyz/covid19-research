/**
 * Vue Router.
 *
 * @module routes
 */

import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

import Intro from '@components/intro'

const routes = [
  {
    path: '/',
    component: Intro
  }
]

const router = new VueRouter({
  routes
})
router.replace('/')

export default router

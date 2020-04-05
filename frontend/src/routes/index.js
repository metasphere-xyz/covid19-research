/**
 * Vue Router.
 *
 * @module routes
 */

import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

import Intro from '@components/intro'
import Explorer from '@components/explorer'

const routes = [
  {
    path: '/',
    component: Intro
  },
  {
    path: '/explorer',
    component: Explorer
  }
]

const router = new VueRouter({
  routes
})
router.replace('/')

export default router

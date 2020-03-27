<template>
  <div>
    <b-navbar type="is-black">
      <template slot="brand">
        <p style="font-size: 2.5rem;">metasphere</p>
      </template>
      <template slot="start">
        <b-navbar-item
          tag="router-link"
          to="/example"
        >
          Example
        </b-navbar-item>
      </template>
    </b-navbar>
    <div>
      <router-view />
    </div>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

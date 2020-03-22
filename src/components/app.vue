<template>
  <div>
    <b-navbar type="is-black">
      <template slot="brand">
        <p style="font-size: 2.5rem;">metasphere - HackCorona</p>
      </template>
    </b-navbar>
    <div class="container">
      <router-view />
    </div>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

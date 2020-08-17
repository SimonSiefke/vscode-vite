<template>
  <p>{{ count }}</p>
  <h1>hello aaa dd fff</h1>
</template>

<script>
export default {
  name: 'HelloWorld',
  props: {
    msg: String,
  },
  data() {
    return {
      count: 0,
    }
  },
  mounted() {
    setInterval(() => {
      this.count++
    }, 1000)
  },
}
</script>

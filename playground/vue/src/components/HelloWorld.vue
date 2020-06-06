<template>
 <p>{{count}}</p>
 <h1>go vite vite</h1>
 <p>this also works as expected</p>
</template>

<script>
export default {
  name: 'HelloWorld',
  props: {
    msg: String
  },
  data() {
    return {
      count: 0
    }
  },
  mounted(){
    setInterval(()=>{
      this.count++
    }, 1000)
  }
}
</script>

import React, { useState } from 'react'
import logo from './logo.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        hello react this is awesome and its so fast it makes editing a blast which makes it even more awesome
      </header>
    </div>
  )
}

export default App

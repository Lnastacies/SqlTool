import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { configureMonaco } from './monaco/configureMonaco'
import './styles/index.less'

configureMonaco()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

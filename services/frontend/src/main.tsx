// Polyfill OPENAI key for browser before anything else
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.global ??= window;
  // @ts-ignore
  window.process ??= { env: {} };
  // Provide fake key so OpenAI client constructor doesn't complain (real requests go via backend)
  // @ts-ignore
  window.process.env.OPENAI_API_KEY = 'NOTAREALKEYSECRETSCRETSTOPLOOKINGATALLMYSECRETSAHHHHHHH!';
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Buffer } from 'buffer'
// Ensure Buffer is available (some libs expect it)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.Buffer = window.Buffer || Buffer

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
) 
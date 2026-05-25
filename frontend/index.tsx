import './vertex-ai-proxy-interceptor.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const rootContainer = rootElement as HTMLElement & {
  _putraAiRoot?: ReturnType<typeof ReactDOM.createRoot>;
};
const root = rootContainer._putraAiRoot ?? ReactDOM.createRoot(rootElement);
rootContainer._putraAiRoot = root;

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

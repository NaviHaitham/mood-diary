import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import OpeningBook from './components/OpeningBook';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <OpeningBook />
  </React.StrictMode>,
);

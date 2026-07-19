import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { getMeta } from './api.js';
import { setDdragonVersion } from './lib/champ.js';
import './index.css';

function render() {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

// Busca a versão mais recente do Data Dragon antes de renderizar (ícones
// atualizados). Em caso de falha, usa a versão pinada e renderiza mesmo assim.
getMeta()
  .then((m) => setDdragonVersion(m?.ddragonVersion))
  .catch(() => {})
  .finally(render);

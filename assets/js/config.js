// Endereço do backend de pré-inscrição (BACK END/).
// Dev: npm run dev:api sobe em http://localhost:3004.
// Produção: https://api-metodo.charaotechub.com
window.APP_CONFIG = {
  API_URL: location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:3004'
    : 'https://api-metodo.charaotechub.com'
};

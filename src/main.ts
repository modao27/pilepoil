import { mount } from 'svelte';
import './ui/design/base.css';
import App from './ui/App.svelte';
import { app } from './ui/lib/app.svelte';
import { pwa } from './ui/lib/pwa.svelte';
import { startRouter } from './ui/lib/router.svelte';
import { toast } from './ui/lib/toasts.svelte';

// filet de sécurité : une erreur que personne n'a traitée se dit, au lieu de laisser un écran figé
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast('Une opération a échoué. Réessayez ; si le problème revient, rechargez la page.', { tone: 'error' });
});

startRouter();
pwa.start();
void app.init();
mount(App, { target: document.getElementById('app')! });

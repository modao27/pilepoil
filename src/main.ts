import { mount } from 'svelte';
import './ui/design/base.css';
import App from './ui/App.svelte';
import { app } from './ui/lib/app.svelte';
import { pwa } from './ui/lib/pwa.svelte';
import { startRouter } from './ui/lib/router.svelte';

startRouter();
pwa.start();
void app.init();
mount(App, { target: document.getElementById('app')! });

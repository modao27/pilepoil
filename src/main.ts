import { mount } from 'svelte';
import './ui/design/base.css';
import App from './ui/App.svelte';
import { app } from './ui/lib/app.svelte';
import { startRouter } from './ui/lib/router.svelte';

startRouter();
void app.init();
mount(App, { target: document.getElementById('app')! });

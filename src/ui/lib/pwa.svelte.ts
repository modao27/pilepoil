/**
 * Application installable et hors ligne : enregistrement du service worker (vite-plugin-pwa, mode « prompt »),
 * message quand une nouvelle version est prête, état de connexion et stockage persistant.
 */
import { registerSW } from 'virtual:pwa-register';
import { toast } from './toasts.svelte';

/** Vérification des mises à jour pendant une longue session (l'appli reste souvent ouverte sur le chantier). */
const UPDATE_EVERY_MS = 60 * 60 * 1000;

class PwaState {
  /** Toutes les ressources sont en cache : l'application s'ouvre sans réseau. */
  offlineReady = $state(false);
  /** Une nouvelle version est installée et attend d'être activée. */
  updateReady = $state(false);
  online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
  /** Le navigateur garde les données même en cas de manque de place. */
  persisted = $state(false);
  readonly supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  /** Le navigateur propose l'installation (Chrome, Edge, Android) ; absent sur iPhone et une fois installée. */
  installable = $state(false);
  /** Ouverte comme application installée (fenêtre sans barre d'adresse). */
  standalone = $state(false);

  private installPrompt: BeforeInstallPromptEvent | undefined;
  private readonly flushers = new Set<() => Promise<void>>();

  private registration: ServiceWorkerRegistration | undefined;
  private apply: ((reload?: boolean) => Promise<void>) | undefined;

  start(): void {
    addEventListener('online', () => (this.online = true));
    addEventListener('offline', () => (this.online = false));
    void this.persist();
    this.standalone = matchMedia('(display-mode: standalone)').matches;
    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as BeforeInstallPromptEvent;
      this.installable = true;
    });
    addEventListener('appinstalled', () => {
      this.installable = false;
      this.installPrompt = undefined;
    });
    if (!this.supported || import.meta.env.DEV) return;
    // déjà contrôlée par un service worker : le cache est complet depuis une visite précédente
    this.offlineReady = !!navigator.serviceWorker.controller;
    this.apply = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        this.updateReady = true;
        toast('Une nouvelle version est disponible.', {
          action: { label: 'Mettre à jour', run: () => void this.update() },
          timeout: null,
        });
      },
      onOfflineReady: () => {
        this.offlineReady = true;
        toast('Calepinage fonctionne maintenant sans connexion.');
      },
      onRegisteredSW: (_url, reg) => {
        this.registration = reg;
        if (reg) setInterval(() => void this.check(), UPDATE_EVERY_MS);
      },
    });
  }

  /** Ouvre la fenêtre d'installation du navigateur ; true si acceptée. */
  async install(): Promise<boolean> {
    const p = this.installPrompt;
    if (!p) return false;
    await p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === 'accepted') {
      this.installable = false;
      this.installPrompt = undefined;
    }
    return outcome === 'accepted';
  }

  /** Écriture à terminer avant le rechargement de mise à jour (modification en attente d'enregistrement). */
  beforeUpdate(flush: () => Promise<void>): () => void {
    this.flushers.add(flush);
    return () => this.flushers.delete(flush);
  }

  /** Enregistre ce qui est en attente, active la nouvelle version et recharge la page. */
  async update(): Promise<void> {
    await Promise.all([...this.flushers].map((f) => f().catch(() => undefined)));
    // Page ouverte avant l'installation du premier service worker : elle n'est pas contrôlée, la nouvelle version
    // s'est donc activée d'elle-même (aucune page à protéger) et aucun changement de contrôleur ne rechargera.
    if (!navigator.serviceWorker.controller) location.reload();
    else await this.apply?.(true);
  }

  /** Cherche une nouvelle version ; renvoie un message pour l'utilisateur. */
  async check(): Promise<string> {
    const reg = this.registration;
    if (!reg) return 'Mise à jour indisponible dans ce navigateur.';
    if (!navigator.onLine) return 'Pas de connexion : réessayez plus tard.';
    try {
      await reg.update();
    } catch {
      return 'Impossible de joindre le serveur.';
    }
    if (reg.waiting) return 'Une nouvelle version est prête.';
    if (reg.installing) return 'Nouvelle version en cours de téléchargement…';
    return 'Vous avez la dernière version.';
  }

  private async persist(): Promise<void> {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!storage?.persist) return;
    try {
      this.persisted = (await storage.persisted()) || (await storage.persist());
    } catch {
      this.persisted = false;
    }
  }
}

export const pwa = new PwaState();

/** Version affichée dans les réglages. */
export const APP_VERSION = `${__APP_VERSION__} du ${new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
}).format(Date.parse(__BUILD_DATE__))}`;

/** Événement propre à Chromium, absent des types DOM standard. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

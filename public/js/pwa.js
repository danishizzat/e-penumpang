// public/js/pwa.js - Progressive Web App (PWA) Controller for e-PENUMPANG
(function() {
  let deferredPrompt = null;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  document.addEventListener('DOMContentLoaded', () => {
    initPWA();
  });

  function initPWA() {
    registerServiceWorker();
    setupInstallListeners();
  }

  // 1. Register Service Worker
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker successfully registered with scope:', registration.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }
  }

  // 2. Setup Install Prompt Listeners
  function setupInstallListeners() {
    const installBtn = document.getElementById('btn-pwa-install');
    const banner = document.getElementById('pwa-install-banner');
    const bannerInstallBtn = document.getElementById('btn-pwa-banner-install');
    const bannerCloseBtn = document.getElementById('btn-pwa-banner-close');
    const iosModal = document.getElementById('modal-ios-install');
    const iosCloseBtn = document.getElementById('btn-close-ios-modal');

    // Already running as installed standalone app? Don't show install prompts
    if (isStandalone) {
      console.log('[PWA] Running in standalone app mode');
      return;
    }

    // Android / Chrome beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      console.log('[PWA] Captured beforeinstallprompt event');

      // Check if user previously dismissed banner in this session
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');

      if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.classList.add('flex');
      }

      if (banner && !dismissed) {
        banner.classList.remove('hidden');
      }
    });

    // Handle user clicking install in header button
    if (installBtn) {
      installBtn.addEventListener('click', () => {
        triggerInstallPrompt();
      });
    }

    // Handle user clicking install in mobile banner
    if (bannerInstallBtn) {
      bannerInstallBtn.addEventListener('click', () => {
        triggerInstallPrompt();
      });
    }

    // Handle dismissing mobile banner
    if (bannerCloseBtn && banner) {
      bannerCloseBtn.addEventListener('click', () => {
        banner.classList.add('hidden');
        sessionStorage.setItem('pwa_banner_dismissed', 'true');
      });
    }

    // iOS Safari Detection
    if (isIOS && !isStandalone) {
      if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.classList.add('flex');
      }
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (banner && !dismissed) {
        banner.classList.remove('hidden');
      }
    }

    // Close iOS Modal
    if (iosCloseBtn && iosModal) {
      iosCloseBtn.addEventListener('click', () => {
        iosModal.classList.add('hidden');
      });
    }

    // Track app installation completion
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] e-PENUMPANG was successfully installed on the device!');
      deferredPrompt = null;
      if (installBtn) installBtn.classList.add('hidden');
      if (banner) banner.classList.add('hidden');
      
      const isEn = window.I18N && window.I18N.getLanguage() === 'en';
      const msg = isEn ? 'e-PENUMPANG App installed successfully!' : 'Aplikasi e-PENUMPANG berjaya dipasang!';
      if (typeof window.showToast === 'function') {
        window.showToast(msg, 'success');
      }
    });
  }

  // Trigger Install Dialog
  async function triggerInstallPrompt() {
    const banner = document.getElementById('pwa-install-banner');
    const installBtn = document.getElementById('btn-pwa-install');
    const iosModal = document.getElementById('modal-ios-install');

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      console.log('[PWA] User choice:', choiceResult.outcome);
      if (choiceResult.outcome === 'accepted') {
        if (banner) banner.classList.add('hidden');
        if (installBtn) installBtn.classList.add('hidden');
      }
      deferredPrompt = null;
    } else if (isIOS) {
      // Show iOS Safari guide modal
      if (iosModal) {
        iosModal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
      }
    } else {
      // Fallback tip for desktop or unsupported browsers
      const isEn = window.I18N && window.I18N.getLanguage() === 'en';
      alert(isEn 
        ? 'To install: In your browser menu, click "Install e-PENUMPANG" or "Add to Home Screen".' 
        : 'Untuk memasang: Pada menu pelayar web anda, pilih "Pasang e-PENUMPANG" atau "Tambah ke Skrin Utama".');
    }
  }

  // Expose global helper if needed
  window.PWAManager = {
    triggerInstall: triggerInstallPrompt,
    isStandalone: () => isStandalone
  };
})();

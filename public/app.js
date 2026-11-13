// js/app.js - Main Application Controller for e-PENUMPANG SMC System
(function() {
  let activeTripId = null;

  function isEnglish() {
    return window.I18N && window.I18N.getLanguage() === 'en';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
  });

  async function initApp() {
    initThemeSwitcher();
    setupLandingPageListeners();
    setupAuthListeners();
    setupTekongListeners();
    setupAdminListeners();
    setupJlmListeners();
    setupPassengerListeners();
    setupModalListeners();

    // Listen for language changes and dynamically update current view
    window.addEventListener('languageChanged', () => {
      renderHeader();
      const currentSession = SMCStore.getSession();
      const viewLanding = document.getElementById('view-landing');
      const viewAdmin = document.getElementById('view-admin');
      const viewJlm = document.getElementById('view-jlm');
      if (viewLanding && !viewLanding.classList.contains('hidden')) {
        loadLandingPage();
      } else if (viewAdmin && !viewAdmin.classList.contains('hidden')) {
        loadAdminDashboard();
      } else if (viewJlm && !viewJlm.classList.contains('hidden')) {
        loadJlmDashboard();
      } else if (currentSession) {
        if (currentSession.role === 'ADMIN') {
          loadAdminDashboard();
        } else if (currentSession.role === 'JLM') {
          loadJlmDashboard();
        } else {
          if (activeTripId) {
            refreshTekongTripDropdown(activeTripId);
            renderTekongActiveTrip(activeTripId);
          }
        }
      } else {
        const viewPax = document.getElementById('view-passenger');
        if (viewPax && !viewPax.classList.contains('hidden') && currentPassengerTripId) {
          loadPassengerForm(currentPassengerTripId);
        }
      }
    });

    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const paramTripId = urlParams.get('trip') || urlParams.get('tripId');

    if (urlParams.get('theme')) {
      applyTheme(urlParams.get('theme'));
    }

    // Demo auto-login for headless testing and instant verification
    if (urlParams.get('demoLogin') === 'tekong') {
      try { SMCStore.login('tekong', 'pass123'); } catch (e) {}
    }

    // 1. If QR Code scanned or URL has ?trip=... parameter -> ALWAYS show passenger registration view!
    if (paramTripId) {
      showView('passenger', paramTripId);
    } else {
      const user = SMCStore.getSession();
      if (user) {
        // Tekong, Admin & JLM are NOT redirected to login on refresh
        if (user.role === 'ADMIN') {
          showView('admin');
        } else if (user.role === 'JLM') {
          showView('jlm');
        } else {
          showView('tekong');
          if (urlParams.get('showModal') === 'createTrip') {
            const btn = document.getElementById('btn-open-create-trip');
            if (btn) btn.click();
            if (urlParams.get('populateDemoCrew') === 'true') {
              const tbody = document.getElementById('crew-table-body');
              if (tbody) {
                initCrewTable([
                  { name: 'Faizal bin Azman', ic_passport: '940312-11-5541', role: 'Awak-awak / Deckhand' },
                  { name: 'Khairul Anwar', ic_passport: '980620-11-4433', role: 'Kru Keselamatan' },
                  { name: 'Zulkifli Hassan', ic_passport: '911105-11-2299', role: 'Jurutera Bot / Mekanik' }
                ]);
              }
            }
          }
        }
      } else {
        // Default to modern landing page immediately
        showView('landing');
      }
    }

    // 2. Synchronize database state in the background without blocking the UI
    if (window.SMCStore && typeof window.SMCStore.syncWithServer === 'function') {
      window.SMCStore.syncWithServer().then(() => {
        const refreshedUser = SMCStore.getSession();
        if (refreshedUser) {
          renderHeader();
          if (refreshedUser.role === 'ADMIN') {
            const vAdmin = document.getElementById('view-admin');
            if (vAdmin && !vAdmin.classList.contains('hidden')) loadAdminDashboard();
          } else if (refreshedUser.role === 'JLM') {
            const vJlm = document.getElementById('view-jlm');
            if (vJlm && !vJlm.classList.contains('hidden')) loadJlmDashboard();
          } else {
            const vTekong = document.getElementById('view-tekong');
            if (vTekong && !vTekong.classList.contains('hidden') && activeTripId) {
              renderTekongActiveTrip(activeTripId);
            }
          }
        }
      }).catch(() => {});
    }

    // 3. Start background live sync auto-polling (every 4 seconds)
    startLiveSync();
  }

  function getPassengerRegistrationUrl(tripId) {
    if (!tripId) return '';
    if (window.location.protocol === 'file:' || window.location.origin === 'null' || !window.location.origin) {
      return `http://localhost:3000/?trip=${encodeURIComponent(tripId)}`;
    }
    const cleanOrigin = window.location.origin;
    const cleanPath = window.location.pathname.endsWith('.html') ? window.location.pathname : window.location.pathname.replace(/\/$/, '') + '/';
    return `${cleanOrigin}${cleanPath}?trip=${encodeURIComponent(tripId)}`;
  }

  // -------------------------------------------------------------
  // AUTH FORM RESET HELPERS
  // -------------------------------------------------------------
  function resetRegistrationForm() {
    const formRegister = document.getElementById('form-register');
    if (!formRegister) return;
    try { formRegister.reset(); } catch (e) {}

    // Explicit element IDs
    const fieldIds = [
      'reg-fullname',
      'reg-mykad-1',
      'reg-mykad-2',
      'reg-mykad-3',
      'reg-passport',
      'reg-ic-passport'
    ];
    fieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Explicit named inputs
    const namedInputs = [
      'regFullName',
      'regPassword',
      'regPhone',
      'regLicenseNo',
      'regBoatName',
      'regBoatRegNo',
      'regStaffId',
      'regAgencyKey',
      'regUsername'
    ];
    namedInputs.forEach(name => {
      const el = formRegister.querySelector(`input[name="${name}"]`);
      if (el) el.value = '';
    });

    // Reset role radio to TEKONG
    const roleTekongRadio = formRegister.querySelector('input[name="regRole"][value="TEKONG"]');
    if (roleTekongRadio) {
      roleTekongRadio.checked = true;
    }

    // Reset role field sections
    const tekongFields = document.getElementById('reg-tekong-fields');
    const adminFields = document.getElementById('reg-admin-fields');
    if (tekongFields) tekongFields.classList.remove('hidden');
    if (adminFields) adminFields.classList.add('hidden');

    // Reset boat type dropdown & locked capacity
    const regBoatType = document.getElementById('reg-boat-type');
    if (regBoatType) {
      regBoatType.value = 'mini_speedboat';
      const regBoatCapacity = document.getElementById('reg-boat-capacity');
      if (regBoatCapacity) regBoatCapacity.value = '12';
      const regCapacityBadgeText = document.getElementById('reg-capacity-badge-text');
      const regCapacitySubtext = document.getElementById('reg-capacity-subtext');
      const isEn = window.I18N && window.I18N.getLanguage() === 'en';
      if (regCapacityBadgeText) regCapacityBadgeText.textContent = isEn ? 'Locked (12)' : 'Dikunci (12)';
      if (regCapacitySubtext) {
        regCapacitySubtext.textContent = isEn
          ? '* Registered boat capacity is locked to 12 persons based on the chosen boat type and automatically applied to all your trips.'
          : '* Kapasiti bot dikunci kepada 12 orang mengikut jenis bot yang dipilih dan digunakan secara automatik untuk setiap trip pelayaran anda.';
      }
    }
  }

  function resetLoginForm() {
    const formLogin = document.getElementById('form-login');
    if (!formLogin) return;
    try { formLogin.reset(); } catch (e) {}
    const u = document.getElementById('login-username');
    const p = document.getElementById('login-password');
    if (u) u.value = '';
    if (p) p.value = '';
  }

  function resetAuthForms() {
    resetRegistrationForm();
    resetLoginForm();
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    if (tabLogin && tabRegister && formLogin && formRegister) {
      tabLogin.className = 'py-2 rounded-lg transition-all bg-white text-[#0d3b66] shadow-sm';
      tabRegister.className = 'py-2 rounded-lg transition-all text-slate-500 hover:text-slate-800';
      formLogin.classList.remove('hidden');
      formRegister.classList.add('hidden');
    }
  }

  // -------------------------------------------------------------
  // VIEW SWITCHER
  // -------------------------------------------------------------
  function showView(viewName, extraParam = null) {
    const viewLanding = document.getElementById('view-landing');
    const viewAuth = document.getElementById('view-auth');
    const viewTekong = document.getElementById('view-tekong');
    const viewAdmin = document.getElementById('view-admin');
    const viewJlm = document.getElementById('view-jlm');
    const viewPassenger = document.getElementById('view-passenger');

    if (viewLanding) viewLanding.classList.add('hidden');
    if (viewAuth) viewAuth.classList.add('hidden');
    if (viewTekong) viewTekong.classList.add('hidden');
    if (viewAdmin) viewAdmin.classList.add('hidden');
    if (viewJlm) viewJlm.classList.add('hidden');
    if (viewPassenger) viewPassenger.classList.add('hidden');

    renderHeader();

    if (viewName === 'landing') {
      resetAuthForms();
      if (viewLanding) viewLanding.classList.remove('hidden');
      loadLandingPage();
    } else if (viewName === 'auth') {
      resetAuthForms();
      if (viewAuth) viewAuth.classList.remove('hidden');
    } else if (viewName === 'tekong') {
      if (viewTekong) viewTekong.classList.remove('hidden');
      loadTekongDashboard(extraParam);
    } else if (viewName === 'admin') {
      if (viewAdmin) viewAdmin.classList.remove('hidden');
      loadAdminDashboard();
    } else if (viewName === 'jlm') {
      if (viewJlm) viewJlm.classList.remove('hidden');
      loadJlmDashboard();
    } else if (viewName === 'passenger') {
      if (viewPassenger) viewPassenger.classList.remove('hidden');
      loadPassengerForm(extraParam);
    }

    if (window.lucide) window.lucide.createIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderHeader() {
    const headerAuth = document.getElementById('header-auth-container');
    const roleSubbar = document.getElementById('header-role-subbar');
    const roleWelcome = document.getElementById('role-welcome-text');
    const roleBadge = document.getElementById('role-badge-tag');
    const user = SMCStore.getSession();
    const isEn = window.I18N && window.I18N.getLanguage() === 'en';

    const isPassengerView = document.getElementById('view-passenger') && !document.getElementById('view-passenger').classList.contains('hidden');

    if (isPassengerView) {
      headerAuth.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg">
            ${isEn ? 'Passenger Registration Mode' : 'Mod Pendaftaran Penumpang'}
          </span>
          <button id="btn-header-back-main" class="text-xs py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm">
            <i data-lucide="layout-dashboard" class="w-3.5 h-3.5"></i>
            <span>${isEn ? 'Main Portal' : 'Portal Utama'}</span>
          </button>
        </div>
      `;
      document.getElementById('btn-header-back-main').onclick = () => {
        const currentUser = SMCStore.getSession();
        if (currentUser) {
          showView(currentUser.role === 'ADMIN' ? 'admin' : 'tekong');
        } else {
          showView('landing');
        }
      };
      roleSubbar.classList.add('hidden');
      return;
    }

    if (!user) {
      const isLanding = document.getElementById('view-landing') && !document.getElementById('view-landing').classList.contains('hidden');
      headerAuth.innerHTML = `
        <div class="flex items-center gap-2 text-xs">
          ${!isLanding ? `
            <button id="btn-header-home" type="button" class="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1 border border-slate-200">
              <i data-lucide="home" class="w-3.5 h-3.5 text-slate-600"></i>
              <span data-i18n="nav_home">${isEn ? 'Home' : 'Laman Utama'}</span>
            </button>
          ` : `
            <span class="text-slate-500 font-medium hidden sm:inline" data-i18n="header_safety_compliance">${isEn ? 'Safety Compliance' : 'Pematuhan Keselamatan'}</span>
          `}
          <button id="btn-header-login" type="button" class="py-1.5 px-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm">
            <i data-lucide="log-in" class="w-3.5 h-3.5"></i>
            <span data-i18n="btn_login">${isEn ? 'Log In' : 'Log Masuk'}</span>
          </button>
        </div>
      `;
      if (document.getElementById('btn-header-home')) {
        document.getElementById('btn-header-home').onclick = () => {
          resetAuthForms();
          showView('landing');
        };
      }
      if (document.getElementById('btn-header-login')) {
        document.getElementById('btn-header-login').onclick = () => {
          resetAuthForms();
          showView('auth');
        };
      }
      roleSubbar.classList.add('hidden');
    } else {
      headerAuth.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="text-right hidden sm:block">
            <div class="text-xs font-bold text-slate-800">${escapeHtml(user.fullName)}</div>
            <div class="text-[10px] text-slate-500 font-mono">${user.licenseNo ? 'SID: ' + escapeHtml(String(user.licenseNo).replace(/^SID\s*no\.?\s*/i, '')) : (user.staffId || user.username || '')}</div>
          </div>
          <button id="btn-logout" class="text-xs py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors flex items-center gap-1 font-semibold">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
            <span>${isEn ? 'Log Out' : 'Log Keluar'}</span>
          </button>
        </div>
      `;
      document.getElementById('btn-logout').onclick = () => {
        SMCStore.logout();
        resetAuthForms();
        showView('landing');
      };

      roleSubbar.classList.remove('hidden');
      const welcomePrefix = isEn ? 'Welcome on duty,' : 'Selamat bertugas,';
      let welcomeIcon = 'anchor';
      if (user.role === 'ADMIN') welcomeIcon = 'shield-check';
      else if (user.role === 'JLM') welcomeIcon = 'shield-alert';

      roleWelcome.innerHTML = `
        <i data-lucide="${welcomeIcon}" class="w-3.5 h-3.5 text-amber-400"></i>
        <span>${welcomePrefix} <strong>${escapeHtml(user.fullName)}</strong></span>
      `;

      let badgeText = '';
      let badgeClass = '';
      if (user.role === 'ADMIN') {
        badgeText = isEn ? 'MCH ADMIN' : 'PENTADBIR MCH';
        badgeClass = 'text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-rose-500 text-white';
      } else if (user.role === 'JLM') {
        badgeText = isEn ? 'JABATAN LAUT MALAYSIA (ENFORCEMENT)' : 'JABATAN LAUT MALAYSIA (PENGUATKUASA)';
        badgeClass = 'text-[10px] font-extrabold px-2.5 py-0.5 rounded uppercase tracking-wider bg-[#0d3b66] text-amber-300 border border-amber-400/50 shadow-xs';
      } else {
        badgeText = isEn ? 'CAPTAIN / DRIVER' : 'TEKONG / NAKHODA';
        badgeClass = 'text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-sky-500 text-white';
      }
      roleBadge.textContent = badgeText;
      roleBadge.className = badgeClass;
    }
  }

  // -------------------------------------------------------------
  // LANDING PAGE CONTROLLER
  // -------------------------------------------------------------
  function loadLandingPage() {
    if (window.I18N) window.I18N.translateDOM(document.getElementById('view-landing'));
    updateWeatherAdvisoryUI();
    if (window.lucide) window.lucide.createIcons();
  }

  function setupLandingPageListeners() {
    const btnPortalLoginDirect = document.getElementById('btn-portal-login-direct');
    const btnPortalTekongLogin = document.getElementById('btn-portal-tekong-login');
    const btnPortalTekongDemo = document.getElementById('btn-portal-tekong-demo');
    const btnPortalAdminLogin = document.getElementById('btn-portal-admin-login');
    const btnPortalAdminDemo = document.getElementById('btn-portal-admin-demo');
    const btnAuthBack = document.getElementById('btn-auth-back-landing');
    const brandLink = document.getElementById('header-brand-link');

    if (btnPortalLoginDirect) {
      btnPortalLoginDirect.onclick = () => {
        resetAuthForms();
        showView('auth');
      };
    }

    if (btnPortalTekongLogin) {
      btnPortalTekongLogin.onclick = () => {
        resetAuthForms();
        showView('auth');
        const tabLogin = document.getElementById('tab-auth-login');
        if (tabLogin) tabLogin.click();
      };
    }

    if (btnPortalTekongDemo) {
      btnPortalTekongDemo.onclick = () => {
        resetAuthForms();
        showView('auth');
        const tabLogin = document.getElementById('tab-auth-login');
        if (tabLogin) tabLogin.click();
        const uInput = document.getElementById('login-username');
        const pInput = document.getElementById('login-password');
        const formLogin = document.getElementById('form-login');
        if (uInput && pInput && formLogin) {
          uInput.value = 'Rosli bin Ahmad';
          pInput.value = 'pass123';
          formLogin.dispatchEvent(new Event('submit'));
        }
      };
    }

    if (btnPortalAdminLogin) {
      btnPortalAdminLogin.onclick = () => {
        resetAuthForms();
        showView('auth');
        const tabLogin = document.getElementById('tab-auth-login');
        if (tabLogin) tabLogin.click();
      };
    }

    if (btnPortalAdminDemo) {
      btnPortalAdminDemo.onclick = () => {
        resetAuthForms();
        showView('auth');
        const tabLogin = document.getElementById('tab-auth-login');
        if (tabLogin) tabLogin.click();
        const uInput = document.getElementById('login-username');
        const pInput = document.getElementById('login-password');
        const formLogin = document.getElementById('form-login');
        if (uInput && pInput && formLogin) {
          uInput.value = 'ADMIN-MCH-001';
          pInput.value = 'admin123';
          formLogin.dispatchEvent(new Event('submit'));
        }
      };
    }

    const btnPortalJlmDemo = document.getElementById('btn-portal-jlm-demo');
    if (btnPortalJlmDemo) {
      btnPortalJlmDemo.onclick = () => {
        resetAuthForms();
        showView('auth');
        const tabLogin = document.getElementById('tab-auth-login');
        if (tabLogin) tabLogin.click();
        const uInput = document.getElementById('login-username');
        const pInput = document.getElementById('login-password');
        const formLogin = document.getElementById('form-login');
        if (uInput && pInput && formLogin) {
          uInput.value = 'jlm';
          pInput.value = 'epenumpang2026';
          formLogin.dispatchEvent(new Event('submit'));
        }
      };
    }

    if (btnAuthBack) {
      btnAuthBack.onclick = () => {
        resetAuthForms();
        showView('landing');
      };
    }

    if (brandLink) {
      brandLink.onclick = (e) => {
        e.preventDefault();
        const currentUser = SMCStore.getSession();
        if (currentUser) {
          if (currentUser.role === 'ADMIN') {
            showView('admin');
          } else if (currentUser.role === 'JLM') {
            showView('jlm');
          } else {
            showView('tekong');
          }
        } else {
          showView('landing');
        }
      };
    }
  }

  // -------------------------------------------------------------
  // AUTH (LOGIN & REGISTER)
  // -------------------------------------------------------------
  function setupAuthListeners() {
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const btnQuickTekong = document.getElementById('btn-quick-tekong');
    const btnQuickAdmin = document.getElementById('btn-quick-admin');
    const btnQuickJlm = document.getElementById('btn-quick-jlm');

    if (btnQuickTekong) {
      btnQuickTekong.onclick = () => {
        const uInput = document.getElementById('login-username');
        const pInput = document.getElementById('login-password');
        if (uInput && pInput && formLogin) {
          uInput.value = 'Rosli bin Ahmad';
          pInput.value = 'pass123';
          formLogin.dispatchEvent(new Event('submit'));
        }
      };
    }

    if (btnQuickAdmin) {
      btnQuickAdmin.onclick = () => {
        const uInput = document.getElementById('login-username');
        const pInput = document.getElementById('login-password');
        if (uInput && pInput && formLogin) {
          uInput.value = 'ADMIN-MCH-001';
          pInput.value = 'admin123';
          formLogin.dispatchEvent(new Event('submit'));
        }
      };
    }

    if (btnQuickJlm) {
      btnQuickJlm.onclick = () => {
        const uInput = document.getElementById('login-username');
        const pInput = document.getElementById('login-password');
        if (uInput && pInput && formLogin) {
          uInput.value = 'jlm';
          pInput.value = 'epenumpang2026';
          formLogin.dispatchEvent(new Event('submit'));
        }
      };
    }

    // Switch Tabs
    tabLogin.onclick = () => {
      tabLogin.className = 'py-2 rounded-lg transition-all bg-white text-[#0d3b66] shadow-sm';
      tabRegister.className = 'py-2 rounded-lg transition-all text-slate-500 hover:text-slate-800';
      formLogin.classList.remove('hidden');
      formRegister.classList.add('hidden');
    };

    tabRegister.onclick = () => {
      tabRegister.className = 'py-2 rounded-lg transition-all bg-white text-[#0d3b66] shadow-sm';
      tabLogin.className = 'py-2 rounded-lg transition-all text-slate-500 hover:text-slate-800';
      formRegister.classList.remove('hidden');
      formLogin.classList.add('hidden');
    };

    // Role Radio in Registration Form
    const roleRadios = document.querySelectorAll('input[name="regRole"]');
    const tekongFields = document.getElementById('reg-tekong-fields');
    const adminFields = document.getElementById('reg-admin-fields');

    roleRadios.forEach(radio => {
      radio.onchange = () => {
        if (radio.value === 'TEKONG') {
          if (tekongFields) tekongFields.classList.remove('hidden');
          if (adminFields) adminFields.classList.add('hidden');
        } else {
          if (adminFields) adminFields.classList.remove('hidden');
          if (tekongFields) tekongFields.classList.add('hidden');
        }
      };
    });

    // Letterbox IC / Passport Setup
    const radioIcMykad = document.getElementById('radio-ic-mykad');
    const radioIcPassport = document.getElementById('radio-ic-passport');
    const containerRegMykad = document.getElementById('container-reg-mykad');
    const containerRegPassport = document.getElementById('container-reg-passport');
    const regMykad1 = document.getElementById('reg-mykad-1');
    const regMykad2 = document.getElementById('reg-mykad-2');
    const regMykad3 = document.getElementById('reg-mykad-3');
    const regPassport = document.getElementById('reg-passport');
    const regIcPassportHidden = document.getElementById('reg-ic-passport');

    function syncIcPassportValue() {
      if (radioIcPassport && radioIcPassport.checked) {
        if (regIcPassportHidden) regIcPassportHidden.value = (regPassport ? regPassport.value : '').trim().toUpperCase();
      } else {
        const p1 = (regMykad1 ? regMykad1.value : '').replace(/\D/g, '');
        const p2 = (regMykad2 ? regMykad2.value : '').replace(/\D/g, '');
        const p3 = (regMykad3 ? regMykad3.value : '').replace(/\D/g, '');
        if (p1 || p2 || p3) {
          if (regIcPassportHidden) regIcPassportHidden.value = `${p1}${p2 ? '-' + p2 : ''}${p3 ? '-' + p3 : ''}`;
        } else {
          if (regIcPassportHidden) regIcPassportHidden.value = '';
        }
      }
    }

    if (radioIcMykad && radioIcPassport) {
      radioIcMykad.onchange = () => {
        if (containerRegMykad) containerRegMykad.classList.remove('hidden');
        if (containerRegPassport) containerRegPassport.classList.add('hidden');
        syncIcPassportValue();
      };
      radioIcPassport.onchange = () => {
        if (containerRegPassport) containerRegPassport.classList.remove('hidden');
        if (containerRegMykad) containerRegMykad.classList.add('hidden');
        syncIcPassportValue();
      };
    }

    if (regMykad1 && regMykad2 && regMykad3) {
      // Auto-advance
      regMykad1.addEventListener('input', () => {
        regMykad1.value = regMykad1.value.replace(/\D/g, '').slice(0, 6);
        if (regMykad1.value.length === 6) {
          regMykad2.focus();
        }
        syncIcPassportValue();
      });

      regMykad2.addEventListener('input', () => {
        regMykad2.value = regMykad2.value.replace(/\D/g, '').slice(0, 2);
        if (regMykad2.value.length === 2) {
          regMykad3.focus();
        }
        syncIcPassportValue();
      });

      regMykad3.addEventListener('input', () => {
        regMykad3.value = regMykad3.value.replace(/\D/g, '').slice(0, 4);
        syncIcPassportValue();
      });

      // Backspace handling
      regMykad2.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && regMykad2.value.length === 0) {
          regMykad1.focus();
        }
      });

      regMykad3.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && regMykad3.value.length === 0) {
          regMykad2.focus();
        }
      });

      // Paste handling
      const handleMykadPaste = (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        if (text) {
          regMykad1.value = text.slice(0, 6);
          regMykad2.value = text.slice(6, 8);
          regMykad3.value = text.slice(8, 12);
          if (text.length >= 8) {
            regMykad3.focus();
          } else if (text.length >= 6) {
            regMykad2.focus();
          }
          syncIcPassportValue();
        }
      };

      regMykad1.addEventListener('paste', handleMykadPaste);
      regMykad2.addEventListener('paste', handleMykadPaste);
      regMykad3.addEventListener('paste', handleMykadPaste);
    }

    if (regPassport) {
      regPassport.addEventListener('input', () => {
        regPassport.value = regPassport.value.toUpperCase();
        syncIcPassportValue();
      });
    }

    // Boat Type dropdown & capacity lock
    const regBoatType = document.getElementById('reg-boat-type');
    const regBoatCapacity = document.getElementById('reg-boat-capacity');
    const regCapacityBadgeText = document.getElementById('reg-capacity-badge-text');
    const regCapacitySubtext = document.getElementById('reg-capacity-subtext');

    function updateRegBoatCapacityLock() {
      if (!regBoatType || !regBoatCapacity) return;
      const val = regBoatType.value;
      let cap = 12;
      if (val === 'medium_speedboat') cap = 24;
      else if (val === 'ferry') cap = 40;
      else cap = 12;

      regBoatCapacity.value = cap;
      const isEn = window.I18N && window.I18N.getLanguage() === 'en';
      if (regCapacityBadgeText) {
        regCapacityBadgeText.textContent = isEn ? `Locked (${cap})` : `Dikunci (${cap})`;
      }
      if (regCapacitySubtext) {
        regCapacitySubtext.textContent = isEn
          ? `* Registered boat capacity is locked to ${cap} persons based on the chosen boat type and automatically applied to all your trips.`
          : `* Kapasiti bot dikunci kepada ${cap} orang mengikut jenis bot yang dipilih dan digunakan secara automatik untuk setiap trip pelayaran anda.`;
      }
    }

    if (regBoatType) {
      regBoatType.onchange = updateRegBoatCapacityLock;
      updateRegBoatCapacityLock();
    }

    // Form Submit: Login
    formLogin.onsubmit = async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value;
      const p = document.getElementById('login-password').value;

      const submitBtn = formLogin.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        const isEnLogin = window.I18N && window.I18N.getLanguage() === 'en'; submitBtn.innerHTML = `<span>${isEnLogin ? 'Checking credentials...' : 'Memeriksa kelayakan...'}</span>`;
      }

      const result = await SMCStore.loginAsync(u, p);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }

      if (!result.success) {
        alert(result.message);
        return;
      }

      if (result.user.role === 'ADMIN') {
        showView('admin');
      } else if (result.user.role === 'JLM') {
        showView('jlm');
      } else {
        showView('tekong');
      }
    };

    // Form Submit: Register (Directly saves into MySQL & SQLite)
    formRegister.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(formRegister);
      const role = formData.get('regRole') || 'TEKONG';
      const fullName = (formData.get('regFullName') || '').trim();
      const password = formData.get('regPassword') || '';

      const isEnReg = window.I18N && window.I18N.getLanguage() === 'en';
      if (!fullName) {
        alert(isEnReg ? 'Please enter your Full Name.' : 'Sila masukkan Nama Penuh anda.');
        return;
      }

      if (!password) {
        alert(isEnReg ? 'Please create a password to secure your account.' : 'Sila cipta kata laluan untuk keselamatan akaun anda.');
        return;
      }

      // Check captain IC / Passport
      syncIcPassportValue();
      const icPassport = (regIcPassportHidden ? regIcPassportHidden.value : '').trim();
      if (role === 'TEKONG' && !icPassport) {
        alert(isEnReg 
          ? 'Please enter the Captain National ID (MyKad).' 
          : 'Sila masukkan No. Kad Pengenalan (MyKad) Nakhoda.');
        if (regMykad1 && !regMykad1.value) regMykad1.focus();
        return;
      }

      const boatType = formData.get('regBoatType') || 'mini_speedboat';
      const capacityVal = parseInt(document.getElementById('reg-boat-capacity')?.value || formData.get('regBoatCapacity'), 10) || 12;

      const submitBtn = formRegister.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>${isEnReg ? 'Registering account...' : 'Mendaftar akaun...'}</span>`;
      }

      const account = {
        role,
        fullName,
        username: (formData.get('regUsername') || '').trim(),
        password,
        phone: formData.get('regPhone') || '',
        licenseNo: (formData.get('regLicenseNo') || ('2025' + Math.floor(10000000 + Math.random() * 90000000))).replace(/^SID\s*no\.?\s*/i, '').trim(),
        ic_passport: icPassport || null,
        boat_type: boatType,
        boatName: formData.get('regBoatName') || 'Bot Pelancongan Baharu',
        boatRegNo: formData.get('regBoatRegNo') || 'TR-BARU-01',
        boatCapacity: capacityVal,
        defaultCapacity: capacityVal,
        staffId: formData.get('regStaffId'),
        agencyKey: formData.get('regAgencyKey'),
        port: 'Jeti Kuala Besut'
      };

      try {
        const res = await SMCStore.register(account);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }

        if (!res.success) {
          alert(res.message);
          return;
        }

        const boatTypeDisplay = boatType === 'medium_speedboat' ? 'Medium Speedboat (24 Pax)' : (boatType === 'ferry' ? 'Ferry (40 Pax)' : 'Mini Speedboat (12 Pax)');
        const successNotice = isEnReg
          ? `Registration Successful!\n\nCaptain Name: ${fullName}\nCaptain ID: ${icPassport || '-'}\nSeafarer ID: ${res.user.id || '-'}\nBoat Type: ${boatTypeDisplay}\nLocked Capacity: ${capacityVal} Pax\n\nYour account is now registered and verified. You can log in at any time using your Full Name and Password.`
          : `Pendaftaran Berjaya!\n\nNama Nakhoda: ${fullName}\nNo. KP/Pasport: ${icPassport || '-'}\nID Pelaut: ${res.user.id || '-'}\nJenis Bot: ${boatTypeDisplay}\nKapasiti Terkunci: ${capacityVal} Orang\n\nAkaun anda kini telah didaftarkan dan disahkan. Anda boleh log masuk pada bila-bila masa menggunakan Nama Penuh dan Kata Laluan anda.`;
        alert(successNotice);
        resetAuthForms();
        showView(role === 'ADMIN' ? 'admin' : 'tekong');
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
        alert((isEnReg ? 'Registration error: ' : 'Ralat pendaftaran: ') + err.message);
      }
    };
  }

  // -------------------------------------------------------------
  // DEDICATED TEKONG PORTAL
  // -------------------------------------------------------------
  let tekongPaxSearchQuery = '';

  function setupTekongListeners() {
    const selectTrip = document.getElementById('tekong-trip-select');
    selectTrip.onchange = () => {
      activeTripId = selectTrip.value;
      try {
        localStorage.setItem('ep_last_selected_trip', activeTripId);
      } catch (e) {}
      if (activeTripId) {
        renderTekongActiveTrip(activeTripId);
      } else {
        const user = SMCStore.getSession();
        renderTekongEmptyState(user);
      }
    };

    // Live Passenger Search Filter in Tekong Manifest
    const paxSearchInput = document.getElementById('tekong-pax-search');
    if (paxSearchInput) {
      paxSearchInput.oninput = () => {
        tekongPaxSearchQuery = paxSearchInput.value.trim().toLowerCase();
        const trip = SMCStore.getTripById(activeTripId);
        if (trip) renderTekongPassengerTable(trip);
      };
    }
    const btnClearSearch = document.getElementById('btn-clear-tekong-search');
    if (btnClearSearch) {
      btnClearSearch.onclick = () => {
        if (paxSearchInput) paxSearchInput.value = '';
        tekongPaxSearchQuery = '';
        const trip = SMCStore.getTripById(activeTripId);
        if (trip) renderTekongPassengerTable(trip);
      };
    }

    // Approve Trip Button
    document.getElementById('btn-tekong-approve').onclick = async () => {
      const isEnApprove = window.I18N && window.I18N.getLanguage() === 'en';
      if (!activeTripId) {
        alert(isEnApprove ? 'Please create or select an active trip before approving departure.' : 'Sila cipta atau pilih trip aktif terlebih dahulu sebelum meluluskan pelepasan.');
        return;
      }
      const trip = SMCStore.getTripById(activeTripId);
      if (!trip) return;

      const confirmText = isEnApprove
        ? `Confirm departure for vessel ${trip.boatName}?\n\nThis confirms that all passengers are wearing lifejackets and capacity limits are strictly obeyed.`
        : `Sahkan pelepasan untuk bot ${trip.boatName}?\n\nPengesahan ini mengesahkan bahawa semua penumpang telah memakai jaket keselamatan dan mematuhi had kapasiti.`;
      if (!confirm(confirmText)) {
        return;
      }

      const approveBtn = document.getElementById('btn-tekong-approve');
      const originalHtml = approveBtn ? approveBtn.innerHTML : '';
      if (approveBtn) {
        approveBtn.disabled = true;
        approveBtn.innerHTML = `<span>${isEnApprove ? 'Authorising departure clearance...' : 'Mengesahkan pelepasan pelayaran...'}</span>`;
      }

      try {
        await SMCStore.approveTrip(activeTripId);
        renderTekongActiveTrip(activeTripId);
        alert(isEnApprove ? 'TRIP APPROVED! The vessel is officially authorised to depart. Port clearance has been granted.' : 'TRIP TELAH DILULUSKAN! Bot dibenarkan berlepas secara rasmi. Pelepasan pelabuhan telah disahkan.');
      } catch (err) {
        alert(err.message);
      } finally {
        if (approveBtn) {
          approveBtn.disabled = false;
          approveBtn.innerHTML = originalHtml;
        }
      }
    };

    // Print Manifest (Direct in-page print without opening new tab)
    document.getElementById('btn-print-manifest').onclick = () => {
      if (!activeTripId) {
        alert(window.I18N && window.I18N.getLanguage() === 'en' ? 'Please create a trip and register passengers before printing the manifest.' : 'Sila cipta trip dan daftarkan penumpang terlebih dahulu untuk mencetak manifes.');
        return;
      }
      printManifestDirect(activeTripId);
    };

    const btnView = document.getElementById('btn-view-manifest');
    if (btnView) {
      btnView.onclick = () => {
        if (!activeTripId) {
          alert(window.I18N && window.I18N.getLanguage() === 'en' ? 'Please create a trip first to review manifest APPENDIX A.' : 'Sila cipta trip terlebih dahulu untuk menyemak manifes LAMPIRAN A.');
          return;
        }
        openManifestModal(activeTripId);
      };
    }

    // Modal: Manifest In-App Viewer Controls
    const modalViewManifest = document.getElementById('modal-view-manifest');
    if (modalViewManifest) {
      modalViewManifest.onclick = (e) => {
        if (e.target === modalViewManifest) {
          modalViewManifest.classList.add('hidden');
          const iframe = document.getElementById('manifest-modal-iframe');
          if (iframe) iframe.src = 'about:blank';
        }
      };
    }

    const btnCloseManifestModal = document.getElementById('btn-close-manifest-modal');
    if (btnCloseManifestModal) {
      btnCloseManifestModal.onclick = () => {
        const modal = document.getElementById('modal-view-manifest');
        const iframe = document.getElementById('manifest-modal-iframe');
        if (modal) modal.classList.add('hidden');
        if (iframe) iframe.src = 'about:blank';
      };
    }

    const btnManifestModalPrint = document.getElementById('btn-manifest-modal-print');
    if (btnManifestModalPrint) {
      btnManifestModalPrint.onclick = () => {
        printManifestDirect(activeTripId);
      };
    }

    document.getElementById('btn-export-csv').onclick = () => {
      if (!activeTripId) {
        alert(window.I18N && window.I18N.getLanguage() === 'en' ? 'Please create a trip first to download CSV.' : 'Sila cipta trip terlebih dahulu untuk memuat turun CSV.');
        return;
      }
      const trip = SMCStore.getTripById(activeTripId);
      if (trip) ManifestExport.exportCSV({ trip, ...trip });
    };
  }

  function openManifestModal(tripId) {
    const isEn = window.I18N && window.I18N.getLanguage() === 'en';
    if (!tripId) {
      alert(isEn ? 'Please select or create an active boat trip first to review the manifest.' : 'Sila pilih atau cipta trip aktif terlebih dahulu untuk menyemak manifes.');
      return;
    }
    const modal = document.getElementById('modal-view-manifest');
    const iframe = document.getElementById('manifest-modal-iframe');
    const badge = document.getElementById('manifest-modal-trip-badge');
    const newTabLink = document.getElementById('link-manifest-modal-newtab');
    const currentLang = (window.I18N && window.I18N.getLanguage()) || 'en';
    const manifestUrl = `/manifest-print.html?tripId=${encodeURIComponent(tripId)}&lang=${currentLang}`;

    if (badge) badge.textContent = tripId;
    if (iframe) iframe.src = manifestUrl;
    if (newTabLink) newTabLink.href = manifestUrl;
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  function printManifestDirect(tripId) {
    if (!tripId) return;

    // 1. If in-app manifest modal is already open and loaded, trigger its print directly
    const modal = document.getElementById('modal-view-manifest');
    const modalIframe = document.getElementById('manifest-modal-iframe');
    if (modal && !modal.classList.contains('hidden') && modalIframe && modalIframe.contentWindow) {
      modalIframe.contentWindow.focus();
      modalIframe.contentWindow.print();
      return;
    }

    // 2. Otherwise, load silent hidden iframe to print without opening any new tab!
    let printFrame = document.getElementById('silent-manifest-print-frame');
    if (printFrame) {
      printFrame.remove();
    }

    printFrame = document.createElement('iframe');
    printFrame.id = 'silent-manifest-print-frame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.visibility = 'hidden';
    document.body.appendChild(printFrame);

    const currentLang = (window.I18N && window.I18N.getLanguage()) || 'en';
    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (err) {
        console.warn('Direct print error, falling back:', err);
        window.open('/manifest-print.html?tripId=' + encodeURIComponent(tripId) + '&lang=' + currentLang + '&print=true', '_blank');
      }
    };

    const messageHandler = (event) => {
      if (event.data && event.data.type === 'MANIFEST_RENDERED') {
        window.removeEventListener('message', messageHandler);
        setTimeout(triggerPrint, 100);
      }
    };
    window.addEventListener('message', messageHandler);

    // Fallback timer in case postMessage is delayed
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      triggerPrint();
    }, 1000);

    printFrame.src = '/manifest-print.html?tripId=' + encodeURIComponent(tripId) + '&lang=' + currentLang;
  }

  function refreshTekongTripDropdown(targetTripId = null) {
    const user = SMCStore.getSession();
    const trips = user ? SMCStore.getTripsForUser(user) : SMCStore.getTrips();
    const select = document.getElementById('tekong-trip-select');
    if (!select) return null;

    if (!trips || trips.length === 0) {
      activeTripId = null;
      renderTekongEmptyState(user);
      return null;
    }

    let savedTripId = null;
    try {
      savedTripId = localStorage.getItem('ep_last_selected_trip');
    } catch (e) {}

    // Selection priority: targetTripId -> currently selected in select -> activeTripId -> saved in localStorage -> first trip
    const candidateId = targetTripId || select.value || activeTripId || savedTripId;
    const foundTrip = candidateId ? trips.find(t => t.id === candidateId) : null;
    const chosenTrip = foundTrip || trips[0];
    activeTripId = chosenTrip.id;

    try {
      localStorage.setItem('ep_last_selected_trip', activeTripId);
    } catch (e) {}

    select.innerHTML = '';
    trips.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      const paxCount = (t.passengers && Array.isArray(t.passengers)) ? t.passengers.length : 0;
      const maxCap = t.maxCapacity || 12;
      opt.textContent = `${t.id} - ${t.boatName} (${t.destination}) [${paxCount}/${maxCap} Pax]`;
      if (t.id === activeTripId) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.value = activeTripId;
    return activeTripId;
  }

  function loadTekongDashboard(selectId = null) {
    const user = SMCStore.getSession();
    const chosenId = refreshTekongTripDropdown(selectId);
    if (chosenId) {
      renderTekongActiveTrip(chosenId);
    } else {
      renderTekongEmptyState(user);
    }
  }

  function renderTekongEmptyState(user) {
    const isEn = window.I18N && window.I18N.getLanguage() === 'en';
    const select = document.getElementById('tekong-trip-select');
    select.innerHTML = `<option value="">-- ${isEn ? 'No Active Trips (Please Create a New Trip)' : 'Tiada Trip Aktif (Sila Cipta Trip Baharu)'} --</option>`;

    const boatName = (user && user.boatName) || (isEn ? 'Your Tourist Boat' : 'Bot Pelancongan Anda');
    const boatReg = (user && user.boatRegNo) || 'TR-NEW';
    const skipperName = (user && user.fullName) || (isEn ? 'Captain' : 'Nakhoda');
    const skipperLicense = String((user && user.licenseNo) || '202523023697').replace(/^SID\s*no\.?\s*/i, '').trim();
    const boatCapacity = (user && (user.defaultCapacity || user.boatCapacity || user.regBoatCapacity)) || 12;

    // Details card
    document.getElementById('tekong-boat-name').textContent = boatName;
    document.getElementById('tekong-boat-reg').textContent = boatReg;
    document.getElementById('tekong-destination').textContent = isEn ? 'Not Assigned' : 'Belum Ditetapkan';
    document.getElementById('tekong-jetty').textContent = isEn ? 'Departure Jetty (Please Create Trip)' : 'Jeti Berlepas (Sila Cipta Trip)';
    document.getElementById('tekong-datetime').textContent = isEn ? 'Today • Awaiting Trip' : 'Hari Ini • Menunggu Trip';
    document.getElementById('tekong-skipper').textContent = skipperName;
    document.getElementById('tekong-skipper-license').textContent = skipperLicense;
    document.getElementById('tekong-crew-list').textContent = isEn ? 'No active trip. Please create a trip and assign duty crew.' : 'Tiada trip aktif. Sila cipta trip dan tetapkan kru bertugas.';
    document.getElementById('tekong-trip-id').textContent = isEn ? 'NO TRIP' : 'TIADA TRIP';

    // Status Badge
    const statusBadge = document.getElementById('tekong-trip-status-badge');
    statusBadge.className = 'badge-status badge-open bg-blue-100 text-[#0d3b66] border border-blue-200';
    statusBadge.textContent = isEn ? 'Ready for New Trip' : 'Sedia Untuk Trip Baharu';

    // Capacity Widget
    document.getElementById('tekong-capacity-count').textContent = `0 / ${boatCapacity}`;
    const progressEl = document.getElementById('tekong-capacity-progress');
    progressEl.style.width = '0%';
    progressEl.className = 'h-2 rounded-full bg-slate-200 transition-all';

    const capBadge = document.getElementById('tekong-capacity-badge');
    capBadge.className = 'badge-status badge-open';
    capBadge.textContent = isEn ? 'Ready for Duty' : 'Sedia Beroperasi';

    document.getElementById('tekong-capacity-remaining').innerHTML = isEn
      ? `Registered boat capacity: <span class="font-bold text-slate-800">${boatCapacity}</span> seats`
      : `Kapasiti bot berdaftar: <span class="font-bold text-slate-800">${boatCapacity}</span> tempat duduk`;

    // Sidebar QR canvas
    const sidebarCanvas = document.getElementById('tekong-sidebar-qr-canvas');
    if (sidebarCanvas) {
      const ctx = sidebarCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, sidebarCanvas.width, sidebarCanvas.height);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, sidebarCanvas.width, sidebarCanvas.height);
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isEn ? 'Create Trip To' : 'Cipta Trip Untuk', sidebarCanvas.width / 2, sidebarCanvas.height / 2 - 8);
        ctx.fillText(isEn ? 'Generate QR Code' : 'Jana Kod QR', sidebarCanvas.width / 2, sidebarCanvas.height / 2 + 10);
      }
    }

    // Approval Notice & Button
    const approveNotice = document.getElementById('tekong-approval-notice');
    approveNotice.classList.add('hidden');
    const approveBtn = document.getElementById('btn-tekong-approve');
    approveBtn.disabled = true;
    approveBtn.className = 'w-full py-3 px-4 rounded-xl font-bold bg-slate-200 text-slate-400 cursor-not-allowed flex items-center justify-center gap-2';

    // Passenger Table Body - Clear previous rows
    const tbody = document.getElementById('tekong-passenger-table-body');
    tbody.innerHTML = '';

    // Empty Notice
    const emptyNotice = document.getElementById('tekong-passenger-empty');
    emptyNotice.classList.remove('hidden');
    emptyNotice.innerHTML = `
      <div class="w-16 h-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#0077b6]">
        <i data-lucide="ship" class="w-8 h-8"></i>
      </div>
      <h4 class="text-base font-black text-slate-800">${isEn ? `Welcome, ${escapeHtml(skipperName)}!` : `Selamat Datang, ${escapeHtml(skipperName)}!`}</h4>
      <p class="text-xs text-slate-600 max-w-md mx-auto mt-1 leading-relaxed">
        ${isEn 
          ? `Your vessel <strong>"${escapeHtml(boatName)}" (${escapeHtml(boatReg)})</strong> is ready for operations with a locked capacity of <strong>${boatCapacity} passengers</strong>.`
          : `Bot anda <strong>"${escapeHtml(boatName)}" (${escapeHtml(boatReg)})</strong> sedia beroperasi dengan had kapasiti terkunci <strong>${boatCapacity} penumpang</strong>.`}
      </p>
      <div class="mt-4 p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-slate-700 max-w-md mx-auto text-left">
        <div class="font-bold text-[#0d3b66] mb-1 flex items-center gap-1.5">
          <i data-lucide="info" class="w-4 h-4 text-[#0077b6]"></i>
          <span>${isEn ? 'First Step in Vessel Operations:' : 'Langkah Pertama Operasi Bot Anda:'}</span>
        </div>
        <p class="text-slate-600 leading-normal">
          ${isEn 
            ? 'Click the <strong>"Create Your Boat\'s First Trip"</strong> button below to specify your destination (Perhentian Island / Redang Island) and departure time to generate your digital passenger registration QR code.'
            : 'Klik butang <strong>"Cipta Trip Pertama Bot Anda"</strong> di bawah untuk menetapkan destinasi (Pulau Perhentian / Pulau Redang) dan waktu berlepas bagi menjana Kod QR pendaftaran penumpang digital.'}
        </p>
      </div>
      <button onclick="document.getElementById('btn-open-create-trip').click()" class="mt-4 py-2.5 px-6 bg-[#0d3b66] hover:bg-[#072340] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2">
        <i data-lucide="plus-circle" class="w-4 h-4 text-amber-400"></i>
        <span>${isEn ? '1. Create Your Boat\'s First Trip' : '1. Cipta Trip Pertama Bot Anda'}</span>
      </button>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // -------------------------------------------------------------
  // REAL-TIME LIVE SYNC (SERVER-SENT EVENTS + RESILIENT POLLING)
  // -------------------------------------------------------------
  let liveEventSource = null;
  let liveSyncInterval = null;
  let isLiveSyncActive = false;
  let lastSyncTimestamp = Date.now();

  function updateLiveSyncUI(status) {
    const indicator = document.getElementById('admin-live-sync-indicator');
    const label = document.getElementById('admin-live-sync-label');
    const timeEl = document.getElementById('admin-live-sync-time');
    if (!indicator || !label) return;

    const isEn = window.I18N && window.I18N.getLanguage() === 'en';

    if (status === 'active') {
      indicator.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-mono text-[11px] border border-emerald-200 transition-all shadow-2xs';
      label.textContent = isEn ? 'LIVE SYNC ACTIVE' : 'SEGERAK LANGSUNG AKTIF';
      if (timeEl) timeEl.textContent = isEn ? '⚡ Real-Time' : '⚡ Masa Nyata';
    } else if (status === 'syncing') {
      indicator.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-mono text-[11px] border border-sky-200 transition-all shadow-2xs animate-pulse';
      label.textContent = isEn ? 'SYNCING...' : 'MENYEGERAK...';
    } else {
      indicator.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-mono text-[11px] border border-amber-200 transition-all shadow-2xs';
      label.textContent = isEn ? 'OFFLINE (RETRYING)' : 'LUAR TALIAN (CUBA SEMULA)';
      if (timeEl) timeEl.textContent = '● Fallback';
    }
  }

  function flashSyncPulse() {
    const indicator = document.getElementById('admin-live-sync-indicator');
    if (!indicator) return;
    indicator.classList.add('ring-2', 'ring-emerald-400', 'scale-105');
    setTimeout(() => {
      indicator.classList.remove('ring-2', 'ring-emerald-400', 'scale-105');
    }, 450);
  }

  async function triggerInstantSync(eventInfo) {
    try {
      updateLiveSyncUI('syncing');
      await SMCStore.syncWithServer();
      lastSyncTimestamp = Date.now();
      flashSyncPulse();
      updateLiveSyncUI('active');

      // 1. If Admin view is active, immediately re-render everything
      const viewAdmin = document.getElementById('view-admin');
      if (viewAdmin && !viewAdmin.classList.contains('hidden')) {
        loadAdminDashboard();
      }

      // 2. If Captain view is active, immediately re-render active trip
      const viewTekong = document.getElementById('view-tekong');
      if (viewTekong && !viewTekong.classList.contains('hidden')) {
        if (eventInfo && eventInfo.type === 'DATA_RESET') {
          const userTrips = SMCStore.getTripsForCurrentUser();
          if (userTrips && userTrips.length > 0) {
            activeTripId = userTrips[0].id;
          }
        }
        const incomingTripId = eventInfo && eventInfo.payload ? eventInfo.payload.tripId : null;

        // If driver has no active trip or if incoming event is for a trip and current active trip has 0 pax
        if (incomingTripId && (!activeTripId || (activeTripId !== incomingTripId && (!SMCStore.getTripById(activeTripId) || (SMCStore.getTripById(activeTripId).passengers || []).length === 0)))) {
          activeTripId = incomingTripId;
        }

        // Dynamically refresh dropdown options so passenger counts e.g. [3/12 Pax] are updated live
        refreshTekongTripDropdown(activeTripId);

        if (activeTripId) {
          renderTekongActiveTrip(activeTripId);
        }

        // Flash Captain Live Sync Indicator
        const tekongIndicator = document.getElementById('tekong-live-sync-indicator');
        if (tekongIndicator) {
          tekongIndicator.classList.add('ring-2', 'ring-emerald-400', 'scale-105');
          setTimeout(() => {
            tekongIndicator.classList.remove('ring-2', 'ring-emerald-400', 'scale-105');
          }, 450);
        }
      }
    } catch (err) {
      console.warn('[Live Sync] Instant sync error:', err);
    }
  }

  function startLiveSync() {
    let reconnectTimeout = null;

    function connectSSE() {
      if (typeof window === 'undefined' || !window.EventSource) return;
      if (typeof document !== 'undefined' && document.hidden) return; // Don't hold sockets when tab is backgrounded

      if (liveEventSource) {
        try { liveEventSource.close(); } catch(e) {}
        liveEventSource = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      try {
        liveEventSource = new EventSource('/api/live-events');

        liveEventSource.onopen = () => {
          isLiveSyncActive = true;
          updateLiveSyncUI('active');
        };

        liveEventSource.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'CONNECTED') {
              updateLiveSyncUI('active');
              return;
            }
            if (data.type === 'CYCLE' || data.type === 'DISCONNECT_OLD') {
              // Server requested socket cycle; close and reconnect cleanly
              if (liveEventSource) {
                try { liveEventSource.close(); } catch(e) {}
                liveEventSource = null;
              }
              reconnectTimeout = setTimeout(connectSSE, 1500);
              return;
            }
            // Trigger instant synchronization
            await triggerInstantSync(data);
          } catch (e) {
            console.warn('[Live Sync] Message parse error:', e);
          }
        };

        liveEventSource.onerror = () => {
          isLiveSyncActive = false;
          updateLiveSyncUI('offline');
          if (liveEventSource) {
            try { liveEventSource.close(); } catch(e) {}
            liveEventSource = null;
          }
          if (!reconnectTimeout) {
            reconnectTimeout = setTimeout(connectSSE, 4000);
          }
        };
      } catch (e) {
        console.warn('[Live Sync] EventSource initialization failed, using polling fallback');
      }
    }

    // 1. Initial SSE connect
    connectSSE();

    // 2. Fallback / supplementary heartbeat polling (every 3 seconds)
    if (liveSyncInterval) clearInterval(liveSyncInterval);

    liveSyncInterval = setInterval(async () => {
      // If document is hidden, conserve polling frequency
      if (typeof document !== 'undefined' && document.hidden) return;

      const user = SMCStore.getSession();
      if (!user) return;

      try {
        const viewAdmin = document.getElementById('view-admin');
        const viewTekong = document.getElementById('view-tekong');

        if ((viewAdmin && !viewAdmin.classList.contains('hidden')) || 
            (viewTekong && !viewTekong.classList.contains('hidden'))) {
          // If no SSE event was received in the last 4 seconds, do a check
          if (Date.now() - lastSyncTimestamp > 3000) {
            await triggerInstantSync({ type: 'HEARTBEAT' });
          }
        }
      } catch (e) {
        // Silently ignore polling hiccups
      }
    }, 3000);

    // 3. Tab visibility change: disconnect SSE when tab is backgrounded to release browser socket (HTTP/1.1 max 6)
    if (typeof document !== 'undefined' && !document._hasLiveSyncVisibilityListener) {
      document._hasLiveSyncVisibilityListener = true;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (liveEventSource) {
            try { liveEventSource.close(); } catch(e) {}
            liveEventSource = null;
            isLiveSyncActive = false;
          }
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
          }
        } else {
          connectSSE();
          triggerInstantSync({ type: 'TAB_FOCUSED' });
        }
      });
    }

    // 4. Page unload / navigation cleanup: release sockets immediately
    if (typeof window !== 'undefined' && !window._hasLiveSyncUnloadListener) {
      window._hasLiveSyncUnloadListener = true;
      const releaseSockets = () => {
        if (liveEventSource) {
          try { liveEventSource.close(); } catch(e) {}
          liveEventSource = null;
        }
        if (liveSyncInterval) {
          clearInterval(liveSyncInterval);
          liveSyncInterval = null;
        }
      };
      window.addEventListener('beforeunload', releaseSockets);
      window.addEventListener('pagehide', releaseSockets);
    }
  }

  function renderTekongActiveTrip(tripId) {
    const trip = SMCStore.getTripById(tripId);
    if (!trip) return;

    const isEn = isEnglish();

    // Details
    document.getElementById('tekong-boat-name').textContent = trip.boatName;
    document.getElementById('tekong-boat-reg').textContent = trip.boatRegNo;

    const boatTypeBadge = document.getElementById('tekong-boat-type-badge');
    if (boatTypeBadge) {
      const cap = trip.maxCapacity || 12;
      let label = isEn ? `🛥️ Mini Speedboat (${cap} Pax)` : `🛥️ Mini Speedboat (${cap} Pax)`;
      let badgeStyle = 'text-[10px] font-bold text-sky-800 bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-full';
      if (cap === 24) {
        label = isEn ? `🚤 Medium Speedboat (${cap} Pax)` : `🚤 Medium Speedboat (${cap} Pax)`;
        badgeStyle = 'text-[10px] font-bold text-indigo-800 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full';
      } else if (cap >= 40) {
        label = isEn ? `⛴️ Ferry (${cap} Pax)` : `⛴️ Feri (${cap} Pax)`;
        badgeStyle = 'text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full';
      }
      boatTypeBadge.textContent = label;
      boatTypeBadge.className = badgeStyle;
    }

    document.getElementById('tekong-destination').textContent = trip.destination;
    document.getElementById('tekong-jetty').textContent = trip.departureJetty || 'Jeti Berlepas';
    document.getElementById('tekong-datetime').textContent = `${trip.departureDate} • ${trip.departureTime}`;
    document.getElementById('tekong-skipper').textContent = trip.skipperName;
    document.getElementById('tekong-skipper-license').textContent = String(trip.skipperLicense || '202523023697').replace(/^SID\s*no\.?\s*/i, '').trim();
    const skipperIcEl = document.getElementById('tekong-skipper-ic');
    if (skipperIcEl) {
      const currentUser = SMCStore.getSession();
      const primaryIc = trip.skipperIc || trip.driver_ic || (trip.drivers && trip.drivers[0] && trip.drivers[0].ic_passport) || (currentUser && currentUser.ic_passport) || '-';
      skipperIcEl.textContent = primaryIc;
    }
    
    // Render Structured Crew List
    const crewContainer = document.getElementById('tekong-crew-list');
    if (crewContainer) {
      if (trip.crew && Array.isArray(trip.crew) && trip.crew.length > 0) {
        crewContainer.innerHTML = `
          <div class="space-y-1.5">
            ${trip.crew.map((c, idx) => `
              <div class="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-4 h-4 rounded-full bg-slate-100 text-[#0d3b66] flex items-center justify-center font-bold text-[9px] flex-shrink-0 border border-slate-200">${idx + 1}</span>
                  <div class="truncate">
                    <span class="font-bold text-slate-800 text-[11px] block leading-tight truncate">${escapeHtml(c.name)}</span>
                    <span class="font-mono text-[9px] text-slate-400 block">${escapeHtml(c.ic_passport && c.ic_passport !== '-' ? c.ic_passport : 'IC: -')}</span>
                  </div>
                </div>
                <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-[#0d3b66] border border-blue-200 flex-shrink-0">${escapeHtml(c.role || 'Awak-awak')}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else if (trip.crewList) {
        crewContainer.textContent = trip.crewList;
      } else {
        crewContainer.innerHTML = isEn ? '<span class="text-slate-400 italic text-[11px]">No additional crew (Solo Operation)</span>' : '<span class="text-slate-400 italic text-[11px]">Tiada kru tambahan (Operasi Solo)</span>';
      }
    }

    document.getElementById('tekong-trip-id').textContent = trip.id;

    // Status Badge
    const statusBadge = document.getElementById('tekong-trip-status-badge');
    if (trip.status === 'APPROVED') {
      statusBadge.className = 'badge-status badge-approved';
      statusBadge.textContent = isEn ? 'Approved / Departed' : 'Diluluskan / Belayar';
    } else if (trip.status === 'FULL') {
      statusBadge.className = 'badge-status badge-full';
      statusBadge.textContent = isEn ? 'Capacity Full' : 'Kapasiti Penuh';
    } else {
      statusBadge.className = 'badge-status badge-open';
      statusBadge.textContent = isEn ? 'Registration Open' : 'Pendaftaran Dibuka';
    }

    // Capacity Widget (Had Penumpang adalah Mengikut Kapasiti Bot!)
    const paxCount = trip.passengers.length;
    const maxCapacity = trip.maxCapacity || 12;
    const isFull = paxCount >= maxCapacity;
    const remaining = Math.max(0, maxCapacity - paxCount);
    const pct = Math.min(100, Math.round((paxCount / maxCapacity) * 100));

    document.getElementById('tekong-capacity-count').textContent = `${paxCount} / ${maxCapacity}`;
    const progressEl = document.getElementById('tekong-capacity-progress');
    progressEl.style.width = `${pct}%`;
    progressEl.className = isFull 
      ? 'h-2 rounded-full bg-rose-600 animate-pulse transition-all duration-300' 
      : (pct >= 70 ? 'h-2 rounded-full bg-amber-500 transition-all duration-300' : 'h-2 rounded-full bg-emerald-500 transition-all duration-300');

    const capBadge = document.getElementById('tekong-capacity-badge');
    capBadge.className = isFull ? 'badge-status badge-full' : 'badge-status badge-open';
    capBadge.textContent = isFull ? (isEn ? 'Capacity Full' : 'Kapasiti Penuh') : (isEn ? 'Seats Available' : 'Kapasiti Masih Ada');

    document.getElementById('tekong-capacity-remaining').innerHTML = isFull
      ? (isEn ? '<span class="text-rose-600 font-bold">Boat maximum capacity reached.</span>' : '<span class="text-rose-600 font-bold">Kapasiti maksimum bot telah dipenuhi.</span>')
      : (isEn ? `Remaining <span class="font-bold text-slate-800">${remaining}</span> seats available` : `Baki <span class="font-bold text-slate-800">${remaining}</span> tempat duduk kosong lagi`);

    // Render Mini Sidebar QR Code
    const passengerUrl = getPassengerRegistrationUrl(trip.id);
    const sidebarCanvas = document.getElementById('tekong-sidebar-qr-canvas');
    if (sidebarCanvas) {
      QRUtils.renderToCanvas(sidebarCanvas, passengerUrl, { size: 130, padding: 6 });
    }

    // Approval Notice and Controls
    const approveNotice = document.getElementById('tekong-approval-notice');
    const approveBtn = document.getElementById('btn-tekong-approve');

    const isApproved = trip.status === 'APPROVED' || trip.status === 'APPROVED_DEPARTED' || trip.status === 'COMPLETED';

    if (isApproved) {
      approveBtn.classList.remove('hidden');
      approveBtn.disabled = true;
      approveBtn.className = 'w-full py-3 px-4 rounded-xl font-bold bg-slate-200 text-slate-500 cursor-not-allowed flex items-center justify-center gap-2';
      approveBtn.innerHTML = `
        <i data-lucide="check-circle" class="w-5 h-5 text-emerald-600"></i>
        <span>${isEn ? 'Departure Approved (Departed)' : 'Pelepasan Diluluskan (Belayar)'}</span>
      `;

      approveNotice.classList.remove('hidden');
      approveNotice.className = 'mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs';
      approveNotice.innerHTML = `
        <div class="flex items-center gap-1.5 text-emerald-800 font-bold">
          <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
          <span>${isEn ? `Trip APPROVED for departure at ${new Date(trip.approvedAt || trip.approved_at || Date.now()).toLocaleTimeString()}` : `Trip telah DILULUSKAN untuk pelepasan pada ${new Date(trip.approvedAt || trip.approved_at || Date.now()).toLocaleTimeString()}`}</span>
        </div>
      `;
    } else {
      // Status OPEN
      approveBtn.classList.remove('hidden');
      approveNotice.classList.add('hidden');
      approveBtn.disabled = paxCount === 0;
      approveBtn.className = paxCount === 0
        ? 'w-full py-3 px-4 rounded-xl font-bold bg-slate-200 text-slate-400 cursor-not-allowed flex items-center justify-center gap-2'
        : 'w-full py-3 px-4 rounded-xl font-bold bg-[#0d3b66] hover:bg-[#072340] text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2';
      approveBtn.innerHTML = `
        <i data-lucide="stamp" class="w-5 h-5 text-amber-400"></i>
        <span>${isEn ? '6. Authorise & Approve Departure' : '6. Sahkan & Luluskan Pelepasan'}</span>
      `;
    }

    // Update maritime weather advisory
    updateWeatherAdvisoryUI(trip.departureJetty);

    // Render Registered Passengers Table
    renderTekongPassengerTable(trip);
    if (window.lucide) window.lucide.createIcons();
  }

  function renderTekongPassengerTable(trip) {
    const isEn = isEnglish();
    const tbody = document.getElementById('tekong-passenger-table-body');
    const emptyNotice = document.getElementById('tekong-passenger-empty');
    const searchCountEl = document.getElementById('tekong-pax-search-count');
    const clearBtn = document.getElementById('btn-clear-tekong-search');
    tbody.innerHTML = '';

    if (!trip.passengers || trip.passengers.length === 0) {
      emptyNotice.classList.remove('hidden');
      if (searchCountEl) searchCountEl.textContent = '';
      if (clearBtn) clearBtn.classList.add('hidden');
      return;
    }

    let passengersToDisplay = trip.passengers;
    if (tekongPaxSearchQuery) {
      passengersToDisplay = passengersToDisplay.filter(p => {
        const name = (p.fullName || p.name || '').toLowerCase();
        const ic = (p.icOrPassport || p.ic_passport || '').toLowerCase();
        const phone = (p.phone || '').toLowerCase();
        const addr = (p.shortAddress || '').toLowerCase();
        return name.includes(tekongPaxSearchQuery) || ic.includes(tekongPaxSearchQuery) || phone.includes(tekongPaxSearchQuery) || addr.includes(tekongPaxSearchQuery);
      });

      if (searchCountEl) {
        searchCountEl.textContent = isEn 
          ? `Found ${passengersToDisplay.length} of ${trip.passengers.length}`
          : `Dijumpai ${passengersToDisplay.length} drp ${trip.passengers.length}`;
      }
      if (clearBtn) clearBtn.classList.remove('hidden');
    } else {
      if (searchCountEl) {
        searchCountEl.textContent = isEn ? `Total: ${trip.passengers.length} pax` : `Jumlah: ${trip.passengers.length} orang`;
      }
      if (clearBtn) clearBtn.classList.add('hidden');
    }

    if (passengersToDisplay.length === 0) {
      emptyNotice.classList.add('hidden');
      const emptyTr = document.createElement('tr');
      emptyTr.innerHTML = `
        <td colspan="7" class="py-8 text-center text-slate-400 font-medium bg-slate-50/50">
          <div class="flex flex-col items-center justify-center gap-1.5">
            <span class="text-base">🔍</span>
            <span>${isEn ? 'No passengers match the search query.' : 'Tiada penumpang sepadan dengan carian.'}</span>
          </div>
        </td>
      `;
      tbody.appendChild(emptyTr);
      return;
    }

    emptyNotice.classList.add('hidden');
    passengersToDisplay.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 hover:bg-slate-50/80 text-xs transition-colors';
      tr.innerHTML = `
        <td class="py-3 px-3 text-center font-bold text-slate-500">${idx + 1}</td>
        <td class="py-3 px-3">
          <div class="font-bold text-slate-800">${escapeHtml(p.fullName)}</div>
          <div class="text-[10px] text-slate-400 font-mono">${p.id}</div>
        </td>
        <td class="py-3 px-3 font-mono font-medium text-slate-700">${escapeHtml(p.icOrPassport)}</td>
        <td class="py-3 px-3 text-slate-600">${escapeHtml(p.shortAddress)}</td>
        <td class="py-3 px-3 font-mono text-slate-600">${escapeHtml(p.phone || '-')}</td>
        <td class="py-3 px-3 text-center">
          <button class="btn-toggle-jacket p-1 rounded hover:bg-slate-200" title="${isEn ? 'Toggle lifejacket status' : 'Tukar status jaket keselamatan'}" data-pax-id="${p.id}">
            <span class="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full ${p.lifejacket !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
              <i data-lucide="${p.lifejacket !== false ? 'check' : 'x'}" class="w-3 h-3"></i>
              ${p.lifejacket !== false ? (isEn ? 'Worn' : 'Pakai') : (isEn ? 'None' : 'Tiada')}
            </span>
          </button>
        </td>
        <td class="py-3 px-3 text-right">
          <button class="btn-delete-pax text-slate-400 hover:text-rose-600 p-1 transition-colors" title="${isEn ? 'Delete passenger' : 'Padam penumpang'}" data-pax-id="${p.id}">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Wire table button events
    tbody.querySelectorAll('.btn-toggle-jacket').forEach(btn => {
      btn.onclick = async () => {
        const paxId = btn.getAttribute('data-pax-id');
        await SMCStore.toggleLifejacket(activeTripId, paxId);
        renderTekongActiveTrip(activeTripId);
      };
    });

    tbody.querySelectorAll('.btn-delete-pax').forEach(btn => {
      btn.onclick = async () => {
        const paxId = btn.getAttribute('data-pax-id');
        const isEnDel = window.I18N && window.I18N.getLanguage() === 'en';
        if (confirm(isEnDel ? 'Are you sure you want to delete this passenger record from the manifest?' : 'Adakah anda pasti ingin memadam rekod penumpang ini daripada manifes?')) {
          await SMCStore.deletePassenger(activeTripId, paxId);
          renderTekongActiveTrip(activeTripId);
        }
      };
    });
  }

  // ==========================================
  // DEDICATED MCH ADMIN PORTAL
  // ==========================================
  let adminFleetStatusFilter = 'ALL';
  let adminFleetDestFilter = 'ALL';
  let adminFleetBoatTypeFilter = 'ALL';
  let adminFleetPeriodFilter = 'ALL'; // 'ALL', 'TODAY', 'MONTH', 'CUSTOM'
  let adminFleetDateFilter = ''; // Specific 'YYYY-MM-DD'
  let adminIncidentLogView = 'DAILY'; // 'DAILY' or 'MONTHLY'

  function getTripDateString(t) {
    if (t.departureDate && String(t.departureDate).trim()) return String(t.departureDate).trim();
    if (t.departure_date && String(t.departure_date).trim()) return String(t.departure_date).trim();
    if (t.createdAt) return String(t.createdAt).split('T')[0];
    if (t.created_at) return String(t.created_at).split('T')[0];
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function getFilteredAdminTrips(allTrips) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return allTrips.filter(t => {
      const matchStatus = adminFleetStatusFilter === 'ALL' || t.status === adminFleetStatusFilter;
      const matchDest = adminFleetDestFilter === 'ALL' || t.destination === adminFleetDestFilter;
      const matchBoatType = adminFleetBoatTypeFilter === 'ALL' || String(t.maxCapacity) === String(adminFleetBoatTypeFilter);

      const tDate = getTripDateString(t);
      let matchDate = true;
      if (adminFleetPeriodFilter === 'TODAY') {
        matchDate = (tDate === todayStr);
      } else if (adminFleetPeriodFilter === 'MONTH') {
        matchDate = tDate && tDate.startsWith(currentMonthStr);
      } else if (adminFleetPeriodFilter === 'CUSTOM' || adminFleetDateFilter) {
        matchDate = (tDate === adminFleetDateFilter) || (tDate && tDate.startsWith(adminFleetDateFilter));
      }

      return matchStatus && matchDest && matchBoatType && matchDate;
    });
  }

  function setupAdminListeners() {
    // Reset demo data button
    const btnResetDemo = document.getElementById('btn-reset-demo-data');
    if (btnResetDemo) {
      btnResetDemo.onclick = async () => {
        const isEnReset = window.I18N && window.I18N.getLanguage() === 'en';
        if (confirm(isEnReset ? 'Are you sure you want to reset demo data to default?' : 'Adakah anda pasti mahu mengeset semula data demo kepada asal?')) {
          const originalHtml = btnResetDemo.innerHTML;
          btnResetDemo.disabled = true;
          btnResetDemo.innerHTML = `<svg class="w-4 h-4 animate-spin inline-block mr-1 text-amber-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> ${isEnReset ? 'Resetting...' : 'Mengeset semula...'}`;

          try {
            await SMCStore.resetDemoData();
            const searchInput = document.getElementById('admin-search-input');
            if (searchInput) searchInput.value = '';
            loadAdminDashboard();
            alert(isEnReset ? 'Demo data successfully reset to default!' : 'Data demo berjaya disegerakkan semula kepada asal!');
          } catch (err) {
            console.error('Reset error:', err);
            alert(isEnReset ? 'Failed to reset demo data: ' + err.message : 'Gagal mengeset semula data demo: ' + err.message);
          } finally {
            btnResetDemo.disabled = false;
            btnResetDemo.innerHTML = originalHtml;
            if (window.lucide) window.lucide.createIcons();
          }
        }
      };
    }

    // Export Master CSV button (incorporates active filters)
    const btnExportAllCsv = document.getElementById('btn-admin-export-all-csv');
    if (btnExportAllCsv) {
      btnExportAllCsv.onclick = () => {
        const allTrips = SMCStore.getTrips();
        const targetTrips = getFilteredAdminTrips(allTrips);
        if (!targetTrips || targetTrips.length === 0) {
          const isEn = window.I18N && window.I18N.getLanguage() === 'en';
          alert(isEn ? 'No trips available to export for the selected filter.' : 'Tiada trip untuk dieksport bagi tapisan yang dipilih.');
          return;
        }
        let filename = 'MCH_Master_Manifest_Fleet.csv';
        if (adminFleetDateFilter) {
          filename = `MCH_Manifes_Insiden_${adminFleetDateFilter}.csv`;
        } else if (adminFleetPeriodFilter === 'TODAY') {
          filename = `MCH_Manifes_Harian_${SMCStore.getAdminStats().todayStr}.csv`;
        } else if (adminFleetPeriodFilter === 'MONTH') {
          filename = `MCH_Manifes_Bulanan_${SMCStore.getAdminStats().currentMonthStr}.csv`;
        }
        ManifestExport.exportAllTripsCSV(targetTrips, filename);
      };
    }

    // Manual Live Sync button
    const btnManualSync = document.getElementById('btn-admin-manual-sync');
    if (btnManualSync) {
      btnManualSync.onclick = async () => {
        const icon = btnManualSync.querySelector('i');
        if (icon) icon.classList.add('animate-spin');
        await triggerInstantSync({ type: 'MANUAL_SYNC' });
        setTimeout(() => {
          if (icon) icon.classList.remove('animate-spin');
        }, 600);
      };
    }

    // Quick filter buttons in stats cards
    const btnQuickToday = document.getElementById('btn-quick-filter-today');
    if (btnQuickToday) {
      btnQuickToday.onclick = () => {
        adminFleetPeriodFilter = 'TODAY';
        adminFleetDateFilter = '';
        const customDateInput = document.getElementById('admin-fleet-custom-date');
        if (customDateInput) customDateInput.value = '';
        renderAdminFleetTable();
        const fleetCard = document.getElementById('admin-fleet-management-card');
        if (fleetCard) fleetCard.scrollIntoView({ behavior: 'smooth' });
      };
    }

    const btnQuickMonth = document.getElementById('btn-quick-filter-month');
    if (btnQuickMonth) {
      btnQuickMonth.onclick = () => {
        adminFleetPeriodFilter = 'MONTH';
        adminFleetDateFilter = '';
        const customDateInput = document.getElementById('admin-fleet-custom-date');
        if (customDateInput) customDateInput.value = '';
        renderAdminFleetTable();
        const fleetCard = document.getElementById('admin-fleet-management-card');
        if (fleetCard) fleetCard.scrollIntoView({ behavior: 'smooth' });
      };
    }

    const btnScrollIncident = document.getElementById('btn-scroll-to-incident-log');
    if (btnScrollIncident) {
      btnScrollIncident.onclick = () => {
        const incidentCard = document.getElementById('admin-incident-log-card');
        if (incidentCard) incidentCard.scrollIntoView({ behavior: 'smooth' });
      };
    }

    // Incident Log View Toggle (Daily vs Monthly)
    const btnToggleDaily = document.getElementById('btn-toggle-daily-log');
    const btnToggleMonthly = document.getElementById('btn-toggle-monthly-log');
    if (btnToggleDaily && btnToggleMonthly) {
      btnToggleDaily.onclick = () => {
        adminIncidentLogView = 'DAILY';
        btnToggleDaily.className = 'py-1 px-3 rounded-lg bg-white text-[#0d3b66] shadow-xs transition-all cursor-pointer font-bold';
        btnToggleMonthly.className = 'py-1 px-3 rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer font-semibold';
        renderAdminIncidentLog();
      };
      btnToggleMonthly.onclick = () => {
        adminIncidentLogView = 'MONTHLY';
        btnToggleMonthly.className = 'py-1 px-3 rounded-lg bg-white text-[#0d3b66] shadow-xs transition-all cursor-pointer font-bold';
        btnToggleDaily.className = 'py-1 px-3 rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer font-semibold';
        renderAdminIncidentLog();
      };
    }

    // Incident Date Quick Audit Picker
    const btnIncidentAudit = document.getElementById('btn-incident-quick-audit');
    const inputIncidentDate = document.getElementById('admin-incident-quick-date');
    if (btnIncidentAudit && inputIncidentDate) {
      btnIncidentAudit.onclick = () => {
        const d = inputIncidentDate.value;
        if (!d) {
          const isEn = window.I18N && window.I18N.getLanguage() === 'en';
          alert(isEn ? 'Please select an incident date to audit.' : 'Sila pilih tarikh insiden untuk diaudit.');
          return;
        }
        adminFleetPeriodFilter = 'CUSTOM';
        adminFleetDateFilter = d;
        const customDateInput = document.getElementById('admin-fleet-custom-date');
        if (customDateInput) customDateInput.value = d;
        renderAdminFleetTable();
        const fleetCard = document.getElementById('admin-fleet-management-card');
        if (fleetCard) fleetCard.scrollIntoView({ behavior: 'smooth' });
      };
    }

    // Status Filter Tabs
    const statusTabs = document.querySelectorAll('.admin-fleet-filter-tab');
    statusTabs.forEach(tab => {
      tab.onclick = () => {
        adminFleetStatusFilter = tab.getAttribute('data-status') || 'ALL';
        renderAdminFleetTable();
      };
    });

    // Period Filter Tabs in Fleet Table
    const periodTabs = document.querySelectorAll('.admin-fleet-period-tab');
    periodTabs.forEach(tab => {
      tab.onclick = () => {
        adminFleetPeriodFilter = tab.getAttribute('data-period') || 'ALL';
        adminFleetDateFilter = '';
        const customDateInput = document.getElementById('admin-fleet-custom-date');
        if (customDateInput) customDateInput.value = '';
        renderAdminFleetTable();
      };
    });

    // Custom Date Input in Fleet Table
    const customDateInput = document.getElementById('admin-fleet-custom-date');
    if (customDateInput) {
      customDateInput.onchange = () => {
        if (customDateInput.value) {
          adminFleetPeriodFilter = 'CUSTOM';
          adminFleetDateFilter = customDateInput.value;
        } else {
          adminFleetPeriodFilter = 'ALL';
          adminFleetDateFilter = '';
        }
        renderAdminFleetTable();
      };
    }

    // Clear Date Filter button & Emergency Banner close button
    const btnClearDate = document.getElementById('btn-admin-clear-date');
    const btnEmergencyClose = document.getElementById('btn-emergency-banner-close');
    const clearDateFilterHandler = () => {
      adminFleetPeriodFilter = 'ALL';
      adminFleetDateFilter = '';
      if (customDateInput) customDateInput.value = '';
      renderAdminFleetTable();
    };
    if (btnClearDate) btnClearDate.onclick = clearDateFilterHandler;
    if (btnEmergencyClose) btnEmergencyClose.onclick = clearDateFilterHandler;

    // Export Emergency Manifest Button (inside Emergency Banner)
    const btnExportEmergency = document.getElementById('btn-export-emergency-manifest');
    if (btnExportEmergency) {
      btnExportEmergency.onclick = () => {
        const allTrips = SMCStore.getTrips();
        const targetTrips = getFilteredAdminTrips(allTrips);
        if (!targetTrips || targetTrips.length === 0) {
          const isEn = window.I18N && window.I18N.getLanguage() === 'en';
          alert(isEn ? 'No trips to export for this period.' : 'Tiada trip untuk dieksport bagi tempoh ini.');
          return;
        }
        const stats = SMCStore.getAdminStats();
        const activeDate = adminFleetDateFilter || (adminFleetPeriodFilter === 'TODAY' ? stats.todayStr : stats.currentMonthStr);
        ManifestExport.exportAllTripsCSV(targetTrips, `SMC_Manifes_Insiden_${activeDate}.csv`);
      };
    }

    // Destination Filter Select
    const destSelect = document.getElementById('admin-fleet-dest-filter');
    if (destSelect) {
      destSelect.onchange = () => {
        adminFleetDestFilter = destSelect.value;
        renderAdminFleetTable();
      };
    }

    // Vessel Type Filter Select
    const boatTypeSelect = document.getElementById('admin-fleet-boat-type-filter');
    if (boatTypeSelect) {
      boatTypeSelect.onchange = () => {
        adminFleetBoatTypeFilter = boatTypeSelect.value;
        renderAdminFleetTable();
      };
    }

    // Central search input & Clear Button
    const searchInput = document.getElementById('admin-search-input');
    const btnClearSearch = document.getElementById('btn-clear-admin-search');

    function updateClearSearchVisibility() {
      if (!btnClearSearch) return;
      if (searchInput && searchInput.value.trim().length > 0) {
        btnClearSearch.classList.remove('hidden');
      } else {
        btnClearSearch.classList.add('hidden');
      }
    }

    if (searchInput) {
      searchInput.oninput = () => {
        updateClearSearchVisibility();
        renderAdminSearchResults(searchInput.value);
      };
      searchInput.onkeydown = (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          updateClearSearchVisibility();
          renderAdminSearchResults('');
        }
      };
    }

    if (btnClearSearch) {
      btnClearSearch.onclick = () => {
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        updateClearSearchVisibility();
        renderAdminSearchResults('');
      };
    }

    // Admin Edit Trip Form
    const formEdit = document.getElementById('form-admin-edit-trip');
    formEdit.onsubmit = async (e) => {
      e.preventDefault();
      const tripId = document.getElementById('edit-trip-id').value;
      const destination = document.getElementById('edit-destination').value.trim();
      const allowedDestinations = ['Pulau Perhentian', 'Pulau Redang'];
      if (!allowedDestinations.includes(destination)) {
        alert(window.I18N && window.I18N.getLanguage() === 'en' ? 'Invalid destination! Allowed choices: Pulau Perhentian or Pulau Redang.' : 'Destinasi tidak sah! Pilihan destinasi hanyalah: Pulau Perhentian atau Pulau Redang.');
        return;
      }

      const rawCrewList = document.getElementById('edit-crew-list').value.trim();
      if (rawCrewList) {
        const crewItems = rawCrewList.split(',').map(c => c.trim()).filter(Boolean);
        if (crewItems.length > 5) {
          alert(window.I18N && window.I18N.getLanguage() === 'en' 
            ? 'Maximum limit reached: Only a maximum of 5 assisting crew members are allowed per trip.' 
            : 'Had maksimum dicapai: Hanya maksimum 5 orang kru pembantu (awak-awak / deckhand) dibenarkan bagi setiap trip.');
          return;
        }
      }

      const updateData = {
        boatName: document.getElementById('edit-boat-name').value.trim(),
        boatRegNo: document.getElementById('edit-boat-reg').value.trim().toUpperCase(),
        destination: destination,
        maxCapacity: parseInt(document.getElementById('edit-max-capacity').value, 10) || 12,
        departureDate: document.getElementById('edit-departure-date').value,
        departureTime: document.getElementById('edit-departure-time').value,
        crewList: rawCrewList,
        status: document.getElementById('edit-trip-status').value
      };

      try {
        await SMCStore.updateTrip(tripId, updateData);
        document.getElementById('modal-admin-edit-trip').classList.add('hidden');
        loadAdminDashboard();
        alert(window.I18N && window.I18N.getLanguage() === 'en' ? 'Trip data successfully updated!' : 'Data perjalanan berjaya dikemas kini!');
      } catch (err) {
        alert(err.message);
      }
    };
  }

  function loadAdminDashboard() {
    // Stats
    const stats = SMCStore.getAdminStats();
    const isEn = window.I18N && window.I18N.getLanguage() === 'en';

    const elTripsToday = document.getElementById('admin-stat-trips-today');
    const elTripsTodaySub = document.getElementById('admin-stat-trips-today-sub');
    const elTripsMonth = document.getElementById('admin-stat-trips-month');
    const elTripsMonthSub = document.getElementById('admin-stat-trips-month-sub');

    if (elTripsToday) elTripsToday.textContent = stats.tripsToday;
    if (elTripsTodaySub) elTripsTodaySub.textContent = `${stats.paxToday} ${isEn ? 'Pax Today' : 'Penumpang Hari Ini'} • ${stats.todayStr}`;
    if (elTripsMonth) elTripsMonth.textContent = stats.tripsMonth;
    if (elTripsMonthSub) elTripsMonthSub.textContent = `${stats.paxMonth} ${isEn ? 'Pax This Month' : 'Penumpang Bulan Ini'} • ${stats.currentMonthStr}`;

    const elStatTrips = document.getElementById('admin-stat-trips');
    const elStatPax = document.getElementById('admin-stat-pax');
    const elStatComp = document.getElementById('admin-stat-compliance');
    const elStatOcc = document.getElementById('admin-stat-occupancy');

    if (elStatTrips) elStatTrips.textContent = stats.totalTrips;
    if (elStatPax) elStatPax.textContent = stats.totalPax;
    if (elStatComp) elStatComp.textContent = stats.complianceRate;
    if (elStatOcc) elStatOcc.textContent = stats.occupancyRate;

    // Render Incident & Operations Audit Log Table
    renderAdminIncidentLog(stats);

    // Fleet Table
    renderAdminFleetTable();

    // Maritime Weather Advisory
    updateWeatherAdvisoryUI();

    // Centralized Search Results (preserve active search filter)
    const searchInput = document.getElementById('admin-search-input');
    const activeSearchQuery = searchInput ? searchInput.value : '';
    renderAdminSearchResults(activeSearchQuery);

    // Fetch Live Database Status from Backend (MySQL / MariaDB check)
    (window.SMCStore && window.SMCStore.apiFetch ? window.SMCStore.apiFetch('/api/system/database-status') : fetch('/api/system/database-status'))
      .then(res => res.json())
      .then(data => {
        const banner = document.getElementById('admin-db-status-banner');
        if (!banner || !data) return;
        const isConnected = data && ((data.mysql && data.mysql.connected) || data.activeEngine);
        banner.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
            <span class="font-bold text-slate-700">${isEn ? 'Central Registry:' : 'Registri Berpusat:'}</span>
            <span class="font-semibold px-2.5 py-0.5 rounded ${isConnected ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}">
              ${isEn ? 'Maritime Operations Database' : 'Pangkalan Data Operasi Maritim'}
            </span>
          </div>
          <div class="text-slate-500 text-[11px] flex items-center gap-3">
            <span>${isEn ? 'Sync Mode:' : 'Mod Segerak:'} <strong>${isEn ? 'Live Real-Time' : 'Masa Nyata'}</strong></span>
            <span class="${isConnected ? 'text-emerald-700' : 'text-amber-700'} font-bold">
              ${isConnected ? (isEn ? '🟢 System Connected & Active' : '🟢 Sistem Bersambung & Aktif') : (isEn ? '🟡 Offline Cache Active' : '🟡 Sandaran Tempatan Aktif')}
            </span>
          </div>
        `;
      })
      .catch(() => {});

    if (window.lucide) window.lucide.createIcons();
  }

  function renderAdminIncidentLog(stats) {
    if (!stats) stats = SMCStore.getAdminStats();
    const tbody = document.getElementById('admin-incident-log-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const isEn = window.I18N && window.I18N.getLanguage() === 'en';

    if (adminIncidentLogView === 'DAILY') {
      const logs = stats.dailyLog || [];
      if (logs.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="py-6 text-center text-slate-400 font-medium">
              ${isEn ? 'No daily trip records found in database.' : 'Tiada rekod perjalanan harian dijumpai dalam pangkalan data.'}
            </td>
          </tr>
        `;
        return;
      }

      logs.forEach(day => {
        const isToday = (day.date === stats.todayStr);
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100 hover:bg-slate-50 transition-colors';
        const dateBadge = isToday
          ? `<span class="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 uppercase">${isEn ? 'Today' : 'Hari Ini'}</span>`
          : '';

        const vesselTags = day.vessels.map(v => `<span class="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px] border border-slate-200">${escapeHtml(v)}</span>`).join(' ');

        tr.innerHTML = `
          <td class="py-2.5 px-3 font-semibold text-slate-800">
            <div class="flex items-center">
              <span class="font-mono text-xs font-bold text-sky-950">${day.date}</span>
              ${dateBadge}
            </div>
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-block font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md font-mono">${day.tripsCount}</span>
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="font-black text-emerald-700 font-mono">${day.paxCount}</span>
          </td>
          <td class="py-2.5 px-3">
            <div class="flex flex-wrap gap-1 max-w-xs">
              ${vesselTags || '-'}
            </div>
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>${isEn ? 'Manifest Ready' : 'Manifes Lengkap'}</span>
            </span>
          </td>
          <td class="py-2.5 px-3 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button type="button" class="btn-audit-day-filter py-1 px-2.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold border border-sky-200 text-[11px] transition-colors cursor-pointer" data-date="${day.date}">
                ${isEn ? 'Filter Trips' : 'Semak Trip'}
              </button>
              <button type="button" class="btn-audit-day-export py-1 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 text-[11px] transition-colors flex items-center gap-1 cursor-pointer" data-date="${day.date}">
                <i data-lucide="download" class="w-3 h-3"></i>
                <span>${isEn ? 'Export Manifest' : 'Eksport Manifes'}</span>
              </button>
            </div>
          </td>
        `;

        tbody.appendChild(tr);
      });

      // Wire row actions
      tbody.querySelectorAll('.btn-audit-day-filter').forEach(btn => {
        btn.onclick = () => {
          const d = btn.getAttribute('data-date');
          adminFleetPeriodFilter = 'CUSTOM';
          adminFleetDateFilter = d;
          const customDateInput = document.getElementById('admin-fleet-custom-date');
          if (customDateInput) customDateInput.value = d;
          renderAdminFleetTable();
          const fleetCard = document.getElementById('admin-fleet-management-card');
          if (fleetCard) fleetCard.scrollIntoView({ behavior: 'smooth' });
        };
      });

      tbody.querySelectorAll('.btn-audit-day-export').forEach(btn => {
        btn.onclick = () => {
          const d = btn.getAttribute('data-date');
          const dayData = (stats.dailyLog || []).find(x => x.date === d);
          if (dayData && dayData.trips && dayData.trips.length > 0) {
            ManifestExport.exportAllTripsCSV(dayData.trips, `SMC_Manifes_Insiden_${d}.csv`);
          } else {
            alert(isEn ? 'No trips for this date.' : 'Tiada trip untuk tarikh ini.');
          }
        };
      });

    } else {
      // MONTHLY VIEW
      const logs = stats.monthlyLog || [];
      if (logs.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="py-6 text-center text-slate-400 font-medium">
              ${isEn ? 'No monthly records found.' : 'Tiada rekod bulanan dijumpai.'}
            </td>
          </tr>
        `;
        return;
      }

      logs.forEach(month => {
        const isCurrentMonth = (month.month === stats.currentMonthStr);
        const label = isEn ? month.labelEn : month.labelMs;
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100 hover:bg-slate-50 transition-colors';
        const monthBadge = isCurrentMonth
          ? `<span class="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 uppercase">${isEn ? 'Current Month' : 'Bulan Semasa'}</span>`
          : '';

        const vesselTags = month.vessels.map(v => `<span class="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px] border border-slate-200">${escapeHtml(v)}</span>`).join(' ');

        tr.innerHTML = `
          <td class="py-2.5 px-3 font-semibold text-slate-800">
            <div class="flex items-center">
              <span class="font-bold text-xs">${label}</span>
              <span class="text-[10px] font-mono text-slate-400 ml-1.5">(${month.month})</span>
              ${monthBadge}
            </div>
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-block font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md font-mono">${month.tripsCount}</span>
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="font-black text-indigo-700 font-mono">${month.paxCount}</span>
          </td>
          <td class="py-2.5 px-3">
            <div class="flex flex-wrap gap-1 max-w-xs">
              ${vesselTags || '-'}
            </div>
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>${isEn ? 'Archived & Logged' : 'Direkod & Disimpan'}</span>
            </span>
          </td>
          <td class="py-2.5 px-3 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button type="button" class="btn-audit-month-filter py-1 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold border border-indigo-200 text-[11px] transition-colors cursor-pointer" data-month="${month.month}">
                ${isEn ? 'Filter Month' : 'Tapis Bulan'}
              </button>
              <button type="button" class="btn-audit-month-export py-1 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 text-[11px] transition-colors flex items-center gap-1 cursor-pointer" data-month="${month.month}">
                <i data-lucide="download" class="w-3 h-3"></i>
                <span>${isEn ? 'Export Month CSV' : 'Eksport Log Bulanan'}</span>
              </button>
            </div>
          </td>
        `;

        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('.btn-audit-month-filter').forEach(btn => {
        btn.onclick = () => {
          const m = btn.getAttribute('data-month');
          adminFleetPeriodFilter = 'MONTH';
          adminFleetDateFilter = m;
          renderAdminFleetTable();
          const fleetCard = document.getElementById('admin-fleet-management-card');
          if (fleetCard) fleetCard.scrollIntoView({ behavior: 'smooth' });
        };
      });

      tbody.querySelectorAll('.btn-audit-month-export').forEach(btn => {
        btn.onclick = () => {
          const m = btn.getAttribute('data-month');
          const monthData = (stats.monthlyLog || []).find(x => x.month === m);
          if (monthData && monthData.trips && monthData.trips.length > 0) {
            ManifestExport.exportAllTripsCSV(monthData.trips, `SMC_Log_Bulanan_${m}.csv`);
          } else {
            alert(isEn ? 'No trips for this month.' : 'Tiada trip untuk bulan ini.');
          }
        };
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function renderAdminFleetTable() {
    const allTrips = SMCStore.getTrips();
    const tbody = document.getElementById('admin-fleet-table-body');
    tbody.innerHTML = '';
    const isEn = window.I18N && window.I18N.getLanguage() === 'en';

    // 1. Calculate and update badge counts across all trips
    const countAll = allTrips.length;
    const countOpen = allTrips.filter(t => t.status === 'OPEN').length;
    const countApproved = allTrips.filter(t => t.status === 'APPROVED').length;
    const countFull = allTrips.filter(t => t.status === 'FULL').length;
    const countCompleted = allTrips.filter(t => t.status === 'COMPLETED').length;

    const elCountAll = document.getElementById('admin-count-all');
    const elCountOpen = document.getElementById('admin-count-open');
    const elCountApproved = document.getElementById('admin-count-approved');
    const elCountFull = document.getElementById('admin-count-full');
    const elCountCompleted = document.getElementById('admin-count-completed');

    if (elCountAll) elCountAll.textContent = countAll;
    if (elCountOpen) elCountOpen.textContent = countOpen;
    if (elCountApproved) elCountApproved.textContent = countApproved;
    if (elCountFull) elCountFull.textContent = countFull;
    if (elCountCompleted) elCountCompleted.textContent = countCompleted;

    // 2. Update visual status tab styles
    const statusTabs = document.querySelectorAll('.admin-fleet-filter-tab');
    statusTabs.forEach(tab => {
      const tabStatus = tab.getAttribute('data-status');
      if (tabStatus === adminFleetStatusFilter) {
        tab.className = 'admin-fleet-filter-tab text-xs font-bold py-1.5 px-3 rounded-lg transition-all bg-[#0d3b66] text-white shadow-sm border border-[#0d3b66] cursor-pointer';
        const badge = tab.querySelector('span[id^="admin-count-"]');
        if (badge) badge.className = 'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-mono';
      } else {
        tab.className = 'admin-fleet-filter-tab text-xs font-bold py-1.5 px-3 rounded-lg transition-all bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer';
        const badge = tab.querySelector('span[id^="admin-count-"]');
        if (badge) {
          if (tabStatus === 'OPEN') badge.className = 'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-800 font-mono';
          else if (tabStatus === 'APPROVED') badge.className = 'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono';
          else if (tabStatus === 'FULL') badge.className = 'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono';
          else if (tabStatus === 'COMPLETED') badge.className = 'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-800 font-mono';
          else badge.className = 'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono';
        }
      }
    });

    // 3. Update visual period tab styles
    const periodTabs = document.querySelectorAll('.admin-fleet-period-tab');
    periodTabs.forEach(tab => {
      const p = tab.getAttribute('data-period');
      if (p === adminFleetPeriodFilter && !adminFleetDateFilter) {
        tab.className = 'admin-fleet-period-tab py-1 px-2.5 rounded-md bg-[#0d3b66] text-white font-bold transition-all cursor-pointer shadow-xs';
      } else {
        tab.className = 'admin-fleet-period-tab py-1 px-2.5 rounded-md text-slate-600 hover:bg-slate-100 transition-all cursor-pointer font-semibold';
      }
    });

    // 4. Filter trips using unified helper
    const trips = getFilteredAdminTrips(allTrips);

    // 5. Update Emergency Incident Banner & Filter Summary
    const emergencyBanner = document.getElementById('admin-fleet-emergency-banner');
    const emergencyDateBadge = document.getElementById('emergency-banner-date-badge');
    const emergencyDesc = document.getElementById('emergency-banner-desc');
    const btnClearDate = document.getElementById('btn-admin-clear-date');
    const filterSummary = document.getElementById('admin-fleet-filter-summary');

    const isFilteredByDate = (adminFleetPeriodFilter !== 'ALL' || !!adminFleetDateFilter);
    const totalFilteredPax = trips.reduce((sum, t) => sum + (t.passengers ? t.passengers.length : 0), 0);

    if (emergencyBanner) {
      if (isFilteredByDate) {
        emergencyBanner.classList.remove('hidden');
        const stats = SMCStore.getAdminStats();
        let activeLabel = adminFleetDateFilter || (adminFleetPeriodFilter === 'TODAY' ? `${isEn ? 'Today' : 'Hari Ini'} (${stats.todayStr})` : `${isEn ? 'This Month' : 'Bulan Ini'} (${stats.currentMonthStr})`);
        if (emergencyDateBadge) emergencyDateBadge.textContent = activeLabel;
        if (emergencyDesc) {
          emergencyDesc.textContent = isEn
            ? `Displaying ${trips.length} trip(s) and ${totalFilteredPax} registered passenger(s) for ${activeLabel}. Ready for immediate emergency verification and manifest retrieval.`
            : `Menunjukkan ${trips.length} trip dan ${totalFilteredPax} penumpang berdaftar untuk ${activeLabel}. Sedia untuk semakan kecemasan, siasatan APMM/JLM, dan muat turun manifes.`;
        }
        if (btnClearDate) btnClearDate.classList.remove('hidden');
      } else {
        emergencyBanner.classList.add('hidden');
        if (btnClearDate) btnClearDate.classList.add('hidden');
      }
    }

    if (filterSummary) {
      filterSummary.textContent = isEn
        ? `Showing ${trips.length} of ${allTrips.length} fleet trips`
        : `Menunjukkan ${trips.length} daripada ${allTrips.length} trip armada`;
    }

    if (trips.length === 0) {
      const emptyTr = document.createElement('tr');
      const emptyMsg = isEn ? 'No trips match the selected filter criteria.' : 'Tiada trip memenuhi kriteria tapisan yang dipilih.';
      emptyTr.innerHTML = `
        <td colspan="7" class="py-8 text-center text-slate-400 font-medium bg-slate-50/50">
          <div class="flex flex-col items-center justify-center gap-1.5">
            <span class="text-xl">🛥️</span>
            <span>${emptyMsg}</span>
          </div>
        </td>
      `;
      tbody.appendChild(emptyTr);
      return;
    }

    const txtOpen = isEn ? 'Open' : 'Buka';
    const txtEdit = isEn ? 'Edit' : 'Sunting';
    const txtPrint = isEn ? 'Print' : 'Cetak';
    const txtCancel = isEn ? 'Cancel' : 'Batal';
    const titleOpen = isEn ? 'Open Official Manifest LAMPIRAN A' : 'Buka Manifes Rasmi LAMPIRAN A';

    trips.forEach(t => {
      const paxCount = t.passengers ? t.passengers.length : 0;
      const maxCap = t.maxCapacity || 12;
      const isFull = paxCount >= maxCap;

      let statusBadge = `<span class="badge-status badge-open">${isEn ? 'OPEN' : 'DIBUKA'}</span>`;
      if (t.status === 'APPROVED') statusBadge = `<span class="badge-status badge-approved">${isEn ? 'APPROVED' : 'DILULUSKAN'}</span>`;
      else if (t.status === 'FULL') statusBadge = `<span class="badge-status badge-full">${isEn ? 'FULL' : 'PENUH'}</span>`;
      else if (t.status === 'COMPLETED') statusBadge = `<span class="badge-status badge-completed">${isEn ? 'COMPLETED' : 'SELESAI'}</span>`;

      // Vessel Type Badge
      let vesselBadge = '';
      if (maxCap <= 12) {
        vesselBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 ml-1.5" title="${isEn ? 'Mini Speedboat (12 Pax)' : 'Bot Laju Mini (12 Pax)'}">🛥️ Mini (12)</span>`;
      } else if (maxCap <= 24) {
        vesselBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 ml-1.5" title="${isEn ? 'Medium Speedboat (24 Pax)' : 'Bot Laju Sederhana (24 Pax)'}">🚤 Med (24)</span>`;
      } else {
        vesselBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 ml-1.5" title="${isEn ? `Ferry (${maxCap} Pax)` : `Feri (${maxCap} Pax)`}">⛴️ Ferry (${maxCap})</span>`;
      }

      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 hover:bg-slate-50 text-xs';
      tr.innerHTML = `
        <td class="py-3 px-3 font-mono font-bold text-sky-900">
          <div>${t.id}</div>
          <div class="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1 font-normal">
            <span>📅 ${escapeHtml(t.departureDate || '-')}</span>
            <span>•</span>
            <span>⏰ ${escapeHtml(t.departureTime || '-')}</span>
          </div>
        </td>
        <td class="py-3 px-3">
          <div class="flex items-center">
            <span class="font-bold text-slate-800">${escapeHtml(t.boatName)}</span>
            ${vesselBadge}
          </div>
          <div class="text-[10px] font-mono text-slate-400">${escapeHtml(t.boatRegNo)}</div>
        </td>
        <td class="py-3 px-3 font-semibold text-slate-700">${escapeHtml(t.destination)}</td>
        <td class="py-3 px-3 font-medium text-slate-600">${escapeHtml(t.skipperName)}</td>
        <td class="py-3 px-3">
          <span class="font-bold ${isFull ? 'text-rose-600' : 'text-slate-800'}">${paxCount} / ${maxCap}</span>
          <span class="text-[10px] text-slate-400 block">${Math.round((paxCount / maxCap) * 100)}% ${isEn ? 'load' : 'muatan'}</span>
        </td>
        <td class="py-3 px-3">${statusBadge}</td>
        <td class="py-3 px-3 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button type="button" class="btn-admin-view-manifest py-1 px-2 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 font-semibold border border-sky-200 inline-block cursor-pointer" data-trip-id="${t.id}" title="${titleOpen}">
              ${txtOpen}
            </button>
            <button class="btn-admin-edit py-1 px-2 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 cursor-pointer" data-trip-id="${t.id}">
              ${txtEdit}
            </button>
            <button class="btn-admin-print py-1 px-2 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 cursor-pointer" data-trip-id="${t.id}">
              ${txtPrint}
            </button>
            <button class="btn-admin-delete py-1 px-2 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200 cursor-pointer" data-trip-id="${t.id}">
              ${txtCancel}
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Wire Admin Fleet actions
    tbody.querySelectorAll('.btn-admin-view-manifest').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-trip-id');
        openManifestModal(id);
      };
    });

    tbody.querySelectorAll('.btn-admin-edit').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-trip-id');
        openAdminEditModal(id);
      };
    });

    tbody.querySelectorAll('.btn-admin-print').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-trip-id');
        window.open('/manifest-print.html?tripId=' + encodeURIComponent(id) + '&print=true', '_blank');
      };
    });

    tbody.querySelectorAll('.btn-admin-delete').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-trip-id');
        const isEnDelTrip = window.I18N && window.I18N.getLanguage() === 'en';
        if (confirm(isEnDelTrip ? `Cancel and delete trip operation ${id} from database?` : `Batalkan dan padam operasi trip ${id} daripada pangkalan data?`)) {
          await SMCStore.deleteTrip(id);
          loadAdminDashboard();
        }
      };
    });
  }

  function openAdminEditModal(tripId) {
    const trip = SMCStore.getTripById(tripId);
    if (!trip) return;

    document.getElementById('edit-trip-id').value = trip.id;
    document.getElementById('edit-boat-name').value = trip.boatName;
    document.getElementById('edit-boat-reg').value = trip.boatRegNo;
    document.getElementById('edit-destination').value = trip.destination;
    document.getElementById('edit-max-capacity').value = trip.maxCapacity || 12;
    document.getElementById('edit-departure-date').value = trip.departureDate;
    document.getElementById('edit-departure-time').value = trip.departureTime;
    document.getElementById('edit-crew-list').value = trip.crewList || (trip.crew ? trip.crew.map(c => c.name).join(', ') : '');
    document.getElementById('edit-trip-status').value = trip.status;

    document.getElementById('modal-admin-edit-trip').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  function renderAdminSearchResults(query) {
    const cleanQuery = (query !== undefined && query !== null) ? String(query).trim() : '';
    const results = SMCStore.searchPassengers(cleanQuery);
    const tbody = document.getElementById('admin-search-results-body');
    const countEl = document.getElementById('admin-search-count');
    const searchInput = document.getElementById('admin-search-input');
    const btnClearSearch = document.getElementById('btn-clear-admin-search');

    if (btnClearSearch && searchInput) {
      if (searchInput.value.trim().length > 0) {
        btnClearSearch.classList.remove('hidden');
      } else {
        btnClearSearch.classList.add('hidden');
      }
    }

    if (!tbody || !countEl) return;
    tbody.innerHTML = '';
    const isEnSearch = window.I18N && window.I18N.getLanguage() === 'en';

    if (!cleanQuery) {
      countEl.textContent = isEnSearch ? `Showing ${results.length} recent passenger records` : `Menunjukkan ${results.length} rekod penumpang terkini`;
    } else {
      countEl.textContent = isEnSearch ? `${results.length} records found for "${cleanQuery}"` : `${results.length} rekod dijumpai untuk "${cleanQuery}"`;
    }

    if (results.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400">${isEnSearch ? 'No passenger records matched the search.' : 'Tiada rekod penumpang sepadan dengan carian.'}</td></tr>`;
      return;
    }

    results.forEach((p, idx) => {
      let regTimeStr = '-';
      if (p.registeredAt || p.registered_at) {
        try {
          const d = new Date(p.registeredAt || p.registered_at);
          regTimeStr = !isNaN(d.getTime()) ? d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : (p.registeredAt || p.registered_at || '-');
        } catch (e) {
          regTimeStr = p.registeredAt || p.registered_at || '-';
        }
      }

      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 hover:bg-slate-50 text-xs';
      tr.innerHTML = `
        <td class="py-2.5 px-3 text-center text-slate-400 font-bold">${idx + 1}</td>
        <td class="py-2.5 px-3 font-bold text-slate-800">${escapeHtml(p.fullName || p.name || 'Penumpang')}</td>
        <td class="py-2.5 px-3 font-mono text-slate-700">${escapeHtml(p.icOrPassport || p.ic_passport || '-')}</td>
        <td class="py-2.5 px-3 text-slate-600">${escapeHtml(p.shortAddress || p.short_address || '-')}</td>
        <td class="py-2.5 px-3">
          <span class="font-semibold text-[#0d3b66]">${escapeHtml(p.boatName || '-')}</span>
          <span class="text-[10px] text-slate-400 font-mono block">${p.tripId || '-'} &bull; ${escapeHtml(p.destination || '-')}</span>
        </td>
        <td class="py-2.5 px-3 font-mono text-slate-500">${regTimeStr}</td>
        <td class="py-2.5 px-3 text-right">
          <button class="btn-admin-del-pax text-slate-400 hover:text-rose-600 p-1 transition-colors" data-trip-id="${p.tripId}" data-pax-id="${p.id}" title="${isEnSearch ? 'Delete entry' : 'Padam entri'}">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-admin-del-pax').forEach(btn => {
      btn.onclick = async () => {
        const tId = btn.getAttribute('data-trip-id');
        const pId = btn.getAttribute('data-pax-id');
        const isEnDel = window.I18N && window.I18N.getLanguage() === 'en';
        if (confirm(isEnDel ? 'Delete this passenger record from database?' : 'Padam rekod penumpang ini daripada pangkalan data?')) {
          await SMCStore.deletePassenger(tId, pId);
          const currentVal = document.getElementById('admin-search-input') ? document.getElementById('admin-search-input').value : '';
          renderAdminSearchResults(currentVal);
          loadAdminDashboard();
        }
      };
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // -------------------------------------------------------------
  // DEDICATED JABATAN LAUT MALAYSIA (JLM) ENFORCEMENT PORTAL
  // Strictly Read-Only: Manifest Viewing, Compliance Inspection, Global Passenger Search
  // -------------------------------------------------------------
  let jlmFleetSearchQuery = '';
  let jlmDateFilter = 'all'; // 'all', 'today', 'month', or 'YYYY-MM-DD'
  let jlmPaxSearchQuery = '';

  function setupJlmListeners() {
    // 1. Fleet Search Input
    const searchInput = document.getElementById('jlm-fleet-search');
    if (searchInput) {
      searchInput.oninput = () => {
        jlmFleetSearchQuery = (searchInput.value || '').trim();
        renderJlmFleetTable();
      };
    }

    // 2. Period Filter Buttons & Date Picker
    const btnAll = document.getElementById('btn-jlm-filter-all');
    const btnToday = document.getElementById('btn-jlm-filter-today');
    const btnMonth = document.getElementById('btn-jlm-filter-month');
    const inputDate = document.getElementById('jlm-filter-date');
    const btnRefresh = document.getElementById('btn-jlm-refresh');

    function updatePeriodPills(activeType) {
      if (btnAll) btnAll.className = activeType === 'all' 
        ? 'px-2.5 py-1 rounded-lg font-bold text-xs transition-colors bg-white text-[#0d3b66] shadow-2xs'
        : 'px-2.5 py-1 rounded-lg font-bold text-xs transition-colors text-slate-600 hover:text-slate-900';
      if (btnToday) btnToday.className = activeType === 'today'
        ? 'px-2.5 py-1 rounded-lg font-bold text-xs transition-colors bg-white text-[#0d3b66] shadow-2xs'
        : 'px-2.5 py-1 rounded-lg font-bold text-xs transition-colors text-slate-600 hover:text-slate-900';
      if (btnMonth) btnMonth.className = activeType === 'month'
        ? 'px-2.5 py-1 rounded-lg font-bold text-xs transition-colors bg-white text-[#0d3b66] shadow-2xs'
        : 'px-2.5 py-1 rounded-lg font-bold text-xs transition-colors text-slate-600 hover:text-slate-900';
      if (inputDate && activeType !== 'date') {
        inputDate.value = '';
      }
    }

    if (btnAll) {
      btnAll.onclick = () => {
        jlmDateFilter = 'all';
        updatePeriodPills('all');
        renderJlmFleetTable();
      };
    }
    if (btnToday) {
      btnToday.onclick = () => {
        jlmDateFilter = 'today';
        updatePeriodPills('today');
        renderJlmFleetTable();
      };
    }
    if (btnMonth) {
      btnMonth.onclick = () => {
        jlmDateFilter = 'month';
        updatePeriodPills('month');
        renderJlmFleetTable();
      };
    }
    if (inputDate) {
      inputDate.onchange = () => {
        if (inputDate.value) {
          jlmDateFilter = inputDate.value;
          updatePeriodPills('date');
          renderJlmFleetTable();
        }
      };
    }
    if (btnRefresh) {
      btnRefresh.onclick = () => {
        loadJlmDashboard();
      };
    }

    // 3. Centralized Passenger Search Input
    const paxSearchInput = document.getElementById('jlm-pax-search');
    if (paxSearchInput) {
      paxSearchInput.oninput = () => {
        jlmPaxSearchQuery = (paxSearchInput.value || '').trim();
        renderJlmPassengerSearch();
      };
    }

    // 4. Quick Emergency Export CSV for Today's Manifests
    const btnExportTodayCsv = document.getElementById('btn-jlm-export-today-csv');
    if (btnExportTodayCsv) {
      btnExportTodayCsv.onclick = () => {
        const isEn = window.I18N && window.I18N.getLanguage() === 'en';
        const trips = SMCStore.getTrips();
        const todayStr = new Date().toISOString().split('T')[0];
        const todayTrips = trips.filter(t => (t.departureDate || '').startsWith(todayStr));
        const targetTrips = todayTrips.length > 0 ? todayTrips : trips;
        const filename = isEn ? `JLM_Port_Clearance_Manifest_${todayStr}.csv` : `JLM_Manifes_Pelepasan_Pelabuhan_${todayStr}.csv`;
        if (typeof ManifestExport !== 'undefined' && typeof ManifestExport.exportAllTripsCSV === 'function') {
          ManifestExport.exportAllTripsCSV(targetTrips, filename);
        } else {
          alert(isEn ? 'CSV export module ready.' : 'Modul eksport CSV bersedia.');
        }
      };
    }

    // 5. Maritime Weather Modal button
    const btnViewWeather = document.getElementById('btn-jlm-view-weather');
    if (btnViewWeather) {
      btnViewWeather.onclick = () => {
        const modal = document.getElementById('modal-weather-advisory');
        if (modal) modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
      };
    }
  }

  function loadJlmDashboard() {
    const isEn = window.I18N && window.I18N.getLanguage() === 'en';
    const user = SMCStore.getSession();
    if (user) {
      const elName = document.getElementById('jlm-officer-name');
      const elId = document.getElementById('jlm-officer-id');
      if (elName) elName.textContent = user.fullName || (isEn ? 'JLM Enforcement Officer' : 'Pegawai Penguatkuasa JLM');
      if (elId) elId.textContent = user.staffId || user.licenseNo || 'JLM-ENF-001';
    }

    const stats = SMCStore.getAdminStats();
    const trips = SMCStore.getTrips();

    // 1. Trips Today
    const elTripsToday = document.getElementById('jlm-stat-trips-today');
    const elTripsTodaySub = document.getElementById('jlm-stat-trips-today-sub');
    if (elTripsToday) elTripsToday.textContent = stats.tripsToday || 0;
    if (elTripsTodaySub) elTripsTodaySub.textContent = isEn ? `${stats.paxToday || 0} Passengers Scheduled Today` : `${stats.paxToday || 0} Penumpang Dijadualkan Hari Ini`;

    // 2. Pax Today
    const elPaxToday = document.getElementById('jlm-stat-pax-today');
    if (elPaxToday) elPaxToday.textContent = stats.paxToday || 0;

    // 3. Compliance
    const elCompliance = document.getElementById('jlm-stat-compliance');
    if (elCompliance) elCompliance.textContent = '100%';

    // 4. Total Registered Boats
    const distinctBoats = new Set(trips.map(t => (t.boatName || '').trim()).filter(Boolean));
    const elActiveBoats = document.getElementById('jlm-stat-active-boats');
    if (elActiveBoats) elActiveBoats.textContent = distinctBoats.size || trips.length;

    // Weather Status
    updateWeatherAdvisoryUI();

    // Render Tables
    renderJlmFleetTable();
    renderJlmPassengerSearch();

    if (window.I18N) window.I18N.translateDOM(document.getElementById('view-jlm'));
    if (window.lucide) window.lucide.createIcons();
  }

  function renderJlmFleetTable() {
    const isEn = window.I18N && window.I18N.getLanguage() === 'en';
    const tbody = document.getElementById('jlm-fleet-table-body');
    if (!tbody) return;

    let trips = SMCStore.getTrips();
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.slice(0, 7);

    // Apply period filter
    if (jlmDateFilter === 'today') {
      trips = trips.filter(t => (t.departureDate || '').startsWith(todayStr));
    } else if (jlmDateFilter === 'month') {
      trips = trips.filter(t => (t.departureDate || '').startsWith(currentMonthPrefix));
    } else if (jlmDateFilter && jlmDateFilter !== 'all') {
      trips = trips.filter(t => (t.departureDate || '').startsWith(jlmDateFilter));
    }

    // Apply search query
    if (jlmFleetSearchQuery) {
      const q = jlmFleetSearchQuery.toLowerCase();
      trips = trips.filter(t => 
        (t.id || '').toLowerCase().includes(q) ||
        (t.boatName || '').toLowerCase().includes(q) ||
        (t.boatRegNo || '').toLowerCase().includes(q) ||
        (t.skipperName || '').toLowerCase().includes(q) ||
        (t.destination || '').toLowerCase().includes(q) ||
        (t.departureJetty || '').toLowerCase().includes(q)
      );
    }

    if (trips.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-8 text-slate-400 italic">
            ${isEn ? 'No trips found matching the inspection filter.' : 'Tiada trip ditemui yang sepadan dengan tapisan pemeriksaan.'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = trips.map((t, idx) => {
      const paxList = t.passengers || [];
      const paxCount = paxList.length;
      const maxCap = t.maxCapacity || t.boatCapacity || 12;
      const pct = Math.min(100, Math.round((paxCount / maxCap) * 100));
      const isOver = paxCount > maxCap;
      const isFull = paxCount >= maxCap;

      const isApproved = t.status === 'APPROVED' || t.status === 'APPROVED_DEPARTED' || t.status === 'COMPLETED';
      let statusBadge = '';
      if (isApproved) {
        statusBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>${isEn ? 'DEPARTED' : 'BERLEPAS'}</span>`;
      } else if (isFull) {
        statusBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>${isEn ? 'FULL' : 'PENUH'}</span>`;
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 flex items-center justify-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>${isEn ? 'OPEN' : 'DIBUKA'}</span>`;
      }

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-3 px-3 text-center font-mono text-slate-400">${idx + 1}</td>
          <td class="py-3 px-3">
            <span class="font-mono font-bold text-[#0d3b66] text-xs block">${escapeHtml(t.id)}</span>
            <span class="text-[11px] text-slate-500 block">${escapeHtml(t.departureDate || '-')} &bull; ${escapeHtml(t.departureTime || '-')}</span>
          </td>
          <td class="py-3 px-3">
            <div class="font-bold text-slate-800 text-xs">${escapeHtml(t.boatName || (isEn ? 'Tourist Boat' : 'Bot Pelancong'))}</div>
            <div class="text-[10px] font-mono text-slate-500">${escapeHtml(t.boatRegNo || '-')}</div>
          </td>
          <td class="py-3 px-3">
            <div class="font-semibold text-slate-800 text-xs">${escapeHtml(t.skipperName || t.ownerFullName || (isEn ? 'Licensed Master' : 'Nakhoda Berlesen'))}</div>
            <div class="text-[10px] font-mono text-slate-400">${escapeHtml(t.skipperLicense || t.ownerLicense || (isEn ? 'VERIFIED SID' : 'SID DISAHKAN'))}</div>
          </td>
          <td class="py-3 px-3">
            <div class="font-bold text-sky-800 text-xs">${escapeHtml(t.destination || '-')}</div>
            <div class="text-[10px] text-slate-400 truncate max-w-[130px]" title="${escapeHtml(t.departureJetty || '')}">${escapeHtml(t.departureJetty || (isEn ? 'Jetty' : 'Jeti'))}</div>
          </td>
          <td class="py-3 px-3">
            <div class="flex items-center justify-between text-[11px] font-bold ${isOver ? 'text-rose-600' : 'text-slate-700'} mb-1">
              <span>${paxCount} / ${maxCap} ${isEn ? 'Persons' : 'Orang'}</span>
              <span class="text-[10px] font-normal text-slate-400">${pct}%</span>
            </div>
            <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div class="h-full ${isOver ? 'bg-rose-500' : (isFull ? 'bg-amber-500' : 'bg-emerald-500')} rounded-full" style="width: ${pct}%;"></div>
            </div>
          </td>
          <td class="py-3 px-3 text-center">
            ${statusBadge}
          </td>
          <td class="py-3 px-3 text-right">
            <div class="inline-flex items-center gap-1.5">
              <button type="button" class="btn-jlm-view-manifest py-1.5 px-2.5 rounded-lg bg-[#0d3b66] hover:bg-[#072340] text-white font-bold text-xs flex items-center gap-1 transition-colors shadow-2xs cursor-pointer" data-trip-id="${escapeHtml(t.id)}" title="${isEn ? 'Open Official Statutory Manifest (LAMPIRAN A)' : 'Buka Manifes Rasmi (LAMPIRAN A)'}">
                <i data-lucide="file-text" class="w-3.5 h-3.5 text-amber-300"></i>
                <span>${isEn ? 'Manifest' : 'Manifes'}</span>
              </button>
              <button type="button" class="btn-jlm-print-manifest p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer" data-trip-id="${escapeHtml(t.id)}" title="${isEn ? 'Print Manifest Document' : 'Cetak Dokumen Manifes'}">
                <i data-lucide="printer" class="w-3.5 h-3.5 text-slate-600"></i>
              </button>
              <button type="button" class="btn-jlm-export-csv p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer" data-trip-id="${escapeHtml(t.id)}" title="${isEn ? 'Export Manifest to CSV' : 'Muat Turun Manifes (CSV)'}">
                <i data-lucide="download" class="w-3.5 h-3.5 text-sky-700"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach read-only action event handlers
    tbody.querySelectorAll('.btn-jlm-view-manifest').forEach(btn => {
      btn.onclick = () => {
        const tId = btn.getAttribute('data-trip-id');
        openManifestModal(tId);
      };
    });

    tbody.querySelectorAll('.btn-jlm-print-manifest').forEach(btn => {
      btn.onclick = () => {
        const tId = btn.getAttribute('data-trip-id');
        printManifestDirect(tId);
      };
    });

    tbody.querySelectorAll('.btn-jlm-export-csv').forEach(btn => {
      btn.onclick = () => {
        const tId = btn.getAttribute('data-trip-id');
        const trip = SMCStore.getTripById(tId);
        if (trip && typeof ManifestExport !== 'undefined') {
          ManifestExport.exportCSV({ trip, ...trip });
        }
      };
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function renderJlmPassengerSearch() {
    const isEn = window.I18N && window.I18N.getLanguage() === 'en';
    const tbody = document.getElementById('jlm-pax-table-body');
    const badge = document.getElementById('jlm-pax-count-badge');
    if (!tbody) return;

    const trips = SMCStore.getTrips();
    const query = (jlmPaxSearchQuery || '').toLowerCase().trim();

    // Flatten all passengers with trip info
    const allPax = [];
    trips.forEach(t => {
      (t.passengers || []).forEach(p => {
        allPax.push({
          ...p,
          tripId: t.id,
          boatName: t.boatName,
          boatRegNo: t.boatRegNo,
          departureDate: t.departureDate,
          departureTime: t.departureTime,
          destination: t.destination
        });
      });
    });

    let filteredPax = [];
    if (query) {
      filteredPax = allPax.filter(p => 
        (p.fullName || '').toLowerCase().includes(query) ||
        (p.icOrPassport || '').toLowerCase().includes(query) ||
        (p.phone || '').toLowerCase().includes(query) ||
        (p.shortAddress || '').toLowerCase().includes(query) ||
        (p.boatName || '').toLowerCase().includes(query) ||
        (p.tripId || '').toLowerCase().includes(query)
      );
    } else {
      // Default: show the first 15 passengers
      filteredPax = allPax.slice(0, 15);
    }

    if (badge) {
      badge.textContent = isEn ? `${filteredPax.length} Passengers Found` : `${filteredPax.length} Penumpang Dijumpai`;
    }

    if (filteredPax.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-6 text-slate-400 italic text-xs">
            ${isEn ? 'No passenger records matching your search.' : 'Tiada rekod penumpang sepadan dengan carian anda.'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredPax.map((p, idx) => {
      const dateStr = p.departureDate || '-';
      const timeStr = p.departureTime || '-';
      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-2.5 px-3 text-center font-mono text-slate-400 text-xs">${idx + 1}</td>
          <td class="py-2.5 px-3">
            <span class="font-bold text-slate-800 text-xs block">${escapeHtml(p.fullName || '-')}</span>
            <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(p.id || '-')}</span>
          </td>
          <td class="py-2.5 px-3 font-mono text-xs font-semibold text-slate-700">
            ${escapeHtml(p.icOrPassport || '-')}
          </td>
          <td class="py-2.5 px-3 text-xs text-slate-600 truncate max-w-[130px]" title="${escapeHtml(p.shortAddress || '')}">
            ${escapeHtml(p.shortAddress || '-')}
          </td>
          <td class="py-2.5 px-3 font-mono text-xs text-slate-700">
            ${escapeHtml(p.phone || '-')}
          </td>
          <td class="py-2.5 px-3">
            <span class="font-bold text-[#0d3b66] text-xs block">${escapeHtml(p.boatName || '-')}</span>
            <span class="text-[10px] font-mono text-sky-700 block">${escapeHtml(p.tripId || '-')} &bull; ${escapeHtml(p.destination || '-')}</span>
          </td>
          <td class="py-2.5 px-3 text-xs text-slate-600">
            ${escapeHtml(dateStr)}<br><span class="text-[10px] text-slate-400">${escapeHtml(timeStr)}</span>
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i>
              <span>${isEn ? 'Verified' : 'Disahkan'}</span>
            </span>
          </td>
          <td class="py-2.5 px-3 text-right">
            <button type="button" class="btn-jlm-pax-manifest py-1 px-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs border border-sky-200 transition-colors inline-flex items-center gap-1 cursor-pointer" data-trip-id="${escapeHtml(p.tripId)}">
              <i data-lucide="file-text" class="w-3 h-3 text-sky-600"></i>
              <span>${isEn ? 'Manifest' : 'Manifes'}</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-jlm-pax-manifest').forEach(btn => {
      btn.onclick = () => {
        const tId = btn.getAttribute('data-trip-id');
        if (tId) openManifestModal(tId);
      };
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // -------------------------------------------------------------
  // PUBLIC PASSENGER FORM & QR SCAN
  // -------------------------------------------------------------
  let currentPassengerTripId = null;

  function setupPassengerListeners() {
    const form = document.getElementById('form-passenger-register');
    const btnSubmit = document.getElementById('btn-pax-submit');
    const btnRegisterAnother = document.getElementById('btn-register-another');

    // Auto-calculate age and format MyKad / Passport
    const paxIc = document.getElementById('pax-input-ic');
    const paxAge = document.getElementById('pax-input-age');
    const paxBadge = document.getElementById('pax-input-id-badge');
    if (paxIc) {
      paxIc.addEventListener('input', () => {
        let raw = paxIc.value.toUpperCase();
        const isEn = window.I18N && window.I18N.getLanguage() === 'en';

        const hasLetters = /[A-Z]/.test(raw);
        if (hasLetters) {
          if (paxBadge) {
            paxBadge.textContent = isEn ? 'Passport' : 'Pasport';
            paxBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 uppercase';
          }
          return;
        }

        let digits = raw.replace(/\D/g, '').slice(0, 12);
        if (paxBadge) {
          if (digits.length >= 6) {
            paxBadge.textContent = 'MyKad';
            paxBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800 uppercase';
          } else {
            paxBadge.textContent = isEn ? 'MyKad / Passport' : 'MyKad / Pasport';
            paxBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase';
          }
        }

        let formatted = '';
        if (digits.length <= 6) {
          formatted = digits;
        } else if (digits.length <= 8) {
          formatted = `${digits.slice(0, 6)}-${digits.slice(6)}`;
        } else {
          formatted = `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 12)}`;
        }

        paxIc.value = formatted;

        if (digits.length >= 6 && paxAge) {
          const yy = parseInt(digits.substring(0, 2), 10);
          const currentYear = new Date().getFullYear();
          const currentYY = currentYear % 100;
          let birthYear = (yy <= currentYY) ? (2000 + yy) : (1900 + yy);
          let diff = currentYear - birthYear;
          if (diff >= 0 && diff <= 120) {
            paxAge.value = diff;
          }
        }
      });
    }

    // Enforce numeric-only input for mobile / emergency phone number
    const paxPhone = document.getElementById('pax-input-phone');
    if (paxPhone) {
      paxPhone.setAttribute('inputmode', 'numeric');
      paxPhone.setAttribute('pattern', '[0-9]*');
      paxPhone.addEventListener('input', () => {
        paxPhone.value = paxPhone.value.replace(/\D/g, '');
      });
      paxPhone.addEventListener('keypress', (e) => {
        if (!/[0-9]/.test(e.key) && e.key !== 'Enter') {
          e.preventDefault();
        }
      });
      paxPhone.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const digits = text.replace(/\D/g, '');
        paxPhone.value = digits;
      });
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!currentPassengerTripId) return;

      const fullName = document.getElementById('pax-input-name').value;
      const icOrPassport = document.getElementById('pax-input-ic').value;
      const age = document.getElementById('pax-input-age') ? document.getElementById('pax-input-age').value : '';
      const shortAddress = document.getElementById('pax-input-address').value;
      
      const countryCodeSelect = document.getElementById('pax-input-country-code');
      const countryCode = countryCodeSelect ? countryCodeSelect.value : '+60';
      let rawPhone = document.getElementById('pax-input-phone').value.trim();
      rawPhone = rawPhone.replace(/\D/g, '');
      let fullPhone = rawPhone;
      if (countryCode !== 'other' && !rawPhone.startsWith('+')) {
        const cleanDigits = rawPhone.replace(/^0+/, '');
        fullPhone = `${countryCode}${cleanDigits}`;
      }

      const lifejacket = form.querySelector('input[name="lifejacket"]').checked;

      const isEnPax = window.I18N && window.I18N.getLanguage() === 'en';
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span class="inline-flex items-center gap-2">${isEnPax ? 'Submitting Registration...' : 'Menghantar Pendaftaran...'}</span>`;

      try {
        const result = await SMCStore.addPassenger(currentPassengerTripId, {
          fullName,
          icOrPassport,
          age,
          shortAddress,
          phone: fullPhone,
          lifejacket
        });

        // Persist ticket in localStorage so in-app passenger simulation also persists on refresh
        try {
          localStorage.setItem('e_penumpang_inapp_ticket_' + currentPassengerTripId, JSON.stringify({ passenger: result.passenger, trip: result.trip }));
        } catch (e) {}

        // Show Ticket
        showPassengerTicket(result.passenger, result.trip);
      } catch (err) {
        alert(err.message);
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i data-lucide="send" class="w-5 h-5 text-amber-400"></i><span>${isEnPax ? '4. Submit Registration (Send)' : '4. Hantar Pendaftaran (Hantar)'}</span>`;
        if (window.lucide) window.lucide.createIcons();
        loadPassengerForm(currentPassengerTripId);
      }
    };

    btnRegisterAnother.onclick = () => {
      try {
        localStorage.removeItem('e_penumpang_inapp_ticket_' + currentPassengerTripId);
      } catch (e) {}
      document.getElementById('form-passenger-register').reset();
      document.getElementById('passenger-form-container').classList.remove('hidden');
      document.getElementById('passenger-ticket-container').classList.add('hidden');
      loadPassengerForm(currentPassengerTripId);
    };

    const btnSaveTicket = document.getElementById('btn-pax-save-ticket');
    if (btnSaveTicket) {
      btnSaveTicket.onclick = () => {
        const trip = SMCStore.getTripById(currentPassengerTripId);
        const pName = document.getElementById('ticket-pax-name').textContent || 'Penumpang';
        const pIc = document.getElementById('ticket-pax-id').textContent || '-';
        const bName = trip ? trip.boatName : (document.getElementById('ticket-boat-name').textContent || 'Bot');
        const bReg = trip ? trip.boatRegNo : '';
        const origin = trip ? (trip.departureJetty || 'Jeti') : 'Jeti';
        const destination = trip ? trip.destination : (document.getElementById('ticket-destination').textContent || 'Destinasi');
        const isEn = window.I18N && window.I18N.getLanguage() === 'en';
        
        let seatNum = 1;
        if (trip && trip.passengers) {
          const sIdx = trip.passengers.findIndex(p => p.icOrPassport === pIc || p.fullName === pName);
          seatNum = sIdx >= 0 ? sIdx + 1 : trip.passengers.length;
        }

        if (window.QRUtils && window.QRUtils.downloadBoardingPassPNG) {
          window.QRUtils.downloadBoardingPassPNG({
            passengerName: pName,
            icOrPassport: pIc,
            boatName: bName,
            boatRegNo: bReg,
            origin,
            destination,
            seatNumber: seatNum,
            boatCapacity: trip ? trip.maxCapacity : 12,
            tripId: currentPassengerTripId,
            isEn
          }, `Pas_Pelepasan_${currentPassengerTripId}_${pName.replace(/[^a-zA-Z0-9]/g, '_')}.png`);
        }
      };
    }

    const btnFinishLogin = document.getElementById('btn-pax-finish-login');
    if (btnFinishLogin) {
      btnFinishLogin.onclick = () => {
        try {
          localStorage.removeItem('e_penumpang_inapp_ticket_' + currentPassengerTripId);
        } catch (e) {}
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        resetAuthForms();
        showView('landing');
      };
    }
  }

  async function loadPassengerForm(tripId) {
    currentPassengerTripId = tripId || (SMCStore.getTrips()[0] ? SMCStore.getTrips()[0].id : null);
    if (!currentPassengerTripId) return;

    // Reset Containers immediately
    const formCont = document.getElementById('passenger-form-container');
    const ticketCont = document.getElementById('passenger-ticket-container');
    if (formCont) formCont.classList.remove('hidden');
    if (ticketCont) ticketCont.classList.add('hidden');

    let trip = SMCStore.getTripById(currentPassengerTripId);
    if (!trip && SMCStore.getTripByIdAsync) {
      trip = await SMCStore.getTripByIdAsync(currentPassengerTripId);
    }
    if (!trip) {
      const isEn = window.I18N && window.I18N.getLanguage() === 'en';
      const boatElem = document.getElementById('pax-view-boat');
      if (boatElem) boatElem.textContent = currentPassengerTripId;
      const alertBox = document.getElementById('pax-capacity-alert-box');
      if (alertBox) {
        alertBox.innerHTML = `
          <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <strong>${isEn ? 'Connecting to Trip Database...' : 'Menyambung ke Rekod Trip...'}</strong><br>
            ${isEn ? 'Trip ID: ' : 'ID Trip: '}<strong>${currentPassengerTripId}</strong>. ${isEn ? 'Please pull down to refresh if details do not appear.' : 'Sila muat semula laman jika butiran bot tidak dipaparkan.'}
          </div>
        `;
      }
      return;
    }

    // Check if in-app passenger simulation has a saved ticket for this trip
    try {
      const savedTicketRaw = localStorage.getItem('e_penumpang_inapp_ticket_' + currentPassengerTripId);
      if (savedTicketRaw) {
        const saved = JSON.parse(savedTicketRaw);
        if (saved && saved.passenger && saved.trip) {
          showPassengerTicket(saved.passenger, saved.trip);
          return;
        }
      }
    } catch (e) {}

    // Reset Containers
    document.getElementById('passenger-form-container').classList.remove('hidden');
    document.getElementById('passenger-ticket-container').classList.add('hidden');

    document.getElementById('pax-view-boat').textContent = trip.boatName;
    document.getElementById('pax-view-destination').textContent = trip.destination;
    document.getElementById('pax-view-time').textContent = `${trip.departureDate} • ${trip.departureTime}`;
    document.getElementById('pax-view-skipper').textContent = trip.skipperName;

    // Capacity Control (Step 5)
    const paxCount = trip.passengers.length;
    const maxCapacity = trip.maxCapacity || 12;
    const isFull = paxCount >= maxCapacity;
    const remaining = Math.max(0, maxCapacity - paxCount);

    const remainingBadge = document.getElementById('pax-view-remaining-badge');
    const alertBox = document.getElementById('pax-capacity-alert-box');
    const submitBtn = document.getElementById('btn-pax-submit');
    const formInputs = document.querySelectorAll('#form-passenger-register input');

    const isEn = window.I18N && window.I18N.getLanguage() === 'en';

    if (trip.status === 'APPROVED' || trip.status === 'COMPLETED') {
      remainingBadge.className = 'badge-status badge-approved';
      remainingBadge.textContent = isEn ? 'Boat Departed' : 'Bot Telah Berlepas';
      alertBox.innerHTML = `
        <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <strong>${isEn ? 'Registration Closed:' : 'Pendaftaran Ditutup:'}</strong> ${isEn ? 'Boat has departed or trip has finished.' : 'Bot telah berlepas atau trip telah tamat.'}
        </div>
      `;
      formInputs.forEach(i => i.disabled = true);
      submitBtn.disabled = true;
      submitBtn.textContent = isEn ? 'Registration Closed' : 'Pendaftaran Ditutup';
      return;
    }

    if (isFull) {
      remainingBadge.className = 'badge-status badge-full';
      remainingBadge.textContent = isEn ? 'Capacity Full' : 'Kapasiti Penuh';
      alertBox.innerHTML = `
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
          <div class="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold flex-shrink-0">
            &#10060;
          </div>
          <div>
            <strong class="text-sm block">${isEn ? `BOAT CAPACITY FULL (${maxCapacity}/${maxCapacity})` : `KAPASITI BOT PENUH (${maxCapacity}/${maxCapacity})`}</strong>
            <p class="text-rose-700 mt-0.5">
              ${isEn 
                ? `Sorry, the maximum passenger safety limit (${maxCapacity} persons) for this vessel has been reached. No further registrations allowed.` 
                : `Maaf, had muatan keselamatan maksimum (${maxCapacity} orang) bagi bot ini telah dicapai. Pendaftaran tambahan tidak lagi dibenarkan.`}
            </p>
          </div>
        </div>
      `;
      formInputs.forEach(i => i.disabled = true);
      submitBtn.disabled = true;
      submitBtn.className = 'w-full py-3.5 rounded-xl font-bold bg-slate-300 text-slate-500 cursor-not-allowed';
      submitBtn.textContent = isEn ? 'Boat Capacity Full' : 'Kapasiti Bot Telah Penuh';
    } else {
      remainingBadge.className = 'badge-status badge-open';
      remainingBadge.textContent = isEn ? `${remaining} Available` : `${remaining} Kekosongan`;
      alertBox.innerHTML = `
        <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-3">
          <div class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0">
            &#10004;
          </div>
          <div>
            <strong class="block">${isEn ? `Seats Available (${paxCount}/${maxCapacity} Passengers)` : `Kapasiti Masih Ada (${paxCount}/${maxCapacity} Penumpang)`}</strong>
            <span class="text-emerald-700 text-[11px]">${isEn ? `There are ${remaining} seats remaining for this trip.` : `Terdapat ${remaining} tempat duduk kosong lagi untuk pendaftaran trip ini.`}</span>
          </div>
        </div>
      `;
      formInputs.forEach(i => i.disabled = false);
      submitBtn.disabled = false;
      submitBtn.className = 'w-full py-3.5 rounded-xl font-bold bg-[#0d3b66] hover:bg-[#072340] text-white shadow-lg shadow-blue-950/20 hover:shadow-xl transition-all flex items-center justify-center gap-2';
      submitBtn.innerHTML = `<i data-lucide="send" class="w-5 h-5 text-amber-400"></i><span>${isEn ? '4. Submit Registration' : '4. Hantar Pendaftaran (Hantar)'}</span>`;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function showPassengerTicket(pax, trip) {
    document.getElementById('passenger-form-container').classList.add('hidden');
    const ticketContainer = document.getElementById('passenger-ticket-container');
    ticketContainer.classList.remove('hidden');

    document.getElementById('ticket-pax-name').textContent = pax.fullName || pax.name || '-';
    document.getElementById('ticket-pax-id').textContent = pax.icOrPassport || pax.ic_passport || pax.icPassport || '-';
    document.getElementById('ticket-pax-address').textContent = pax.shortAddress || pax.short_address || pax.address || '-';
    document.getElementById('ticket-pax-ref').textContent = pax.id || pax.ticket_no || pax.ticketNo || '-';

    document.getElementById('ticket-boat-name').textContent = trip.boatName;
    document.getElementById('ticket-destination').textContent = trip.destination;
    document.getElementById('ticket-jetty').textContent = trip.departureJetty || 'Jeti Berlepas';
    document.getElementById('ticket-datetime').textContent = `${trip.departureDate} • ${trip.departureTime}`;
    document.getElementById('ticket-registered-at').textContent = new Date(pax.registeredAt).toLocaleTimeString();

    // Generate small QR on Ticket
    const ticketCanvas = document.getElementById('ticket-qr-canvas');
    if (ticketCanvas) {
      QRUtils.renderToCanvas(ticketCanvas, `PAX:${pax.id}|${trip.id}`, { size: 64, padding: 2 });
    }

    if (window.lucide) window.lucide.createIcons();
    ticketContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // -------------------------------------------------------------
  // DYNAMIC CREW TABLE (SENARAI KRU PEMBANTU)
  // -------------------------------------------------------------
  function updateCrewIndexes() {
    const tbody = document.getElementById('crew-table-body');
    const hint = document.getElementById('crew-empty-hint');
    const badge = document.getElementById('crew-count-badge');
    const btnAdd = document.getElementById('btn-add-crew-row');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr.crew-row');
    rows.forEach((row, idx) => {
      const idxSpan = row.querySelector('.crew-bil-badge');
      if (idxSpan) idxSpan.textContent = idx + 1;
    });

    const count = rows.length;
    if (badge) {
      badge.textContent = `${count} / 5`;
      if (count >= 5) {
        badge.className = 'ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300';
      } else {
        badge.className = 'ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#0077b6] border border-blue-200';
      }
    }

    if (btnAdd) {
      if (count >= 5) {
        btnAdd.classList.add('opacity-50', 'cursor-not-allowed');
        btnAdd.setAttribute('title', window.I18N && window.I18N.t ? window.I18N.t('modal_crew_limit_reached') : 'Maksimum 5 orang kru dicapai');
      } else {
        btnAdd.classList.remove('opacity-50', 'cursor-not-allowed');
        btnAdd.removeAttribute('title');
      }
    }

    if (hint) {
      if (rows.length === 0) {
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
    }
  }

  function addCrewRow(name = '', ic = '', role = 'Awak-awak / Deckhand') {
    const tbody = document.getElementById('crew-table-body');
    if (!tbody) return;

    const currentRows = tbody.querySelectorAll('tr.crew-row');
    if (currentRows.length >= 5) {
      const isEn = window.I18N && window.I18N.getLanguage() === 'en';
      const msg = (window.I18N && window.I18N.t) ? window.I18N.t('modal_crew_limit_reached') : (
        isEn 
          ? 'Maximum limit reached: Only a maximum of 5 assisting crew members are allowed per trip.'
          : 'Had maksimum dicapai: Hanya maksimum 5 orang kru pembantu (awak-awak / deckhand) dibenarkan bagi setiap trip.'
      );
      alert(msg);
      return;
    }

    const tr = document.createElement('tr');
    tr.className = 'crew-row hover:bg-slate-50 transition-colors';
    tr.innerHTML = `
      <td class="py-2 px-2.5 text-center font-bold text-slate-500">
        <span class="crew-bil-badge inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[#0d3b66] text-[10px] font-bold border border-slate-200">1</span>
      </td>
      <td class="py-2 px-2.5">
        <input type="text" class="crew-name-input w-full p-2 rounded-lg border border-slate-300 font-medium text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none" placeholder="cth: Faizal b. Azman" value="${escapeHtml(name)}" required>
      </td>
      <td class="py-2 px-2.5">
        <input type="text" class="crew-ic-input w-full p-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none" placeholder="cth: 950410-11-6677" value="${escapeHtml(ic !== '-' ? ic : '')}">
      </td>
      <td class="py-2 px-2.5">
        <select class="crew-role-select w-full p-2 rounded-lg border border-slate-300 font-semibold text-slate-800 bg-white text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none">
          <option value="Awak-awak / Deckhand" ${role === 'Awak-awak / Deckhand' ? 'selected' : ''}>Awak-awak / Deckhand</option>
          <option value="Kru Keselamatan" ${role === 'Kru Keselamatan' ? 'selected' : ''}>Kru Keselamatan</option>
          <option value="Dekman" ${role === 'Dekman' ? 'selected' : ''}>Dekman</option>
          <option value="Kru Pembantu" ${role === 'Kru Pembantu' ? 'selected' : ''}>Kru Pembantu</option>
          <option value="Jurutera Bot / Mekanik" ${role === 'Jurutera Bot / Mekanik' ? 'selected' : ''}>Jurutera Bot / Mekanik</option>
        </select>
      </td>
      <td class="py-2 px-2 text-center">
        <button type="button" class="btn-remove-crew p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Padam baris kru ini">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    `;

    const btnRemove = tr.querySelector('.btn-remove-crew');
    btnRemove.onclick = () => {
      tr.remove();
      updateCrewIndexes();
    };

    tbody.appendChild(tr);
    updateCrewIndexes();
    if (window.lucide) window.lucide.createIcons();
  }

  function initCrewTable(defaultCrew = null) {
    const tbody = document.getElementById('crew-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (Array.isArray(defaultCrew) && defaultCrew.length > 0) {
      defaultCrew.slice(0, 5).forEach(c => addCrewRow(c.name || '', c.ic_passport || '', c.role || 'Awak-awak / Deckhand'));
    } else {
      // Sediakan 1 baris kosong awal untuk memudahkan tekong mengisi maklumat kru
      addCrewRow('', '', 'Awak-awak / Deckhand');
    }
    updateCrewIndexes();
  }

  function harvestCrewTable() {
    const tbody = document.getElementById('crew-table-body');
    if (!tbody) return { crew: [], crewList: '' };
    const rows = tbody.querySelectorAll('tr.crew-row');
    const crew = [];
    rows.forEach(row => {
      const nameInput = row.querySelector('.crew-name-input');
      const icInput = row.querySelector('.crew-ic-input');
      const roleSelect = row.querySelector('.crew-role-select');
      const name = nameInput ? nameInput.value.trim() : '';
      const ic = icInput ? icInput.value.trim() : '';
      const role = roleSelect ? roleSelect.value : 'Awak-awak / Deckhand';
      if (name) {
        crew.push({
          name: name,
          ic_passport: ic || '-',
          role: role
        });
      }
    });

    if (crew.length > 5) {
      const isEn = window.I18N && window.I18N.getLanguage() === 'en';
      const msg = (window.I18N && window.I18N.t) ? window.I18N.t('modal_crew_limit_reached') : (
        isEn 
          ? 'Maximum limit reached: Only a maximum of 5 assisting crew members are allowed per trip.'
          : 'Had maksimum dicapai: Hanya maksimum 5 orang kru pembantu (awak-awak / deckhand) dibenarkan bagi setiap trip.'
      );
      alert(msg);
      crew.splice(5);
    }

    const crewList = crew.map(c => `${c.name} (${c.role})`).join(', ');
    return { crew, crewList };
  }

  // -------------------------------------------------------------
  // MODALS HANDLING (CREATE TRIP & QR CODE)
  // -------------------------------------------------------------
  function setupModalListeners() {
    // Open Create Trip Modal
    document.getElementById('btn-open-create-trip').onclick = () => {
      const user = SMCStore.getSession();
      if (user) {
        document.getElementById('create-boat-name').value = user.boatName || 'Bayu Mutiara 09';
        document.getElementById('create-boat-reg').value = user.boatRegNo || 'TR-9921-A';
        document.getElementById('create-skipper-name').value = user.fullName || 'Rosli bin Ahmad';
        
        const skipperIcInput = document.getElementById('create-skipper-ic');
        if (skipperIcInput) {
          // Isi nombor kad pengenalan / pasport tekong mengikut akaun berdaftar
          skipperIcInput.value = user.ic_passport || ((user.icOrPassport && !user.icOrPassport.startsWith('SID')) ? user.icOrPassport : (user.ic || '780312-11-5421'));
        }
        
        // Kapasiti maksimum dikunci mengikut jenis & lesen bot berdaftar tekong
        const capInput = document.getElementById('create-max-capacity');
        if (capInput) {
          const cap = user.boatCapacity || user.defaultCapacity || user.regBoatCapacity || 12;
          capInput.value = cap;
          capInput.readOnly = true;
          const capNote = document.querySelector('[data-i18n="modal_create_capacity_note"]');
          if (capNote) {
            const isEn = window.I18N && window.I18N.getLanguage() === 'en';
            capNote.textContent = isEn 
              ? `* Locked to ${cap} passengers (${user.boat_type ? user.boat_type.replace('_', ' ') : 'registered capacity'}).`
              : `* Dikunci pada ${cap} orang (${user.boat_type ? user.boat_type.replace('_', ' ') : 'kapasiti lesen bot berdaftar'}).`;
          }
        }
      }

      // Always set departure date to the latest current date (YYYY-MM-DD)
      const depDateInput = document.getElementById('create-departure-date');
      if (depDateInput) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        depDateInput.value = todayStr;
        depDateInput.min = todayStr;
      }

      initCrewTable();
      document.getElementById('modal-create-trip').classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
    };

    // Set initial date on load
    const initialDepDate = document.getElementById('create-departure-date');
    if (initialDepDate && !initialDepDate.value) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      initialDepDate.value = todayStr;
      initialDepDate.min = todayStr;
    }

    document.getElementById('btn-close-create-trip').onclick = () => {
      document.getElementById('modal-create-trip').classList.add('hidden');
    };

    // Butang Tambah Baris Kru Baharu
    const btnAddCrewRow = document.getElementById('btn-add-crew-row');
    if (btnAddCrewRow) {
      btnAddCrewRow.onclick = () => {
        const tbody = document.getElementById('crew-table-body');
        const rows = tbody ? tbody.querySelectorAll('tr.crew-row') : [];
        if (rows.length >= 5) {
          const isEn = window.I18N && window.I18N.getLanguage() === 'en';
          const msg = (window.I18N && window.I18N.t) ? window.I18N.t('modal_crew_limit_reached') : (
            isEn 
              ? 'Maximum limit reached: Only a maximum of 5 assisting crew members are allowed per trip.'
              : 'Had maksimum dicapai: Hanya maksimum 5 orang kru pembantu (awak-awak / deckhand) dibenarkan bagi setiap trip.'
          );
          alert(msg);
          return;
        }
        addCrewRow('', '', 'Awak-awak / Deckhand');
      };
    }

    // Form Create Trip Submit
    const formCreateTrip = document.getElementById('form-create-trip');
    formCreateTrip.onsubmit = async (e) => {
      e.preventDefault();
      const user = SMCStore.getSession();
      const formData = new FormData(formCreateTrip);
      const boatName = (formData.get('boatName') || '').trim();
      const boatRegNo = (formData.get('boatRegNo') || '').trim();
      const skipperName = (formData.get('skipperName') || '').trim();
      const skipperIc = (formData.get('skipperIc') || '').trim();
      
      // SID kekal tetap mengikut pendaftaran akaun tekong (hanya paparkan nombor)
      const skipperLicense = String((user && user.licenseNo) ? user.licenseNo : '202523023697').replace(/^SID\s*no\.?\s*/i, '').trim();
      
      // Tekong cannot change capacity: strictly locked to registered boat capacity
      const maxCapacity = (user && (user.defaultCapacity || user.regBoatCapacity || user.boatCapacity)) || 12;
      
      const departureJetty = formData.get('departureJetty');
      const destination = (formData.get('destination') || '').trim();
      const departureDate = formData.get('departureDate');
      const departureTime = formData.get('departureTime');
      
      // Tuai data berstruktur dari jadual baris & lajur kru
      const { crew, crewList } = harvestCrewTable();
      if (crew && crew.length > 5) {
        const isEnModal = window.I18N && window.I18N.getLanguage() === 'en';
        alert(isEnModal 
          ? 'Maximum limit reached: Only a maximum of 5 assisting crew members are allowed per trip.'
          : 'Had maksimum dicapai: Hanya maksimum 5 orang kru pembantu (awak-awak / deckhand) dibenarkan bagi setiap trip.');
        return;
      }

      // Validate destination strictly to Pulau Perhentian or Pulau Redang
      const allowedDestinations = ['Pulau Perhentian', 'Pulau Redang'];
      if (!allowedDestinations.includes(destination)) {
        alert('Destinasi tidak sah! Pilihan destinasi hanyalah: Pulau Perhentian atau Pulau Redang.');
        return;
      }

      const submitBtn = formCreateTrip.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
      const isEnModal = window.I18N && window.I18N.getLanguage() === 'en';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="inline-flex items-center gap-2">${isEnModal ? 'Creating voyage...' : 'Mencipta perjalanan...'}</span>`;
      }

      try {
        const newTrip = await SMCStore.createTrip({
          boatName,
          boatRegNo,
          skipperName,
          skipperIc,
          skipperLicense,
          maxCapacity,
          departureJetty,
          destination,
          departureDate,
          departureTime,
          crew,
          crewList
        });

        document.getElementById('modal-create-trip').classList.add('hidden');
        if (newTrip && newTrip.id) {
          loadTekongDashboard(newTrip.id);
          const crewMsg = isEnModal 
            ? (crew.length > 0 ? `\nDuty Crew: ${crew.length} persons registered.` : '\nSolo Operation (No additional crew).')
            : (crew.length > 0 ? `\nKru Bertugas: ${crew.length} orang didaftarkan.` : '\nOperasi Solo (Tiada kru tambahan).');
          const msg = isEnModal 
            ? `Trip ${newTrip.id} to ${newTrip.destination} successfully created!\nCapacity Limit: ${newTrip.maxCapacity} Passengers (Locked to registered boat).${crewMsg}\nQR Code has been generated.`
            : `Trip ${newTrip.id} ke ${newTrip.destination} berjaya dicipta!\nHad Kapasiti: ${newTrip.maxCapacity} Penumpang (Terkunci mengikut bot berdaftar).${crewMsg}\nKod QR telah dijana.`;
          alert(msg);
        } else {
          loadTekongDashboard();
          alert(isEnModal ? 'Trip successfully created!' : 'Trip berjaya dicipta!');
        }
      } catch (err) {
        alert(err.message || (window.I18N && window.I18N.getLanguage() === 'en' ? 'Error creating trip.' : 'Ralat semasa mencipta trip.'));
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      }
    };

    // Open QR Modal
    document.getElementById('btn-open-qr-modal').onclick = () => {
      if (!activeTripId) {
        alert(window.I18N && window.I18N.getLanguage() === 'en' ? 'Please create a trip first before opening the QR Code display.' : 'Sila cipta trip terlebih dahulu sebelum membuka paparan Kod QR.');
        return;
      }
      const trip = SMCStore.getTripById(activeTripId);
      if (!trip) return;

      document.getElementById('modal-qr-boat').textContent = trip.boatName;
      document.getElementById('modal-qr-destination').textContent = trip.destination;
      document.getElementById('modal-qr-capacity').textContent = `${trip.maxCapacity} ${window.I18N && window.I18N.getLanguage() === 'en' ? 'Passengers' : 'Penumpang'}`;
      document.getElementById('modal-qr-trip-id').textContent = trip.id;

      const passengerUrl = getPassengerRegistrationUrl(trip.id);
      document.getElementById('modal-qr-url-text').value = passengerUrl;

      document.getElementById('modal-qr-code').classList.remove('hidden');
      const canvas = document.getElementById('modal-qr-canvas');
      setTimeout(() => {
        QRUtils.renderToCanvas(canvas, passengerUrl, { size: 210, padding: 8 });
      }, 20);
      if (window.lucide) window.lucide.createIcons();
    };

    document.getElementById('btn-close-qr-modal').onclick = () => {
      document.getElementById('modal-qr-code').classList.add('hidden');
    };

    document.getElementById('btn-close-edit-trip').onclick = () => {
      document.getElementById('modal-admin-edit-trip').classList.add('hidden');
    };

    // Copy QR URL
    document.getElementById('btn-copy-qr-url').onclick = () => {
      const urlText = document.getElementById('modal-qr-url-text');
      navigator.clipboard.writeText(urlText.value).then(() => {
        alert(window.I18N && window.I18N.getLanguage() === 'en' ? 'Passenger registration link copied to clipboard!' : 'Pautan pendaftaran penumpang telah disalin ke papan klip!');
      });
    };

    // Download QR Code PNG
    document.getElementById('btn-download-qr').onclick = () => {
      const canvas = document.getElementById('modal-qr-canvas');
      QRUtils.downloadPNG(canvas, `Kod_QR_${activeTripId}.png`);
    };

    // Test Open Passenger Form
    document.getElementById('btn-test-open-form').onclick = () => {
      document.getElementById('modal-qr-code').classList.add('hidden');
      showView('passenger', activeTripId);
    };

    // Weather Modal setup
    setupWeatherAdvisoryModal();
  }

  // -------------------------------------------------------------
  // MARITIME WEATHER ADVISORY CONTROLLER
  // -------------------------------------------------------------
  let currentMaritimeAdvisory = null;

  async function updateWeatherAdvisoryUI(port) {
    const isEn = isEnglish();
    const trip = SMCStore.getTripById(activeTripId);
    const targetPort = port || (trip && trip.departureJetty) || 'Jeti Kuala Besut';

    const renderAdvisory = (adv) => {
      if (!adv) return;
      const applyPillStyle = (pillEl, textEl, level, statusText, statusTextEn) => {
        if (!pillEl || !textEl) return;
        if (level === 'RED') {
          pillEl.className = 'text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/40 flex items-center gap-1';
          textEl.textContent = isEn ? (statusTextEn || 'DEPARTURE SUSPENDED') : (statusText || 'PELEPASAN DITANGGUHKAN');
        } else if (level === 'YELLOW') {
          pillEl.className = 'text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/40 flex items-center gap-1';
          textEl.textContent = isEn ? (statusTextEn || 'CAUTION ADVISED') : (statusText || 'BERWASPADA (HAD BOT KECIL)');
        } else {
          pillEl.className = 'text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 flex items-center gap-1';
          textEl.textContent = isEn ? (statusTextEn || 'DEPARTURE CLEARANCE GRANTED') : (statusText || 'PELEPASAN DIBENARKAN');
        }
      };

      const formatWind = (w) => {
        if (!w) return isEn ? '10 – 20 km/h' : '10 – 20 km/j';
        return isEn ? w.replace('km/j', 'km/h') : w.replace('km/h', 'km/j');
      };

      const formatSeaState = (adv) => {
        return isEn ? (adv.seaStateEn || 'Calm / Smooth') : (adv.seaState || 'Tenang / Baik');
      };

      // 0. Landing Page Banner
      const lndPort = document.getElementById('landing-weather-port');
      if (lndPort) {
        lndPort.textContent = adv.port;
        const lndStateEl = document.getElementById('landing-weather-sea-state');
        const lndWaveEl = document.getElementById('landing-weather-wave');
        const lndWindEl = document.getElementById('landing-weather-wind');
        if (lndStateEl) lndStateEl.textContent = formatSeaState(adv);
        if (lndWaveEl) lndWaveEl.textContent = adv.waveHeight;
        if (lndWindEl) lndWindEl.textContent = formatWind(adv.windSpeed);
        applyPillStyle(
          document.getElementById('landing-weather-status-pill'),
          document.getElementById('landing-weather-status-text'),
          adv.level,
          adv.clearanceStatus,
          adv.clearanceStatusEn
        );
      }

      // 1. Tekong Banner
      const tkPort = document.getElementById('tekong-weather-port');
      if (tkPort) {
        tkPort.textContent = adv.port;
        const sStateEl = document.getElementById('tekong-weather-sea-state');
        const waveEl = document.getElementById('tekong-weather-wave');
        const windEl = document.getElementById('tekong-weather-wind');
        if (sStateEl) sStateEl.textContent = formatSeaState(adv);
        if (waveEl) waveEl.textContent = adv.waveHeight;
        if (windEl) windEl.textContent = formatWind(adv.windSpeed);
        applyPillStyle(
          document.getElementById('tekong-weather-status-pill'),
          document.getElementById('tekong-weather-status-text'),
          adv.level,
          adv.clearanceStatus,
          adv.clearanceStatusEn
        );
      }

      // 2. Admin Banner
      const admPort = document.getElementById('admin-weather-port');
      if (admPort) {
        admPort.textContent = adv.port;
        const admStateEl = document.getElementById('admin-weather-sea-state');
        const admWaveEl = document.getElementById('admin-weather-wave');
        const admWindEl = document.getElementById('admin-weather-wind');
        if (admStateEl) admStateEl.textContent = formatSeaState(adv);
        if (admWaveEl) admWaveEl.textContent = adv.waveHeight;
        if (admWindEl) admWindEl.textContent = formatWind(adv.windSpeed);
        applyPillStyle(
          document.getElementById('admin-weather-status-pill'),
          document.getElementById('admin-weather-status-text'),
          adv.level,
          adv.clearanceStatus,
          adv.clearanceStatusEn
        );
      }

      // 3. Step 6 Warning Notice for Captain
      const warnCard = document.getElementById('tekong-weather-warning');
      const warnTitle = document.getElementById('tekong-weather-warning-title');
      const warnBody = document.getElementById('tekong-weather-warning-body');
      if (warnCard) {
        if (adv.level === 'RED') {
          warnCard.classList.remove('hidden');
          warnCard.className = 'mt-3 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-xs';
          if (warnTitle) warnTitle.textContent = isEn ? '🔴 MANDATORY NOTICE: DEPARTURE SUSPENDED' : '🔴 NOTIS WAJIB: PELEPASAN DITANGGUHKAN';
          if (warnBody) warnBody.textContent = isEn ? (adv.advisoryNoteEn || 'All passenger boats are strictly prohibited from departing by Port Authority due to dangerous sea conditions.') : (adv.advisoryNote || 'Semua bot penumpang dilarang meninggalkan jeti sehingga notis seterusnya dikeluarkan oleh Jabatan Laut.');
        } else if (adv.level === 'YELLOW') {
          warnCard.classList.remove('hidden');
          warnCard.className = 'mt-3 p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs';
          if (warnTitle) warnTitle.textContent = isEn ? '🟡 CAUTION: ROUGH SEA RESTRICTIONS' : '🟡 AMARAN: KEKANGAN LAUT BERGELORA';
          if (warnBody) warnBody.textContent = isEn ? (adv.advisoryNoteEn || 'Skippers must ensure all lifejackets are secured and exercise extreme caution.') : (adv.advisoryNote || 'Nakhoda dinasihatkan sentiasa berwaspada dan mematuhi had laju laut bergelora.');
        } else {
          warnCard.classList.add('hidden');
        }
      }

      // 4. Modal card if open
      const mBadge = document.getElementById('weather-modal-badge');
      if (mBadge) {
        mBadge.textContent = `${adv.level} • ${isEn ? (adv.clearanceStatusEn || adv.clearanceStatus) : adv.clearanceStatus}`;
        mBadge.className = adv.level === 'RED' ? 'px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white' : (adv.level === 'YELLOW' ? 'px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-600 text-white' : 'px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white');
        const mNote = document.getElementById('weather-modal-note');
        const mWave = document.getElementById('weather-modal-wave');
        const mWind = document.getElementById('weather-modal-wind');
        const mDir = document.getElementById('weather-modal-dir');
        if (mNote) mNote.textContent = isEn ? (adv.advisoryNoteEn || adv.advisoryNote) : adv.advisoryNote;
        if (mWave) mWave.textContent = adv.waveHeight;
        if (mWind) mWind.textContent = formatWind(adv.windSpeed);
        if (mDir) mDir.textContent = isEn ? (adv.windDirectionEn || (adv.windDirection ? adv.windDirection.replace('Barat Daya', 'Southwest') : 'Southwest (SW)')) : (adv.windDirection || 'Barat Daya (SW)');
      }
    };

    // Immediate synchronous render using existing advisory or fallback
    const fallbackAdvisory = {
      port: targetPort,
      seaState: 'Tenang / Baik',
      seaStateEn: 'Calm / Smooth',
      waveHeight: '0.5m – 1.0m',
      windSpeed: '10 – 20 km/j',
      windDirection: 'Barat Daya (SW)',
      windDirectionEn: 'Southwest (SW)',
      level: 'GREEN',
      clearanceStatus: 'PELEPASAN DIBENARKAN',
      clearanceStatusEn: 'DEPARTURE CLEARANCE GRANTED',
      advisoryNote: 'Keadaan laut mengizinkan pelayaran bot pelancong.',
      advisoryNoteEn: 'Sea conditions safe for passenger boat departure.'
    };
    renderAdvisory(currentMaritimeAdvisory || fallbackAdvisory);

    // Fetch latest advisory from server asynchronously
    try {
      const data = await SMCStore.getWeatherAdvisory(targetPort);
      if (data && data.advisory) {
        currentMaritimeAdvisory = data.advisory;
        renderAdvisory(currentMaritimeAdvisory);
      }
    } catch (e) {}
  }

  function setupWeatherAdvisoryModal() {
    const modal = document.getElementById('modal-weather-advisory');
    const btnTekong = document.getElementById('btn-open-weather-modal-tekong');
    const btnAdmin = document.getElementById('btn-open-weather-modal-admin');
    const btnClose = document.getElementById('btn-close-weather-modal');
    const portSelect = document.getElementById('weather-modal-port-select');
    const adminControls = document.getElementById('weather-admin-controls');

    const openModal = (isAdmin = false) => {
      if (!modal) return;
      modal.classList.remove('hidden');
      if (adminControls) {
        if (isAdmin) {
          adminControls.classList.remove('hidden');
        } else {
          adminControls.classList.add('hidden');
        }
      }
      const trip = SMCStore.getTripById(activeTripId);
      if (trip && trip.departureJetty && portSelect) {
        portSelect.value = trip.departureJetty;
      }
      const p = portSelect ? portSelect.value : 'Jeti Kuala Besut';
      updateWeatherAdvisoryUI(p);
      if (window.lucide) window.lucide.createIcons();
    };

    const btnLanding = document.getElementById('btn-open-weather-modal-landing');
    if (btnLanding) btnLanding.onclick = () => openModal(false);
    if (btnTekong) btnTekong.onclick = () => openModal(false);
    if (btnAdmin) btnAdmin.onclick = () => openModal(true);
    if (btnClose) btnClose.onclick = () => modal.classList.add('hidden');

    if (portSelect) {
      portSelect.onchange = () => {
        updateWeatherAdvisoryUI(portSelect.value);
      };
    }

    // Set weather buttons
    document.querySelectorAll('.btn-set-weather').forEach(btn => {
      btn.onclick = async () => {
        const level = btn.getAttribute('data-level');
        const port = portSelect ? portSelect.value : 'Jeti Kuala Besut';
        await SMCStore.updateWeatherAdvisory({ port, level });
        await updateWeatherAdvisoryUI(port);
      };
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function initThemeSwitcher() {
    let savedTheme = 'modern';
    localStorage.setItem('mch_theme', 'modern');
    applyTheme('modern');

    // Ensure any theme selectors or buttons that might exist are removed from DOM
    try {
      document.querySelectorAll('.retro-theme-toolbar, .theme-btn-group, .retro-theme-btn, [data-theme-target]').forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    } catch (e) {}
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('mch_theme', theme);

    const themeButtons = document.querySelectorAll('.retro-theme-btn');
    themeButtons.forEach(btn => {
      if (btn.getAttribute('data-theme-target') === theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const headerThemeSelect = document.getElementById('header-theme-select');
    if (headerThemeSelect && headerThemeSelect.value !== theme) {
      headerThemeSelect.value = theme;
    }
  }

  window.ePenumpangApp = {
    showView,
    applyTheme
  };
})();

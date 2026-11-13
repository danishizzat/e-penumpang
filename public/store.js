// js/store.js - Central Data Store, Validation Rules & Persistence for e-PENUMPANG
(function() {
  const STORAGE_KEY_TRIPS = 'ep_smc_trips_v2';
  const STORAGE_KEY_USER = 'ep_smc_user_session_v3';
  const STORAGE_KEY_ACCOUNTS = 'ep_smc_registered_accounts_v3';

  // Pre-seeded Official Demo Accounts
  const DEFAULT_ACCOUNTS = [
    {
      role: 'TEKONG',
      username: 'tekong',
      password: 'pass123',
      fullName: 'Rosli bin Ahmad',
      licenseNo: 'SMC-TEKONG-8841',
      boatName: 'Bayu Samudera 03',
      boatRegNo: 'TR-4592-B',
      defaultCapacity: 12,
      phone: '+6012-9845123'
    },
    {
      role: 'TEKONG',
      username: 'tekong_johan',
      password: 'pass123',
      fullName: 'Johan Idris',
      licenseNo: 'SMC-TEKONG-9931',
      boatName: 'Camar Laut Express',
      boatRegNo: 'KDH-7721-BP',
      defaultCapacity: 10,
      phone: '+6019-9112233'
    },
    {
      role: 'ADMIN',
      username: 'admin',
      password: 'admin123',
      fullName: 'Pegawai Azman bin Yusof',
      staffId: 'SMC-ADM-088',
      agencyKey: 'SMC2026',
      phone: '+603-88889999'
    },
    {
      role: 'JLM',
      username: 'jlm',
      password: 'epenumpang2026',
      fullName: 'Pegawai Penguatkuasa Jabatan Laut Malaysia',
      staffId: 'JLM-ENF-001',
      agencyKey: 'JLM2026',
      agency: 'Jabatan Laut Malaysia (Marine Department Malaysia)',
      port: 'Ibu Pejabat Laut Malaysia (Port Klang)',
      phone: '+603-33467777'
    }
  ];

  // Pre-seeded Official Demo Trips
  const DEFAULT_TRIPS = [
    {
      id: 'TRIP-2026-101',
      driverId: 'tekong',
      ownerFullName: 'Rosli bin Ahmad',
      ownerLicense: 'SMC-TEKONG-8841',
      boatName: 'Bayu Samudera 03',
      boatRegNo: 'TR-4592-B',
      skipperName: 'Rosli bin Ahmad',
      skipperLicense: 'SMC-TEKONG-8841',
      maxCapacity: 12, // Had penumpang mengikut kapasiti bot
      destination: 'Pulau Perhentian',
      departureJetty: 'Jeti Kuala Besut, Terengganu',
      departureDate: '2026-09-09',
      departureTime: '10:00',
      status: 'OPEN',
      drivers: [
        { name: 'Rosli bin Ahmad', ic_passport: '780312-11-5421', license_no: 'SMC-TEKONG-8841', role: 'Tekong Utama' },
        { name: 'Zulkifli', ic_passport: '840915-11-6671', license_no: 'SMC-TEKONG-9912', role: 'Tekong Kedua' }
      ],
      crewList: 'Faizal b. Azman (Dekman), Mohd Syukri (Kru Keselamatan)',
      crew: [
        { name: 'Faizal b. Azman', ic_passport: '950410-11-6677', role: 'Awak-awak / Deckhand' },
        { name: 'Mohd Syukri', ic_passport: '980115-11-7891', role: 'Kru Keselamatan' }
      ],
      passengers: [
        { id: 'PAX-101-01', fullName: 'Muhammad Amirul bin Razali', icOrPassport: '940512-11-5321', shortAddress: 'Kota Bharu, Kelantan', phone: '019-9876543', lifejacket: true, registeredAt: '2026-09-09T08:15:00Z' },
        { id: 'PAX-101-02', fullName: 'Siti Nurhaliza binti Tarudin', icOrPassport: '920512-11-5432', shortAddress: 'Petaling Jaya, Selangor', phone: '013-9876543', lifejacket: true, registeredAt: '2026-09-09T08:20:00Z' },
        { id: 'PAX-101-03', fullName: 'Alexander John Smith', icOrPassport: 'A8839201', shortAddress: 'London, UK', phone: '+44 7700 900077', lifejacket: true, registeredAt: '2026-09-09T08:25:00Z' },
        { id: 'PAX-101-04', fullName: 'Ahmad Dani bin Roslan', icOrPassport: '881104-03-5121', shortAddress: 'Kuantan, Pahang', phone: '017-6543210', lifejacket: true, registeredAt: '2026-09-09T08:30:00Z' },
        { id: 'PAX-101-05', fullName: 'Mei Ling Tan', icOrPassport: '950314-14-5890', shortAddress: 'George Town, Pulau Pinang', phone: '016-8899123', lifejacket: true, registeredAt: '2026-09-09T08:35:00Z' },
        { id: 'PAX-101-06', fullName: 'Kavitha A/P Subramaniam', icOrPassport: '900215-08-5112', shortAddress: 'Ipoh, Perak', phone: '012-5544332', lifejacket: true, registeredAt: '2026-09-09T08:40:00Z' },
        { id: 'PAX-101-07', fullName: 'David Michael Lee', icOrPassport: 'E9981240', shortAddress: 'Singapura', phone: '+65 9123 4567', lifejacket: true, registeredAt: '2026-09-09T08:45:00Z' },
        { id: 'PAX-101-08', fullName: 'Nurul Huda binti Halim', icOrPassport: '971120-14-5222', shortAddress: 'Shah Alam, Selangor', phone: '017-8899112', lifejacket: true, registeredAt: '2026-09-09T08:50:00Z' },
        { id: 'PAX-101-09', fullName: 'Chong Wei Lun', icOrPassport: '890704-01-5589', shortAddress: 'Johor Bahru, Johor', phone: '016-7788990', lifejacket: true, registeredAt: '2026-09-09T08:55:00Z' },
        { id: 'PAX-101-10', fullName: 'Fatimah Az-Zahra', icOrPassport: '010615-03-6002', shortAddress: 'Muar, Johor', phone: '019-2233445', lifejacket: true, registeredAt: '2026-09-09T09:00:00Z' }
      ]
    },
    {
      id: 'TRIP-2026-102',
      driverId: 'tekong',
      ownerFullName: 'Rosli bin Ahmad',
      ownerLicense: 'SMC-TEKONG-8841',
      boatName: 'Ombak Biru 01',
      boatRegNo: 'TR-7788-B',
      skipperName: 'Rosli bin Ahmad',
      skipperLicense: 'SMC-TEKONG-8841',
      maxCapacity: 15,
      destination: 'Pulau Redang',
      departureJetty: 'Jeti Merang, Terengganu',
      departureDate: '2026-09-09',
      departureTime: '14:30',
      status: 'OPEN',
      drivers: [
        { name: 'Rosli bin Ahmad', ic_passport: '780312-11-5421', license_no: 'SMC-TEKONG-8841', role: 'Tekong Utama' }
      ],
      crewList: 'Wan Hazrul (Dekman)',
      crew: [
        { name: 'Wan Hazrul', ic_passport: '950410-11-6677', role: 'Awak-awak' }
      ],
      passengers: [
        { id: 'PAX-102-01', fullName: 'Hassan bin Abdullah', icOrPassport: '750312-08-5431', shortAddress: 'Melaka', phone: '012-3344551', lifejacket: true, registeredAt: '2026-09-09T11:00:00Z' },
        { id: 'PAX-102-02', fullName: 'Zainab binti Omar', icOrPassport: '810815-03-5114', shortAddress: 'Kuantan, Pahang', phone: '019-4455667', lifejacket: true, registeredAt: '2026-09-09T11:15:00Z' }
      ]
    },
    {
      id: 'TRIP-2026-103',
      driverId: 'tekong_johan',
      ownerFullName: 'Nakhoda Johan Idris',
      ownerLicense: 'SMC-TEKONG-9931',
      boatName: 'Camar Laut Express',
      boatRegNo: 'KDH-7721-BP',
      skipperName: 'Nakhoda Johan Idris',
      skipperLicense: 'SMC-TEKONG-9931',
      maxCapacity: 10,
      destination: 'Pulau Redang',
      departureJetty: 'Jeti Marang, Terengganu',
      departureDate: '2026-09-09',
      departureTime: '09:00',
      status: 'APPROVED',
      approvedAt: '2026-09-09T08:50:00Z',
      drivers: [
        { name: 'Nakhoda Johan Idris', ic_passport: '791104-02-6611', license_no: 'SMC-TEKONG-9931', role: 'Tekong Utama' }
      ],
      crewList: 'Razali (Deckhand)',
      crew: [{ name: 'Razali', ic_passport: '910304-11-5511', role: 'Deckhand' }],
      passengers: [
        { id: 'PAX-103-01', fullName: 'Tan Siew Min', icOrPassport: '860412-14-5312', shortAddress: 'Kuala Lumpur', phone: '012-9988776', lifejacket: true, registeredAt: '2026-09-09T08:20:00Z' },
        { id: 'PAX-103-02', fullName: 'Faridah binti Yusof', icOrPassport: '910101-11-5432', shortAddress: 'Terengganu', phone: '013-4455667', lifejacket: true, registeredAt: '2026-09-09T08:30:00Z' }
      ]
    }
  ];

  // Helper Functions
  function loadFromStorage(key, defaultVal) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  }

  function saveToStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  // Load Trips
  let trips = loadFromStorage(STORAGE_KEY_TRIPS, null);
  if (!trips || !Array.isArray(trips) || trips.length === 0) {
    trips = DEFAULT_TRIPS;
    saveToStorage(STORAGE_KEY_TRIPS, trips);
  } else {
    // Migration: Ensure all existing trips in localStorage have proper ownership metadata
    let modified = false;

    // Ensure valid trips array
    trips = trips.filter(t => t && t.id);

    trips.forEach(t => {
      if (!t.driverId || !t.ownerFullName) {
        if (t.id === 'TRIP-2026-101' || t.id === 'TRIP-2026-102' || (t.skipperName && t.skipperName.includes('Rosli'))) {
          t.driverId = t.driverId || 'tekong';
          t.ownerFullName = t.ownerFullName || 'Nakhoda Rosli bin Ahmad';
          t.ownerLicense = t.ownerLicense || 'SMC-TEKONG-8841';
          modified = true;
        } else if (t.id === 'TRIP-2026-103' || (t.skipperName && t.skipperName.includes('Johan'))) {
          t.driverId = t.driverId || 'tekong_johan';
          t.ownerFullName = t.ownerFullName || 'Nakhoda Johan Idris';
          t.ownerLicense = t.ownerLicense || 'SMC-TEKONG-9931';
          modified = true;
        }
      }
    });
    if (modified) {
      saveToStorage(STORAGE_KEY_TRIPS, trips);
    }
  }

  // Load Accounts
  let accounts = loadFromStorage(STORAGE_KEY_ACCOUNTS, null);
  if (!accounts || !Array.isArray(accounts)) {
    accounts = DEFAULT_ACCOUNTS;
    saveToStorage(STORAGE_KEY_ACCOUNTS, accounts);
  } else {
    // Purge temporary test accounts
    accounts = accounts.filter(a => (!a.fullName || !a.fullName.includes('Test Medium')) && (!a.username || !a.username.startsWith('test_')));

    // Ensure default accounts exist
    DEFAULT_ACCOUNTS.forEach(defAcc => {
      if (!accounts.some(a => a.username === defAcc.username)) {
        accounts.push(defAcc);
        saveToStorage(STORAGE_KEY_ACCOUNTS, accounts);
      }
    });
  }

  // Session
  let currentSession = loadFromStorage(STORAGE_KEY_USER, null);

  // Resilient API Fetch Helper: Tries /api/... and automatically falls back to api.php?endpoint=...
  async function apiFetch(url, options = {}) {
    try {
      const resp = await fetch(url, options);
      if (resp.status !== 404) {
        return resp;
      }
    } catch (e) {}

    // Fallback if 404 (e.g. missing .htaccess / no mod_rewrite): Call api.php directly
    if (url.startsWith('/api/') || url.startsWith('api/')) {
      const cleanPath = url.replace(/^\/?api\//, '');
      const queryMark = cleanPath.indexOf('?');
      let ep = cleanPath;
      let extraParams = '';
      if (queryMark !== -1) {
        ep = cleanPath.substring(0, queryMark);
        extraParams = '&' + cleanPath.substring(queryMark + 1);
      }
      try {
        const fallbackUrl = `api.php?endpoint=${encodeURIComponent(ep)}${extraParams}`;
        return await fetch(fallbackUrl, options);
      } catch (e2) {}
    }

    return fetch(url, options);
  }

  // Synchronize with server (MySQL & SQLite) if available
  async function syncWithServer() {
    try {
      // 1. Sync accounts from MySQL/server
      const accRes = await apiFetch('/api/auth/accounts');
      if (accRes.ok) {
        const accData = await accRes.json();
        if (accData.users && Array.isArray(accData.users)) {
          accData.users.forEach(u => {
            const existing = accounts.find(a => (a.username && a.username === u.id) || (a.fullName && a.fullName.toLowerCase() === u.name.toLowerCase()));
            if (!existing) {
              accounts.push({
                id: u.id,
                role: (u.role === 'admin' || u.role === 'ADMIN') ? 'ADMIN' : ((u.role === 'jlm' || u.role === 'JLM') ? 'JLM' : 'TEKONG'),
                username: u.id,
                fullName: u.name,
                password: '',
                licenseNo: u.license_no,
                ic_passport: u.ic_passport || null,
                boat_type: u.boat_type || 'mini_speedboat',
                boatName: u.boat_default_name,
                boatRegNo: u.boat_default_reg,
                defaultCapacity: parseInt(u.boat_default_capacity, 10) || 12,
                boatCapacity: parseInt(u.boat_default_capacity, 10) || 12,
                phone: u.phone,
                port: u.port
              });
            } else {
              existing.id = u.id;
              existing.licenseNo = u.license_no || existing.licenseNo;
              existing.ic_passport = u.ic_passport || existing.ic_passport;
              existing.boat_type = u.boat_type || existing.boat_type || 'mini_speedboat';
              existing.boatName = u.boat_default_name || existing.boatName;
              existing.boatRegNo = u.boat_default_reg || existing.boatRegNo;
              existing.defaultCapacity = parseInt(u.boat_default_capacity, 10) || existing.defaultCapacity || 12;
              existing.boatCapacity = parseInt(u.boat_default_capacity, 10) || existing.boatCapacity || 12;
            }
          });
          saveToStorage(STORAGE_KEY_ACCOUNTS, accounts);
        }
      }

      // 2. Sync trips with full manifests directly from MySQL e_penumpang
      const res = await apiFetch('/api/trips');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.trips) && data.trips.length > 0) {
          trips = data.trips;
          saveToStorage(STORAGE_KEY_TRIPS, trips);
        }
      }
    } catch (e) {
      // Offline / purely client fallback
    }
  }
  syncWithServer();

  // Public Store API
  const SMCStore = {
    // Auth & Accounts
    login(identifier, password) {
      const rawId = (identifier || '').trim();
      const u = rawId.toLowerCase();
      const p = (password || '').trim();

      if (!rawId || !p) {
        const isEn = window.I18N && window.I18N.getLanguage() === 'en';
        return {
          success: false,
          message: isEn ? 'Please enter your User ID / Name and Password.' : 'Sila masukkan ID Pengguna / Nama dan Kata Laluan.'
        };
      }

      // Normalize input helper
      const cleanInput = u.replace(/\s+/g, ' ');
      const cleanInputNoTitle = cleanInput.replace(/^(nakhoda|kapten|capt\.|captain|encik|tuan)\s+/i, '').trim();

      const user = accounts.find(a => {
        if (!a.password || a.password !== p) return false;

        const accFull = (a.fullName || '').toLowerCase().trim();
        const accUser = (a.username || '').toLowerCase().trim();
        const accLicense = (a.licenseNo || '').toLowerCase().trim();
        const accStaff = (a.staffId || '').toLowerCase().trim();
        const accFullNoTitle = accFull.replace(/^(nakhoda|kapten|capt\.|captain|encik|tuan)\s+/i, '').trim();

        // 1. Exact matches (Full Name, Username, License No, Staff ID)
        if (accFull === cleanInput || accUser === cleanInput) return true;
        if (accLicense === cleanInput || accStaff === cleanInput) return true;

        // 2. Name match without titles (e.g. "Rosli" matches "Nakhoda Rosli" or "Rosli bin Ahmad")
        if (cleanInputNoTitle && (accFullNoTitle === cleanInputNoTitle || accFullNoTitle.includes(cleanInputNoTitle) || cleanInputNoTitle.includes(accFullNoTitle))) {
          return true;
        }

        // 3. Partial Name Match
        if (cleanInput.length >= 3 && accFull.includes(cleanInput)) {
          return true;
        }

        return false;
      });

      if (!user) {
        const isEn = window.I18N && window.I18N.getLanguage() === 'en';
        return {
          success: false,
          message: isEn ? 'Invalid User ID / Name or Password. Please check again.' : 'Nama penuh/ID atau kata laluan tidak sah. Sila semak semula.'
        };
      }

      currentSession = user;
      saveToStorage(STORAGE_KEY_USER, currentSession);
      return { success: true, user };
    },

    // Async login querying backend MySQL first
    async loginAsync(identifier, password) {
      const rawId = (identifier || '').trim();
      const p = (password || '').trim();

      if (!rawId || !p) {
        const isEn = window.I18N && window.I18N.getLanguage() === 'en';
        return {
          success: false,
          message: isEn ? 'Please enter your User ID / Name and Password.' : 'Sila masukkan ID Pengguna / Nama dan Kata Laluan.'
        };
      }

      // 1. Always verify against live MySQL database first
      try {
        const resp = await apiFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: rawId, password: p })
        });
        const data = await resp.json();

        if (resp.ok && data.success && data.user) {
          const u = data.user;
          const userRole = (u.role === 'admin' || u.role === 'ADMIN') ? 'ADMIN' : ((u.role === 'jlm' || u.role === 'JLM') ? 'JLM' : 'TEKONG');
          const userObj = {
            id: u.id,
            role: userRole,
            username: u.id,
            fullName: u.name || u.fullName,
            name: u.name || u.fullName,
            password: p,
            licenseNo: u.license_no || u.licenseNo,
            ic_passport: u.ic_passport || null,
            boat_type: u.boat_type || 'mini_speedboat',
            boatName: u.boat_default_name || u.boatName,
            boatRegNo: u.boat_default_reg || u.boatRegNo,
            defaultCapacity: parseInt(u.boat_default_capacity || u.boatCapacity, 10) || 12,
            boatCapacity: parseInt(u.boat_default_capacity || u.boatCapacity, 10) || 12,
            phone: u.phone,
            port: u.port
          };

          const existingIdx = accounts.findIndex(a => a.id === u.id || (a.username && a.username.toLowerCase() === u.id.toLowerCase()) || (a.fullName && a.fullName.toLowerCase() === (u.name || '').toLowerCase()));
          if (existingIdx >= 0) {
            accounts[existingIdx] = userObj;
          } else {
            accounts.push(userObj);
          }
          saveToStorage(STORAGE_KEY_ACCOUNTS, accounts);
          currentSession = userObj;
          saveToStorage(STORAGE_KEY_USER, currentSession);
          return { success: true, user: userObj };
        } else if (resp.status === 401 || (data && data.success === false)) {
          // Explicit rejection from MySQL - do not bypass!
          const isEn = window.I18N && window.I18N.getLanguage() === 'en';
          return {
            success: false,
            message: (data && data.error) ? data.error : (isEn ? 'Invalid credentials. Please verify your password.' : 'Kata laluan atau ID pengguna tidak sah. Sila semak semula.')
          };
        } else if (resp.status === 500 || (data && data.error && (data.error.includes('pangkalan data') || data.error.includes('MySQL')))) {
          // Database connection error from server
          return {
            success: false,
            message: `[Ralat Pangkalan Data / Database Error]\n\n${(data && data.error) ? data.error : 'Pelayan gagal menyambung ke MySQL database.'}\n\nSila pastikan kata laluan database dimasukkan dalam config.php.`
          };
        }
      } catch (e) {
        console.warn('Pelayan API tidak dapat dicapai, beralih ke cache mod luar talian...', e);
      }

      // 2. Strict offline fallback ONLY if backend is completely unreachable
      return this.login(rawId, p);
    },

    async register(accountData) {
      const cleanFullName = (accountData.fullName || accountData.name || '').trim();
      if (!cleanFullName) {
        return { success: false, message: 'Sila masukkan Nama Penuh anda.' };
      }

      if (accountData.role === 'ADMIN' && accountData.agencyKey !== 'MCH2026' && accountData.agencyKey !== 'SMC2026') {
        const isEn = window.I18N && window.I18N.getLanguage() === 'en';
        return { success: false, message: isEn ? 'Invalid MCH Security Key! Please use MCH2026.' : 'Kod Keselamatan MCH tidak sah! Sila gunakan MCH2026.' };
      }

      // Check if full name is already registered locally
      const existing = accounts.find(a => 
        a.fullName && a.fullName.trim().toLowerCase() === cleanFullName.toLowerCase()
      );
      if (existing) {
        return { success: false, message: `Nama "${cleanFullName}" telah pun didaftarkan. Anda boleh terus log masuk menggunakan Nama Penuh dan kata laluan anda.` };
      }

      // Call Backend API to save directly into MySQL & SQLite
      let serverUser = null;
      let mysqlSaved = false;
      let databaseName = 'MySQL / MariaDB';
      try {
        const resp = await apiFetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: accountData.role,
            fullName: cleanFullName,
            password: accountData.password,
            phone: accountData.phone,
            licenseNo: accountData.licenseNo,
            ic_passport: accountData.ic_passport,
            boat_type: accountData.boat_type,
            boatName: accountData.boatName,
            boatRegNo: accountData.boatRegNo,
            boatCapacity: accountData.boatCapacity || accountData.defaultCapacity || 12,
            port: accountData.port,
            email: accountData.email,
            agencyKey: accountData.agencyKey
          })
        });

        const data = await resp.json();
        if (resp.ok && data.success) {
          serverUser = data.user;
          mysqlSaved = data.mysqlSaved;
          databaseName = data.database;
        } else if (data.error) {
          return { success: false, message: data.error };
        }
      } catch (netErr) {
        console.warn('Gagal menghubungi pelayan, menggunakan simpanan tempatan:', netErr);
      }

      // For Tekong, automatically assign official seafarer ID from MySQL
      accountData.id = serverUser ? serverUser.id : ('TK-' + Date.now());
      accountData.username = accountData.id;
      accountData.fullName = cleanFullName;
      if (serverUser && serverUser.license_no) {
        accountData.licenseNo = serverUser.license_no;
      }
      if (serverUser && serverUser.ic_passport) {
        accountData.ic_passport = serverUser.ic_passport;
      }
      if (serverUser && serverUser.boat_type) {
        accountData.boat_type = serverUser.boat_type;
      }
      if (serverUser && serverUser.boat_default_capacity) {
        accountData.boatCapacity = parseInt(serverUser.boat_default_capacity, 10);
        accountData.defaultCapacity = parseInt(serverUser.boat_default_capacity, 10);
      }

      accounts.push(accountData);
      saveToStorage(STORAGE_KEY_ACCOUNTS, accounts);
      currentSession = accountData;
      saveToStorage(STORAGE_KEY_USER, currentSession);

      return {
        success: true,
        user: accountData,
        mysqlSaved,
        database: databaseName
      };
    },

    getSession() {
      return currentSession;
    },

    logout() {
      currentSession = null;
      localStorage.removeItem(STORAGE_KEY_USER);
    },

    // Trips
    getTrips() {
      return trips;
    },

    getTripsForUser(user) {
      if (!user) return [];
      if (user.role === 'ADMIN') {
        return trips;
      }

      const uName = (user.username || user.id || '').toLowerCase().trim();
      const fName = (user.fullName || '').toLowerCase().trim();
      const lic = (user.licenseNo || '').toLowerCase().trim();
      const cleanFNameNoTitle = fName.replace(/^(nakhoda|kapten|capt\.|captain|encik|tuan)\s+/i, '').trim();

      return trips.filter(t => {
        const tDriverId = (t.driverId || '').toLowerCase().trim();
        const tOwnerName = (t.ownerFullName || t.skipperName || '').toLowerCase().trim();
        const tCleanOwnerNoTitle = tOwnerName.replace(/^(nakhoda|kapten|capt\.|captain|encik|tuan)\s+/i, '').trim();
        const tLic = (t.ownerLicense || t.skipperLicense || '').toLowerCase().trim();

        // 1. Direct username / driverId match
        if (uName && tDriverId && (tDriverId === uName || (uName === 'tekong' && tDriverId === 'mch-tk-1002') || (uName === 'tekong_johan' && tDriverId === 'mch-tk-1004'))) return true;

        // 2. License match
        if (lic && tLic && tLic === lic) return true;

        // 3. Full name match (with or without title)
        if (fName && tOwnerName && (fName === tOwnerName || cleanFNameNoTitle === tCleanOwnerNoTitle || tCleanOwnerNoTitle.includes(cleanFNameNoTitle) || cleanFNameNoTitle.includes(tCleanOwnerNoTitle))) {
          return true;
        }

        // 4. Match in drivers array
        if (Array.isArray(t.drivers)) {
          const match = t.drivers.some(d => {
            const dLic = (d.license_no || '').toLowerCase().trim();
            const dName = (d.name || '').toLowerCase().trim();
            const dCleanName = dName.replace(/^(nakhoda|kapten|capt\.|captain|encik|tuan)\s+/i, '').trim();
            if (lic && dLic && dLic === lic) return true;
            if (fName && dName && (dName === fName || dCleanName === cleanFNameNoTitle || dCleanName.includes(cleanFNameNoTitle))) return true;
            return false;
          });
          if (match) return true;
        }

        return false;
      });
    },

    getTripById(tripId) {
      return trips.find(t => t.id === tripId) || null;
    },

    async getTripByIdAsync(tripId) {
      if (!tripId) return null;
      let t = this.getTripById(tripId);
      if (t) return t;

      try {
        const res = await apiFetch(`/api/trips/${encodeURIComponent(tripId)}/manifest`);
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.trip) {
            const raw = data.trip;
            const formatted = {
              id: raw.id || tripId,
              boatName: raw.boat_name || raw.boatName,
              boatRegNo: raw.boat_reg_no || raw.boatRegNo,
              maxCapacity: data.boatCapacity || raw.boat_capacity || 12,
              driverId: raw.driver_id || raw.driverId,
              skipperName: raw.driver_name || raw.skipperName,
              destination: raw.destination,
              departureJetty: raw.origin || raw.departure_jetty || 'Jeti Kuala Besut',
              departureDate: raw.departure_date || raw.departureDate,
              departureTime: raw.departure_time || raw.departureTime,
              status: raw.status || 'OPEN',
              passengers: (data.passengers || []).map(p => ({
                id: p.id,
                fullName: p.full_name || p.fullName,
                icOrPassport: p.ic_passport || p.icOrPassport,
                shortAddress: p.short_address || p.shortAddress,
                phone: p.phone,
                emergencyPhone: p.emergency_phone || p.emergencyPhone,
                lifejacket: p.lifejacket,
                registeredAt: p.registered_at || p.registeredAt
              })),
              drivers: raw.drivers || [],
              crew: raw.crew || []
            };
            const idx = trips.findIndex(x => x.id === tripId);
            if (idx >= 0) trips[idx] = formatted;
            else trips.push(formatted);
            saveToStorage(STORAGE_KEY_TRIPS, trips);
            return formatted;
          }
        }
      } catch (e) {}

      const def = (typeof DEFAULT_TRIPS !== 'undefined' ? DEFAULT_TRIPS : []).find(x => x.id === tripId);
      if (def) {
        trips.push(def);
        saveToStorage(STORAGE_KEY_TRIPS, trips);
        return def;
      }
      return null;
    },

    async createTrip(data) {
      // Validate 5 Drivers Limit
      const primaryDriverIc = (data.skipperIc && data.skipperIc.trim()) 
        ? data.skipperIc.trim() 
        : ((currentSession && currentSession.ic_passport) 
            ? currentSession.ic_passport 
            : ((currentSession && currentSession.icOrPassport && !currentSession.icOrPassport.startsWith('SID')) 
                ? currentSession.icOrPassport 
                : ((currentSession && currentSession.ic) ? currentSession.ic : '780312-11-5421')));
      const registeredSid = (currentSession && currentSession.licenseNo) ? currentSession.licenseNo : (data.skipperLicense || 'SID-MY-88210');
      const drivers = data.drivers || [
        { name: data.skipperName || (currentSession ? currentSession.fullName : 'Nakhoda'), ic_passport: primaryDriverIc, license_no: registeredSid, role: 'Tekong Utama' }
      ];

      if (drivers.length > 5) {
        throw new Error('HAD KESELAMATAN: Jumlah pemandu (tekong) terhad kepada maksimum 5 orang (tidak termasuk kru)!');
      }

      // Parse crew
      let crew = [];
      if (Array.isArray(data.crew) && data.crew.length > 0) {
        crew = data.crew;
      } else if (data.crewList) {
        crew = data.crewList.split(',').map(c => ({ name: c.trim(), ic_passport: '-', role: 'Awak-awak' })).filter(c => c.name);
      }

      // Enforce max 5 assisting crew members
      if (crew.length > 5) {
        throw new Error('HAD KESELAMATAN: Jumlah kru pembantu (awak-awak / deckhand) terhad kepada maksimum 5 orang sahaja!');
      }

      const formattedCrewList = data.crewList || (crew.length > 0 ? crew.map(c => `${c.name} (${c.role || 'Kru'})`).join(', ') : '');

      // Enforce Destination: Only 'Pulau Perhentian' or 'Pulau Redang'
      const allowedDestinations = ['Pulau Perhentian', 'Pulau Redang'];
      const cleanDestination = (data.destination || '').trim();
      if (!allowedDestinations.includes(cleanDestination)) {
        throw new Error('Destinasi tidak sah! Pilihan destinasi hanyalah: Pulau Perhentian atau Pulau Redang.');
      }

      // Enforce Max Capacity: Tekong cannot change capacity, locked to registered boat
      const lockedCapacity = (currentSession && (currentSession.defaultCapacity || currentSession.boatCapacity || currentSession.regBoatCapacity))
        ? (currentSession.defaultCapacity || currentSession.boatCapacity || currentSession.regBoatCapacity)
        : (parseInt(data.maxCapacity, 10) || 12);

      const driverId = (currentSession && (currentSession.id || currentSession.username)) ? (currentSession.id || currentSession.username) : (data.driverId || 'tekong');
      const ownerFullName = (currentSession && currentSession.fullName) ? currentSession.fullName : (data.skipperName || 'Nakhoda');
      const ownerLicense = (currentSession && currentSession.licenseNo) ? currentSession.licenseNo : (data.skipperLicense || 'SMC-TEKONG-DEFAULT');

      const effectiveDepartureDate = (data.departureDate && String(data.departureDate).trim()) ? String(data.departureDate).trim() : (function() {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
      })();

      // 1. Post to MySQL Backend REST API
      try {
        const resp = await apiFetch('/api/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId,
            boatName: data.boatName.trim(),
            boatRegNo: data.boatRegNo.trim().toUpperCase(),
            boatCapacity: lockedCapacity,
            origin: data.departureJetty ? data.departureJetty.trim() : 'Jeti Kuala Besut',
            destination: cleanDestination,
            departureDate: effectiveDepartureDate,
            departureTime: data.departureTime,
            driverList: drivers,
            crewList: crew
          })
        });

        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json.error || 'Gagal menyimpan trip. Sila cuba lagi.');
        }

        await syncWithServer();
        const createdId = json.manifest ? json.manifest.trip.id : `TRIP-2026-${100 + trips.length}`;
        return this.getTripById(createdId) || (json.manifest ? json.manifest.trip : null);
      } catch (netErr) {
        console.warn('Pelayan tidak dapat dihubungi, menggunakan mod sandaran tempatan:', netErr.message);
      }

      // Local fallback
      const newId = `TRIP-2026-${100 + trips.length + 1}`;
      const newTrip = {
        id: newId,
        driverId: driverId,
        ownerFullName: ownerFullName,
        ownerLicense: ownerLicense,
        boatName: data.boatName.trim(),
        boatRegNo: data.boatRegNo.trim().toUpperCase(),
        skipperName: data.skipperName ? data.skipperName.trim() : ownerFullName,
        skipperIc: primaryDriverIc,
        driver_ic: primaryDriverIc,
        skipperLicense: ownerLicense,
        maxCapacity: lockedCapacity,
        destination: cleanDestination,
        departureJetty: data.departureJetty ? data.departureJetty.trim() : 'Jeti Kuala Besut',
        departureDate: effectiveDepartureDate,
        departureTime: data.departureTime,
        status: 'OPEN',
        drivers: drivers,
        crewList: formattedCrewList,
        crew: crew,
        passengers: []
      };

      trips.unshift(newTrip);
      saveToStorage(STORAGE_KEY_TRIPS, trips);
      return newTrip;
    },

    async updateTrip(tripId, updateData) {
      const idx = trips.findIndex(t => t.id === tripId);
      if (idx === -1) throw new Error('Trip tidak dijumpai.');

      if (updateData.destination) {
        const allowedDestinations = ['Pulau Perhentian', 'Pulau Redang'];
        const cleanDest = updateData.destination.trim();
        if (!allowedDestinations.includes(cleanDest)) {
          throw new Error('Destinasi tidak sah! Pilihan destinasi hanyalah: Pulau Perhentian atau Pulau Redang.');
        }
        updateData.destination = cleanDest;
      }

      if (updateData.crewList && !updateData.crew) {
        updateData.crew = updateData.crewList.split(',').map(c => ({
          name: c.trim(),
          ic_passport: '-',
          role: 'Awak-awak / Deckhand'
        })).filter(c => c.name);
      } else if (updateData.crew && !updateData.crewList) {
        updateData.crewList = updateData.crew.map(c => `${c.name} (${c.role || 'Kru'})`).join(', ');
      }

      if (updateData.crew && updateData.crew.length > 5) {
        throw new Error('HAD KESELAMATAN: Jumlah kru pembantu (awak-awak / deckhand) terhad kepada maksimum 5 orang sahaja!');
      }

      // Call API to update in MySQL
      try {
        const resp = await apiFetch(`/api/trips/${encodeURIComponent(tripId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        if (resp.ok) {
          await syncWithServer();
          return this.getTripById(tripId);
        }
      } catch (e) {}

      trips[idx] = {
        ...trips[idx],
        ...updateData
      };

      if (trips[idx].status === 'OPEN' && trips[idx].passengers.length >= trips[idx].maxCapacity) {
        trips[idx].status = 'FULL';
      }

      saveToStorage(STORAGE_KEY_TRIPS, trips);
      return trips[idx];
    },

    async approveTrip(tripId) {
      const trip = this.getTripById(tripId);
      if (!trip) throw new Error('Trip tidak dijumpai.');
      if (trip.passengers.length === 0) {
        throw new Error('Sila pastikan sekurang-kurangnya seorang penumpang telah berdaftar sebelum kelulusan.');
      }

      const user = this.getSession();
      const driverId = (user && (user.id || user.username)) || 'tekong';

      try {
        const resp = await apiFetch(`/api/trips/${encodeURIComponent(tripId)}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverId })
        });
        if (resp.ok) {
          await syncWithServer();
          return this.getTripById(tripId);
        }
      } catch (e) {}

      trip.status = 'APPROVED';
      trip.approvedAt = new Date().toISOString();
      saveToStorage(STORAGE_KEY_TRIPS, trips);
      return trip;
    },

    async completeTrip(tripId) {
      const user = this.getSession();
      const driverId = (user && (user.id || user.username)) || 'tekong';

      try {
        const resp = await apiFetch(`/api/trips/${encodeURIComponent(tripId)}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverId })
        });
        if (resp.ok) {
          await syncWithServer();
          return this.getTripById(tripId);
        }
      } catch (e) {}

      const trip = this.getTripById(tripId);
      if (trip) {
        trip.status = 'COMPLETED';
        saveToStorage(STORAGE_KEY_TRIPS, trips);
      }
      return trip;
    },

    async deleteTrip(tripId) {
      try {
        const resp = await apiFetch(`/api/trips/${encodeURIComponent(tripId)}`, {
          method: 'DELETE'
        });
        if (resp.ok) {
          await syncWithServer();
          return true;
        }
      } catch (e) {}

      const idx = trips.findIndex(t => t.id === tripId);
      if (idx === -1) throw new Error('Trip tidak dijumpai.');
      trips.splice(idx, 1);
      saveToStorage(STORAGE_KEY_TRIPS, trips);
      return true;
    },

    // Passengers
    async addPassenger(tripId, paxData) {
      let trip = this.getTripById(tripId);
      if (!trip && this.getTripByIdAsync) {
        trip = await this.getTripByIdAsync(tripId);
      }
      if (!trip) throw new Error('Trip tidak sah atau tidak dijumpai.');

      if (trip.status === 'APPROVED' || trip.status === 'COMPLETED') {
        throw new Error('Pendaftaran telah ditutup. Bot telah diluluskan untuk berlepas.');
      }

      const boatCapacity = trip.maxCapacity || 12;
      if (trip.passengers.length >= boatCapacity) {
        const err = new Error(`KAPASITI BOT PENUH! Had keselamatan kapasiti bot (${boatCapacity} penumpang) telah dicapai.`);
        err.code = 'CAPACITY_FULL';
        throw err;
      }

      let age = paxData.age;
      if (!age && paxData.icOrPassport) {
        const clean = paxData.icOrPassport.replace(/[^0-9]/g, '');
        if (clean.length >= 6) {
          const yy = parseInt(clean.substring(0, 2), 10);
          const currentYear = new Date().getFullYear();
          const currentYY = currentYear % 100;
          let birthYear = (yy <= currentYY) ? (2000 + yy) : (1900 + yy);
          let diff = currentYear - birthYear;
          if (diff >= 0 && diff <= 120) {
            age = diff;
          }
        }
      }

      // 1. Post to MySQL Backend API
      try {
        const resp = await apiFetch(`/api/trips/${encodeURIComponent(tripId)}/passengers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: paxData.fullName.trim(),
            icPassport: paxData.icOrPassport.trim().toUpperCase(),
            age: age,
            shortAddress: paxData.shortAddress.trim(),
            phone: (paxData.phone || '').trim(),
            emergencyPhone: (paxData.emergencyPhone || '').trim(),
            lifejacket: paxData.lifejacket !== false
          })
        });

        const json = await resp.json();
        if (!resp.ok) {
          const err = new Error(json.error || 'Gagal mendaftar penumpang. Sila cuba lagi.');
          if (json.code === 'CAPACITY_FULL') err.code = 'CAPACITY_FULL';
          throw err;
        }

        await syncWithServer();
        const p = json.passenger || {};
        const normalizedPax = {
          ...p,
          fullName: p.fullName || p.name || paxData.fullName,
          name: p.name || p.fullName || paxData.fullName,
          icOrPassport: p.icOrPassport || p.ic_passport || paxData.icOrPassport,
          ic_passport: p.ic_passport || p.icOrPassport || paxData.icOrPassport,
          shortAddress: p.shortAddress || p.short_address || paxData.shortAddress,
          short_address: p.short_address || p.shortAddress || paxData.shortAddress
        };
        return {
          passenger: normalizedPax,
          trip: this.getTripById(tripId)
        };
      } catch (netErr) {
        if (netErr.code === 'CAPACITY_FULL') throw netErr;
        console.warn('Pelayan tidak dapat dihubungi, menggunakan mod sandaran tempatan:', netErr.message);
      }

      // Local fallback
      const paxId = `PAX-${tripId.replace('TRIP-2026-', '')}-${String(trip.passengers.length + 1).padStart(2, '0')}`;
      const newPax = {
        id: paxId,
        fullName: paxData.fullName.trim(),
        icOrPassport: paxData.icOrPassport.trim().toUpperCase(),
        age: age || '-',
        shortAddress: paxData.shortAddress.trim(),
        phone: (paxData.phone || '').trim(),
        lifejacket: paxData.lifejacket !== false,
        registeredAt: new Date().toISOString()
      };

      trip.passengers.push(newPax);

      if (trip.passengers.length >= boatCapacity) {
        trip.status = 'FULL';
      }

      saveToStorage(STORAGE_KEY_TRIPS, trips);
      return { passenger: newPax, trip };
    },

    async deletePassenger(tripId, paxId) {
      try {
        const resp = await apiFetch(`/api/trips/${encodeURIComponent(tripId)}/passengers/${encodeURIComponent(paxId)}`, {
          method: 'DELETE'
        });
        if (resp.ok) {
          await syncWithServer();
          return true;
        }
      } catch (e) {}

      const trip = this.getTripById(tripId);
      if (!trip) return false;

      const idx = trip.passengers.findIndex(p => p.id === paxId);
      if (idx === -1) return false;

      trip.passengers.splice(idx, 1);
      if (trip.status === 'FULL' && trip.passengers.length < trip.maxCapacity) {
        trip.status = 'OPEN';
      }

      saveToStorage(STORAGE_KEY_TRIPS, trips);
      return true;
    },

    async toggleLifejacket(tripId, paxId) {
      try {
        const resp = await apiFetch(`/api/trips/${encodeURIComponent(tripId)}/passengers/${encodeURIComponent(paxId)}/toggle-jacket`, {
          method: 'POST'
        });
        if (resp.ok) {
          await syncWithServer();
          const t = this.getTripById(tripId);
          return t ? t.passengers.find(p => p.id === paxId) : null;
        }
      } catch (e) {}

      const trip = this.getTripById(tripId);
      if (!trip) return false;

      const pax = trip.passengers.find(p => p.id === paxId);
      if (!pax) return false;

      pax.lifejacket = !pax.lifejacket;
      saveToStorage(STORAGE_KEY_TRIPS, trips);
      return pax;
    },

    async getWeatherAdvisory(port = 'Jeti Kuala Besut') {
      try {
        const resp = await apiFetch(`/api/weather/advisory?port=${encodeURIComponent(port)}`);
        if (resp.ok) {
          return await resp.json();
        }
      } catch (e) {}
      return {
        success: true,
        advisory: {
          port,
          seaState: 'Tenang / Baik',
          seaStateEn: 'Calm / Smooth',
          waveHeight: '0.5m – 1.0m',
          windSpeed: '10 – 20 km/j',
          windDirection: 'Barat Daya (SW)',
          level: 'GREEN',
          clearanceStatus: 'PELEPASAN DIBENARKAN',
          clearanceStatusEn: 'DEPARTURE CLEARANCE GRANTED',
          advisoryNote: 'Keadaan laut mengizinkan pelayaran bot pelancong.',
          advisoryNoteEn: 'Sea conditions safe for passenger boat departure.'
        }
      };
    },

    async updateWeatherAdvisory(advisoryData) {
      try {
        const resp = await apiFetch('/api/weather/advisory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(advisoryData)
        });
        if (resp.ok) {
          return await resp.json();
        }
      } catch (e) {}
      return { success: false };
    },

    // Search
    searchPassengers(query) {
      if (!query || !query.trim()) {
        // Return recent passengers (up to 50)
        const results = [];
        for (const t of (trips || [])) {
          for (const p of (t.passengers || [])) {
            results.push({
              ...p,
              fullName: p.fullName || p.name || 'Penumpang',
              icOrPassport: p.icOrPassport || p.ic_passport || '-',
              shortAddress: p.shortAddress || p.short_address || '-',
              phone: p.phone || '-',
              tripId: t.id,
              boatName: t.boatName || t.boat_name || '-',
              destination: t.destination || '-'
            });
          }
        }
        return results.slice(0, 50);
      }

      const q = query.trim().toLowerCase();
      const cleanQ = q.replace(/[^a-z0-9]/gi, '');
      const results = [];

      for (const t of (trips || [])) {
        for (const p of (t.passengers || [])) {
          const fullName = (p.fullName || p.name || '').toLowerCase();
          const icOrPassport = (p.icOrPassport || p.ic_passport || '').toLowerCase();
          const shortAddress = (p.shortAddress || p.short_address || '').toLowerCase();
          const phone = (p.phone || '').toLowerCase();
          const tripId = (t.id || '').toLowerCase();
          const boatName = (t.boatName || t.boat_name || '').toLowerCase();
          const dest = (t.destination || '').toLowerCase();
          const cleanIc = icOrPassport.replace(/[^a-z0-9]/gi, '');
          const cleanPhone = phone.replace(/[^a-z0-9]/gi, '');

          if (
            fullName.includes(q) ||
            icOrPassport.includes(q) ||
            (cleanQ && cleanIc.includes(cleanQ)) ||
            shortAddress.includes(q) ||
            phone.includes(q) ||
            (cleanQ && cleanPhone.includes(cleanQ)) ||
            tripId.includes(q) ||
            boatName.includes(q) ||
            dest.includes(q)
          ) {
            results.push({
              ...p,
              fullName: p.fullName || p.name || 'Penumpang',
              icOrPassport: p.icOrPassport || p.ic_passport || '-',
              shortAddress: p.shortAddress || p.short_address || '-',
              phone: p.phone || '-',
              tripId: t.id,
              boatName: t.boatName || t.boat_name || '-',
              destination: t.destination || '-'
            });
          }
        }
      }

      return results;
    },

    // Admin Stats (Daily, Monthly, Fleet Total & Incident Log)
    getAdminStats() {
      let totalPax = 0;
      let totalCapacity = 0;

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthNamesMs = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

      function extractTripDate(t) {
        if (t.departureDate && String(t.departureDate).trim()) {
          return String(t.departureDate).trim();
        }
        if (t.departure_date && String(t.departure_date).trim()) {
          return String(t.departure_date).trim();
        }
        if (t.createdAt) {
          return String(t.createdAt).split('T')[0];
        }
        if (t.created_at) {
          return String(t.created_at).split('T')[0];
        }
        return todayStr;
      }

      let tripsToday = 0;
      let paxToday = 0;
      let tripsMonth = 0;
      let paxMonth = 0;

      const dailyMap = {};
      const monthlyMap = {};

      for (const t of trips) {
        const paxCount = t.passengers ? t.passengers.length : 0;
        const cap = t.maxCapacity || 12;
        totalPax += paxCount;
        totalCapacity += cap;

        const dateStr = extractTripDate(t);
        const monthStr = dateStr.substring(0, 7);

        if (dateStr === todayStr) {
          tripsToday++;
          paxToday += paxCount;
        }

        if (monthStr === currentMonthStr) {
          tripsMonth++;
          paxMonth += paxCount;
        }

        // Aggregate for Daily Incident Log
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = {
            date: dateStr,
            tripsCount: 0,
            paxCount: 0,
            vessels: [],
            trips: []
          };
        }
        dailyMap[dateStr].tripsCount++;
        dailyMap[dateStr].paxCount += paxCount;
        const boatName = t.boatName || t.boat_name || 'Bot';
        if (!dailyMap[dateStr].vessels.includes(boatName)) {
          dailyMap[dateStr].vessels.push(boatName);
        }
        dailyMap[dateStr].trips.push(t);

        // Aggregate for Monthly Incident Log
        if (!monthlyMap[monthStr]) {
          const [y, m] = monthStr.split('-');
          const mIdx = parseInt(m, 10) - 1;
          const labelEn = `${monthNamesEn[mIdx] || m} ${y}`;
          const labelMs = `${monthNamesMs[mIdx] || m} ${y}`;
          monthlyMap[monthStr] = {
            month: monthStr,
            year: y,
            monthNum: m,
            labelEn,
            labelMs,
            tripsCount: 0,
            paxCount: 0,
            vessels: [],
            trips: []
          };
        }
        monthlyMap[monthStr].tripsCount++;
        monthlyMap[monthStr].paxCount += paxCount;
        if (!monthlyMap[monthStr].vessels.includes(boatName)) {
          monthlyMap[monthStr].vessels.push(boatName);
        }
        monthlyMap[monthStr].trips.push(t);
      }

      const occupancyRate = totalCapacity > 0 ? Math.round((totalPax / totalCapacity) * 100) : 0;

      // Sort logs newest date first
      const dailyLog = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));
      const monthlyLog = Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month));

      return {
        totalTrips: trips.length,
        totalPax,
        tripsToday,
        paxToday,
        tripsMonth,
        paxMonth,
        todayStr,
        currentMonthStr,
        dailyLog,
        monthlyLog,
        complianceRate: '100%',
        occupancyRate: `${occupancyRate}%`
      };
    },

    getTripsByDate(dateStr) {
      if (!dateStr || dateStr === 'ALL') return trips;
      return trips.filter(t => {
        const d = t.departureDate || t.departure_date || (t.createdAt ? t.createdAt.split('T')[0] : '');
        return d === dateStr;
      });
    },

    getTripsByMonth(monthStr) {
      if (!monthStr || monthStr === 'ALL') return trips;
      return trips.filter(t => {
        const d = t.departureDate || t.departure_date || (t.createdAt ? t.createdAt.split('T')[0] : '');
        return d && d.startsWith(monthStr);
      });
    },

    // Synchronize with server (MySQL & SQLite)
    syncWithServer() {
      return syncWithServer();
    },

    // Resilient API fetch
    apiFetch(url, options) {
      return apiFetch(url, options);
    },

    // Reset
    async resetDemoData() {
      // 1. Clear cached passenger tickets from localStorage
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith('e_penumpang_saved_ticket_') ||
            key.startsWith('e_penumpang_inapp_ticket_') ||
            key === 'ep_last_selected_trip' ||
            key === 'e_penumpang_last_active_trip'
          )) {
            localStorage.removeItem(key);
          }
        }
      } catch (e) {}

      // 2. Call server reset endpoint (resets MySQL & SQLite)
      let serverResetDone = false;
      try {
        const resp = await apiFetch('/api/system/reset-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && Array.isArray(data.trips) && data.trips.length > 0) {
            trips = data.trips;
            serverResetDone = true;
          }
        }
      } catch (e) {
        console.warn('Server reset API call failed, using client fallback:', e);
      }

      // 3. Client fallback if server was offline
      if (!serverResetDone) {
        trips = JSON.parse(JSON.stringify(DEFAULT_TRIPS));
      }

      accounts = JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS));
      saveToStorage(STORAGE_KEY_TRIPS, trips);
      saveToStorage(STORAGE_KEY_ACCOUNTS, accounts);

      // 4. Synchronize accounts & trips
      await syncWithServer();
      return true;
    }
  };

  window.SMCStore = SMCStore;
})();

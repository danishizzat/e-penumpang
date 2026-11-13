// passenger.js - Passenger Registration Logic & Real-time Capacity Guard
let tripData = null;
let tripId = null;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  tripId = params.get('tripId') || params.get('trip');
  if (!tripId) {
    try {
      tripId = localStorage.getItem('e_penumpang_last_active_trip');
    } catch (e) {}
  }

  if (!tripId) {
    showError('Parameter Kod QR Tidak Lengkap', 'Pautan tidak mengandungi ID Trip yang sah. Sila imbas semula kod QR pada bot anda.');
    return;
  }

  // Check if passenger already has a saved valid ticket for this trip
  try {
    const savedTicketRaw = localStorage.getItem('e_penumpang_saved_ticket_' + tripId);
    if (savedTicketRaw) {
      const savedTicket = JSON.parse(savedTicketRaw);
      if (savedTicket && savedTicket.passenger && savedTicket.manifest) {
        tripData = savedTicket.manifest;
        showSuccessTicket(savedTicket.passenger, savedTicket.manifest, true);
        return;
      }
    }
  } catch (e) {}

  // Setup auto-formatting and calculation for MyKad / Passport
  setupIcPassportMasking();
  setupPhoneNumericOnly();

  loadTripStatus();
});

// Resilient API Fetch Helper: Tries /api/... and falls back to api.php?endpoint=...
async function apiFetch(url, options = {}) {
  try {
    const resp = await fetch(url, options);
    if (resp.status !== 404) return resp;
  } catch (e) {}

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

async function loadTripStatus() {
  try {
    let res = await apiFetch(`/api/trips/${encodeURIComponent(tripId)}/manifest`);
    if (!res || !res.ok) {
      // Check local storage fallback
      try {
        const localTripsRaw = localStorage.getItem('ep_smc_trips_v2');
        if (localTripsRaw) {
          const localTrips = JSON.parse(localTripsRaw);
          const found = localTrips.find(t => t.id === tripId);
          if (found) {
            renderPassengerView({
              trip: {
                id: found.id,
                boat_name: found.boatName,
                boat_reg_no: found.boatRegNo,
                driver_name: found.skipperName,
                origin: found.departureJetty || 'Jeti Kuala Besut',
                destination: found.destination
              },
              boatCapacity: found.maxCapacity || 12,
              passengerCount: (found.passengers || []).length,
              isFull: (found.passengers || []).length >= (found.maxCapacity || 12),
              isApproved: found.status === 'APPROVED' || found.status === 'COMPLETED'
            });
            return;
          }
        }
      } catch (e) {}

      if (res && res.status === 404) {
        showError('Trip Tidak Dijumpai', `Trip dengan ID [${tripId}] tidak ditemui dalam sistem e-PENUMPANG. Sila rujuk Tekong bot.`);
      } else {
        showError('Ralat Sambungan', 'Gagal memuat turun status trip. Sila cuba sebentar lagi.');
      }
      return;
    }

    const manifest = await res.json();
    tripData = manifest;
    renderPassengerView(manifest);
  } catch (err) {
    showError('Ralat Rangkaian', 'Tidak dapat menghubungi pelayan e-PENUMPANG: ' + err.message);
  }
}

function showError(title, message) {
  document.getElementById('pax-loading').style.display = 'none';
  document.getElementById('pax-main-content').style.display = 'none';
  const errBox = document.getElementById('pax-error-box');
  errBox.style.display = 'block';
  document.getElementById('pax-error-title').textContent = title;
  document.getElementById('pax-error-desc').textContent = message;
}

function renderPassengerView(manifest) {
  document.getElementById('pax-loading').style.display = 'none';
  document.getElementById('pax-error-box').style.display = 'none';
  document.getElementById('pax-main-content').style.display = 'block';

  const trip = manifest.trip;
  const paxCount = manifest.passengerCount;
  const maxPax = manifest.boatCapacity || 12; // Had penumpang adalah mengikut kapasiti bot
  const isFull = manifest.isFull;
  const isApproved = manifest.isApproved;

  // Banner details
  document.getElementById('pax-boat-name').textContent = trip.boat_name;
  document.getElementById('pax-boat-reg').textContent = trip.boat_reg_no;
  document.getElementById('pax-driver-name').textContent = trip.driver_name;
  document.getElementById('pax-origin').textContent = trip.origin;
  document.getElementById('pax-destination').textContent = trip.destination;

  const paxLabel = window.I18N && window.I18N.getLanguage() === 'en' ? 'Passengers (Boat Capacity)' : 'Penumpang (Kapasiti Bot)';
  document.getElementById('pax-seats-text').textContent = `${paxCount} / ${maxPax} ${paxLabel}`;

  // Visual seats representation
  const seatsContainer = document.getElementById('pax-seats-visual');
  seatsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0;';
  let seatsHtml = '';
  const occupiedText = window.I18N && window.I18N.getLanguage() === 'en' ? 'Occupied' : 'Terisi';
  const emptyText = window.I18N && window.I18N.getLanguage() === 'en' ? 'Available' : 'Kosong';
  const seatPrefix = window.I18N && window.I18N.getLanguage() === 'en' ? 'Seat' : 'Tempat';

  for (let i = 1; i <= maxPax; i++) {
    const isOccupied = i <= paxCount;
    seatsHtml += `
      <div class="seat-item ${isOccupied ? 'occupied' : ''}" style="min-width: 60px; font-size:0.75rem;">
        <div style="font-size: 1.1rem;">${isOccupied ? '&#129489;' : '&#9633;'}</div>
        <div>${seatPrefix} ${i}</div>
        <div style="font-size: 0.65rem; color:${isOccupied ? 'var(--marine-blue)' : 'var(--slate-400)'};">
          ${isOccupied ? occupiedText : emptyText}
        </div>
      </div>
    `;
  }
  seatsContainer.innerHTML = seatsHtml;

  // Capacity Alert Box
  const alertContainer = document.getElementById('pax-capacity-alert');
  const form = document.getElementById('form-passenger-reg');
  const submitBtn = document.getElementById('btn-submit-pax');
  const isEn = window.I18N && window.I18N.getLanguage() === 'en';

  if (trip.status === 'APPROVED_DEPARTED' || trip.status === 'COMPLETED') {
    alertContainer.innerHTML = `
      <div class="alert alert-warning" style="margin-bottom: 0;">
        <div style="font-size: 1.5rem;">&#128674;</div>
        <div>
          <strong>${isEn ? 'Registration Closed - Boat Departed!' : 'Pendaftaran Ditutup - Bot Telah Berlepas!'}</strong>
          <div style="font-size: 0.8rem; margin-top: 0.2rem;">
            ${isEn ? 'The captain has finalized the manifest and the boat is underway or completed.' : 'Tekong telah meluluskan manifes dan bot kini dalam pelayaran atau telah selesai.'}
          </div>
        </div>
      </div>
    `;
    disableForm(form, submitBtn, isEn ? 'Boat Departed' : 'Bot Telah Berlepas');
    return;
  }

  if (isFull) {
    alertContainer.innerHTML = `
      <div class="alert alert-danger" style="margin-bottom: 0;">
        <div style="font-size: 1.75rem;">&#10060;</div>
        <div>
          <strong style="font-size: 1rem;">${isEn ? `BOAT CAPACITY FULL (${maxPax}/${maxPax})` : `KAPASITI BOT PENUH (${maxPax}/${maxPax})`}</strong>
          <div style="font-size: 0.82rem; margin-top: 0.25rem;">
            ${isEn 
              ? `Sorry, the maximum licensed quota of <strong>${maxPax} passengers</strong> has been reached. No new registrations allowed. Please consult the boat captain or jetty officer.` 
              : `Maaf, kuota keselamatan maksimum <strong>${maxPax} orang penumpang</strong> bagi kapasiti bot ini telah lengkap. Pendaftaran baharu tidak lagi dibenarkan. Sila hubungi Tekong atau petugas jeti.`}
          </div>
        </div>
      </div>
    `;
    disableForm(form, submitBtn, isEn ? 'Boat Capacity Full' : 'Kapasiti Bot Penuh');
  } else {
    const slotsLeft = maxPax - paxCount;
    alertContainer.innerHTML = `
      <div class="alert alert-success" style="margin-bottom: 0;">
        <div style="font-size: 1.5rem;">&#9989;</div>
        <div>
          <strong style="font-size: 0.95rem;">${isEn ? `SEATS AVAILABLE (${paxCount}/${maxPax})` : `KAPASITI MASIH ADA (${paxCount}/${maxPax})`}</strong>
          <div style="font-size: 0.82rem; margin-top: 0.25rem;">
            ${isEn ? `There are <strong>${slotsLeft} seats available</strong>. Please complete the form below to register.` : `Terdapat <strong>${slotsLeft} tempat kosong</strong> lagi. Sila lengkapkan maklumat di bawah untuk pendaftaran.`}
          </div>
        </div>
      </div>
    `;
    enableForm(form, submitBtn);
  }
}

function disableForm(form, btn, reason) {
  const inputs = form.querySelectorAll('input');
  inputs.forEach(input => input.disabled = true);
  btn.disabled = true;
  btn.textContent = reason;
  btn.className = 'btn btn-secondary btn-lg';
}

function enableForm(form, btn) {
  const inputs = form.querySelectorAll('input');
  inputs.forEach(input => input.disabled = false);
  btn.disabled = false;
  btn.textContent = window.I18N && window.I18N.t ? window.I18N.t('btn_submit_pax', '✔ Submit Passenger Registration') : '✔ Hantar Pendaftaran Penumpang';
  btn.className = 'btn btn-primary btn-lg';
}

function setupIcPassportMasking() {
  const icInput = document.getElementById('reg-ic');
  const ageInput = document.getElementById('reg-age');
  const badge = document.getElementById('reg-id-type-badge');
  if (!icInput) return;

  icInput.addEventListener('input', () => {
    let raw = icInput.value.toUpperCase();
    const isEn = window.I18N && window.I18N.getLanguage() === 'en';

    // Check if input contains letters -> Passport mode
    const hasLetters = /[A-Z]/.test(raw);
    if (hasLetters) {
      if (badge) {
        badge.textContent = isEn ? 'Passport' : 'Pasport';
        badge.style.background = '#fef3c7';
        badge.style.color = '#92400e';
      }
      return; // Freeform passport input, no hyphen mask
    }

    // Otherwise numeric -> MyKad mode
    let digits = raw.replace(/\D/g, '').slice(0, 12);
    if (badge) {
      if (digits.length >= 6) {
        badge.textContent = 'MyKad';
        badge.style.background = '#e0f2fe';
        badge.style.color = '#0369a1';
      } else {
        badge.textContent = isEn ? 'MyKad / Passport' : 'MyKad / Pasport';
        badge.style.background = '#f1f5f9';
        badge.style.color = '#475569';
      }
    }

    // Auto format with hyphens: YYMMDD-PB-###G
    let formatted = '';
    if (digits.length <= 6) {
      formatted = digits;
    } else if (digits.length <= 8) {
      formatted = `${digits.slice(0, 6)}-${digits.slice(6)}`;
    } else {
      formatted = `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 12)}`;
    }

    icInput.value = formatted;

    // Auto-calculate age from MyKad (first 6 digits)
    if (digits.length >= 6 && ageInput) {
      const yy = parseInt(digits.substring(0, 2), 10);
      const currentYear = new Date().getFullYear();
      const currentYY = currentYear % 100;
      let birthYear = (yy <= currentYY) ? (2000 + yy) : (1900 + yy);
      let calculated = currentYear - birthYear;
      if (calculated >= 0 && calculated <= 120) {
        ageInput.value = calculated;
      }
    }
  });
}

function setupPhoneNumericOnly() {
  const phoneInputs = [
    document.getElementById('reg-phone'),
    document.getElementById('reg-emergency')
  ];

  phoneInputs.forEach(input => {
    if (!input) return;
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('pattern', '[0-9]*');
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '');
    });
    input.addEventListener('keypress', (e) => {
      if (!/[0-9]/.test(e.key) && e.key !== 'Enter') {
        e.preventDefault();
      }
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      const digits = text.replace(/\D/g, '');
      input.value = digits;
    });
  });
}

async function handlePassengerSubmit(event) {
  event.preventDefault();
  if (!tripId) return;

  const isEn = window.I18N && window.I18N.getLanguage() === 'en';
  const submitBtn = document.getElementById('btn-submit-pax');
  submitBtn.disabled = true;
  submitBtn.textContent = isEn ? 'Submitting Registration...' : 'Menghantar Pendaftaran...';

  const name = document.getElementById('reg-name').value.trim();
  const icPassport = document.getElementById('reg-ic').value.trim();
  const age = document.getElementById('reg-age') ? document.getElementById('reg-age').value.trim() : '';
  const shortAddress = document.getElementById('reg-address').value.trim();

  // Format international phone with country code
  const countryCodeSelect = document.getElementById('reg-country-code');
  const countryCode = countryCodeSelect ? countryCodeSelect.value : '+60';
  let rawPhone = document.getElementById('reg-phone').value.trim();
  rawPhone = rawPhone.replace(/\D/g, '');
  let fullPhone = rawPhone;
  if (countryCode !== 'other' && !rawPhone.startsWith('+')) {
    // Strip leading 0 if user typed e.g. 0123456789
    const cleanDigits = rawPhone.replace(/^0+/, '');
    fullPhone = `${countryCode}${cleanDigits}`;
  }

  let emergencyPhone = document.getElementById('reg-emergency') ? document.getElementById('reg-emergency').value.trim() : '';
  emergencyPhone = emergencyPhone.replace(/\D/g, '');

  try {
    const res = await apiFetch(`/api/trips/${encodeURIComponent(tripId)}/passengers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        icPassport,
        age,
        shortAddress,
        phone: fullPhone,
        emergencyPhone
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        const fullMsg = isEn 
          ? 'BOAT CAPACITY FULL: Vessel limit has just been reached by another passenger. Registration is closed for this trip.' 
          : 'KAPASITI PENUH: Kuota bot telah dipenuhi sebentar tadi oleh penumpang lain. Pendaftaran ditutup bagi trip ini.';
        alert(fullMsg);

        // Display prominent inline alert & disable form
        const alertContainer = document.getElementById('pax-capacity-alert');
        const form = document.getElementById('form-passenger-reg');
        if (alertContainer) {
          alertContainer.innerHTML = `
            <div class="alert alert-danger" style="margin-bottom: 0;">
              <div style="font-size: 1.75rem;">&#10060;</div>
              <div>
                <strong style="font-size: 1rem;">${isEn ? 'BOAT CAPACITY REACHED' : 'KAPASITI BOT TELAH PENUH'}</strong>
                <div style="font-size: 0.82rem; margin-top: 0.25rem;">
                  ${isEn 
                    ? 'The vessel has reached its maximum passenger capacity. Please consult the boat captain or jetty officer.' 
                    : 'Bot ini telah mencapai kuota kapasiti penumpang berlesen yang dibenarkan. Sila hubungi Tekong atau kaunter tiket jeti.'}
                </div>
              </div>
            </div>
          `;
          alertContainer.scrollIntoView({ behavior: 'smooth' });
        }
        if (form && submitBtn && typeof disableForm === 'function') {
          disableForm(form, submitBtn, isEn ? 'Boat Capacity Full' : 'Kapasiti Bot Penuh');
        }
        loadTripStatus();
        return;
      }
      alert((isEn ? 'Registration error: ' : 'Ralat pendaftaran: ') + (data.error || (isEn ? 'Failed' : 'Gagal')));
      submitBtn.disabled = false;
      submitBtn.textContent = isEn ? '✔ Submit Passenger Registration' : '✔ Hantar Pendaftaran Penumpang';
      return;
    }

    // Success! Show boarding pass
    showSuccessTicket(data.passenger, data.tripManifest);

  } catch (err) {
    alert((isEn ? 'Connection error: ' : 'Ralat sambungan: ') + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = isEn ? '✔ Submit Passenger Registration' : '✔ Hantar Pendaftaran Penumpang';
  }
}

function showSuccessTicket(passenger, manifest, isRestored = false) {
  if (!isRestored) {
    const ticketData = {
      passenger,
      manifest,
      tripId,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem('e_penumpang_saved_ticket_' + tripId, JSON.stringify(ticketData));
      localStorage.setItem('e_penumpang_last_active_trip', tripId);
    } catch (e) {}
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname + '?tripId=' + encodeURIComponent(tripId) + '&status=registered');
    }
  }

  document.getElementById('pax-loading').style.display = 'none';
  document.getElementById('pax-error-box').style.display = 'none';
  document.getElementById('pax-main-content').style.display = 'block';

  document.getElementById('form-passenger-reg').style.display = 'none';
  document.getElementById('pax-capacity-alert').style.display = 'none';
  const successCard = document.getElementById('pax-success-card');
  successCard.style.display = 'block';

  const pName = passenger.fullName || passenger.name || '-';
  const pIc = passenger.icOrPassport || passenger.ic_passport || '-';
  const bName = manifest.trip.boatName || manifest.trip.boat_name || '-';
  const bReg = manifest.trip.boatRegNo || manifest.trip.boat_reg_no || '';
  const origin = manifest.trip.origin || manifest.trip.departureJetty || 'Jeti';
  const destination = manifest.trip.destination || '-';

  document.getElementById('ticket-pax-name').textContent = pName;
  document.getElementById('ticket-pax-ic').textContent = pIc;
  document.getElementById('ticket-boat-name').textContent = `${bName} (${bReg})`;
  document.getElementById('ticket-destination').textContent = `${origin} → ${destination}`;
  
  // Find passenger order in manifest
  let seatNum = 1;
  if (manifest.passengers && Array.isArray(manifest.passengers)) {
    const seatIndex = manifest.passengers.findIndex(p => p.id === passenger.id || p.ic_passport === pIc || p.icOrPassport === pIc);
    seatNum = seatIndex >= 0 ? seatIndex + 1 : (manifest.passengerCount || manifest.passengers.length);
  }
  const boatCapacity = manifest.boatCapacity || manifest.maxCapacity || 12;
  const isEn = window.I18N && window.I18N.getLanguage() === 'en';
  document.getElementById('ticket-seat-no').textContent = isEn
    ? `Passenger #${seatNum} of licensed boat capacity (${boatCapacity} persons)`
    : `Penumpang #${seatNum} daripada had kapasiti bot (${boatCapacity} orang)`;

  // Render Personal Digital Boarding Pass QR Code
  const qrCanvas = document.getElementById('pax-ticket-qr-canvas');
  const tokenEl = document.getElementById('pax-ticket-qr-token');
  const tokenString = `${tripId} • SEAT #${seatNum}`;
  if (tokenEl) tokenEl.textContent = tokenString;

  if (qrCanvas && window.QRUtils) {
    const payload = `MCH:TRIP=${tripId}:SEAT=${seatNum}:PAX=${encodeURIComponent(pName)}:IC=${encodeURIComponent(pIc)}`;
    window.QRUtils.renderToCanvas(qrCanvas, payload, { size: 140, padding: 4 });
  }

  setupTicketButtons(passenger, manifest);

  if (!isRestored) {
    successCard.scrollIntoView({ behavior: 'smooth' });
  }
}

function setupTicketButtons(passenger, manifest) {
  const btnSaveQr = document.getElementById('btn-pax-save-qr');
  if (btnSaveQr) {
    btnSaveQr.onclick = () => {
      if (window.QRUtils && window.QRUtils.downloadBoardingPassPNG) {
        const pName = passenger ? (passenger.fullName || passenger.name) : (document.getElementById('ticket-pax-name').textContent || 'Penumpang');
        const pIc = passenger ? (passenger.icOrPassport || passenger.ic_passport) : (document.getElementById('ticket-pax-ic').textContent || '-');
        const pNameClean = (pName || 'Penumpang').replace(/[^a-zA-Z0-9]/g, '_');
        const bName = (manifest && manifest.trip) ? (manifest.trip.boatName || manifest.trip.boat_name) : (document.getElementById('pax-boat-name').textContent || '-');
        const bReg = (manifest && manifest.trip) ? (manifest.trip.boatRegNo || manifest.trip.boat_reg_no) : (document.getElementById('pax-boat-reg').textContent || '');
        const origin = (manifest && manifest.trip) ? (manifest.trip.origin || manifest.trip.departureJetty) : (document.getElementById('pax-origin').textContent || 'Jeti');
        const destination = (manifest && manifest.trip) ? manifest.trip.destination : (document.getElementById('pax-destination').textContent || '-');
        
        let seatNum = 1;
        if (manifest && manifest.passengers && Array.isArray(manifest.passengers)) {
          const seatIndex = manifest.passengers.findIndex(p => p.id === (passenger && passenger.id) || p.ic_passport === pIc || p.icOrPassport === pIc);
          seatNum = seatIndex >= 0 ? seatIndex + 1 : (manifest.passengerCount || manifest.passengers.length || 1);
        }
        const boatCap = (manifest && (manifest.boatCapacity || manifest.maxCapacity)) || 12;
        const isEn = window.I18N && window.I18N.getLanguage() === 'en';

        window.QRUtils.downloadBoardingPassPNG({
          passengerName: pName,
          icOrPassport: pIc,
          boatName: bName,
          boatRegNo: bReg,
          origin,
          destination,
          seatNumber: seatNum,
          boatCapacity: boatCap,
          tripId,
          isEn
        }, `Pas_Pelepasan_${tripId}_${pNameClean}.png`);
      } else {
        window.print();
      }
    };
  }
  const btnAnother = document.getElementById('btn-pax-register-another');
  if (btnAnother) {
    btnAnother.onclick = () => {
      try {
        localStorage.removeItem('e_penumpang_saved_ticket_' + tripId);
      } catch (e) {}
      document.getElementById('form-passenger-reg').reset();
      document.getElementById('pax-success-card').style.display = 'none';
      document.getElementById('form-passenger-reg').style.display = 'block';
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname + '?tripId=' + encodeURIComponent(tripId));
      }
      loadTripStatus();
    };
  }

  const btnFinish = document.getElementById('btn-pax-finish');
  if (btnFinish) {
    btnFinish.onclick = () => {
      try {
        localStorage.removeItem('e_penumpang_saved_ticket_' + tripId);
        localStorage.removeItem('e_penumpang_last_active_trip');
      } catch (e) {}
      const homeUrl = window.location.pathname.includes('/e-penumpang') ? '/e-penumpang/' : '/';
      window.location.href = homeUrl;
    };
  }
}

// React immediately when language switcher is clicked
window.addEventListener('languageChanged', () => {
  const successCard = document.getElementById('pax-success-card');
  if (successCard && successCard.style.display !== 'none') {
    try {
      const savedTicketRaw = localStorage.getItem('e_penumpang_saved_ticket_' + tripId);
      if (savedTicketRaw) {
        const saved = JSON.parse(savedTicketRaw);
        if (saved && saved.passenger && saved.manifest) {
          showSuccessTicket(saved.passenger, saved.manifest, true);
          return;
        }
      }
    } catch (e) {}
  }
  if (tripData) {
    renderPassengerView(tripData);
  }
});


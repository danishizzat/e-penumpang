// js/manifest-export.js - Official SMC Manifest Printing & CSV Export
(function() {
  function calculateAge(icOrPassport) {
    if (!icOrPassport) return '-';
    const clean = String(icOrPassport).replace(/[^0-9]/g, '');
    if (clean.length >= 6) {
      const yy = parseInt(clean.substring(0, 2), 10);
      const currentYear = new Date().getFullYear();
      const currentYY = currentYear % 100;
      let birthYear = (yy <= currentYY) ? (2000 + yy) : (1900 + yy);
      let age = currentYear - birthYear;
      if (age >= 0 && age <= 120) {
        return age;
      }
    }
    return '-';
  }

  function printTripManifest(manifest) {
    if (!manifest) return;
    const trip = manifest.trip || manifest;
    const tripId = trip ? (trip.id || trip.tripId) : null;
    if (tripId) {
      window.open('/manifest-print.html?tripId=' + encodeURIComponent(tripId) + '&print=true', '_blank');
      return;
    }

    const printSection = document.getElementById('manifest-print-section');
    if (!printSection) return;
    const boatCapacity = manifest.boatCapacity || trip.boat_capacity || 12;
    const totalRows = Math.max(boatCapacity, 15);
    const passengers = manifest.passengers || [];

    let paxRows = '';
    for (let i = 0; i < totalRows; i++) {
      const p = passengers[i];
      if (p) {
        const pName = p.fullName || p.name || '';
        const pIc = p.icOrPassport || p.ic_passport || '';
        const pAge = (p.age !== undefined && p.age !== null && p.age !== '') ? p.age : calculateAge(pIc);
        const pPhone = p.phone || '';
        const pLoc = p.shortAddress || p.short_address || p.state_country || '-';

        paxRows += `
          <tr>
            <td style="text-align: center; font-weight: bold; border: 1px solid #000; padding: 3px 4px;">${i + 1}</td>
            <td style="font-weight: bold; border: 1px solid #000; padding: 3px 4px;">${escapeHtml(pName)}</td>
            <td style="text-align: center; border: 1px solid #000; padding: 3px 4px;">${escapeHtml(pIc)}</td>
            <td style="text-align: center; border: 1px solid #000; padding: 3px 4px;">${pAge}</td>
            <td style="text-align: center; border: 1px solid #000; padding: 3px 4px;">${escapeHtml(pPhone)}</td>
            <td style="border: 1px solid #000; padding: 3px 4px;">${escapeHtml(pLoc)}</td>
          </tr>
        `;
      } else {
        paxRows += `
          <tr>
            <td style="text-align: center; color: #94a3b8; border: 1px solid #000; padding: 3px 4px; height: 19px;">${i + 1}</td>
            <td style="border: 1px solid #000;"></td>
            <td style="border: 1px solid #000;"></td>
            <td style="border: 1px solid #000;"></td>
            <td style="border: 1px solid #000;"></td>
            <td style="border: 1px solid #000;"></td>
          </tr>
        `;
      }
    }

    const boatInfo = (trip.boatRegNo || trip.boat_reg_no || '-') + ((trip.boatName || trip.boat_name) ? ' (' + (trip.boatName || trip.boat_name) + ')' : '');
    const depDate = trip.departureDate || trip.departure_date || '-';
    const depTime = trip.departureTime || trip.departure_time || '-';
    const origin = trip.departureJetty || trip.origin || '-';
    const rawNakhodaName = trip.driver_name || trip.skipper_name || (manifest.drivers && manifest.drivers[0] && manifest.drivers[0].name) || '-';
    const nakhodaName = String(rawNakhodaName || '').replace(/^(Nakhoda|Kapten|Capt\.?|Skipper|Encik|En\.?|Tuan)\s+/i, '').trim() || rawNakhodaName;
    const currentUser = window.SMCStore ? window.SMCStore.getSession() : null;
    const nakhodaIc = (manifest.drivers && manifest.drivers[0] && manifest.drivers[0].ic_passport && manifest.drivers[0].ic_passport !== '-')
      ? manifest.drivers[0].ic_passport
      : (trip.driver_ic || trip.skipperIc || (currentUser && currentUser.ic_passport) || '-');
    const rawNakhodaSid = (manifest.drivers && manifest.drivers[0] && manifest.drivers[0].license_no && manifest.drivers[0].license_no !== '-')
      ? manifest.drivers[0].license_no
      : (trip.driver_license || trip.skipperLicense || (currentUser && currentUser.licenseNo) || '202523023697');
    const nakhodaSid = String(rawNakhodaSid || '').replace(/^SID\s*no\.?\s*/i, '').trim();

    const crewMembers = (trip.crew && Array.isArray(trip.crew) && trip.crew.length > 0)
      ? trip.crew
      : (trip.crew_list ? trip.crew_list.split(',').map(c => ({ name: c.trim(), role: 'Awak-awak / Deckhand', ic_passport: '-' })).filter(c => c.name)
      : (trip.crewList ? trip.crewList.split(',').map(c => ({ name: c.trim(), role: 'Awak-awak / Deckhand', ic_passport: '-' })).filter(c => c.name) : []));

    let crewBlockHtml = '';
    if (crewMembers.length > 0) {
      crewBlockHtml = `
        <div style="flex: 1; max-width: 480px; text-align: left; font-size: 10.5px; line-height: 1.45; color: #1e293b;">
          <div style="font-weight: bold; font-size: 11px; margin-bottom: 3px;">Kru Pembantu Bertugas:</div>
          ${crewMembers.map((c, idx) => `<div>${idx + 1}. <strong>${escapeHtml(c.name)}</strong> ${c.ic_passport && c.ic_passport !== '-' ? '(' + escapeHtml(c.ic_passport) + ')' : ''} &bull; <em>${escapeHtml(c.role || 'Awak-awak')}</em></div>`).join('')}
        </div>
      `;
    } else {
      crewBlockHtml = `
        <div style="flex: 1; max-width: 480px; text-align: left; font-size: 10.5px; line-height: 1.45; color: #64748b; font-style: italic;">
          <div style="font-weight: bold; font-size: 11px; margin-bottom: 3px; font-style: normal; color: #1e293b;">Kru Pembantu Bertugas:</div>
          <div>Tiada kru tambahan didaftarkan (Operasi Solo).</div>
        </div>
      `;
    }

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #000000; max-width: 820px; margin: 0 auto; padding: 10mm 14mm 10mm 14mm; box-sizing: border-box; background: #fff;">
        
        <!-- Top Header with Logo & LAMPIRAN A -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <img src="data:image/png;base64,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" alt="MarineCareerHub Logo" style="height: 60px; max-height: 60px; width: auto; object-fit: contain; display: block;">
          </div>
          <div style="font-size: 14px; font-weight: bold; letter-spacing: 0.5px; color: #1e293b;">
            LAMPIRAN A
          </div>
        </div>

        <!-- Centered Title -->
        <div style="text-align: center; margin-bottom: 10px;">
          <div style="font-size: 16px; font-weight: bold; text-decoration: underline; letter-spacing: 0.5px; margin-bottom: 3px;">
            SENARAI NAMA PENUMPANG
          </div>
          <div style="font-size: 13px; font-weight: bold; text-decoration: underline; font-style: italic; letter-spacing: 0.5px; color: #334155;">
            PASSENGER MANIFEST
          </div>
        </div>

        <!-- Meta Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          <tr>
            <td style="width: 25%; font-weight: bold; border: 1px solid #000; padding: 3px 6px; font-size: 11.5px; line-height: 1.35;">
              No. Lesen Bot<br><span style="font-style: italic; font-weight: normal; font-size: 10.5px;">Boat Licensing Number</span>
            </td>
            <td colspan="3" style="font-weight: bold; font-size: 12.5px; border: 1px solid #000; padding: 3px 6px;">
              ${escapeHtml(boatInfo)}
            </td>
          </tr>
          <tr>
            <td style="width: 25%; font-weight: bold; border: 1px solid #000; padding: 3px 6px; font-size: 11.5px; line-height: 1.35;">
              Tarikh<br><span style="font-style: italic; font-weight: normal; font-size: 10.5px;">Date</span>
            </td>
            <td style="width: 25%; font-weight: bold; border: 1px solid #000; padding: 3px 6px; font-size: 11.5px;">
              ${escapeHtml(depDate)}
            </td>
            <td style="width: 25%; font-weight: bold; border: 1px solid #000; padding: 3px 6px; font-size: 11.5px; line-height: 1.35;">
              Masa Berlepas<br><span style="font-style: italic; font-weight: normal; font-size: 10.5px;">Time of Departure</span>
            </td>
            <td style="width: 25%; font-weight: bold; border: 1px solid #000; padding: 3px 6px; font-size: 11.5px;">
              ${escapeHtml(depTime)}
            </td>
          </tr>
          <tr>
            <td style="width: 25%; font-weight: bold; border: 1px solid #000; padding: 3px 6px; font-size: 11.5px; line-height: 1.35;">
              Laluan<br><span style="font-style: italic; font-weight: normal; font-size: 10.5px;">Route</span>
            </td>
            <td colspan="3" style="font-weight: bold; border: 1px solid #000; padding: 3px 6px; font-size: 11.5px;">
              <span>Dari / <span style="font-style: italic; font-weight: normal;">From</span>: ${escapeHtml(origin)}</span>
              <span style="display: inline-block; width: 40px;"></span>
              <span>Ke / <span style="font-style: italic; font-weight: normal;">To</span>: ${escapeHtml(destination)}</span>
            </td>
          </tr>
        </table>

        <!-- Main 6-column Passenger Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          <thead>
            <tr>
              <th style="width: 38px; border: 1px solid #000; padding: 3px 4px; font-size: 11px; font-weight: 900; text-align: center; background: #fff;">
                BIL<br><span style="font-weight: normal; font-style: italic;">(No)</span>
              </th>
              <th style="border: 1px solid #000; padding: 3px 4px; font-size: 11px; font-weight: 900; text-align: center; background: #fff;">
                NAMA<br><span style="font-weight: normal; font-style: italic;">(Name)</span>
              </th>
              <th style="width: 140px; border: 1px solid #000; padding: 3px 4px; font-size: 11px; font-weight: 900; text-align: center; background: #fff;">
                NO. KAD PENGENALAN<br><span style="font-weight: normal; font-style: italic;">(Identity/Passport)</span>
              </th>
              <th style="width: 55px; border: 1px solid #000; padding: 3px 4px; font-size: 11px; font-weight: 900; text-align: center; background: #fff;">
                UMUR<br><span style="font-weight: normal; font-style: italic;">(Age)</span>
              </th>
              <th style="width: 110px; border: 1px solid #000; padding: 3px 4px; font-size: 11px; font-weight: 900; text-align: center; background: #fff;">
                NO. TELEFON<br><span style="font-weight: normal; font-style: italic;">(Phone No.)</span>
              </th>
              <th style="width: 130px; border: 1px solid #000; padding: 3px 4px; font-size: 11px; font-weight: 900; text-align: center; background: #fff;">
                NEGARA / NEGERI<br><span style="font-weight: normal; font-style: italic;">(State/Country)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            ${paxRows}
          </tbody>
        </table>

        <!-- Declaration -->
        <div style="font-size: 11.5px; line-height: 1.5; margin-top: 6px; margin-bottom: 6px;">
          Saya sebagai Nakhoda mengesahkan butiran penumpang yang dibawa oleh saya untuk pelayaran yang dinyatakan diatas.
        </div>

        <!-- Signature & Assisting Crew Block -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 6px; gap: 16px;">
          ${crewBlockHtml}
          <div style="width: 250px; font-size: 11.5px; line-height: 1.6; flex-shrink: 0;">
            <div>......................................................................</div>
            <div style="font-weight: bold; margin-top: 2px;">Tandatangan <span style="font-weight: normal; font-style: italic; font-size: 9.5px; color: #475569;">(Signature)</span></div>
            <div style="margin-top: 6px;">Nama: <strong>${escapeHtml(nakhodaName)}</strong></div>
            <div>No Kad Pengenalan: <strong>${escapeHtml(nakhodaIc)}</strong></div>
            <div>No. Dokumen Pelaut (SID): <strong>${escapeHtml(nakhodaSid)}</strong></div>
          </div>
        </div>

        <!-- Discreet Footer -->
        <div style="margin-top: 10px; border-top: 1px dashed #94a3b8; padding-top: 10px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
          <div>Sistem e-PENUMPANG &bull; MarineCareerHub | Kod Manifes: <strong>${escapeHtml(trip.id)}</strong></div>
          <div>Status: <strong>${trip.status}</strong> | Dicetak: ${new Date().toLocaleString('ms-MY')}</div>
        </div>

      </div>
    `;

    printSection.innerHTML = html;
    
    // Ensure image is pre-rendered before calling window.print()
    const img = printSection.querySelector('img');
    const triggerPrint = () => {
      setTimeout(() => {
        window.addEventListener('afterprint', () => {
          printSection.innerHTML = '';
        }, { once: true });
        window.print();
      }, 100);
    };

    if (img && typeof img.decode === 'function') {
      img.decode().then(triggerPrint).catch(triggerPrint);
    } else if (img && !img.complete) {
      img.onload = triggerPrint;
      img.onerror = triggerPrint;
      setTimeout(triggerPrint, 300);
    } else {
      triggerPrint();
    }
  }

  function exportTripCSV(manifest) {
    if (!manifest) return;
    const trip = manifest.trip;
    const passengers = manifest.passengers || [];

    const headers = ['BIL (No)', 'NAMA (Name)', 'NO. KAD PENGENALAN (Identity/Passport)', 'UMUR (Age)', 'NO. TELEFON (Phone No.)', 'NEGARA / NEGERI (State/Country)', 'KOD MANIFES', 'NO. LESEN BOT', 'TARIKH', 'MASA BERLEPAS', 'DARI', 'KE', 'NAKHODA'];
    const rows = passengers.map((p, idx) => {
      const pName = p.fullName || p.name || '';
      const pIc = p.icOrPassport || p.ic_passport || '';
      const pAge = (p.age !== undefined && p.age !== null && p.age !== '') ? p.age : calculateAge(pIc);
      const pPhone = p.phone || '';
      const pLoc = p.shortAddress || p.short_address || p.state_country || '-';

      return [
        idx + 1,
        `"${pName.replace(/"/g, '""')}"`,
        `"${pIc.replace(/"/g, '""')}"`,
        `"${pAge}"`,
        `"${pPhone.replace(/"/g, '""')}"`,
        `"${pLoc.replace(/"/g, '""')}"`,
        `"${trip.id}"`,
        `"${(trip.boatRegNo || trip.boat_reg_no || '').replace(/"/g, '""')}"`,
        `"${trip.departureDate || trip.departure_date || ''}"`,
        `"${trip.departureTime || trip.departure_time || ''}"`,
        `"${(trip.departureJetty || trip.origin || '').replace(/"/g, '""')}"`,
        `"${(trip.destination || '').replace(/"/g, '""')}"`,
        `"${(trip.driver_name || trip.skipper_name || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `LAMPIRAN_A_Manifes_${trip.id}_${(trip.boatName || trip.boat_name || 'Bot').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportAllTripsCSV(trips, customFilename) {
    if (!trips || !Array.isArray(trips) || trips.length === 0) {
      alert(window.I18N && window.I18N.getLanguage() === 'en' ? 'No trip records to export.' : 'Tiada rekod trip untuk dieksport.');
      return;
    }

    const headers = ['BIL (No)', 'KOD TRIP (Trip ID)', 'BOT (Boat Name)', 'NO. PENDAFTARAN BOT (Boat Reg)', 'DESTINASI (Destination)', 'JETI (Departure Jetty)', 'TARIKH (Date)', 'MASA BERLEPAS (Time)', 'STATUS TRIP', 'NAKHODA (Captain)', 'SID NAKHODA', 'NAMA PENUMPANG (Passenger Name)', 'NO. KP / PASPORT (IC/Passport)', 'UMUR (Age)', 'NO. TELEFON (Phone)', 'ALAMAT / NEGERI (Origin/Address)', 'JAKET KESELAMATAN (Lifejacket)', 'WAKTU DAFTAR (Registered Time)'];

    const rows = [];
    let rowNum = 1;

    trips.forEach(t => {
      const passengers = t.passengers && Array.isArray(t.passengers) ? t.passengers : [];
      if (passengers.length === 0) {
        rows.push([
          rowNum++,
          `"${t.id}"`,
          `"${(t.boatName || t.boat_name || '').replace(/"/g, '""')}"`,
          `"${(t.boatRegNo || t.boat_reg_no || '').replace(/"/g, '""')}"`,
          `"${(t.destination || '').replace(/"/g, '""')}"`,
          `"${(t.departureJetty || t.origin || '').replace(/"/g, '""')}"`,
          `"${t.departureDate || t.departure_date || ''}"`,
          `"${t.departureTime || t.departure_time || ''}"`,
          `"${t.status || 'OPEN'}"`,
          `"${(t.skipperName || t.driver_name || '').replace(/"/g, '""')}"`,
          `"${(t.skipperLicense || '').replace(/"/g, '""')}"`,
          `"-"`, `"-"`, `"-"`, `"-"`, `"-"`, `"-"`, `"-"`
        ]);
      } else {
        passengers.forEach(p => {
          const pName = p.fullName || p.name || '';
          const pIc = p.icOrPassport || p.ic_passport || '';
          const pAge = (p.age !== undefined && p.age !== null && p.age !== '') ? p.age : calculateAge(pIc);
          const pPhone = p.phone || '';
          const pLoc = p.shortAddress || p.short_address || p.state_country || '-';
          const pJacket = p.lifejacket !== false ? 'YA / YES' : 'TIDAK / NO';
          const pTime = p.registeredAt ? new Date(p.registeredAt).toLocaleString() : '-';

          rows.push([
            rowNum++,
            `"${t.id}"`,
            `"${(t.boatName || t.boat_name || '').replace(/"/g, '""')}"`,
            `"${(t.boatRegNo || t.boat_reg_no || '').replace(/"/g, '""')}"`,
            `"${(t.destination || '').replace(/"/g, '""')}"`,
            `"${(t.departureJetty || t.origin || '').replace(/"/g, '""')}"`,
            `"${t.departureDate || t.departure_date || ''}"`,
            `"${t.departureTime || t.departure_time || ''}"`,
            `"${t.status || 'OPEN'}"`,
            `"${(t.skipperName || t.driver_name || '').replace(/"/g, '""')}"`,
            `"${(t.skipperLicense || '').replace(/"/g, '""')}"`,
            `"${pName.replace(/"/g, '""')}"`,
            `"${pIc.replace(/"/g, '""')}"`,
            `"${pAge}"`,
            `"${pPhone.replace(/"/g, '""')}"`,
            `"${pLoc.replace(/"/g, '""')}"`,
            `"${pJacket}"`,
            `"${pTime}"`
          ]);
        });
      }
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const today = new Date().toISOString().split('T')[0];
    const finalFilename = customFilename || `SMC_Audit_Manifes_Armada_${today}.csv`;
    link.setAttribute('download', finalFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.ManifestExport = {
    print: printTripManifest,
    exportCSV: exportTripCSV,
    exportAllTripsCSV: exportAllTripsCSV
  };
})();

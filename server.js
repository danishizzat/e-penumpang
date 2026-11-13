// server.js - e-PENUMPANG HTTP REST Server & Static File Host
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const db = require('./db.js');
const mysqlDriver = require('./mysql_driver.js');
const qrcode = require('./public/vendor/qrcode.min.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// Server-Sent Events (SSE) Pool for Instant Live Sync
const sseClients = new Set();

function broadcastLiveEvent(eventType, payload = {}) {
  const data = JSON.stringify({
    type: eventType,
    payload,
    timestamp: new Date().toISOString()
  });
  const message = `data: ${data}\n\n`;
  for (const client of sseClients) {
    try {
      if (client.writable && !client.destroyed) {
        client.write(message);
      } else {
        sseClients.delete(client);
      }
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Keep-alive heartbeat every 15 seconds to prevent proxy/browser timeout and clean stale sockets
setInterval(() => {
  for (const client of sseClients) {
    try {
      if (client.writable && !client.destroyed) {
        client.write(': keepalive\n\n');
      } else {
        sseClients.delete(client);
      }
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 15000);

// Maritime Sea State & Port Weather Advisory Store (Jabatan Laut Malaysia & METMalaysia)
let maritimeAdvisories = {
  'Jeti Kuala Besut': {
    port: 'Jeti Kuala Besut',
    seaState: 'Tenang / Baik',
    seaStateEn: 'Calm / Smooth',
    waveHeight: '0.5m – 1.0m',
    windSpeed: '10 – 20 km/j',
    windDirection: 'Barat Daya (SW)',
    level: 'GREEN', // 'GREEN' | 'YELLOW' | 'RED'
    clearanceStatus: 'PELEPASAN DIBENARKAN',
    clearanceStatusEn: 'DEPARTURE CLEARANCE GRANTED',
    advisoryNote: 'Keadaan laut mengizinkan pelayaran bot pelancong ke Pulau Perhentian.',
    advisoryNoteEn: 'Sea conditions safe for passenger boat departure to Perhentian Island.',
    source: 'Jabatan Laut Malaysia & METMalaysia',
    updatedAt: new Date().toISOString()
  },
  'Jeti Merang': {
    port: 'Jeti Merang',
    seaState: 'Tenang / Baik',
    seaStateEn: 'Calm / Smooth',
    waveHeight: '0.6m – 1.2m',
    windSpeed: '12 – 22 km/j',
    windDirection: 'Barat Daya (SW)',
    level: 'GREEN',
    clearanceStatus: 'PELEPASAN DIBENARKAN',
    clearanceStatusEn: 'DEPARTURE CLEARANCE GRANTED',
    advisoryNote: 'Laluan pelayaran ke Pulau Redang selamat.',
    advisoryNoteEn: 'Sea conditions safe for passenger boat departure to Redang Island.',
    source: 'Jabatan Laut Malaysia & METMalaysia',
    updatedAt: new Date().toISOString()
  },
  'Jeti Mersing': {
    port: 'Jeti Mersing',
    seaState: 'Sederhana Berombak',
    seaStateEn: 'Moderate Waves',
    waveHeight: '1.0m – 1.5m',
    windSpeed: '18 – 28 km/j',
    windDirection: 'Tenggara (SE)',
    level: 'GREEN',
    clearanceStatus: 'PELEPASAN DIBENARKAN',
    clearanceStatusEn: 'DEPARTURE CLEARANCE GRANTED',
    advisoryNote: 'Pelepasan ke Pulau Tioman mengikut jadual air pasang surut.',
    advisoryNoteEn: 'Departure to Tioman Island proceeding per tidal schedule.',
    source: 'Jabatan Laut Malaysia & METMalaysia',
    updatedAt: new Date().toISOString()
  }
};

// Helper to parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Protect against oversized payload
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// JSON response helper
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

// Static file server
function serveStatic(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      console.error('[Static Stream Error]:', streamErr);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
      } else {
        try { res.destroy(); } catch (e) {}
      }
    });
    stream.pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS Headers for flexible access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // -------------------------------------------------------------
    // API ROUTES
    // -------------------------------------------------------------

    // Real-Time Live Sync: Server-Sent Events (SSE) Stream
    if (method === 'GET' && pathname === '/api/live-events') {
      // Prevent HTTP/1.1 socket exhaustion (Chrome limit 6 per host) by pruning excess streams from the same client
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
      let activeForIp = 0;
      for (const client of sseClients) {
        if (client._clientIp === clientIp) {
          activeForIp++;
          if (activeForIp >= 2) {
            try {
              client.write(`data: ${JSON.stringify({ type: 'CYCLE' })}\n\n`);
              client.end();
            } catch (e) {}
            sseClients.delete(client);
          }
        }
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res._clientIp = clientIp;
      res._connectedAt = Date.now();
      res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clients: sseClients.size + 1, timestamp: new Date().toISOString() })}\n\n`);
      sseClients.add(res);

      let isCleanedUp = false;
      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        sseClients.delete(res);
        try { res.end(); } catch (e) {}
        try { if (req.socket && !req.socket.destroyed) req.socket.destroy(); } catch (e) {}
      };

      req.on('close', cleanup);
      req.on('error', cleanup);
      res.on('close', cleanup);
      res.on('error', cleanup);
      res.on('finish', cleanup);

      // Gracefully cycle stream after 60 seconds so sockets recycle cleanly
      const cycleTimer = setTimeout(() => {
        if (!isCleanedUp) {
          try {
            res.write(`data: ${JSON.stringify({ type: 'CYCLE', timestamp: new Date().toISOString() })}\n\n`);
          } catch (e) {}
          cleanup();
        }
      }, 60000);

      req.on('close', () => clearTimeout(cycleTimer));
      return;
    }

    // Auth: Login
    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await parseJsonBody(req);
      const identifier = (body.id || body.username || body.email || body.identifier || body.name || '').trim();
      const password = body.password || '';

      if (!identifier || !password) {
        return sendJson(res, 400, { error: 'Sila masukkan ID Pengguna / Nama dan Kata Laluan.' });
      }

      const user = await db.validateLoginAsync(identifier, password);
      if (!user) {
        return sendJson(res, 401, {
          error: 'ID/Emel atau kata laluan tidak sah. Sila semak ID atau Nama Penuh berdaftar anda.'
        });
      }

      return sendJson(res, 200, { success: true, user });
    }

    // Auth: Register (Tekong / Admin) - Directly saves into MySQL & SQLite
    if (method === 'POST' && pathname === '/api/auth/register') {
      const body = await parseJsonBody(req);
      const {
        role,
        fullName,
        name,
        password,
        phone,
        licenseNo,
        license_no,
        ic_passport,
        icPassport,
        regIcPassport,
        boat_type,
        boatType,
        regBoatType,
        boatName,
        boat_default_name,
        boatRegNo,
        boat_default_reg,
        boatCapacity,
        boat_default_capacity,
        port,
        email,
        agencyKey
      } = body;

      const cleanName = (name || fullName || '').trim();
      if (!cleanName) {
        return sendJson(res, 400, { error: 'Sila masukkan Nama Penuh untuk pendaftaran akaun.' });
      }

      if (!password) {
        return sendJson(res, 400, { error: 'Sila cipta kata laluan.' });
      }

      const cleanRole = (role || 'TEKONG').toString().toUpperCase();
      const validAgencyKey = process.env.MCH_AGENCY_KEY || process.env.SMC_AGENCY_KEY || 'MCH2026';
      if (cleanRole === 'ADMIN' && agencyKey !== validAgencyKey && agencyKey !== 'MCH2026' && agencyKey !== 'SMC2026') {
        return sendJson(res, 403, { error: 'Kod Keselamatan Agensi MCH tidak sah! Sila gunakan MCH2026.' });
      }

      try {
        const result = await db.registerUser({
          role: cleanRole === 'ADMIN' ? 'admin' : 'driver',
          name: cleanName,
          password,
          phone,
          licenseNo: licenseNo || license_no,
          ic_passport: ic_passport || icPassport || regIcPassport || null,
          boat_type: boat_type || boatType || regBoatType || 'mini_speedboat',
          boatName: boatName || boat_default_name,
          boatRegNo: boatRegNo || boat_default_reg,
          boatCapacity: boatCapacity || boat_default_capacity,
          port,
          email,
          source: 'web_register'
        });

        broadcastLiveEvent('USER_REGISTERED', { user: result.user });

        return sendJson(res, 201, {
          success: true,
          message: `Akaun berjaya didaftarkan dan disimpan ke dalam pangkalan data ${result.database}!`,
          user: result.user,
          mysqlSaved: result.mysqlSaved,
          database: result.database
        });
      } catch (regErr) {
        return sendJson(res, 400, { error: regErr.message });
      }
    }

    // Auth: List all registered accounts (from MySQL / SQLite)
    if (method === 'GET' && pathname === '/api/auth/accounts') {
      const users = db.listAllUsers();
      return sendJson(res, 200, { users });
    }

    // Auth: List demo accounts
    if (method === 'GET' && pathname === '/api/auth/demo-accounts') {
      const drivers = db.listDrivers();
      const admin = db.getUserById('ADMIN-MCH-001') || db.getUserById('ADMIN-SMC-001') || db.getUserById('admin');
      return sendJson(res, 200, { drivers, admin });
    }

    // Auth: MarineCareerHub Registry Verification Simulation
    if (method === 'GET' && pathname === '/api/auth/marinecareerhub/lookup') {
      const mchId = (parsedUrl.query.id || '').trim();
      const user = db.getUserById(mchId);

      if (!user) {
        return sendJson(res, 404, {
          found: false,
          message: `ID ${mchId} tidak ditemui dalam pengkalan data Seafarer MarineCareerHub.com.`
        });
      }

      return sendJson(res, 200, {
        found: true,
        seafarer: {
          id: user.id,
          name: user.name,
          licenseNo: user.license_no,
          source: 'marinecareerhub.com',
          status: 'VERIFIED_ACTIVE',
          competency: 'Sijil Perakuan Kekompensian Bot (BOK) Diperakui Jabatan Laut',
          boatName: user.boat_default_name,
          boatReg: user.boat_default_reg,
          port: user.port
        }
      });
    }

    // Maritime Weather & Sea State Advisory (Jabatan Laut / METMalaysia)
    if (method === 'GET' && pathname === '/api/weather/advisory') {
      const portParam = (parsedUrl.query.port || '').trim();
      let advisory = null;
      if (portParam) {
        const foundKey = Object.keys(maritimeAdvisories).find(k => k.toLowerCase().includes(portParam.toLowerCase()) || portParam.toLowerCase().includes(k.toLowerCase()));
        if (foundKey) advisory = maritimeAdvisories[foundKey];
      }
      if (!advisory) {
        advisory = maritimeAdvisories['Jeti Kuala Besut'];
      }
      return sendJson(res, 200, {
        success: true,
        advisory,
        allPorts: maritimeAdvisories
      });
    }

    if (method === 'POST' && pathname === '/api/weather/advisory') {
      const body = await parseJsonBody(req);
      const portKey = body.port || 'Jeti Kuala Besut';
      const existing = maritimeAdvisories[portKey] || maritimeAdvisories['Jeti Kuala Besut'];

      const level = (body.level || existing.level || 'GREEN').toUpperCase();
      let clearanceStatus = 'PELEPASAN DIBENARKAN';
      let clearanceStatusEn = 'DEPARTURE CLEARANCE GRANTED';
      if (level === 'YELLOW') {
        clearanceStatus = 'BERWASPADA (HAD BOT KECIL)';
        clearanceStatusEn = 'CAUTION ADVISED (SMALL CRAFT)';
      } else if (level === 'RED') {
        clearanceStatus = 'PELEPASAN DITANGGUHKAN';
        clearanceStatusEn = 'DEPARTURE SUSPENDED';
      }

      const updated = {
        ...existing,
        port: portKey,
        level,
        seaState: body.seaState || (level === 'RED' ? 'Laut Bergelora / Ribut' : (level === 'YELLOW' ? 'Laut Bergelora' : 'Tenang / Baik')),
        seaStateEn: body.seaStateEn || (level === 'RED' ? 'Rough Sea / Storm' : (level === 'YELLOW' ? 'Moderate Rough' : 'Calm / Smooth')),
        waveHeight: body.waveHeight || (level === 'RED' ? '2.5m – 3.5m' : (level === 'YELLOW' ? '1.5m – 2.0m' : '0.5m – 1.0m')),
        windSpeed: body.windSpeed || (level === 'RED' ? '45 – 55 km/j' : (level === 'YELLOW' ? '25 – 35 km/j' : '10 – 20 km/j')),
        windDirection: body.windDirection || existing.windDirection,
        clearanceStatus: body.clearanceStatus || clearanceStatus,
        clearanceStatusEn: body.clearanceStatusEn || clearanceStatusEn,
        advisoryNote: body.advisoryNote || (level === 'RED' ? 'Semua bot penumpang dilarang meninggalkan jeti sehingga notis seterusnya dikeluarkan oleh Jabatan Laut.' : (level === 'YELLOW' ? 'Nakhoda dinasihatkan sentiasa berwaspada dan mematuhi had laju laut bergelora.' : existing.advisoryNote)),
        advisoryNoteEn: body.advisoryNoteEn || (level === 'RED' ? 'All passenger vessels prohibited from departing jetty until further notice by Marine Dept.' : (level === 'YELLOW' ? 'Skippers advised to remain vigilant and comply with speed limits in rough waters.' : existing.advisoryNoteEn)),
        updatedAt: new Date().toISOString()
      };

      maritimeAdvisories[portKey] = updated;
      console.log(`[WEATHER ADVISORY] Nasihat Cuaca Pelabuhan ${portKey} dikemaskini: ${level} - ${updated.clearanceStatus}`);
      broadcastLiveEvent('WEATHER_UPDATED', { port: portKey, advisory: updated });
      return sendJson(res, 200, { success: true, advisory: updated });
    }

    // Trips: List trips with full details from MySQL e_penumpang
    if (method === 'GET' && pathname === '/api/trips') {
      const driverId = parsedUrl.query.driver_id;
      const trips = await db.listTripsWithFullDetailsAsync(driverId);
      return sendJson(res, 200, { trips });
    }

    // Trips: Create Trip directly in MySQL e_penumpang
    if (method === 'POST' && pathname === '/api/trips') {
      const body = await parseJsonBody(req);
      const { driverId, boatName, boatRegNo, boatCapacity, origin, destination, departureDate, departureTime, driverList, crewList, crew } = body;

      if (!boatName || !destination || !departureTime) {
        return sendJson(res, 400, { error: 'Sila lengkapkan semua maklumat wajib trip.' });
      }

      const rawCrew = crew || crewList || [];
      const validCrew = (Array.isArray(rawCrew) ? rawCrew : []).filter(c => c && c.name && c.name.trim());
      if (validCrew.length > 5) {
        return sendJson(res, 400, {
          error: 'HAD MAKSIMUM DIPATUHI: Jumlah kru pembantu (awak-awak / deckhand) bagi satu trip adalah terhad kepada maksimum 5 orang sahaja.',
          code: 'CREW_LIMIT_EXCEEDED'
        });
      }

      let driver = db.getUserById(driverId);
      if (!driver) {
        driver = db.getUserById('MCH-TK-1002');
      }

      try {
        const manifest = await db.createTripAsync({
          driverId: driver ? driver.id : 'MCH-TK-1002',
          boatName,
          boatRegNo: boatRegNo || (driver ? driver.boat_default_reg : 'TR-REG-01'),
          boatCapacity: boatCapacity || (driver ? driver.boat_default_capacity : 12),
          origin: origin || (driver ? driver.port : 'Jeti Kuala Besut'),
          destination,
          departureDate: departureDate || new Date().toISOString().split('T')[0],
          departureTime,
          driverList: driverList || [{ name: driver ? driver.name : 'Tekong Utama', ic_passport: '-', license_no: driver ? driver.license_no : '-', role: 'Tekong Utama' }],
          crewList: crew || crewList || []
        });

        broadcastLiveEvent('TRIP_CREATED', { tripId: manifest.trip.id, manifest });
        return sendJson(res, 201, { success: true, tripId: manifest.trip.id, manifest });
      } catch (tripErr) {
        return sendJson(res, 400, { error: tripErr.message, code: tripErr.code });
      }
    }

    // Trips: Update Trip (PUT /api/trips/:id)
    const updateTripMatch = pathname.match(/^\/api\/trips\/([^/]+)$/);
    if (method === 'PUT' && updateTripMatch) {
      const tripId = updateTripMatch[1];
      const body = await parseJsonBody(req);
      try {
        const manifest = await db.updateTripAsync(tripId, body);
        broadcastLiveEvent('TRIP_UPDATED', { tripId, manifest });
        return sendJson(res, 200, { success: true, manifest });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Trips: Delete Trip (DELETE /api/trips/:id)
    if (method === 'DELETE' && updateTripMatch) {
      const tripId = updateTripMatch[1];
      try {
        await db.deleteTripAsync(tripId);
        broadcastLiveEvent('TRIP_DELETED', { tripId });
        return sendJson(res, 200, { success: true, message: `Trip ${tripId} berjaya dipadam dari MySQL.` });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Trips: Toggle Lifejacket (POST /api/trips/:tripId/passengers/:paxId/toggle-jacket)
    const toggleJacketMatch = pathname.match(/^\/api\/trips\/([^/]+)\/passengers\/([^/]+)\/toggle-jacket$/);
    if (method === 'POST' && toggleJacketMatch) {
      const tripId = toggleJacketMatch[1];
      const paxId = toggleJacketMatch[2];
      try {
        await db.toggleLifejacketAsync(tripId, paxId);
        broadcastLiveEvent('LIFEJACKET_TOGGLED', { tripId, paxId });
        return sendJson(res, 200, { success: true });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Trips: Delete Passenger (DELETE /api/trips/:tripId/passengers/:paxId)
    const delPaxMatch = pathname.match(/^\/api\/trips\/([^/]+)\/passengers\/([^/]+)$/);
    if (method === 'DELETE' && delPaxMatch) {
      const tripId = delPaxMatch[1];
      const paxId = delPaxMatch[2];
      try {
        await db.deletePassengerAsync(tripId, paxId);
        broadcastLiveEvent('PASSENGER_DELETED', { tripId, paxId });
        return sendJson(res, 200, { success: true, message: `Penumpang ${paxId} berjaya dipadam dari MySQL.` });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Trips: Get Manifest / Trip Detail
    const manifestMatch = pathname.match(/^\/api\/trips\/([^/]+)\/manifest$/);
    if (method === 'GET' && manifestMatch) {
      const tripId = manifestMatch[1];
      let manifest = await db.getTripManifestAsync(tripId);
      if (!manifest) {
        manifest = await db.getTripManifestAsync('TRIP-2026-101');
        if (!manifest) {
          manifest = await db.getTripManifestAsync('TRP-2026-052');
        }
      }
      if (!manifest) {
        return sendJson(res, 404, { error: 'Trip tidak dijumpai.' });
      }
      return sendJson(res, 200, manifest);
    }

    // Trips: Get Manifest by Query Param (/api/manifest or /api/manifests?tripId=...)
    if (method === 'GET' && (pathname === '/api/manifest' || pathname === '/api/manifests')) {
      const queryTripId = (parsedUrl.query.tripId || parsedUrl.query.trip || parsedUrl.query.id || '').trim();
      let manifest = null;
      if (queryTripId) {
        manifest = await db.getTripManifestAsync(queryTripId);
      }
      if (!manifest) {
        manifest = await db.getTripManifestAsync('TRIP-2026-101');
        if (!manifest) manifest = await db.getTripManifestAsync('TRP-2026-052');
      }
      if (!manifest) {
        return sendJson(res, 404, { error: 'Trip tidak dijumpai.' });
      }
      return sendJson(res, 200, manifest);
    }

    // Trips: Dynamic QR Code SVG
    const qrcodeMatch = pathname.match(/^\/api\/trips\/([^/]+)\/qrcode\.svg$/);
    if (method === 'GET' && qrcodeMatch) {
      const tripId = qrcodeMatch[1];
      const manifest = await db.getTripManifestAsync(tripId);
      if (!manifest) {
        return sendJson(res, 404, { error: 'Trip tidak dijumpai.' });
      }

      const host = req.headers.host || `localhost:${PORT}`;
      const proto = req.headers['x-forwarded-proto'] || 'http';
      const passengerUrl = `${proto}://${host}/passenger.html?tripId=${encodeURIComponent(tripId)}`;

      const qr = qrcode(0, 'M');
      qr.addData(passengerUrl);
      qr.make();
      const svgTag = qr.createSvgTag(6, 4);

      res.writeHead(200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=30'
      });
      res.end(svgTag);
      return;
    }

    // Trips: Approve Trip (Tekong approval before departure)
    const approveMatch = pathname.match(/^\/api\/trips\/([^/]+)\/approve$/);
    if (method === 'POST' && approveMatch) {
      const tripId = approveMatch[1];
      const body = await parseJsonBody(req);
      const { driverId } = body;

      if (!driverId) {
        return sendJson(res, 400, { error: 'Driver ID diperlukan.' });
      }

      try {
        const manifest = await db.approveTripAsync(tripId, driverId);
        broadcastLiveEvent('TRIP_APPROVED', { tripId, manifest });
        return sendJson(res, 200, {
          success: true,
          message: 'Trip berjaya diluluskan untuk berlepas! Pematuhan kapasiti disahkan.',
          manifest
        });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Trips: Complete Trip
    const completeMatch = pathname.match(/^\/api\/trips\/([^/]+)\/complete$/);
    if (method === 'POST' && completeMatch) {
      const tripId = completeMatch[1];
      const body = await parseJsonBody(req);
      const { driverId } = body;

      try {
        const manifest = await db.completeTripAsync(tripId, driverId);
        broadcastLiveEvent('TRIP_COMPLETED', { tripId, manifest });
        return sendJson(res, 200, { success: true, message: 'Trip telah ditandakan sebagai SELESAI.', manifest });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Passenger: Self-registration via QR Code
    const passengerRegMatch = pathname.match(/^\/api\/trips\/([^/]+)\/passengers$/);
    if (method === 'POST' && passengerRegMatch) {
      const tripId = passengerRegMatch[1];
      const body = await parseJsonBody(req);
      const { name, icPassport, age, shortAddress, phone, emergencyPhone } = body;

      // Validation
      if (!name || !icPassport || !shortAddress || !phone) {
        return sendJson(res, 400, {
          error: 'Sila lengkapkan maklumat wajib: Nama Penuh, No. IC/Passport, Alamat Pendek, dan No Telefon.'
        });
      }

      try {
        const result = await db.addPassengerAsync({
          tripId,
          name,
          icPassport,
          age,
          shortAddress,
          phone,
          emergencyPhone
        });

        broadcastLiveEvent('PASSENGER_ADDED', { tripId, passenger: result.passenger, tripManifest: result.tripManifest });

        return sendJson(res, 201, {
          success: true,
          message: 'Pendaftaran penumpang berjaya! Sila simpan pas pelepasan digital anda.',
          passenger: result.passenger,
          tripManifest: result.tripManifest
        });
      } catch (err) {
        if (err.code === 'CAPACITY_EXCEEDED') {
          return sendJson(res, 409, {
            error: err.message,
            code: 'CAPACITY_FULL',
            currentCount: err.currentCount,
            maxCapacity: err.maxCapacity
          });
        }
        return sendJson(res, 400, { error: err.message });
      }
    }

    // Admin: Overview Dashboard (Live from MySQL e_penumpang)
    if (method === 'GET' && pathname === '/api/admin/overview') {
      const overview = await db.getAdminOverviewAsync();
      const trips = await db.listTripsAsync();
      return sendJson(res, 200, { overview, trips });
    }

    // System: Database Status & MySQL Health
    if (method === 'GET' && pathname === '/api/system/database-status') {
      const mysqlStatus = await mysqlDriver.testConnection();
      let mysqlStats = null;
      if (mysqlStatus.connected) {
        try {
          const [u] = await mysqlDriver.query('SELECT COUNT(*) as c FROM users');
          const [t] = await mysqlDriver.query('SELECT COUNT(*) as c FROM trips');
          const [p] = await mysqlDriver.query('SELECT COUNT(*) as c FROM passengers');
          mysqlStats = { users: u.c, trips: t.c, passengers: p.c };
        } catch (e) {}
      }

      return sendJson(res, 200, {
        activeEngine: mysqlStatus.connected ? 'MySQL / MariaDB' : 'SQLite',
        mysql: { ...mysqlStatus, stats: mysqlStats },
        sqlite: { active: true, path: 'e_penumpang.sqlite' }
      });
    }

    // System: Reset Demo Data (MySQL + SQLite + In-Memory)
    if ((method === 'POST' || method === 'GET') && (pathname === '/api/system/reset-demo' || pathname === '/api/reset-demo')) {
      try {
        const resetTrips = await db.resetToSeedDataAsync();
        broadcastLiveEvent('DATA_RESET', { trips: resetTrips, timestamp: new Date().toISOString() });
        return sendJson(res, 200, {
          success: true,
          message: 'Pangkalan data demo berjaya disegerakkan semula kepada keadaan asal!',
          trips: resetTrips
        });
      } catch (resetErr) {
        console.error('[Reset Demo Error]:', resetErr);
        return sendJson(res, 500, { error: 'Gagal mengeset semula data demo: ' + resetErr.message });
      }
    }

    // -------------------------------------------------------------
    // STATIC FILE SERVING
    // -------------------------------------------------------------
    let cleanPath = pathname;
    if (cleanPath === '/' || cleanPath === '') {
      cleanPath = '/index.html';
    } else if (cleanPath === '/passenger' || cleanPath === '/passenger.html' || cleanPath === '/pax') {
      cleanPath = '/passenger.html';
    } else if (cleanPath === '/manifest' || cleanPath === '/manifest.html' || cleanPath === '/manifest-print' || cleanPath === '/manifest-print.html') {
      cleanPath = '/manifest-print.html';
    } else if (cleanPath === '/js/passenger.js') {
      cleanPath = '/passenger.js';
    }

    // Prevent directory traversal
    const safePath = path.normalize(cleanPath).replace(/^(\.\.[/\\])+/, '');
    const fullPath = path.join(PUBLIC_DIR, safePath);

    serveStatic(res, fullPath);

  } catch (globalErr) {
    console.error('[Server Error]', globalErr);
    sendJson(res, 500, { error: 'Internal Server Error: ' + globalErr.message });
  }
});

server.keepAliveTimeout = 5000;
server.headersTimeout = 6000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  e-PENUMPANG: Sistem Pendaftaran Penumpang Bersepadu  `);
  console.log(`  MarineCareerHub                                      `);
  console.log(`  Server running at: http://localhost:${PORT}          `);
  console.log(`=======================================================`);
});

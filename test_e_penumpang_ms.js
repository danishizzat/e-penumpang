// test_e_penumpang_ms.js - Ujian Automasi Sistem e-PENUMPANG (Versi Bahasa Melayu)
const assert = require('node:assert');
const db = require('./db.js');

console.log('----------------------------------------------------------------------');
console.log('  Ujian Automasi Sistem e-PENUMPANG: Had Pemandu & Kapasiti Bot      ');
console.log('----------------------------------------------------------------------');

// Test 1: Pengesahan Log Masuk Tekong (MarineCareerHub ID)
console.log('[Test 1] Pengesahan Log Masuk Tekong (MarineCareerHub ID)...');
const driverUser = db.validateLogin('MCH-TK-1001', 'pass123');
assert(driverUser !== null, 'Tekong MCH-TK-1001 sepatutnya berjaya log masuk');
assert.strictEqual(driverUser.role, 'driver');
assert.strictEqual(driverUser.source, 'marinecareerhub.com');
console.log(`  ✔ Berjaya: ${driverUser.name} (${driverUser.id}) disahkan.`);

// Test 2: Pengesahan Log Masuk Admin
console.log('[Test 2] Pengesahan Log Masuk Admin MCH / SMC...');
const adminUser = db.validateLogin('ADMIN-MCH-001', 'admin123') || db.validateLogin('ADMIN-SMC-001', 'admin123');
assert(adminUser !== null, 'Admin MCH-001 / SMC-001 sepatutnya berjaya log masuk');
assert.strictEqual(adminUser.role, 'admin');
console.log(`  ✔ Berjaya: ${adminUser.name} disahkan sebagai Pegawai Maritim MCH.`);

// Test 3: Had Pilihan Destinasi
console.log('[Test 3] Menguji Had Pilihan Destinasi (Hanya Pulau Redang & Pulau Perhentian)...');
let invalidDestBlocked = false;
try {
  db.createTrip({
    driverId: 'MCH-TK-1001',
    boatName: 'Bintang Laut 01',
    boatRegNo: 'TR-2041-BP',
    destination: 'Pulau Tioman',
    departureDate: '2026-09-10',
    departureTime: '10:00 AM'
  });
} catch (err) {
  invalidDestBlocked = true;
  assert.strictEqual(err.code, 'INVALID_DESTINATION');
  console.log(`  ✔ Berjaya menyekat destinasi tidak sah: "${err.message}"`);
}
assert(invalidDestBlocked, 'Destinasi selain Pulau Redang / Pulau Perhentian mesti disekat!');

const tripPerhentian = db.createTrip({
  driverId: 'MCH-TK-1001',
  boatName: 'Bintang Laut 01',
  boatRegNo: 'TR-2041-BP',
  destination: 'Pulau Perhentian',
  departureDate: '2026-09-10',
  departureTime: '10:00 AM'
});
assert.strictEqual(tripPerhentian.trip.destination, 'Pulau Perhentian');
console.log(`  ✔ Berjaya: Destinasi sah 'Pulau Perhentian' diterima.`);

// Test 4: Had Kapasiti Maksimum Dikunci
console.log('[Test 4] Menguji Had Kapasiti Maksimum (Terkunci Mengikut Bot Berdaftar Tekong)...');
const lockedTrip = db.createTrip({
  driverId: 'MCH-TK-1001',
  boatName: 'Bintang Laut 01',
  boatRegNo: 'TR-2041-BP',
  boatCapacity: 99,
  destination: 'Pulau Redang',
  departureDate: '2026-09-10',
  departureTime: '02:00 PM'
});
assert.strictEqual(lockedTrip.trip.boat_capacity, 12);
console.log(`  ✔ Berjaya: Kapasiti trip dikunci secara automatik kepada ${lockedTrip.trip.boat_capacity} orang (spesifikasi bot berdaftar).`);

// Test 5: Had Maksimum Pemandu (Tekong)
console.log('[Test 5] Menguji Had Pemandu (Tekong): Maksimum 5 Orang...');
const tripWith5Drivers = db.createTrip({
  driverId: 'MCH-TK-1002',
  boatName: 'Bayu Samudera',
  boatRegNo: 'JHR-8812-BP',
  destination: 'Pulau Redang',
  departureDate: '2026-09-10',
  departureTime: '02:00 PM',
  driverList: [
    { name: 'Kapten Farhan bin Rosli', ic_passport: '800515-01-5231', license_no: 'MSO-BOK-2021-4190', role: 'Tekong Utama' },
    { name: 'Kapten Azman bin Yusof', ic_passport: '780312-11-5421', license_no: 'MSO-BOK-2022-8821', role: 'Tekong Kedua' },
    { name: 'Kapten Ramesh Mohan', ic_passport: '830911-08-5541', license_no: 'MSO-BOK-2023-7740', role: 'Pemandu Sandaran 1' },
    { name: 'Kapten Khairul Anuar', ic_passport: '850720-08-5511', license_no: 'MSO-BOK-2024-1102', role: 'Pemandu Sandaran 2' },
    { name: 'Kapten Johan Idris', ic_passport: '791104-02-6611', license_no: 'MSO-BOK-2020-9931', role: 'Pemandu Sandaran 3' }
  ],
  crewList: [
    { name: 'Khairul Awak-awak', ic_passport: '940211-01-6543', role: 'Awak-awak' },
    { name: 'Zali Deckhand', ic_passport: '970810-01-7711', role: 'Deckhand' }
  ]
});
assert.strictEqual(tripWith5Drivers.driverCount, 5);
assert.strictEqual(tripWith5Drivers.crewCount, 2);
console.log(`  ✔ Berjaya: Trip ${tripWith5Drivers.trip.id} dicipta dengan 5 Pemandu (Tekong) dan 2 Kru (Awak-awak).`);

let driverExceededBlocked = false;
try {
  db.createTrip({
    driverId: 'MCH-TK-1002',
    boatName: 'Bayu Samudera',
    boatRegNo: 'JHR-8812-BP',
    destination: 'Pulau Redang',
    departureDate: '2026-09-10',
    departureTime: '04:00 PM',
    driverList: [
      { name: 'Driver 1' }, { name: 'Driver 2' }, { name: 'Driver 3' },
      { name: 'Driver 4' }, { name: 'Driver 5' }, { name: 'Driver 6 (Lebih)' }
    ]
  });
} catch (err) {
  driverExceededBlocked = true;
  assert.strictEqual(err.code, 'DRIVER_LIMIT_EXCEEDED');
  console.log(`  ✔ Berjaya menyekat pemandu ke-6: "${err.message}"`);
}
assert(driverExceededBlocked);

console.log('[Subtest 5C] Menguji Had Kru Pembantu (Maksimum 5 Orang Sahaja)...');
const tripWith5Crew = db.createTrip({
  driverId: 'MCH-TK-1002',
  boatName: 'Bayu Samudera',
  boatRegNo: 'JHR-8812-BP',
  destination: 'Pulau Redang',
  departureDate: '2026-09-10',
  departureTime: '05:00 PM',
  crewList: [
    { name: 'Kru 1', role: 'Awak-awak' },
    { name: 'Kru 2', role: 'Deckhand' },
    { name: 'Kru 3', role: 'Kru Keselamatan' },
    { name: 'Kru 4', role: 'Dekman' },
    { name: 'Kru 5', role: 'Jurutera Bot' }
  ]
});
assert.strictEqual(tripWith5Crew.crewCount, 5);
console.log(`  ✔ Berjaya: Trip ${tripWith5Crew.trip.id} berjaya didaftarkan dengan tepat 5 orang kru pembantu.`);

let crewExceededBlocked = false;
try {
  db.createTrip({
    driverId: 'MCH-TK-1002',
    boatName: 'Bayu Samudera',
    boatRegNo: 'JHR-8812-BP',
    destination: 'Pulau Redang',
    departureDate: '2026-09-10',
    departureTime: '06:00 PM',
    crewList: [
      { name: 'Kru 1' }, { name: 'Kru 2' }, { name: 'Kru 3' },
      { name: 'Kru 4' }, { name: 'Kru 5' }, { name: 'Kru 6 (Lebih)' }
    ]
  });
} catch (err) {
  crewExceededBlocked = true;
  assert.strictEqual(err.code, 'CREW_LIMIT_EXCEEDED');
  console.log(`  ✔ Berjaya menyekat kru pembantu ke-6: "${err.message}"`);
}
assert(crewExceededBlocked);

console.log('[Test 6] Menguji Had Penumpang Mengikut Kapasiti Bot (Kapasiti = 12 Penumpang)...');
const testTripId = lockedTrip.trip.id;

for (let i = 1; i <= 12; i++) {
  const p = db.addPassenger({
    tripId: testTripId,
    name: `Penumpang VIP #${i}`,
    icPassport: `900101-01-50${String(i).padStart(2, '0')}`,
    shortAddress: 'Kuala Lumpur',
    phone: `012-34567${String(i).padStart(3, '0')}`
  });
  console.log(`  ✔ Penumpang #${i} didaftarkan berjaya (Kapasiti: ${p.tripManifest.passengerCount}/${p.tripManifest.boatCapacity})`);
}

const fullTripManifest = db.getTripManifest(testTripId);
assert.strictEqual(fullTripManifest.passengerCount, 12);
assert.strictEqual(fullTripManifest.isFull, true);
console.log(`  ✔ Status kapasiti bot disahkan: KAPASITI BOT PENUH (12/12).`);

console.log('[Test 7] Percubaan Mendaftar Penumpang ke-13 (Melebihi Kapasiti Bot 12)...');
let passengerExceededBlocked = false;
try {
  db.addPassenger({
    tripId: testTripId,
    name: 'Penumpang Ke-13 Melebihi Bot',
    icPassport: '999999-99-9999',
    shortAddress: 'Johor Bahru',
    phone: '019-9999999'
  });
} catch (err) {
  passengerExceededBlocked = true;
  assert.strictEqual(err.code, 'CAPACITY_EXCEEDED');
  console.log(`  ✔ Berjaya menyekat penumpang ke-13: "${err.message}"`);
}
assert(passengerExceededBlocked);

console.log('[Test 8] Kelulusan Pelepasan oleh Tekong...');
const approvedManifest = db.approveTrip(testTripId, 'MCH-TK-1001');
assert.strictEqual(approvedManifest.trip.status, 'APPROVED_DEPARTED');
console.log(`  ✔ Berjaya: Trip ${testTripId} telah DILULUSKAN untuk berlepas pada ${approvedManifest.trip.approved_at}.`);

console.log('[Test 9] Pemantauan & Pematuhan Pusat MCH (Admin Dashboard)...');
const adminOverview = db.getAdminOverview();
assert(adminOverview.totalTrips >= 2);
assert(adminOverview.totalPassengers >= 12);
assert.strictEqual(adminOverview.maxDriversPerTrip, 5);
assert(adminOverview.complianceRate.includes('Compliant'));
console.log(`  ✔ Metrik MCH: Jumlah Trip: ${adminOverview.totalTrips}, Penumpang Berdaftar: ${adminOverview.totalPassengers}, Had Pemandu: ${adminOverview.maxDriversPerTrip}, Pematuhan: ${adminOverview.complianceRate}.`);

console.log('[Test 10] Pengesahan Format Dokumen Rasmi LAMPIRAN A & Auto-Kiraan Umur...');
const tripLampiran = db.createTrip({
  driverId: 'MCH-TK-1003',
  boatName: 'Cahaya Redang 03',
  boatRegNo: 'TR-5531-BP',
  destination: 'Pulau Redang',
  departureDate: '2026-09-10',
  departureTime: '08:30 AM'
});

const p1 = db.addPassenger({
  tripId: tripLampiran.trip.id,
  name: 'Siti Nurhaliza',
  icPassport: '960824-11-5432',
  shortAddress: 'Kota Bharu, Kelantan',
  phone: '019-8765432'
});
assert.strictEqual(p1.passenger.age, 30);

const p2 = db.addPassenger({
  tripId: tripLampiran.trip.id,
  name: 'Amir bin Kamaruddin',
  icPassport: '180512-11-1234',
  shortAddress: 'Kuala Terengganu, Terengganu',
  phone: '012-3344556'
});
assert.strictEqual(p2.passenger.age, 8);

const p3 = db.addPassenger({
  tripId: tripLampiran.trip.id,
  name: 'John Smith',
  icPassport: 'GBR987654321',
  age: 45,
  shortAddress: 'London, United Kingdom',
  phone: '+44-7911-123456'
});
assert.strictEqual(p3.passenger.age, 45);

const lampiranManifest = db.getTripManifest(tripLampiran.trip.id);
assert(lampiranManifest.passengers.length === 3);
console.log(`  ✔ Berjaya: Format LAMPIRAN A disahkan - Umur Siti Nurhaliza: ${p1.passenger.age}, Amir: ${p2.passenger.age}, John Smith: ${p3.passenger.age}.`);

console.log('----------------------------------------------------------------------');
console.log('  SEMUA 10 UJIAN DESTINASI, KAPASITI & LAMPIRAN A LULUS 100%!         ');
console.log('----------------------------------------------------------------------');

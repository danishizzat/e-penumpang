// test_e_penumpang.js - Automated Verification Suite for e-PENUMPANG
const assert = require('node:assert');
const db = require('./db.js');

console.log('----------------------------------------------------------------------');
console.log('  e-PENUMPANG System Automation Tests: Driver Limit & Boat Capacity   ');
console.log('----------------------------------------------------------------------');

// Test 1: Driver Authentication with MarineCareerHub ID
console.log('[Test 1] Skipper (Captain) Login Verification (MarineCareerHub ID)...');
const driverUser = db.validateLogin('MCH-TK-1001', 'pass123');
assert(driverUser !== null, 'Skipper MCH-TK-1001 should successfully log in');
assert.strictEqual(driverUser.role, 'driver');
assert.strictEqual(driverUser.source, 'marinecareerhub.com');
console.log(`  ✔ Success: Captain Azman bin Yusof (${driverUser.id}) verified.`);

// Test 2: Admin Authentication
console.log('[Test 2] MCH / SMC Admin Login Verification...');
const adminUser = db.validateLogin('ADMIN-MCH-001', 'admin123') || db.validateLogin('ADMIN-SMC-001', 'admin123');
assert(adminUser !== null, 'Admin MCH-001 / SMC-001 should successfully log in');
assert.strictEqual(adminUser.role, 'admin');
console.log(`  ✔ Success: ${adminUser.name} verified as MCH Maritime Safety Officer.`);

// Test 3: Destination Limit Validation (Only Pulau Redang & Pulau Perhentian)
console.log('[Test 3] Testing Destination Limit (Only Pulau Redang & Pulau Perhentian)...');
// Subtest 3A: Invalid destination must be REJECTED
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
  console.log(`  ✔ Successfully blocked invalid destination: "Invalid destination! Allowed destinations are only: Pulau Redang or Pulau Perhentian."`);
}
assert(invalidDestBlocked, 'Destinations other than Pulau Redang / Pulau Perhentian must be blocked!');

// Subtest 3B: Valid destinations (Pulau Perhentian & Pulau Redang) must be ACCEPTED
const tripPerhentian = db.createTrip({
  driverId: 'MCH-TK-1001',
  boatName: 'Bintang Laut 01',
  boatRegNo: 'TR-2041-BP',
  destination: 'Pulau Perhentian',
  departureDate: '2026-09-10',
  departureTime: '10:00 AM'
});
assert.strictEqual(tripPerhentian.trip.destination, 'Pulau Perhentian');
console.log(`  ✔ Success: Valid destination 'Pulau Perhentian' accepted.`);

// Test 4: Maximum Capacity Limit Locked to Registered Boat Specs
console.log('[Test 4] Testing Maximum Capacity Limit (Locked to Skipper Registered Boat)...');
const lockedTrip = db.createTrip({
  driverId: 'MCH-TK-1001',
  boatName: 'Bintang Laut 01',
  boatRegNo: 'TR-2041-BP',
  boatCapacity: 99, // Attempt to alter capacity
  destination: 'Pulau Redang',
  departureDate: '2026-09-10',
  departureTime: '02:00 PM'
});
assert.strictEqual(lockedTrip.trip.boat_capacity, 12, 'Capacity must be locked to 12 according to skipper boat registration');
console.log(`  ✔ Success: Trip capacity automatically locked to ${lockedTrip.trip.boat_capacity} persons (registered boat specification).`);

// Test 5: Maximum Driver Limit (Skippers): Maximum 5 Persons
console.log('[Test 5] Testing Driver (Skipper) Limit: Maximum 5 Persons...');
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

assert.strictEqual(tripWith5Drivers.driverCount, 5, 'Driver count must be exactly 5');
assert.strictEqual(tripWith5Drivers.crewCount, 2, 'Crew count is 2 (excluded from driver limit)');
console.log(`  ✔ Success: Trip ${tripWith5Drivers.trip.id} created with 5 Drivers (Skippers) and 2 Crew members (Deckhands).`);

// Subtest 5B: Attempt to add 6th driver (MUST BE REJECTED)
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
      { name: 'Driver 4' }, { name: 'Driver 5' }, { name: 'Driver 6 (Excess)' }
    ]
  });
} catch (err) {
  driverExceededBlocked = true;
  assert.strictEqual(err.code, 'DRIVER_LIMIT_EXCEEDED');
  console.log(`  ✔ Successfully blocked 6th driver: "MAXIMUM LIMIT ENFORCED: Total drivers (skippers) per trip is limited to a maximum of 5 persons (excluding crew)."`);
}
assert(driverExceededBlocked, 'Adding a 6th driver must be blocked by system!');

// Subtest 5C: Testing Assistant Crew Limit (Maximum 5 Persons Only)
console.log('[Subtest 5C] Testing Assistant Crew Limit (Maximum 5 Persons Only)...');
const tripWith5Crew = db.createTrip({
  driverId: 'MCH-TK-1002',
  boatName: 'Bayu Samudera',
  boatRegNo: 'JHR-8812-BP',
  destination: 'Pulau Redang',
  departureDate: '2026-09-10',
  departureTime: '05:00 PM',
  crewList: [
    { name: 'Crew 1', role: 'Deckhand' },
    { name: 'Crew 2', role: 'Deckhand' },
    { name: 'Crew 3', role: 'Safety Officer' },
    { name: 'Crew 4', role: 'Deckman' },
    { name: 'Crew 5', role: 'Boat Engineer' }
  ]
});
assert.strictEqual(tripWith5Crew.crewCount, 5, 'Crew successfully registered with exactly 5 persons');
console.log(`  ✔ Success: Trip ${tripWith5Crew.trip.id} successfully registered with exactly 5 assistant crew members.`);

// Attempt to register 6th crew member (MUST BE REJECTED)
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
      { name: 'Crew 1' }, { name: 'Crew 2' }, { name: 'Crew 3' },
      { name: 'Crew 4' }, { name: 'Crew 5' }, { name: 'Crew 6 (Excess)' }
    ]
  });
} catch (err) {
  crewExceededBlocked = true;
  assert.strictEqual(err.code, 'CREW_LIMIT_EXCEEDED');
  console.log(`  ✔ Successfully blocked 6th assistant crew member: "MAXIMUM LIMIT ENFORCED: Total assistant crew (deckhands) per trip is limited to a maximum of 5 persons only."`);
}
assert(crewExceededBlocked, 'Adding a 6th crew member must be blocked by system!');

// Test 6: Passenger Limit According to Boat Capacity (Capacity = 12 Passengers)
console.log('[Test 6] Testing Passenger Limit by Boat Capacity (Capacity = 12 Passengers)...');
const testTripId = lockedTrip.trip.id;

// Register 12 passengers up to full capacity
for (let i = 1; i <= 12; i++) {
  const p = db.addPassenger({
    tripId: testTripId,
    name: `VIP Passenger #${i}`,
    icPassport: `900101-01-50${String(i).padStart(2, '0')}`,
    shortAddress: 'Kuala Lumpur',
    phone: `012-34567${String(i).padStart(3, '0')}`
  });
  console.log(`  ✔ Passenger #${i} successfully registered (Capacity: ${p.tripManifest.passengerCount}/${p.tripManifest.boatCapacity})`);
}

const fullTripManifest = db.getTripManifest(testTripId);
assert.strictEqual(fullTripManifest.passengerCount, 12, 'Passenger count must equal 12 according to boat capacity');
assert.strictEqual(fullTripManifest.isFull, true, 'Trip status must be isFull = true');
console.log(`  ✔ Boat capacity status confirmed: BOAT AT FULL CAPACITY (12/12).`);

// Test 7: Attempting to Register 13th Passenger (Exceeding Boat Capacity of 12)
console.log('[Test 7] Attempting to Register 13th Passenger (Exceeding Boat Capacity of 12)...');
let passengerExceededBlocked = false;
try {
  db.addPassenger({
    tripId: testTripId,
    name: '13th Passenger Exceeding Boat',
    icPassport: '999999-99-9999',
    shortAddress: 'Johor Bahru',
    phone: '019-9999999'
  });
} catch (err) {
  passengerExceededBlocked = true;
  assert.strictEqual(err.code, 'CAPACITY_EXCEEDED');
  console.log(`  ✔ Successfully blocked 13th passenger: "BOAT FULL AT CAPACITY! Maximum boat capacity safety limit (12 passengers) has been reached."`);
}
assert(passengerExceededBlocked, 'Passenger exceeding boat capacity must be blocked!');

// Test 8: Departure Approval by Skipper
console.log('[Test 8] Departure Approval by Skipper...');
const approvedManifest = db.approveTrip(testTripId, 'MCH-TK-1001');
assert.strictEqual(approvedManifest.trip.status, 'APPROVED_DEPARTED');
console.log(`  ✔ Success: Trip ${testTripId} has been APPROVED for departure at ${approvedManifest.trip.approved_at}.`);

// Test 9: MCH Admin Central Monitoring
console.log('[Test 9] MCH Central Monitoring & Compliance (Admin Dashboard)...');
const adminOverview = db.getAdminOverview();
assert(adminOverview.totalTrips >= 2);
assert(adminOverview.totalPassengers >= 12);
assert.strictEqual(adminOverview.maxDriversPerTrip, 5);
assert(adminOverview.complianceRate.includes('Compliant'));
console.log(`  ✔ MCH Metrics: Total Trips: ${adminOverview.totalTrips}, Registered Passengers: ${adminOverview.totalPassengers}, Driver Limit: ${adminOverview.maxDriversPerTrip}, Compliance: ${adminOverview.complianceRate}.`);

// Test 10: Official Document Verification (APPENDIX A) & Auto-Age Calculation
console.log('[Test 10] Official Document Format Verification (APPENDIX A) & Auto-Age Calculation...');
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
assert.strictEqual(p1.passenger.age, 30, 'Passenger age with IC 960824 should be 30');

const p2 = db.addPassenger({
  tripId: tripLampiran.trip.id,
  name: 'Amir bin Kamaruddin',
  icPassport: '180512-11-1234',
  shortAddress: 'Kuala Terengganu, Terengganu',
  phone: '012-3344556'
});
assert.strictEqual(p2.passenger.age, 8, 'Passenger age with IC 180512 should be 8');

const p3 = db.addPassenger({
  tripId: tripLampiran.trip.id,
  name: 'John Smith',
  icPassport: 'GBR987654321',
  age: 45,
  shortAddress: 'London, United Kingdom',
  phone: '+44-7911-123456'
});
assert.strictEqual(p3.passenger.age, 45, 'Foreign passenger age with passport must be 45');

const lampiranManifest = db.getTripManifest(tripLampiran.trip.id);
assert(lampiranManifest.passengers.length === 3);
console.log(`  ✔ Success: APPENDIX A format verified - Age of Siti Nurhaliza: ${p1.passenger.age}, Amir: ${p2.passenger.age}, John Smith: ${p3.passenger.age}.`);

console.log('----------------------------------------------------------------------');
console.log('  ALL 10 DESTINATION, CAPACITY & APPENDIX A TESTS PASSED 100%!        ');
console.log('----------------------------------------------------------------------');

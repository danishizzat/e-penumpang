<?php
// api.php - e-PENUMPANG Central MySQL REST API Backend for LiteSpeed / Apache
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// 1. Load Database Settings
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
} else {
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'epenumpa_db');
    define('DB_USER', 'epenumpa_db');
    define('DB_PASS', '');
}

function getDbConnection() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $host = trim(defined('DB_HOST') ? DB_HOST : 'localhost');
    $name = trim(defined('DB_NAME') ? DB_NAME : 'epenumpa_db');
    $user = trim(defined('DB_USER') ? DB_USER : 'epenumpa_db');
    $pass = trim(defined('DB_PASS') ? (string)DB_PASS : '');

    try {
        $pdo = new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        return $pdo;
    } catch (PDOException $e) {
        // Try fallback to 127.0.0.1 if localhost failed
        if ($host === 'localhost') {
            try {
                $pdo = new PDO("mysql:host=127.0.0.1;dbname={$name};charset=utf8mb4", $user, $pass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
                ]);
                return $pdo;
            } catch (PDOException $e2) {}
        }
        http_response_code(500);
        echo json_encode([
            'error' => 'Gagal menyambung ke pangkalan data MySQL: ' . $e->getMessage(),
            'user' => $user,
            'database' => $name,
            'hint' => 'Sila semak kata laluan database epenumpa_db di DirectAdmin dan masukkan di dalam config.php'
        ]);
        exit;
    }
}

// 2. Parse Request Path
$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';

if (!$endpoint) {
    if (preg_match('#^/api/(.*)$#', $uri, $m)) {
        $endpoint = $m[1];
    } elseif (preg_match('#/api\.php/(.*)$#', $uri, $m)) {
        $endpoint = $m[1];
    }
}
$endpoint = trim($endpoint, '/');

// Read JSON Input Body
function getJsonBody() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// Format single trip with its related drivers, crew, and passengers
function formatTripRow($db, $t) {
    $tripId = $t['id'];

    // Get drivers
    $dStmt = $db->prepare("SELECT name, ic_passport, license_no, role FROM trip_drivers WHERE trip_id = ? ORDER BY id ASC");
    $dStmt->execute([$tripId]);
    $drivers = $dStmt->fetchAll();

    // Get crew
    $cStmt = $db->prepare("SELECT name, ic_passport, role FROM crew_members WHERE trip_id = ? ORDER BY id ASC");
    $cStmt->execute([$tripId]);
    $crew = $cStmt->fetchAll();

    // Get passengers
    $pStmt = $db->prepare("SELECT id, trip_id, full_name, ic_passport, age, short_address, phone, emergency_phone, lifejacket, registered_at FROM passengers WHERE trip_id = ? ORDER BY registered_at ASC");
    $pStmt->execute([$tripId]);
    $rawPax = $pStmt->fetchAll();

    $passengers = [];
    $paxIndex = 1;
    foreach ($rawPax as $p) {
        $passengers[] = [
            'id' => $p['id'],
            'tripId' => $p['trip_id'],
            'fullName' => $p['full_name'],
            'name' => $p['full_name'],
            'icOrPassport' => $p['ic_passport'],
            'ic_passport' => $p['ic_passport'],
            'age' => $p['age'] !== null ? (int)$p['age'] : '-',
            'shortAddress' => $p['short_address'],
            'phone' => $p['phone'],
            'emergencyPhone' => $p['emergency_phone'] ? $p['emergency_phone'] : '-',
            'lifejacket' => (bool)$p['lifejacket'],
            'seatNumber' => (string)$paxIndex,
            'registeredAt' => $p['registered_at']
        ];
        $paxIndex++;
    }

    $cap = (int)$t['boat_capacity'];
    return [
        'id' => $t['id'],
        'boatName' => $t['boat_name'],
        'boat_name' => $t['boat_name'],
        'boatRegNo' => $t['boat_reg_no'],
        'boat_reg_no' => $t['boat_reg_no'],
        'boatCapacity' => $cap,
        'maxCapacity' => $cap,
        'driverId' => $t['driver_id'],
        'destination' => $t['destination'],
        'departureJetty' => $t['departure_jetty'] ? $t['departure_jetty'] : 'Jeti Kuala Besut',
        'departureDate' => $t['departure_date'],
        'departureTime' => $t['departure_time'],
        'status' => $t['status'],
        'approvedAt' => $t['approved_at'],
        'completedAt' => $t['completed_at'],
        'createdAt' => $t['created_at'],
        'passengers' => $passengers,
        'drivers' => $drivers,
        'crew' => $crew
    ];
}

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------
$db = getDbConnection();

// 0a. POST /api/auth/login (Pengesahan Pengguna Melalui MySQL Database)
if ($method === 'POST' && ($endpoint === 'auth/login' || $endpoint === 'login')) {
    $body = getJsonBody();
    $identifier = trim(isset($body['id']) ? $body['id'] : (isset($body['username']) ? $body['username'] : (isset($body['identifier']) ? $body['identifier'] : (isset($body['name']) ? $body['name'] : ''))));
    $password = trim(isset($body['password']) ? (string)$body['password'] : '');

    if (!$identifier || $password === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Sila masukkan ID Pengguna / Nama dan Kata Laluan.']);
        exit;
    }

    // Cari pengguna berdasarkan ID, Email, No. Lesen, atau Nama Penuh
    $stmt = $db->prepare("SELECT * FROM users WHERE LOWER(id) = LOWER(?) OR LOWER(email) = LOWER(?) OR LOWER(license_no) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1");
    $stmt->execute([$identifier, $identifier, $identifier, $identifier]);
    $user = $stmt->fetch();

    // Jika tidak dijumpai dengan padanan tepat, cuba carian nama separa (minimum 3 aksara)
    if (!$user && strlen($identifier) >= 3) {
        $stmt = $db->prepare("SELECT * FROM users WHERE LOWER(name) LIKE LOWER(?) LIMIT 1");
        $stmt->execute(['%' . $identifier . '%']);
        $user = $stmt->fetch();
    }

    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Pengguna "' . htmlspecialchars($identifier) . '" tidak dijumpai dalam pangkalan data. Sila semak semula ID anda.']);
        exit;
    }

    // Sahkan kata laluan (Menyokong teks biasa terus dari database phpMyAdmin atau hash)
    $pwValid = false;
    $dbPassword = (string)$user['password'];
    if ($dbPassword === $password) {
        $pwValid = true;
    } elseif (password_verify($password, $dbPassword)) {
        $pwValid = true;
    } elseif (md5($password) === $dbPassword) {
        $pwValid = true;
    } elseif (sha1($password) === $dbPassword) {
        $pwValid = true;
    }

    if (!$pwValid) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Kata laluan tidak sah. Sila masukkan kata laluan yang betul.']);
        exit;
    }

    // Formatkan peranan pengguna untuk sistem e-PENUMPANG
    $roleNormalized = strtoupper($user['role']);
    if ($roleNormalized === 'DRIVER') {
        $roleNormalized = 'TEKONG';
    }

    echo json_encode([
        'success' => true,
        'message' => 'Log masuk berjaya.',
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'fullName' => $user['name'],
            'username' => $user['id'],
            'email' => $user['email'],
            'role' => $roleNormalized,
            'license_no' => $user['license_no'],
            'licenseNo' => $user['license_no'],
            'boat_default_name' => $user['boat_default_name'],
            'boatName' => $user['boat_default_name'],
            'boat_default_reg' => $user['boat_default_reg'],
            'boatRegNo' => $user['boat_default_reg'],
            'boat_default_capacity' => (int)$user['boat_default_capacity'],
            'boatCapacity' => (int)$user['boat_default_capacity'],
            'defaultCapacity' => (int)$user['boat_default_capacity'],
            'phone' => $user['phone'],
            'port' => $user['port'],
            'ic_passport' => $user['ic_passport'],
            'boat_type' => $user['boat_type']
        ]
    ]);
    exit;
}

// 0b. GET /api/auth/accounts (Penyegerakan Senarai Pengguna dari MySQL)
if ($method === 'GET' && ($endpoint === 'auth/accounts' || $endpoint === 'accounts')) {
    $stmt = $db->query("SELECT id, name, email, role, license_no, boat_default_name, boat_default_reg, boat_default_capacity, phone, port, ic_passport, boat_type FROM users ORDER BY id ASC");
    $rawUsers = $stmt->fetchAll();
    $users = [];
    foreach ($rawUsers as $u) {
        $roleNormalized = strtoupper($u['role']);
        if ($roleNormalized === 'DRIVER') $roleNormalized = 'TEKONG';
        $users[] = [
            'id' => $u['id'],
            'name' => $u['name'],
            'fullName' => $u['name'],
            'username' => $u['id'],
            'email' => $u['email'],
            'role' => $roleNormalized,
            'license_no' => $u['license_no'],
            'boat_default_name' => $u['boat_default_name'],
            'boat_default_reg' => $u['boat_default_reg'],
            'boat_default_capacity' => (int)$u['boat_default_capacity'],
            'phone' => $u['phone'],
            'port' => $u['port'],
            'ic_passport' => $u['ic_passport'],
            'boat_type' => $u['boat_type']
        ];
    }
    echo json_encode(['success' => true, 'users' => $users]);
    exit;
}

// 0c. POST /api/auth/register (Pendaftaran Pengguna Baharu ke MySQL)
if ($method === 'POST' && ($endpoint === 'auth/register' || $endpoint === 'register')) {
    $body = getJsonBody();
    $fullName = trim(isset($body['fullName']) ? $body['fullName'] : (isset($body['name']) ? $body['name'] : ''));
    $role = strtoupper(isset($body['role']) ? $body['role'] : 'TEKONG');
    $dbRole = ($role === 'ADMIN') ? 'admin' : (($role === 'JLM') ? 'jlm' : 'driver');
    $password = trim(isset($body['password']) ? (string)$body['password'] : 'pass123');
    $phone = isset($body['phone']) ? trim($body['phone']) : null;
    $licenseNo = isset($body['licenseNo']) ? trim($body['licenseNo']) : null;
    $ic = isset($body['ic_passport']) ? trim($body['ic_passport']) : null;
    $boatType = isset($body['boat_type']) ? trim($body['boat_type']) : 'mini_speedboat';
    $boatName = isset($body['boatName']) ? trim($body['boatName']) : null;
    $boatReg = isset($body['boatRegNo']) ? trim($body['boatRegNo']) : null;
    $capacity = isset($body['boatCapacity']) ? (int)$body['boatCapacity'] : 12;
    $port = isset($body['port']) ? trim($body['port']) : 'Jeti Kuala Besut';
    $email = isset($body['email']) ? trim($body['email']) : null;

    if (!$fullName) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Sila masukkan nama penuh anda.']);
        exit;
    }

    // Semak jika nama telah wujud
    $chk = $db->prepare("SELECT id FROM users WHERE LOWER(name) = LOWER(?) LIMIT 1");
    $chk->execute([$fullName]);
    if ($chk->fetch()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Nama \"{$fullName}\" telah pun didaftarkan."]);
        exit;
    }

    // Jana ID Pengguna Baharu
    if ($dbRole === 'admin') {
        $userId = 'ADMIN-MCH-' . rand(100, 999);
    } elseif ($dbRole === 'jlm') {
        $userId = 'JLM-' . rand(100, 999);
    } else {
        $userId = 'MCH-TK-' . rand(1000, 9999);
    }

    $ins = $db->prepare("INSERT INTO users (id, name, email, password, role, license_no, boat_default_name, boat_default_reg, boat_default_capacity, phone, port, ic_passport, boat_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $ins->execute([$userId, $fullName, $email, $password, $dbRole, $licenseNo, $boatName, $boatReg, $capacity, $phone, $port, $ic, $boatType]);

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'mysqlSaved' => true,
        'database' => 'MySQL / MariaDB (epenumpa_db)',
        'user' => [
            'id' => $userId,
            'name' => $fullName,
            'role' => $dbRole,
            'license_no' => $licenseNo
        ]
    ]);
    exit;
}
if ($method === 'GET' && $endpoint === 'trips') {
    $driverId = isset($_GET['driver_id']) ? trim($_GET['driver_id']) : '';
    if ($driverId) {
        $stmt = $db->prepare("SELECT * FROM trips WHERE driver_id = ? ORDER BY created_at DESC");
        $stmt->execute([$driverId]);
    } else {
        $stmt = $db->query("SELECT * FROM trips ORDER BY created_at DESC");
    }
    $rows = $stmt->fetchAll();
    $trips = [];
    foreach ($rows as $r) {
        $trips[] = formatTripRow($db, $r);
    }
    echo json_encode(['trips' => $trips]);
    exit;
}

// 2. POST /api/trips/:id/passengers (Daftar Penumpang Baharu)
if ($method === 'POST' && preg_match('#^trips/([^/]+)/passengers$#', $endpoint, $m)) {
    $tripId = $m[1];
    $body = getJsonBody();

    $name = trim(isset($body['name']) ? $body['name'] : (isset($body['fullName']) ? $body['fullName'] : ''));
    $ic = strtoupper(trim(isset($body['icPassport']) ? $body['icPassport'] : (isset($body['icOrPassport']) ? $body['icOrPassport'] : '')));
    $age = isset($body['age']) && is_numeric($body['age']) ? (int)$body['age'] : null;
    $address = trim(isset($body['shortAddress']) ? $body['shortAddress'] : '');
    $phone = trim(isset($body['phone']) ? $body['phone'] : '');
    $emergency = trim(isset($body['emergencyPhone']) ? $body['emergencyPhone'] : '');
    $lifejacket = isset($body['lifejacket']) ? ($body['lifejacket'] ? 1 : 0) : 1;

    if (!$name || !$ic || !$phone) {
        http_response_code(400);
        echo json_encode(['error' => 'Sila lengkapkan nama penuh, no. kad pengenalan/pasport, dan no. telefon.']);
        exit;
    }

    // Check trip & capacity
    $tStmt = $db->prepare("SELECT * FROM trips WHERE id = ?");
    $tStmt->execute([$tripId]);
    $trip = $tStmt->fetch();

    if (!$trip) {
        http_response_code(404);
        echo json_encode(['error' => 'Trip tidak dijumpai.']);
        exit;
    }

    $cStmt = $db->prepare("SELECT COUNT(*) as cnt FROM passengers WHERE trip_id = ?");
    $cStmt->execute([$tripId]);
    $countRow = $cStmt->fetch();
    $currentCount = (int)$countRow['cnt'];
    $maxCap = (int)$trip['boat_capacity'];

    if ($currentCount >= $maxCap) {
        http_response_code(409);
        echo json_encode([
            'error' => "KAPASITI BOT PENUH! Had keselamatan kapasiti bot ({$maxCap} penumpang) telah dicapai.",
            'code' => 'CAPACITY_FULL',
            'currentCount' => $currentCount,
            'maxCapacity' => $maxCap
        ]);
        exit;
    }

    // Insert Passenger
    $paxId = 'PAX-' . preg_replace('/^TRIP-2026-|^TRP-2026-/', '', $tripId) . '-' . str_pad($currentCount + 1, 2, '0', STR_PAD_LEFT);
    $now = date('Y-m-d H:i:s');

    $ins = $db->prepare("INSERT INTO passengers (id, trip_id, full_name, ic_passport, age, short_address, phone, emergency_phone, lifejacket, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $ins->execute([$paxId, $tripId, $name, $ic, $age, $address ? $address : '-', $phone, $emergency ? $emergency : '-', $lifejacket, $now]);

    // Update status to FULL if capacity reached
    if ($currentCount + 1 >= $maxCap) {
        $db->prepare("UPDATE trips SET status = 'FULL' WHERE id = ?")->execute([$tripId]);
    }

    // Return formatted passenger and updated manifest
    $formattedTrip = formatTripRow($db, $trip);
    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Pendaftaran penumpang berjaya!',
        'passenger' => [
            'id' => $paxId,
            'tripId' => $tripId,
            'fullName' => $name,
            'name' => $name,
            'icOrPassport' => $ic,
            'ic_passport' => $ic,
            'age' => $age !== null ? $age : '-',
            'shortAddress' => $address,
            'phone' => $phone,
            'emergencyPhone' => $emergency ? $emergency : '-',
            'lifejacket' => (bool)$lifejacket,
            'seatNumber' => (string)($currentCount + 1),
            'registeredAt' => $now
        ],
        'trip' => $formattedTrip,
        'tripManifest' => $formattedTrip
    ]);
    exit;
}

// 5. POST /api/trips (Cipta Trip Baharu)
if ($method === 'POST' && $endpoint === 'trips') {
    $body = getJsonBody();
    $tripId = 'TRIP-' . date('Y') . '-' . rand(100, 999);
    $driverId = isset($body['driverId']) ? $body['driverId'] : 'MCH-TK-1002';
    $boatName = isset($body['boatName']) ? $body['boatName'] : 'Bot Pelancong';
    $boatReg = isset($body['boatRegNo']) ? $body['boatRegNo'] : 'TR-0001-B';
    $cap = isset($body['boatCapacity']) ? (int)$body['boatCapacity'] : 12;
    $dest = isset($body['destination']) ? $body['destination'] : 'Pulau Perhentian';
    $jetty = isset($body['origin']) ? $body['origin'] : 'Jeti Kuala Besut';
    $depDate = isset($body['departureDate']) ? $body['departureDate'] : date('Y-m-d');
    $depTime = isset($body['departureTime']) ? $body['departureTime'] : '10:00';

    $insTrip = $db->prepare("INSERT INTO trips (id, boat_name, boat_reg_no, boat_capacity, driver_id, destination, departure_jetty, departure_date, departure_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')");
    $insTrip->execute([$tripId, $boatName, $boatReg, $cap, $driverId, $dest, $jetty, $depDate, $depTime]);

    // Drivers
    $driverList = isset($body['driverList']) && is_array($body['driverList']) ? $body['driverList'] : [['name' => 'Tekong Utama', 'ic_passport' => '-', 'license_no' => '-', 'role' => 'Tekong Utama']];
    $insDriver = $db->prepare("INSERT INTO trip_drivers (trip_id, name, ic_passport, license_no, role) VALUES (?, ?, ?, ?, ?)");
    foreach ($driverList as $d) {
        if (!empty($d['name'])) {
            $insDriver->execute([$tripId, $d['name'], isset($d['ic_passport']) ? $d['ic_passport'] : '-', isset($d['license_no']) ? $d['license_no'] : '-', isset($d['role']) ? $d['role'] : 'Tekong']);
        }
    }

    // Crew
    $crewList = isset($body['crewList']) && is_array($body['crewList']) ? $body['crewList'] : (isset($body['crew']) && is_array($body['crew']) ? $body['crew'] : []);
    $insCrew = $db->prepare("INSERT INTO crew_members (trip_id, name, ic_passport, role) VALUES (?, ?, ?, ?)");
    foreach (array_slice($crewList, 0, 5) as $c) {
        if (!empty($c['name'])) {
            $insCrew->execute([$tripId, $c['name'], isset($c['ic_passport']) ? $c['ic_passport'] : '-', isset($c['role']) ? $c['role'] : 'Awak-awak']);
        }
    }

    $tStmt = $db->prepare("SELECT * FROM trips WHERE id = ?");
    $tStmt->execute([$tripId]);
    $manifest = formatTripRow($db, $tStmt->fetch());

    http_response_code(201);
    echo json_encode(['success' => true, 'tripId' => $tripId, 'manifest' => $manifest]);
    exit;
}

// 6. POST /api/trips/:id/approve
if ($method === 'POST' && preg_match('#^trips/([^/]+)/approve$#', $endpoint, $m)) {
    $tripId = $m[1];
    $now = date('Y-m-d H:i:s');
    $db->prepare("UPDATE trips SET status = 'APPROVED', approved_at = ? WHERE id = ?")->execute([$now, $tripId]);

    $tStmt = $db->prepare("SELECT * FROM trips WHERE id = ?");
    $tStmt->execute([$tripId]);
    echo json_encode(['success' => true, 'manifest' => formatTripRow($db, $tStmt->fetch())]);
    exit;
}

// 7. DELETE /api/trips/:tripId/passengers/:paxId
if ($method === 'DELETE' && preg_match('#^trips/([^/]+)/passengers/([^/]+)$#', $endpoint, $m)) {
    $tripId = $m[1];
    $paxId = $m[2];
    $db->prepare("DELETE FROM passengers WHERE trip_id = ? AND id = ?")->execute([$tripId, $paxId]);
    $db->prepare("UPDATE trips SET status = 'OPEN' WHERE id = ? AND status = 'FULL'")->execute([$tripId]);
    echo json_encode(['success' => true]);
    exit;
}

// 8. POST /api/trips/:tripId/passengers/:paxId/toggle-jacket
if ($method === 'POST' && preg_match('#^trips/([^/]+)/passengers/([^/]+)/toggle-jacket$#', $endpoint, $m)) {
    $tripId = $m[1];
    $paxId = $m[2];
    $db->prepare("UPDATE passengers SET lifejacket = 1 - lifejacket WHERE trip_id = ? AND id = ?")->execute([$tripId, $paxId]);
    echo json_encode(['success' => true]);
    exit;
}

// 9. Weather Advisory
if ($method === 'GET' && $endpoint === 'weather/advisory') {
    echo json_encode([
        'success' => true,
        'advisory' => [
            'port' => 'Jeti Kuala Besut',
            'seaState' => 'Tenang / Baik',
            'seaStateEn' => 'Calm / Smooth',
            'waveHeight' => '0.5m – 1.0m',
            'windSpeed' => '10 – 20 km/j',
            'windDirection' => 'Barat Daya (SW)',
            'level' => 'GREEN',
            'clearanceStatus' => 'PELEPASAN DIBENARKAN',
            'clearanceStatusEn' => 'DEPARTURE CLEARANCE GRANTED',
            'advisoryNote' => 'Keadaan laut mengizinkan pelayaran bot pelancong ke Pulau Perhentian.',
            'advisoryNoteEn' => 'Sea conditions safe for passenger boat departure.'
        ]
    ]);
    exit;
}

// 10. System Status & Database Connection Diagnostic
if ($endpoint === '' || $endpoint === 'status' || $endpoint === 'health' || $endpoint === 'check') {
    try {
        $db = getDbConnection();
        $userCount = 0;
        $tripCount = 0;
        try {
            $uStmt = $db->query("SELECT COUNT(*) AS c FROM users");
            $userCount = (int)$uStmt->fetchColumn();
            $tStmt = $db->query("SELECT COUNT(*) AS c FROM trips");
            $tripCount = (int)$tStmt->fetchColumn();
        } catch (Exception $e) {}

        echo json_encode([
            'status' => 'ONLINE',
            'database_connected' => true,
            'database_name' => defined('DB_NAME') ? DB_NAME : 'epenumpa_db',
            'database_user' => defined('DB_USER') ? DB_USER : 'epenumpa_db',
            'users_in_database' => $userCount,
            'trips_in_database' => $tripCount,
            'server_time' => date('Y-m-d H:i:s'),
            'message' => 'Pangkalan data MySQL disambung dengan jaya! Sistem sedia digunakan.'
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'status' => 'ERROR',
            'database_connected' => false,
            'error' => $e->getMessage()
        ]);
    }
    exit;
}

// Fallback
http_response_code(404);
echo json_encode(['error' => 'API route not found', 'endpoint' => $endpoint]);

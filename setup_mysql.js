// setup_mysql.js - Automated MySQL Migration & Seed Tool for e-PENUMPANG
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mysql = require('./mysql_driver.js');

console.log('======================================================================');
console.log('   e-PENUMPANG: Penyediaan Pangkalan Data MySQL / MariaDB (SMC)       ');
console.log('======================================================================');

async function setup() {
  const sqlFile = path.join(__dirname, 'database.sql');
  if (!fs.existsSync(sqlFile)) {
    console.error('Ralat: Fail database.sql tidak ditemui.');
    process.exit(1);
  }

  console.log(`[1] Menyemak sambungan pelayan MySQL (${mysql.CONFIG.host}:${mysql.CONFIG.port})...`);
  const initialCheck = await mysql.testConnection();

  if (!initialCheck.connected) {
    console.error('❌ Gagal menyambung ke MySQL:', initialCheck.error);
    console.log('\nPanduan Tindakan:');
    console.log('1. Pastikan perkhidmatan MySQL/MariaDB (cth: XAMPP Control Panel) telah dimulakan (Started).');
    console.log('2. Semak fail config.json atau tetapkan pembolehubah persekitaran DB_USER & DB_PASSWORD jika menggunakan kata laluan.');
    process.exit(1);
  }

  console.log(`✔ Pelayan MySQL Dikesan: ${initialCheck.version}`);
  console.log(`\n[2] Melaksanakan migrasi fail skema & data awalan: ${path.basename(sqlFile)}...`);

  try {
    const mysqlBin = mysql.CONFIG.mysqlBin;
    const cmd = `"${mysqlBin}" -h ${mysql.CONFIG.host} -P ${mysql.CONFIG.port} -u ${mysql.CONFIG.user} ${mysql.CONFIG.password ? `-p${mysql.CONFIG.password}` : ''} < "${sqlFile}"`;
    execSync(cmd, { shell: 'cmd.exe', stdio: 'pipe' });
    console.log('✔ Skema jadual dan rekod awalan berjaya diimport ke dalam pangkalan data "e_penumpang".');
  } catch (migErr) {
    console.error('❌ Ralat semasa import SQL:', migErr.message);
    process.exit(1);
  }

  console.log('\n[3] Mengesahkan jadual dan integriti data dalam MySQL:');
  try {
    const tables = await mysql.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('   Senarai Jadual Aktif:', tableNames.join(', '));

    const [userCount] = await mysql.query('SELECT COUNT(*) as count FROM users');
    const [tripCount] = await mysql.query('SELECT COUNT(*) as count FROM trips');
    const [paxCount] = await mysql.query('SELECT COUNT(*) as count FROM passengers');
    const [driverCount] = await mysql.query('SELECT COUNT(*) as count FROM trip_drivers');
    const [crewCount] = await mysql.query('SELECT COUNT(*) as count FROM crew_members');

    console.log(`   • Jumlah Pengguna (Tekong/Admin): ${userCount ? userCount.count : 0} orang`);
    console.log(`   • Jumlah Trip Pelayaran:         ${tripCount ? tripCount.count : 0} trip`);
    console.log(`   • Pemandu Bertugas (Max 5/trip): ${driverCount ? driverCount.count : 0} orang`);
    console.log(`   • Kru Awak-awak (Asing):         ${crewCount ? crewCount.count : 0} orang`);
    console.log(`   • Manifes Penumpang Berdaftar:   ${paxCount ? paxCount.count : 0} penumpang`);

    console.log('\n======================================================================');
    console.log('   PANGKALAN DATA MYSQL TELAH SIAP DAN BERJAYA DIHUBUNGKAN 100%!     ');
    console.log('======================================================================');
    console.log('\nAnda kini boleh mengakses e-PENUMPANG melalui:');
    console.log('  Web App: http://localhost:3000');
    console.log('  phpMyAdmin (jika guna XAMPP): http://localhost/phpmyadmin/index.php?route=/database/structure&db=e_penumpang');
  } catch (err) {
    console.error('Ralat pengesahan:', err.message);
  }
}

setup();

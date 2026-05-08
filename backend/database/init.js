const bcrypt = require('bcryptjs');
const { initDB, run, queryOne } = require('./db');

const SALT_ROUNDS = 10;

async function main() {
    console.log('🗄️  Initialising database...');
    const db = await initDB();

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            user_id       TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL CHECK(role IN ('student','parent','warden')),
            linked_id     TEXT,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            student_id  TEXT PRIMARY KEY,
            full_name   TEXT NOT NULL,
            roll_number TEXT UNIQUE NOT NULL,
            room_number TEXT NOT NULL,
            hostel_name TEXT NOT NULL,
            course      TEXT NOT NULL,
            year        INTEGER NOT NULL,
            phone       TEXT,
            email       TEXT,
            parent_id   TEXT
        );
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS parents (
            parent_id  TEXT PRIMARY KEY,
            full_name  TEXT NOT NULL,
            phone      TEXT,
            email      TEXT,
            student_id TEXT NOT NULL
        );
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS wardens (
            warden_id   TEXT PRIMARY KEY,
            full_name   TEXT NOT NULL,
            hostel_name TEXT NOT NULL,
            phone       TEXT,
            email       TEXT
        );
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS outpass_requests (
            request_id        INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id        TEXT NOT NULL,
            reason            TEXT NOT NULL,
            destination       TEXT NOT NULL,
            outgoing_datetime DATETIME NOT NULL,
            return_datetime   DATETIME NOT NULL,
            status            TEXT NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('pending','approved','rejected')),
            parent_verified   INTEGER NOT NULL DEFAULT 0,
            parent_note       TEXT,
            warden_note       TEXT,
            submitted_by      TEXT NOT NULL CHECK(submitted_by IN ('student','parent')),
            created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            log_id     INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_id   TEXT NOT NULL,
            action     TEXT NOT NULL,
            target_id  TEXT,
            details    TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.persist();
    console.log('✅ Tables created.');

    const users = [
        { id: 'STU001', password: 'student123', role: 'student', linked: 'STU001' },
        { id: 'STU002', password: 'student456', role: 'student', linked: 'STU002' },
        { id: 'PAR001', password: 'parent123',  role: 'parent',  linked: 'STU001' },
        { id: 'PAR002', password: 'parent456',  role: 'parent',  linked: 'STU002' },
        { id: 'WAR001', password: 'warden123',  role: 'warden',  linked: null     },
    ];

    for (const u of users) {
        const exists = queryOne(db, 'SELECT user_id FROM users WHERE user_id = ?', [u.id]);
        if (!exists) {
            const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
            run(db, `INSERT INTO users (user_id, password_hash, role, linked_id) VALUES (?, ?, ?, ?)`,
                [u.id, hash, u.role, u.linked]);
        }
    }
    console.log('✅ Users seeded (passwords hashed with bcrypt).');

    const s1 = queryOne(db, 'SELECT student_id FROM students WHERE student_id = ?', ['STU001']);
    if (!s1) run(db, `INSERT INTO students (student_id,full_name,roll_number,room_number,hostel_name,course,year,phone,email,parent_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        ['STU001','Arjun Sharma','2021CS001','Room 204','Tagore Hostel','B.Tech CSE',3,'9876543210','arjun@college.edu','PAR001']);

    const s2 = queryOne(db, 'SELECT student_id FROM students WHERE student_id = ?', ['STU002']);
    if (!s2) run(db, `INSERT INTO students (student_id,full_name,roll_number,room_number,hostel_name,course,year,phone,email,parent_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        ['STU002','Priya Verma','2021EC002','Room 108','Tagore Hostel','B.Tech ECE',3,'9876543211','priya@college.edu','PAR002']);

    const p1 = queryOne(db, 'SELECT parent_id FROM parents WHERE parent_id = ?', ['PAR001']);
    if (!p1) run(db, `INSERT INTO parents (parent_id,full_name,phone,email,student_id) VALUES (?,?,?,?,?)`,
        ['PAR001','Ramesh Sharma','9876500001','ramesh@email.com','STU001']);

    const p2 = queryOne(db, 'SELECT parent_id FROM parents WHERE parent_id = ?', ['PAR002']);
    if (!p2) run(db, `INSERT INTO parents (parent_id,full_name,phone,email,student_id) VALUES (?,?,?,?,?)`,
        ['PAR002','Sunita Verma','9876500002','sunita@email.com','STU002']);

    const w1 = queryOne(db, 'SELECT warden_id FROM wardens WHERE warden_id = ?', ['WAR001']);
    if (!w1) run(db, `INSERT INTO wardens (warden_id,full_name,hostel_name,phone,email) VALUES (?,?,?,?,?)`,
        ['WAR001','Dr. Kavita Singh','Tagore Hostel','9876500010','kavita@college.edu']);

    const r1 = queryOne(db, 'SELECT request_id FROM outpass_requests WHERE request_id = 1');
    if (!r1) {
        run(db, `INSERT INTO outpass_requests (student_id,reason,destination,outgoing_datetime,return_datetime,status,parent_verified,submitted_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            ['STU001','Medical appointment','City Hospital','2024-12-20 09:00','2024-12-20 18:00','approved',1,'parent','2024-12-19 10:00','2024-12-19 14:00']);
        run(db, `INSERT INTO outpass_requests (student_id,reason,destination,outgoing_datetime,return_datetime,status,parent_verified,submitted_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            ['STU002','Family function','Home - Delhi','2024-12-21 08:00','2024-12-23 20:00','pending',0,'student','2024-12-20 09:00','2024-12-20 09:00']);
        run(db, `INSERT INTO outpass_requests (student_id,reason,destination,outgoing_datetime,return_datetime,status,parent_verified,submitted_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            ['STU001','Weekend home visit','Home - Jaipur','2024-12-14 10:00','2024-12-16 19:00','rejected',0,'student','2024-12-13 11:00','2024-12-13 15:00']);
    }

    console.log('✅ Sample data inserted.');
    console.log('\n📋 LOGIN CREDENTIALS:');
    console.log('  Student  : STU001 / student123');
    console.log('  Student  : STU002 / student456');
    console.log('  Parent   : PAR001 / parent123');
    console.log('  Parent   : PAR002 / parent456');
    console.log('  Warden   : WAR001 / warden123');
    console.log('\n🚀 Run: node server.js to start the server.');
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});

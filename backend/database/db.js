const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, 'outpass.db');

let db = null;

function persist() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function initDB() {
    if (db) return db;
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }
    db.run('PRAGMA foreign_keys = ON;');
    db.persist = persist;
    return db;
}

function getDB() {
    if (!db) throw new Error('DB not initialised. Ensure initDB() was awaited at startup.');
    return db;
}

function queryAll(database, sql, params = []) {
    const stmt = database.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

function queryOne(database, sql, params = []) {
    const rows = queryAll(database, sql, params);
    return rows.length > 0 ? rows[0] : null;
}

function run(database, sql, params = []) {
    database.run(sql, params);
    const meta = queryOne(database, 'SELECT changes() AS changes, last_insert_rowid() AS lastId');
    persist();
    return {
        changes: meta ? meta.changes : 0,
        lastInsertRowid: meta ? Number(meta.lastId) : null
    };
}

module.exports = { initDB, getDB, queryAll, queryOne, run, persist };

const express = require('express');
const router  = express.Router();
const { getDB, queryOne, queryAll, run } = require('../database/db');
const { verifyToken, requireParent } = require('../middleware/auth');

router.use(verifyToken, requireParent);

function logAction(db, actorId, action, targetId, details, ip) {
    try { run(db, `INSERT INTO audit_logs (actor_id,action,target_id,details,ip_address) VALUES (?,?,?,?,?)`,
        [actorId, action, targetId||null, JSON.stringify(details)||null, ip||null]); } catch(e) {}
}
router.get('/child', (req, res) => {
    const db = getDB();
    const student = queryOne(db, `
        SELECT s.*, u.user_id FROM students s
        JOIN users u ON s.student_id = u.user_id
        WHERE s.student_id = ?
    `, [req.user.linked_id]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    return res.json({ success: true, student });
});
router.get('/requests', (req, res) => {
    const db = getDB();
    const requests = queryAll(db, `
        SELECT * FROM outpass_requests WHERE student_id = ? ORDER BY created_at DESC
    `, [req.user.linked_id]);
    return res.json({ success: true, requests });
});

router.post('/requests', (req, res) => {
    const { reason, destination, outgoing_datetime, return_datetime, parent_note } = req.body;
    if (!reason || !destination || !outgoing_datetime || !return_datetime)
        return res.status(400).json({ success: false, message: 'All fields are required.' });

    if (new Date(return_datetime) <= new Date(outgoing_datetime))
        return res.status(400).json({ success: false, message: 'Return time must be after outgoing time.' });

    const db = getDB();
    const result = run(db, `
        INSERT INTO outpass_requests
        (student_id, reason, destination, outgoing_datetime, return_datetime, status, parent_verified, parent_note, submitted_by)
        VALUES (?, ?, ?, ?, ?, 'pending', 1, ?, 'parent')
    `, [req.user.linked_id, reason.trim(), destination.trim(), outgoing_datetime, return_datetime, parent_note || null]);

    logAction(db, req.user.user_id, 'PARENT_OUTPASS_SUBMITTED', result.lastInsertRowid,
        { student: req.user.linked_id }, req.ip);

    return res.status(201).json({ success: true, message: 'Parent-verified outpass request submitted.', request_id: result.lastInsertRowid });
});

router.patch('/requests/:id/verify', (req, res) => {
    const db = getDB();
    const { parent_note } = req.body;
    const request = queryOne(db, `SELECT * FROM outpass_requests WHERE request_id = ? AND student_id = ?`,
        [req.params.id, req.user.linked_id]);

    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending requests can be verified.' });

    run(db, `UPDATE outpass_requests SET parent_verified = 1, parent_note = ?, updated_at = datetime('now') WHERE request_id = ?`,
        [parent_note || null, req.params.id]);

    logAction(db, req.user.user_id, 'PARENT_VERIFIED', req.params.id, { student: req.user.linked_id }, req.ip);
    return res.json({ success: true, message: 'Request marked as parent-verified.' });
});

router.get('/stats', (req, res) => {
    const db = getDB();
    const all = queryAll(db, `SELECT status, parent_verified FROM outpass_requests WHERE student_id = ?`,
        [req.user.linked_id]);
    const stats = {
        total:            all.length,
        pending:          all.filter(r => r.status === 'pending').length,
        approved:         all.filter(r => r.status === 'approved').length,
        rejected:         all.filter(r => r.status === 'rejected').length,
        verified_by_parent: all.filter(r => r.parent_verified == 1).length
    };
    return res.json({ success: true, stats });
});

module.exports = router;

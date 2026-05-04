import { query, queryOne, run } from '../config/mysql.js';

export const Note = {
  async findByUserAndProblem(userId, problemId) {
    return await queryOne(
      'SELECT * FROM problem_notes WHERE user_id = ? AND problem_id = ?',
      [userId, problemId]
    );
  },

  async upsert(userId, problemId, content) {
    return await run(
      `INSERT INTO problem_notes (user_id, problem_id, content) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = CURRENT_TIMESTAMP`,
      [userId, problemId, content]
    );
  },

  async delete(userId, problemId) {
    return await run(
      'DELETE FROM problem_notes WHERE user_id = ? AND problem_id = ?',
      [userId, problemId]
    );
  },

  async findAllByUser(userId) {
    return await query(
      `SELECT n.*, p.title as problem_title 
       FROM problem_notes n 
       JOIN problems p ON n.problem_id = p.id 
       WHERE n.user_id = ? 
       ORDER BY n.updated_at DESC`,
      [userId]
    );
  }
};

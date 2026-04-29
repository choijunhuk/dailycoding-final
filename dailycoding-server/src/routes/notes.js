import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { Note } from '../models/Note.js';

const router = Router();

// GET /api/notes/:problemId - Get note for a problem
router.get('/:problemId', auth, async (req, res) => {
  try {
    const note = await Note.findByUserAndProblem(req.user.id, req.params.problemId);
    res.json(note || { content: '' });
  } catch (err) {
    res.status(500).json({ message: '노트 조회 실패' });
  }
});

// POST /api/notes/:problemId - Upsert note
router.post('/:problemId', auth, async (req, res) => {
  const { content } = req.body;
  try {
    await Note.upsert(req.user.id, req.params.problemId, content);
    res.json({ message: '노트가 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ message: '노트 저장 실패' });
  }
});

// DELETE /api/notes/:problemId - Delete note
router.delete('/:problemId', auth, async (req, res) => {
  try {
    await Note.delete(req.user.id, req.params.problemId);
    res.json({ message: '노트가 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ message: '노트 삭제 실패' });
  }
});

// GET /api/notes - Get all notes for user
router.get('/', auth, async (req, res) => {
  try {
    const notes = await Note.findAllByUser(req.user.id);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: '전체 노트 조회 실패' });
  }
});

export default router;

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
    res.status(500).json({ message: 'Failed to retrieve note.' });
  }
});

// POST /api/notes/:problemId - Upsert note
router.post('/:problemId', auth, async (req, res) => {
  const { content } = req.body;
  try {
    await Note.upsert(req.user.id, req.params.problemId, content);
    res.json({ message: 'Note saved.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save note.' });
  }
});

// DELETE /api/notes/:problemId - Delete note
router.delete('/:problemId', auth, async (req, res) => {
  try {
    await Note.delete(req.user.id, req.params.problemId);
    res.json({ message: 'Note deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete note.' });
  }
});

// GET /api/notes - Get all notes for user
router.get('/', auth, async (req, res) => {
  try {
    const notes = await Note.findAllByUser(req.user.id);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve notes.' });
  }
});

export default router;

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Copy, Link, Plus, Trash2, Edit3, Check, X, ExternalLink } from 'lucide-react';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { formatWithLang, pickLangText } from '../utils/languageMode.js';

const FRONTEND_BASE = window.location.origin;

function ProblemSetCard({ set, onEdit, onDelete, onShare, onRevokeShare, lang }) {
  const navigate = useNavigate();
  const toast = useToast();
  const txt = (ko, en) => pickLangText(lang, ko, en);

  const copyLink = () => {
    const url = `${FRONTEND_BASE}/problem-sets/shared/${set.shareToken}`;
    navigator.clipboard?.writeText(url).then(() => toast?.show(txt('링크가 복사되었습니다!', 'Link copied!'), 'success'));
  };

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg2)',
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {set.name}
          </div>
          {set.description && (
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>{set.description}</div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {set.problemIds?.length || 0}{txt('문제', ' problems')} · {formatWithLang(lang, set.updatedAt || set.createdAt)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => onEdit(set)}>
            <Edit3 size={14} />
          </button>
          <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--red)' }} onClick={() => onDelete(set.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {set.problemIds?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {set.problemIds.slice(0, 8).map((pid) => (
            <span key={pid} style={{
              padding: '2px 8px', borderRadius: 20, fontSize: 11,
              background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer',
            }} onClick={() => navigate(`/problems/${pid}`)}>#{pid}</span>
          ))}
          {set.problemIds.length > 8 && (
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: 'var(--bg3)', color: 'var(--text3)' }}>
              +{set.problemIds.length - 8}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {set.shareToken ? (
          <>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--green)' }} onClick={copyLink}>
              <Copy size={13} /> {txt('링크 복사', 'Copy Link')}
            </button>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => navigate(`/problem-sets/shared/${set.shareToken}`)}>
              <ExternalLink size={13} /> {txt('미리보기', 'Preview')}
            </button>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--red)' }}
              onClick={() => onRevokeShare(set.id)}>
              <X size={13} /> {txt('링크 해제', 'Revoke Link')}
            </button>
          </>
        ) : (
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => onShare(set.id)}>
            <Link size={13} /> {txt('공유 링크 만들기', 'Create Share Link')}
          </button>
        )}
      </div>
    </div>
  );
}

function EditModal({ set, onSave, onClose, lang }) {
  const [name, setName] = useState(set?.name || '');
  const [description, setDescription] = useState(set?.description || '');
  const [problemIdsText, setProblemIdsText] = useState((set?.problemIds || []).join(', '));
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const txt = (ko, en) => pickLangText(lang, ko, en);

  const handleSave = async () => {
    if (!name.trim()) return toast?.show(txt('이름을 입력해주세요.', 'Please enter a name.'), 'error');
    const problemIds = problemIdsText.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    setSaving(true);
    await onSave({ name: name.trim(), description: description.trim(), problemIds });
    setSaving(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 28, width: '100%', maxWidth: 560,
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>{set?.id ? txt('문제 세트 편집', 'Edit Problem Set') : txt('새 문제 세트', 'New Problem Set')}</h2>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
            {txt('세트 이름', 'Set Name')} *
          </label>
          <input className="input" style={{ width: '100%' }} value={name}
            onChange={(e) => setName(e.target.value)} placeholder={txt('예: 그래프 알고리즘 모음', 'e.g. Graph Algorithm Collection')} maxLength={200} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{txt('설명 (선택)', 'Description (optional)')}</label>
          <textarea className="input" style={{ width: '100%', minHeight: 80, resize: 'vertical' }}
            value={description} onChange={(e) => setDescription(e.target.value)} placeholder={txt('이 문제 세트에 대한 설명', 'Description of this problem set')} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
            {txt('문제 ID 목록 (쉼표 또는 공백으로 구분)', 'Problem ID List (comma or space separated)')}
          </label>
          <textarea className="input mono" style={{ width: '100%', minHeight: 80, resize: 'vertical', fontSize: 13 }}
            value={problemIdsText} onChange={(e) => setProblemIdsText(e.target.value)}
            placeholder={txt('예) 1001, 1002, 1003', 'e.g. 1001, 1002, 1003')} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>{txt('취소', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? txt('저장 중...', 'Saving...') : <><Check size={15} /> {txt('저장', 'Save')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function SharedSetView({ token }) {
  const [set, setSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { lang } = useLang();
  const txt = (ko, en) => pickLangText(lang, ko, en);

  useEffect(() => {
    api.get(`/problem-sets/shared/${token}`)
      .then((r) => setSet(r.data))
      .catch(() => toast?.show(txt('문제 세트를 찾을 수 없습니다.', 'Problem set not found.'), 'error'))
      .finally(() => setLoading(false));
  }, [token, toast]);

  const importSet = async () => {
    setImporting(true);
    try {
      await api.post('/problem-sets', {
        name: `${txt('[가져옴]', '[Imported]')} ${set.name}`,
        description: set.description,
        problemIds: set.problemIds,
      });
      toast?.show(txt('문제 세트를 내 목록으로 가져왔습니다!', 'Problem set imported to your list!'), 'success');
      navigate('/problem-sets');
    } catch (err) {
      toast?.show(err.response?.data?.message || txt('가져오기 실패', 'Import failed.'), 'error');
    }
    setImporting(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{txt('로딩 중...', 'Loading...')}</div>;
  if (!set) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{txt('문제 세트를 찾을 수 없습니다.', 'Problem set not found.')}</div>;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 16px' }}>
      <button className="btn btn-ghost" style={{ marginBottom: 20 }} onClick={() => navigate(-1)}>← {txt('뒤로', 'Back')}</button>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 22 }}>{set.name}</h1>
            {set.description && <p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>{set.description}</p>}
          </div>
          <button className="btn btn-primary" onClick={importSet} disabled={importing} style={{ flexShrink: 0 }}>
            {importing ? txt('가져오는 중...', 'Importing...') : txt('내 세트로 가져오기', 'Import to My Sets')}
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>{set.problemIds?.length || 0}{txt('문제', ' problems')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(set.problemIds || []).map((pid) => (
            <a key={pid} href={`/problems/${pid}`} onClick={(e) => { e.preventDefault(); navigate(`/problems/${pid}`); }}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: 'var(--bg3)', color: 'var(--accent)', border: '1px solid var(--border)',
                textDecoration: 'none', cursor: 'pointer',
              }}>
              #{pid}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProblemSetsPage() {
  const { token } = useParams();
  const toast = useToast();
  const { lang } = useLang();
  const txt = (ko, en) => pickLangText(lang, ko, en);
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(null);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/problem-sets');
      setSets(data.sets || []);
    } catch {
      toast?.show(txt('불러오기 실패', 'Failed to load.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (!token) load(); }, [token, load]);

  if (token) return <SharedSetView token={token} />;

  const handleSave = async ({ name, description, problemIds }) => {
    try {
      if (editModal?.id) {
        await api.put(`/problem-sets/${editModal.id}`, { name, description, problemIds });
        toast?.show(txt('저장됐습니다!', 'Saved!'), 'success');
      } else {
        await api.post('/problem-sets', { name, description, problemIds });
        toast?.show(txt('문제 세트가 생성되었습니다!', 'Problem set created!'), 'success');
      }
      setEditModal(null);
      load();
    } catch (err) {
      toast?.show(err.response?.data?.message || txt('저장 실패', 'Save failed.'), 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(txt('정말 삭제할까요?', 'Are you sure you want to delete this?'))) return;
    try {
      await api.delete(`/problem-sets/${id}`);
      toast?.show(txt('삭제됐습니다.', 'Deleted.'), 'success');
      load();
    } catch {
      toast?.show(txt('삭제 실패', 'Delete failed.'), 'error');
    }
  };

  const handleShare = async (id) => {
    try {
      const { data } = await api.post(`/problem-sets/${id}/share`);
      const url = `${FRONTEND_BASE}/problem-sets/shared/${data.token}`;
      navigator.clipboard?.writeText(url).then(() => toast?.show(txt('공유 링크가 복사되었습니다!', 'Share link copied!'), 'success'));
      load();
    } catch {
      toast?.show(txt('공유 링크 생성 실패', 'Failed to create share link.'), 'error');
    }
  };

  const handleRevokeShare = async (id) => {
    if (!window.confirm(txt('공유 링크를 해제할까요?', 'Revoke the share link?'))) return;
    try {
      await api.delete(`/problem-sets/${id}/share`);
      toast?.show(txt('공유 링크가 해제되었습니다.', 'Share link revoked.'), 'success');
      load();
    } catch {
      toast?.show(txt('실패했습니다.', 'Failed.'), 'error');
    }
  };

  const handleImportUrl = async () => {
    const match = importUrl.match(/\/problem-sets\/shared\/([a-f0-9]+)/);
    if (!match) return toast?.show(txt('올바른 공유 링크를 입력해주세요.', 'Please enter a valid share link.'), 'error');
    setImporting(true);
    try {
      const { data: sharedSet } = await api.get(`/problem-sets/shared/${match[1]}`);
      await api.post('/problem-sets', {
        name: `${txt('[가져옴]', '[Imported]')} ${sharedSet.name}`,
        description: sharedSet.description,
        problemIds: sharedSet.problemIds,
      });
      toast?.show(txt('문제 세트를 가져왔습니다!', 'Problem set imported!'), 'success');
      setImportUrl('');
      load();
    } catch (err) {
      toast?.show(err.response?.data?.message || txt('가져오기 실패', 'Import failed.'), 'error');
    }
    setImporting(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      {editModal !== null && (
        <EditModal set={editModal} onSave={handleSave} onClose={() => setEditModal(null)} lang={lang} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={22} /> {txt('내 문제 세트', 'My Problem Sets')}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>
            {txt('연습하고 싶은 문제를 세트로 모으고 링크로 공유하세요.', 'Collect problems you want to practice into sets and share them via link.')}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditModal({})}>
          <Plus size={15} /> {txt('새 세트', 'New Set')}
        </button>
      </div>

      {/* Import from link */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <Link size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} />
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          placeholder={txt('가져올 문제 세트 공유 링크를 붙여넣으세요', 'Paste a share link to import a problem set')}
        />
        <button className="btn btn-primary" onClick={handleImportUrl} disabled={!importUrl.trim() || importing}
          style={{ flexShrink: 0 }}>
          {importing ? txt('가져오는 중...', 'Importing...') : txt('가져오기', 'Import')}
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{txt('로딩 중...', 'Loading...')}</div>}

      {!loading && sets.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--border)',
          borderRadius: 12, color: 'var(--text3)',
        }}>
          <BookOpen size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ margin: '0 0 16px' }}>{txt('아직 문제 세트가 없습니다.', 'You have no problem sets yet.')}</p>
          <button className="btn btn-primary" onClick={() => setEditModal({})}>
            <Plus size={15} /> {txt('첫 세트 만들기', 'Create Your First Set')}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {sets.map((set) => (
          <ProblemSetCard
            key={set.id}
            set={set}
            lang={lang}
            onEdit={(s) => setEditModal(s)}
            onDelete={handleDelete}
            onShare={handleShare}
            onRevokeShare={handleRevokeShare}
          />
        ))}
      </div>
    </div>
  );
}

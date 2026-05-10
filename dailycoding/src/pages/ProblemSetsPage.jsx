import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Copy, Link, Plus, Trash2, Edit3, Check, X, ExternalLink } from 'lucide-react';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';

const FRONTEND_BASE = window.location.origin;

function ProblemSetCard({ set, onEdit, onDelete, onShare, onRevokeShare }) {
  const navigate = useNavigate();
  const toast = useToast();

  const copyLink = () => {
    const url = `${FRONTEND_BASE}/problem-sets/shared/${set.shareToken}`;
    navigator.clipboard?.writeText(url).then(() => toast?.show('링크 복사됨!', 'success'));
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
            문제 {set.problemIds?.length || 0}개 · {new Date(set.updatedAt || set.createdAt).toLocaleDateString('ko-KR')}
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
              <Copy size={13} /> 링크 복사
            </button>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => navigate(`/problem-sets/shared/${set.shareToken}`)}>
              <ExternalLink size={13} /> 미리보기
            </button>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--red)' }}
              onClick={() => onRevokeShare(set.id)}>
              <X size={13} /> 링크 해제
            </button>
          </>
        ) : (
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => onShare(set.id)}>
            <Link size={13} /> 공유 링크 생성
          </button>
        )}
      </div>
    </div>
  );
}

function EditModal({ set, onSave, onClose }) {
  const [name, setName] = useState(set?.name || '');
  const [description, setDescription] = useState(set?.description || '');
  const [problemIdsText, setProblemIdsText] = useState((set?.problemIds || []).join(', '));
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    if (!name.trim()) return toast?.show('이름을 입력해주세요.', 'error');
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
        <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>{set?.id ? '문제 세트 편집' : '새 문제 세트'}</h2>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
            세트 이름 *
          </label>
          <input className="input" style={{ width: '100%' }} value={name}
            onChange={(e) => setName(e.target.value)} placeholder="예: 그래프 알고리즘 모음" maxLength={200} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>설명 (선택)</label>
          <textarea className="input" style={{ width: '100%', minHeight: 80, resize: 'vertical' }}
            value={description} onChange={(e) => setDescription(e.target.value)} placeholder="이 문제 세트에 대한 설명" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
            문제 ID 목록 (쉼표 또는 공백으로 구분)
          </label>
          <textarea className="input mono" style={{ width: '100%', minHeight: 80, resize: 'vertical', fontSize: 13 }}
            value={problemIdsText} onChange={(e) => setProblemIdsText(e.target.value)}
            placeholder="예: 1001, 1002, 1003" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : <><Check size={15} /> 저장</>}
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

  useEffect(() => {
    api.get(`/problem-sets/shared/${token}`)
      .then((r) => setSet(r.data))
      .catch(() => toast?.show('문제 세트를 찾을 수 없습니다.', 'error'))
      .finally(() => setLoading(false));
  }, [token, toast]);

  const importSet = async () => {
    setImporting(true);
    try {
      await api.post('/problem-sets', {
        name: `[가져옴] ${set.name}`,
        description: set.description,
        problemIds: set.problemIds,
      });
      toast?.show('문제 세트를 내 목록으로 가져왔습니다!', 'success');
      navigate('/problem-sets');
    } catch (err) {
      toast?.show(err.response?.data?.message || '가져오기 실패', 'error');
    }
    setImporting(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>불러오는 중...</div>;
  if (!set) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>문제 세트를 찾을 수 없습니다.</div>;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 16px' }}>
      <button className="btn btn-ghost" style={{ marginBottom: 20 }} onClick={() => navigate(-1)}>← 뒤로</button>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 22 }}>{set.name}</h1>
            {set.description && <p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>{set.description}</p>}
          </div>
          <button className="btn btn-primary" onClick={importSet} disabled={importing} style={{ flexShrink: 0 }}>
            {importing ? '가져오는 중...' : '내 세트로 가져오기'}
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>문제 {set.problemIds?.length || 0}개</div>
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
      toast?.show('불러오기 실패', 'error');
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
        toast?.show('저장됨!', 'success');
      } else {
        await api.post('/problem-sets', { name, description, problemIds });
        toast?.show('문제 세트가 생성되었습니다!', 'success');
      }
      setEditModal(null);
      load();
    } catch (err) {
      toast?.show(err.response?.data?.message || '저장 실패', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/problem-sets/${id}`);
      toast?.show('삭제됨', 'success');
      load();
    } catch {
      toast?.show('삭제 실패', 'error');
    }
  };

  const handleShare = async (id) => {
    try {
      const { data } = await api.post(`/problem-sets/${id}/share`);
      const url = `${FRONTEND_BASE}/problem-sets/shared/${data.token}`;
      navigator.clipboard?.writeText(url).then(() => toast?.show('공유 링크가 복사되었습니다!', 'success'));
      load();
    } catch {
      toast?.show('공유 링크 생성 실패', 'error');
    }
  };

  const handleRevokeShare = async (id) => {
    if (!window.confirm('공유 링크를 해제하시겠습니까?')) return;
    try {
      await api.delete(`/problem-sets/${id}/share`);
      toast?.show('공유 링크가 해제되었습니다.', 'success');
      load();
    } catch {
      toast?.show('실패', 'error');
    }
  };

  const handleImportUrl = async () => {
    const match = importUrl.match(/\/problem-sets\/shared\/([a-f0-9]+)/);
    if (!match) return toast?.show('올바른 공유 링크를 입력해주세요.', 'error');
    setImporting(true);
    try {
      const { data: sharedSet } = await api.get(`/problem-sets/shared/${match[1]}`);
      await api.post('/problem-sets', {
        name: `[가져옴] ${sharedSet.name}`,
        description: sharedSet.description,
        problemIds: sharedSet.problemIds,
      });
      toast?.show('문제 세트를 가져왔습니다!', 'success');
      setImportUrl('');
      load();
    } catch (err) {
      toast?.show(err.response?.data?.message || '가져오기 실패', 'error');
    }
    setImporting(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      {editModal !== null && (
        <EditModal set={editModal} onSave={handleSave} onClose={() => setEditModal(null)} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={22} /> 내 문제 세트
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>
            자주 풀어볼 문제들을 세트로 모아두고, 링크로 공유할 수 있습니다.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditModal({})}>
          <Plus size={15} /> 새 세트 만들기
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
          placeholder="공유 링크를 붙여넣어 문제 세트 가져오기"
        />
        <button className="btn btn-primary" onClick={handleImportUrl} disabled={!importUrl.trim() || importing}
          style={{ flexShrink: 0 }}>
          {importing ? '가져오는 중...' : '가져오기'}
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>불러오는 중...</div>}

      {!loading && sets.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--border)',
          borderRadius: 12, color: 'var(--text3)',
        }}>
          <BookOpen size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ margin: '0 0 16px' }}>아직 만든 문제 세트가 없습니다.</p>
          <button className="btn btn-primary" onClick={() => setEditModal({})}>
            <Plus size={15} /> 첫 번째 세트 만들기
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {sets.map((set) => (
          <ProblemSetCard
            key={set.id}
            set={set}
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

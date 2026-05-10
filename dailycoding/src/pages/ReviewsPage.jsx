import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, GitMerge, MessageSquare, Plus, RefreshCw, X } from 'lucide-react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import './ReviewsPage.css';

const STATUS_LABEL = {
  open: '열림',
  approved: '승인',
  rejected: '반려',
  merged: '병합',
};

function splitLines(value) {
  return String(value || '').split('\n');
}

function DiffViewer({ original = '', suggested = '' }) {
  const left = splitLines(original);
  const right = splitLines(suggested);
  const max = Math.max(left.length, right.length, 1);
  const rows = Array.from({ length: max }, (_, index) => ({
    no: index + 1,
    before: left[index] ?? '',
    after: right[index] ?? '',
    changed: (left[index] ?? '') !== (right[index] ?? ''),
  }));

  return (
    <div className="review-diff">
      <div className="review-diff-head"><span>원본</span><span>제안</span></div>
      {rows.map((row) => (
        <div key={row.no} className={`review-diff-row ${row.changed ? 'changed' : ''}`}>
          <pre><b>{row.no}</b>{row.before || ' '}</pre>
          <pre><b>{row.no}</b>{row.after || ' '}</pre>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }) {
  return <span className={`review-status ${status || 'open'}`}>{STATUS_LABEL[status] || status}</span>;
}

export default function ReviewsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAdmin } = useAuth();
  const [filters, setFilters] = useState({ status: 'all', lang: 'all', difficulty: '', problemId: '' });
  const [loading, setLoading] = useState(false);
  const [listData, setListData] = useState({ reviews: [], myCodeReviews: [], reviewableSubmissions: [], collaborationScore: null });
  const [review, setReview] = useState(null);
  const [comment, setComment] = useState('');
  const [codeForm, setCodeForm] = useState({ filePath: 'solution', suggestedCode: '', reason: '' });
  const [testForm, setTestForm] = useState({ inputData: '', expectedOutput: '', reason: '' });
  const isDetail = Boolean(id);
  const canResolve = review && (isAdmin || review.authorId === user?.id);
  const isClosed = review && review.status !== 'open';
  const firstSuggestion = review?.codeSuggestions?.[0] || null;

  const queryParams = useMemo(() => {
    const params = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') params[key] = value;
    });
    return params;
  }, [filters]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reviews', { params: queryParams });
      setListData({
        reviews: data.reviews || [],
        myCodeReviews: data.myCodeReviews || [],
        reviewableSubmissions: data.reviewableSubmissions || [],
        collaborationScore: data.collaborationScore || null,
      });
    } catch (err) {
      toast?.show(err.response?.data?.message || '리뷰 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, [queryParams, toast]);

  const loadReview = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/reviews/${id}`);
      setReview(data);
      setCodeForm((prev) => ({
        ...prev,
        suggestedCode: prev.suggestedCode || data.codeSuggestions?.[0]?.suggestedCode || data.submission?.code || '',
      }));
    } catch (err) {
      toast?.show(err.response?.data?.message || '리뷰를 불러오지 못했습니다.', 'error');
      navigate('/reviews', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    if (isDetail) loadReview();
    else loadList();
  }, [isDetail, loadList, loadReview]);

  const createReview = async (submissionId) => {
    try {
      const { data } = await api.post(`/submissions/${submissionId}/reviews`);
      navigate(`/reviews/${data.id}`);
    } catch (err) {
      toast?.show(err.response?.data?.message || '리뷰 생성 실패', 'error');
    }
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    try {
      const { data } = await api.post(`/reviews/${id}/comments`, { content: comment });
      setReview(data);
      setComment('');
    } catch (err) {
      toast?.show(err.response?.data?.message || '댓글 작성 실패', 'error');
    }
  };

  const submitCodeSuggestion = async () => {
    try {
      const { data } = await api.post(`/reviews/${id}/suggestions/code`, {
        filePath: codeForm.filePath,
        originalCode: review?.submission?.code || '',
        suggestedCode: codeForm.suggestedCode,
        reason: codeForm.reason,
      });
      setReview(data);
      toast?.show('코드 제안을 저장했습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '코드 제안 실패', 'error');
    }
  };

  const submitTestSuggestion = async () => {
    try {
      const { data } = await api.post(`/reviews/${id}/suggestions/test`, testForm);
      setReview(data);
      setTestForm({ inputData: '', expectedOutput: '', reason: '' });
      toast?.show('테스트 제안을 저장했습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '테스트 제안 실패', 'error');
    }
  };

  const resolveReview = async (action) => {
    try {
      const { data } = await api.post(`/reviews/${id}/${action}`);
      setReview(data);
      toast?.show('리뷰 상태가 변경되었습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '처리 실패', 'error');
    }
  };

  if (isDetail) {
    return (
      <main className="reviews-page">
        <div className="reviews-toolbar">
          <button className="ghost" onClick={() => navigate('/reviews')}>목록</button>
          <button className="ghost" onClick={loadReview}><RefreshCw size={15} />새로고침</button>
          {review && <StatusPill status={review.status} />}
        </div>

        {!review || loading ? (
          <div className="review-empty">리뷰를 불러오는 중입니다.</div>
        ) : (
          <>
            <section className="review-detail-head">
              <div>
                <p>{review.problemTitle}</p>
                <h1>{review.authorUsername}의 제출을 {review.reviewerUsername}가 리뷰 중</h1>
                <span>제출 #{review.submissionId} · {review.submission?.lang} · {review.submission?.result}</span>
              </div>
              {canResolve && (
                <div className="review-actions">
                  <button disabled={isClosed} onClick={() => resolveReview('approve')}><Check size={15} />승인</button>
                  <button disabled={isClosed} onClick={() => resolveReview('reject')}><X size={15} />반려</button>
                  <button disabled={review.status === 'merged' || review.status === 'rejected'} onClick={() => resolveReview('merge')}><GitMerge size={15} />병합</button>
                </div>
              )}
            </section>

            <section className="review-grid">
              <div className="review-panel">
                <h2>원본 코드</h2>
                <pre className="review-code">{review.submission?.code || ''}</pre>
              </div>
              <div className="review-panel">
                <h2>제안 코드</h2>
                <textarea
                  disabled={isClosed}
                  value={codeForm.suggestedCode}
                  onChange={(event) => setCodeForm((prev) => ({ ...prev, suggestedCode: event.target.value }))}
                />
                <input
                  disabled={isClosed}
                  value={codeForm.filePath}
                  onChange={(event) => setCodeForm((prev) => ({ ...prev, filePath: event.target.value }))}
                  placeholder="파일 경로"
                />
                <input
                  disabled={isClosed}
                  value={codeForm.reason}
                  onChange={(event) => setCodeForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder="변경 이유"
                />
                <button disabled={isClosed} onClick={submitCodeSuggestion}><Plus size={15} />코드 제안 추가</button>
              </div>
            </section>

            <section className="review-panel">
              <h2>Diff</h2>
              <DiffViewer original={review.submission?.code || ''} suggested={firstSuggestion?.suggestedCode || codeForm.suggestedCode} />
              {firstSuggestion?.reason && <p className="review-reason">변경 이유: {firstSuggestion.reason}</p>}
            </section>

            <section className="review-lists">
              <div className="review-panel">
                <h2>코드 제안</h2>
                {(review.codeSuggestions || []).map((item) => (
                  <article key={item.id} className="review-item">
                    <div><b>{item.filePath}</b><StatusPill status={item.status} /></div>
                    <p>{item.reason || '이유 없음'}</p>
                  </article>
                ))}
                {review.codeSuggestions?.length === 0 && <p className="muted">아직 코드 제안이 없습니다.</p>}
              </div>
              <div className="review-panel">
                <h2>테스트 제안</h2>
                <textarea disabled={isClosed} value={testForm.inputData} onChange={(event) => setTestForm((prev) => ({ ...prev, inputData: event.target.value }))} placeholder="input" />
                <textarea disabled={isClosed} value={testForm.expectedOutput} onChange={(event) => setTestForm((prev) => ({ ...prev, expectedOutput: event.target.value }))} placeholder="expected output" />
                <input disabled={isClosed} value={testForm.reason} onChange={(event) => setTestForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="제안 이유" />
                <button disabled={isClosed} onClick={submitTestSuggestion}><Plus size={15} />테스트 제안 추가</button>
                {(review.testSuggestions || []).map((item) => (
                  <article key={item.id} className="review-item">
                    <div><b>테스트 #{item.id}</b><StatusPill status={item.status} /></div>
                    <code>{item.inputData} → {item.expectedOutput}</code>
                    <p>{item.reason || '이유 없음'}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="review-panel">
              <h2>댓글</h2>
              <div className="review-comments">
                {(review.comments || []).map((item) => (
                  <article key={item.id}>
                    <b>{item.username}</b>
                    <p>{item.content}</p>
                  </article>
                ))}
              </div>
              <div className="review-comment-form">
                <input disabled={isClosed} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="리뷰 댓글 작성" />
                <button disabled={isClosed} onClick={submitComment}><MessageSquare size={15} />댓글</button>
              </div>
            </section>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="reviews-page">
      <section className="reviews-hero">
        <div>
          <p>Code Review Collaboration</p>
          <h1>코드 리뷰와 개선 제안</h1>
          <span>공개된 다른 유저 제출에 코드 수정안과 테스트 케이스를 제안하고, 제출자가 승인하면 협업 점수를 얻습니다.</span>
        </div>
        <div className="review-score-card">
          <b>{listData.collaborationScore?.totalScore || 0}</b>
          <span>협업 점수</span>
          <small>승인 {listData.collaborationScore?.acceptedCount || 0} · 기여 {listData.collaborationScore?.totalCount || 0}</small>
        </div>
      </section>

      <section className="reviews-filters">
        <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
          <option value="all">전체 상태</option>
          <option value="open">열림</option>
          <option value="approved">승인</option>
          <option value="rejected">반려</option>
          <option value="merged">병합</option>
        </select>
        <select value={filters.lang} onChange={(event) => setFilters((prev) => ({ ...prev, lang: event.target.value }))}>
          <option value="all">전체 언어</option>
          <option value="python">python</option>
          <option value="javascript">javascript</option>
          <option value="cpp">cpp</option>
          <option value="java">java</option>
        </select>
        <input value={filters.problemId} onChange={(event) => setFilters((prev) => ({ ...prev, problemId: event.target.value }))} placeholder="문제 ID" />
        <button onClick={loadList}><RefreshCw size={15} />필터 적용</button>
      </section>

      <section className="review-columns">
        <div className="review-panel review-panel-scroll">
          <h2>리뷰 가능한 제출 <span className="review-count">{listData.reviewableSubmissions.length}</span></h2>
          <p className="muted" style={{ marginBottom: 10, fontSize: 12 }}>내가 푼 문제 중 다른 유저의 정답 제출을 리뷰할 수 있습니다.</p>
          {loading && <p className="muted">불러오는 중...</p>}
          {listData.reviewableSubmissions.map((submission) => (
            <article key={submission.id} className="review-card">
              <div>
                <b>{submission.problemTitle}</b>
                <StatusPill status={submission.result} />
              </div>
              <p>{submission.username} · {submission.lang} · {submission.timeMs || '-'}ms · 코드 {submission.codeLength} bytes</p>
              <button onClick={() => submission.existingReviewId ? navigate(`/reviews/${submission.existingReviewId}`) : createReview(submission.id)}>
                {submission.existingReviewId ? '열린 리뷰 보기' : '리뷰 시작'}
              </button>
            </article>
          ))}
          {!loading && listData.reviewableSubmissions.length === 0 && (
            <div className="review-empty">
              아직 풀어본 문제의 다른 유저 제출이 없습니다. 더 많은 문제를 풀면 리뷰할 수 있는 제출이 생깁니다.
            </div>
          )}
        </div>

        <div className="review-panel-right">
          {listData.reviews.length > 0 && (
            <div className="review-panel review-panel-scroll" style={{ marginBottom: 16 }}>
              <h2>내가 리뷰함 <span className="review-count">{listData.reviews.length}</span></h2>
              {listData.reviews.map((item) => (
                <article key={item.id} className="review-card" onClick={() => navigate(`/reviews/${item.id}`)}>
                  <div>
                    <b>{item.problemTitle}</b>
                    <StatusPill status={item.status} />
                  </div>
                  <p>작성자 {item.authorUsername} · 리뷰어 {item.reviewerUsername}</p>
                </article>
              ))}
            </div>
          )}

          <div className="review-panel review-panel-scroll">
            <h2>내 코드의 리뷰 <span className="review-count">{listData.myCodeReviews.length}</span></h2>
            {listData.myCodeReviews.length > 0 ? listData.myCodeReviews.map((item) => (
              <article key={item.id} className="review-card" onClick={() => navigate(`/reviews/${item.id}`)}>
                <div>
                  <b>{item.problemTitle}</b>
                  <StatusPill status={item.status} />
                </div>
                <p>리뷰어 {item.reviewerUsername}</p>
              </article>
            )) : (
              <div className="review-empty">내 제출에 대한 리뷰가 아직 없습니다.</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

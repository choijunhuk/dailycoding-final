import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, GitMerge, MessageSquare, Plus, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import './ReviewsPage.css';

const STATUS_LABEL = {
  open: 'Open',
  approved: 'Approved',
  rejected: 'Rejected',
  merged: 'Merged',
  cancelled: 'Cancelled',
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
  const canCancel = review && review.status === 'open' && (isAdmin || review.reviewerId === user?.id);
  const canReopen = review && review.status === 'cancelled' && (isAdmin || review.reviewerId === user?.id);
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
      toast?.show(err.response?.data?.message || 'Failed to load review list.', 'error');
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
      toast?.show(err.response?.data?.message || 'Failed to load review.', 'error');
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
      toast?.show(err.response?.data?.message || 'Failed to create review.', 'error');
    }
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    try {
      const { data } = await api.post(`/reviews/${id}/comments`, { content: comment });
      setReview(data);
      setComment('');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to post comment.', 'error');
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
      toast?.show('Code suggestion saved.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to submit code suggestion.', 'error');
    }
  };

  const submitTestSuggestion = async () => {
    try {
      const { data } = await api.post(`/reviews/${id}/suggestions/test`, testForm);
      setReview(data);
      setTestForm({ inputData: '', expectedOutput: '', reason: '' });
      toast?.show('Test suggestion saved.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to submit test suggestion.', 'error');
    }
  };

  const resolveReview = async (action) => {
    try {
      const { data } = await api.post(`/reviews/${id}/${action}`);
      setReview(data);
      toast?.show('Review status updated.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Action failed.', 'error');
    }
  };

  const cancelReview = async () => {
    if (!window.confirm('Cancel this review request? You can re-request it after cancellation.')) return;
    try {
      const { data } = await api.post(`/reviews/${id}/cancel`);
      setReview(data);
      toast?.show('Review request cancelled.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to cancel review.', 'error');
    }
  };

  const reopenReview = async () => {
    try {
      const { data } = await api.post(`/reviews/${id}/reopen`);
      setReview(data);
      toast?.show('Review re-requested.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to re-request review.', 'error');
    }
  };

  const deleteReview = async (reviewId) => {
    if (!window.confirm('Deleting this review will remove all comments and suggestions. Continue?')) return;
    try {
      await api.delete(`/reviews/${reviewId}`);
      toast?.show('Review deleted.', 'success');
      if (isDetail) navigate('/reviews', { replace: true });
      else loadList();
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to delete.', 'error');
    }
  };

  if (isDetail) {
    return (
      <main className="reviews-page">
        <div className="reviews-toolbar">
          <button className="ghost" onClick={() => navigate('/reviews')}>List</button>
          <button className="ghost" onClick={loadReview}><RefreshCw size={15} />Refresh</button>
          {review && <StatusPill status={review.status} />}
          {canCancel && (
            <button className="ghost danger" onClick={cancelReview} title="Cancel review request">
              <X size={15} /> Cancel Request
            </button>
          )}
          {canReopen && (
            <button className="ghost" onClick={reopenReview} title="Re-request review">
              <RotateCcw size={15} /> Re-request
            </button>
          )}
          {review && review.reviewerId === user?.id && (
            <button className="ghost danger" onClick={() => deleteReview(review.id)} title="Delete my review">
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>

        {!review || loading ? (
          <div className="review-empty">Loading review...</div>
        ) : (
          <>
            <section className="review-detail-head">
              <div>
                <p>{review.problemTitle}</p>
                <h1>{review.reviewerUsername} reviewing {review.authorUsername}'s submission</h1>
                <span>Submission #{review.submissionId} · {review.submission?.lang} · {review.submission?.result}</span>
              </div>
              {canResolve && (
                <div className="review-actions">
                  <button disabled={isClosed} onClick={() => resolveReview('approve')}><Check size={15} />Approve</button>
                  <button disabled={isClosed} onClick={() => resolveReview('reject')}><X size={15} />Reject</button>
                  <button disabled={review.status === 'merged' || review.status === 'rejected'} onClick={() => resolveReview('merge')}><GitMerge size={15} />Merge</button>
                </div>
              )}
            </section>

            <section className="review-grid">
              <div className="review-panel">
                <h2>Original Code</h2>
                <pre className="review-code">{review.submission?.code || ''}</pre>
              </div>
              <div className="review-panel">
                <h2>Suggested Code</h2>
                <textarea
                  disabled={isClosed}
                  value={codeForm.suggestedCode}
                  onChange={(event) => setCodeForm((prev) => ({ ...prev, suggestedCode: event.target.value }))}
                />
                <input
                  disabled={isClosed}
                  value={codeForm.filePath}
                  onChange={(event) => setCodeForm((prev) => ({ ...prev, filePath: event.target.value }))}
                  placeholder="File path"
                />
                <input
                  disabled={isClosed}
                  value={codeForm.reason}
                  onChange={(event) => setCodeForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder="Reason for change"
                />
                <button disabled={isClosed} onClick={submitCodeSuggestion}><Plus size={15} />Add Code Suggestion</button>
              </div>
            </section>

            <section className="review-panel">
              <h2>Diff</h2>
              <DiffViewer original={review.submission?.code || ''} suggested={firstSuggestion?.suggestedCode || codeForm.suggestedCode} />
              {firstSuggestion?.reason && <p className="review-reason">Reason: {firstSuggestion.reason}</p>}
            </section>

            <section className="review-lists">
              <div className="review-panel">
                <h2>Code Suggestions</h2>
                {(review.codeSuggestions || []).map((item) => (
                  <article key={item.id} className="review-item">
                    <div><b>{item.filePath}</b><StatusPill status={item.status} /></div>
                    <p>{item.reason || 'No reason provided'}</p>
                  </article>
                ))}
                {review.codeSuggestions?.length === 0 && <p className="muted">No code suggestions yet.</p>}
              </div>
              <div className="review-panel">
                <h2>Test Suggestions</h2>
                <textarea disabled={isClosed} value={testForm.inputData} onChange={(event) => setTestForm((prev) => ({ ...prev, inputData: event.target.value }))} placeholder="input" />
                <textarea disabled={isClosed} value={testForm.expectedOutput} onChange={(event) => setTestForm((prev) => ({ ...prev, expectedOutput: event.target.value }))} placeholder="expected output" />
                <input disabled={isClosed} value={testForm.reason} onChange={(event) => setTestForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="Reason for suggestion" />
                <button disabled={isClosed} onClick={submitTestSuggestion}><Plus size={15} />Add Test Suggestion</button>
                {(review.testSuggestions || []).map((item) => (
                  <article key={item.id} className="review-item">
                    <div><b>Test #{item.id}</b><StatusPill status={item.status} /></div>
                    <code>{item.inputData} → {item.expectedOutput}</code>
                    <p>{item.reason || 'No reason provided'}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="review-panel">
              <h2>Comments</h2>
              <div className="review-comments">
                {(review.comments || []).map((item) => (
                  <article key={item.id}>
                    <b>{item.username}</b>
                    <p>{item.content}</p>
                  </article>
                ))}
              </div>
              <div className="review-comment-form">
                <input disabled={isClosed} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a review comment" />
                <button disabled={isClosed} onClick={submitComment}><MessageSquare size={15} />Comment</button>
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
          <h1>Code Review & Improvement Suggestions</h1>
          <span>Suggest code changes and test cases on other users' public submissions. Earn collaboration points when the author approves your suggestions.</span>
        </div>
        <div className="review-score-card">
          <b>{listData.collaborationScore?.totalScore || 0}</b>
          <span>Collaboration Score</span>
          <small>Approved {listData.collaborationScore?.acceptedCount || 0} · Contributed {listData.collaborationScore?.totalCount || 0}</small>
        </div>
      </section>

      <section className="reviews-filters">
        <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="merged">Merged</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filters.lang} onChange={(event) => setFilters((prev) => ({ ...prev, lang: event.target.value }))}>
          <option value="all">All Languages</option>
          <option value="python">python</option>
          <option value="javascript">javascript</option>
          <option value="cpp">cpp</option>
          <option value="java">java</option>
        </select>
        <input value={filters.problemId} onChange={(event) => setFilters((prev) => ({ ...prev, problemId: event.target.value }))} placeholder="Problem ID" />
        <button onClick={loadList}><RefreshCw size={15} />Apply Filter</button>
      </section>

      <section className="review-columns">
        <div className="review-panel review-panel-scroll">
          <h2>Reviewable Submissions <span className="review-count">{listData.reviewableSubmissions.length}</span></h2>
          <p className="muted" style={{ marginBottom: 10, fontSize: 12 }}>You can review other users' correct submissions on problems you have solved.</p>
          {loading && <p className="muted">Loading...</p>}
          {listData.reviewableSubmissions.map((submission) => (
            <article key={submission.id} className="review-card">
              <div>
                <b>{submission.problemTitle}</b>
                <StatusPill status={submission.result} />
              </div>
              <p>{submission.username} · {submission.lang} · {submission.timeMs || '-'}ms · Code {submission.codeLength} bytes</p>
              <button onClick={() => submission.existingReviewId ? navigate(`/reviews/${submission.existingReviewId}`) : createReview(submission.id)}>
                {submission.existingReviewId ? 'View Open Review' : 'Start Review'}
              </button>
            </article>
          ))}
          {!loading && listData.reviewableSubmissions.length === 0 && (
            <div className="review-empty">
              No other users' submissions on problems you have solved yet. Solve more problems to find submissions to review.
            </div>
          )}
        </div>

        <div className="review-panel-right">
          {listData.reviews.length > 0 && (
            <div className="review-panel review-panel-scroll" style={{ marginBottom: 16 }}>
              <h2>Reviewed by Me <span className="review-count">{listData.reviews.length}</span></h2>
              {listData.reviews.map((item) => (
                <article key={item.id} className="review-card" onClick={() => navigate(`/reviews/${item.id}`)}>
                  <div>
                    <b>{item.problemTitle}</b>
                    <StatusPill status={item.status} />
                  </div>
                  <p>Author: {item.authorUsername} · Reviewer: {item.reviewerUsername}</p>
                  <button
                    className="review-delete-btn"
                    onClick={(e) => { e.stopPropagation(); deleteReview(item.id); }}
                    title="Delete review"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
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

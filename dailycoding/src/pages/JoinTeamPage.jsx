import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useLang } from '../context/LangContext.jsx';

export default function JoinTeamPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLang();

  useEffect(() => {
    let cancelled = false;
    const join = async () => {
      try {
        const { data } = await api.post('/teams/join', { token });
        if (cancelled) return;
        toast.show(data.message, 'success');
        navigate('/team');
      } catch (err) {
        if (cancelled) return;
        toast.show(err.response?.data?.message || t('teamJoinFailed'), 'error');
        navigate('/');
      }
    };
    join();
    return () => { cancelled = true; };
  }, [token, navigate, toast, t]);

  return (
    <div style={{ padding: 100, textAlign: 'center' }}>
      <h2>{t('teamJoinLoadingTitle')}</h2>
      <p style={{ color: 'var(--text3)' }}>{t('teamJoinLoadingDesc')}</p>
    </div>
  );
}

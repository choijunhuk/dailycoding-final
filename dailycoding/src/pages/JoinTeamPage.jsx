import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function JoinTeamPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [, setLoading] = useState(true);

  useEffect(() => {
    const join = async () => {
      try {
        const { data } = await api.post('/teams/join', { token });
        toast.show(data.message, 'success');
        navigate('/team');
      } catch (err) {
        toast.show(err.response?.data?.message || '팀 합류에 실패했습니다.', 'error');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    join();
  }, [token, navigate, toast]);

  return (
    <div style={{ padding: 100, textAlign: 'center' }}>
      <h2>팀에 합류하는 중...</h2>
      <p style={{ color: 'var(--text3)' }}>잠시만 기다려주세요.</p>
    </div>
  );
}

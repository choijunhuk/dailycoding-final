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
        toast.show(err.response?.data?.message || 'Failed to join team.', 'error');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    join();
  }, [token, navigate, toast]);

  return (
    <div style={{ padding: 100, textAlign: 'center' }}>
      <h2>Joining team...</h2>
      <p style={{ color: 'var(--text3)' }}>Please wait a moment.</p>
    </div>
  );
}

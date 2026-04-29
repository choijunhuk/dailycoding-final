import { useCallback, useEffect, useState } from 'react';
import api from '../api.js';

const listeners = new Set();

let store = {
  userId: null,
  data: null,
  loading: false,
  error: null,
  promise: null,
};

function emit() {
  listeners.forEach(listener => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function resetStore(userId = null) {
  store = {
    userId,
    data: null,
    loading: false,
    error: null,
    promise: null,
  };
}

async function fetchSubscriptionStatus(userId, { force = false } = {}) {
  if (!userId) return null;

  if (store.userId !== userId) {
    resetStore(userId);
  }

  if (store.data && !force) return store.data;
  if (store.promise && !force) return store.promise;

  store.loading = true;
  store.error = null;
  emit();

  const request = api.get('/subscription/status')
    .then(({ data }) => {
      if (store.userId === userId) {
        store.data = data;
      }
      return data;
    })
    .catch(error => {
      if (store.userId === userId) {
        store.error = error;
      }
      throw error;
    })
    .finally(() => {
      if (store.userId === userId) {
        store.loading = false;
        store.promise = null;
        emit();
      }
    });

  store.promise = request;
  return request;
}

export function invalidateSubscriptionStatus(userId) {
  if (userId && store.userId && store.userId !== userId) return;
  resetStore(userId ?? store.userId);
  emit();
}

export function useSubscriptionStatus(userId) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    return subscribe(() => setVersion(version => version + 1));
  }, []);

  useEffect(() => {
    if (!userId) {
      if (store.userId !== null) {
        resetStore(null);
        emit();
      }
      return;
    }

    if (store.userId !== userId || (!store.data && !store.promise)) {
      fetchSubscriptionStatus(userId).catch(() => {});
    }
  }, [userId, version]);

  const isCurrentUser = store.userId === userId;
  const refreshSubscriptionStatus = useCallback(async () => {
    try {
      return await fetchSubscriptionStatus(userId, { force: true });
    } catch {
      return null;
    }
  }, [userId]);
  const clearSubscriptionStatus = useCallback(() => {
    invalidateSubscriptionStatus(userId);
  }, [userId]);

  return {
    subscriptionStatus: isCurrentUser ? store.data : null,
    tier: isCurrentUser ? (store.data?.tier || 'free') : 'free',
    loading: isCurrentUser ? store.loading : false,
    error: isCurrentUser ? store.error : null,
    refreshSubscriptionStatus,
    invalidateSubscriptionStatus: clearSubscriptionStatus,
  };
}

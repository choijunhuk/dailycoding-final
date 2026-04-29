import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp }   from './context/AppContext';
import AuthPage           from './pages/AuthPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage  from './pages/ResetPasswordPage';
import VerifyEmailPage    from './pages/VerifyEmailPage';
import LandingPage        from './pages/LandingPage';
import TermsPage          from './pages/TermsPage';
import PrivacyPage        from './pages/PrivacyPage';
import TopNav             from './components/TopNav';
import VerificationBanner from './components/VerificationBanner';
import MockAd             from './components/MockAd';
import NotFoundPage    from './pages/NotFoundPage';
import { ToastProvider } from './context/ToastContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { LangProvider } from './context/LangContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import OnboardingModal from './components/OnboardingModal.jsx';
import api from './api.js';
import './index.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProblemsPage = lazy(() => import('./pages/ProblemsPage'));
const JudgePage = lazy(() => import('./pages/JudgePage'));
const ContestPage = lazy(() => import('./pages/ContestPage'));
const RankingPage = lazy(() => import('./pages/RankingPage'));
const AiPage = lazy(() => import('./pages/AiPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SubmissionsPage = lazy(() => import('./pages/SubmissionsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const BattlePage = lazy(() => import('./pages/BattlePage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const TeamDashboard = lazy(() => import('./pages/TeamDashboard'));
const JoinTeamPage = lazy(() => import('./pages/JoinTeamPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'));
const SharedSubmissionPage = lazy(() => import('./pages/SharedSubmissionPage'));
const ExamListPage = lazy(() => import('./pages/ExamListPage'));
const ExamPage = lazy(() => import('./pages/ExamPage'));
const SheetsPage = lazy(() => import('./pages/SheetsPage'));
const SheetDetailPage = lazy(() => import('./pages/SheetDetailPage'));
const LearningPathPage = lazy(() => import('./pages/LearningPathPage'));

function getInternalRedirectPath(redirect) {
  if (!redirect) return null;

  try {
    const url = new URL(redirect, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return redirect.startsWith('/') ? redirect : null;
  }
}

function RouteFallback({ isJudge }) {
  if (isJudge) {
    return <div style={{ flex: 1, background: 'var(--bg)' }} />;
  }

  return (
    <div style={{padding:'40px 28px',maxWidth:1000,margin:'0 auto',width:'100%'}} className="page-enter">
      <div className="skeleton-line" style={{width:'30%',height:24,marginBottom:20}}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12,marginBottom:24}}>
        {[1,2,3,4].map(i=><div key={i} className="skeleton-line" style={{height:80,borderRadius:12}}/>)}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {[1,2,3,4,5].map(i=><div key={i} className="skeleton-line" style={{height:52,borderRadius:10}}/>)}
      </div>
    </div>
  );
}

function AppInner() {
  const { user, isAdmin } = useAuth();
  const { loadAll, loading } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadAll(user.id);
      const redirect = sessionStorage.getItem('postLoginRedirect');
      if (redirect) {
        sessionStorage.removeItem('postLoginRedirect');
        const internalPath = getInternalRedirectPath(redirect);
        if (internalPath) navigate(internalPath, { replace: true });
        else window.location.assign(redirect);
      }
    }
  }, [user?.id, loadAll, navigate]);

  useEffect(() => {
    let ignore = false;
    if (!user?.id) {
      setOnboardingOpen(false);
      return undefined;
    }
    api.get('/onboarding')
      .then((res) => {
        if (!ignore) setOnboardingOpen(!res.data?.completed);
      })
      .catch(() => {
        if (!ignore) setOnboardingOpen(false);
      });
    return () => { ignore = true; };
  }, [user?.id]);

  // 페이지 전환 시 스크롤 맨 위로
  useEffect(() => {
    const el = document.getElementById('page-content');
    if (el) el.scrollTop = 0;
  }, [location.pathname]);

  if (!user) {
    return (
      <Routes>
        <Route path="/verify-email"    element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/share/:slug"     element={<SharedSubmissionPage />} />
        <Route path="/terms"           element={<TermsPage />} />
        <Route path="/privacy"         element={<PrivacyPage />} />
        <Route path="/pricing"         element={<PricingPage />} />
        <Route path="/login"           element={<AuthPage />} />
        <Route
          path="/"
          element={
            <LandingPage
              onLogin={() => navigate('/login')}
              onSignup={() => navigate('/login', { state: { mode: 'register' } })}
              onPricing={() => navigate('/pricing')}
            />
          }
        />
        <Route path="*"                element={<AuthPage />} />
      </Routes>
    );
  }

  const isJudge = location.pathname.startsWith('/problems/') && location.pathname !== '/problems';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      <TopNav />
      <VerificationBanner />
      <OnboardingModal
        open={onboardingOpen}
        onComplete={() => {
          setOnboardingOpen(false);
          navigate('/problems?recommended=true', { replace: true });
        }}
      />
      <div id="page-content" style={{ flex:1, overflowY:'auto', overflowX:'hidden', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
        {loading && !isJudge ? (
          <RouteFallback isJudge={false} />
        ) : (
          <div key={location.pathname} className="page-enter" style={{ flex:1 }}>
            <Suspense fallback={<RouteFallback isJudge={isJudge} />}>
              <Routes>
                <Route path="/"            element={<Dashboard />} />
                <Route path="/problems"    element={<ProblemsPage />} />
                <Route path="/problems/:id" element={<JudgePage />} />
                <Route path="/contest"     element={<ContestPage />} />
                <Route path="/ranking"     element={<RankingPage />} />
                <Route path="/community"   element={<CommunityPage />} />
                <Route path="/community/:board" element={<CommunityPage />} />
                <Route path="/community/:board/:id" element={<CommunityPage />} />
                <Route path="/ai"          element={<AiPage />} />
                <Route path="/exams"       element={<ExamListPage />} />
                <Route path="/exams/:id"   element={<ExamPage />} />
                <Route path="/sheets"      element={<SheetsPage />} />
                <Route path="/sheets/:id"  element={<SheetDetailPage />} />
                <Route path="/learning"    element={<LearningPathPage />} />
                <Route path="/learning/:id" element={<LearningPathPage />} />
                <Route path="/profile"     element={<ProfilePage />} />
                <Route path="/user/:id"    element={<PublicProfilePage />} />
                <Route path="/submissions" element={<SubmissionsPage />} />
                <Route path="/battle"      element={<BattlePage />} />
                <Route path="/battles/history" element={<BattlePage />} />
                <Route path="/battle/watch/:roomId" element={<BattlePage />} />
                <Route path="/share/:slug" element={<SharedSubmissionPage />} />
                <Route path="/settings"    element={<SettingsPage />} />
                <Route path="/pricing"     element={<PricingPage />} />
                <Route path="/team"        element={<TeamDashboard />} />
                <Route path="/join/team/:token" element={<JoinTeamPage />} />
                <Route path="/terms"       element={<TermsPage />} />
                <Route path="/privacy"     element={<PrivacyPage />} />
                <Route path="/admin"       element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
                <Route path="*"            element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </div>
        )}
        {!isJudge && <MockAd position="bottom" />}
        {/* 푸터 */}
        {!isJudge && (
          <footer className="site-footer">
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16,flexWrap:'wrap',fontSize:12}}>
              <span style={{fontWeight:700}}>⚡ DailyCoding</span>
              <span style={{color:'var(--text3)'}}>© {new Date().getFullYear()}</span>
              <span style={{color:'var(--text3)'}}>·</span>
              <a href="/pricing" style={{color:'var(--text2)',textDecoration:'none'}} onClick={e=>{e.preventDefault();navigate('/pricing');}}>요금제</a>
              <a href="/terms"   style={{color:'var(--text2)',textDecoration:'none'}} onClick={e=>{e.preventDefault();navigate('/terms');}}>이용약관</a>
              <a href="/privacy" style={{color:'var(--text2)',textDecoration:'none'}} onClick={e=>{e.preventDefault();navigate('/privacy');}}>개인정보처리방침</a>
              <span style={{color:'var(--text3)'}}>·</span>
              <span style={{fontSize:10,color:'var(--text3)'}}>React · Node.js · MySQL · Redis · Docker · Gemini AI</span>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppProvider>
              <ToastProvider>
                <AppInner />
              </ToastProvider>
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </LangProvider>
    </ErrorBoundary>
  );
}

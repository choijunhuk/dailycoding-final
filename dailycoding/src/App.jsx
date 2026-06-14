import { Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp }   from './context/AppContext';
import TopNav             from './components/TopNav';
import VerificationBanner from './components/VerificationBanner';
import FriendsWidget      from './components/FriendsWidget.jsx';
import './components/FriendsWidget.css';
import ProBenefitsSlot    from './components/ProBenefitsSlot';
import { ToastProvider } from './context/ToastContext.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import { LangProvider, useLang } from './context/LangContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import api from './api.js';
import { applyAppTypographyPreference } from './utils/fontPreferences.js';
import { applyUiPreferenceFlags } from './utils/uiPreferences.js';
import { resolvePostLoginRedirect } from './utils/redirects.js';
import { MAIN_TECH_STACK, TechIcon } from './components/icons/BrandIcon.jsx';
import BrandMark from './components/BrandMark.jsx';
import { AUTHENTICATED_ROUTES, PUBLIC_ROUTES, renderRouteElement } from './routes/appRouteConfig.jsx';
import './index.css';

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
  const { lang, setLang, t } = useLang();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    applyAppTypographyPreference({
      fontFamily: localStorage.getItem('dc_app_font') || 'noto',
      fontSize: localStorage.getItem('dc_app_font_size') || 14,
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;
    let ignore = false;
    api.get('/auth/settings')
      .then((res) => {
        if (!ignore) {
          const ui = res.data?.settings?.ui || {};
          applyAppTypographyPreference({
            fontFamily: ui.fontFamily || 'noto',
            fontSize: ui.fontSize || ui.code_font_size || 14,
          });
          applyUiPreferenceFlags(ui);
          if (['dark', 'light', 'system'].includes(ui.theme) && ui.theme !== theme) {
            setTheme(ui.theme);
          }
          if (['ko', 'en'].includes(ui.language) && ui.language !== lang) {
            setLang(ui.language);
          }
        }
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      loadAll(user.id);
      const redirect = sessionStorage.getItem('postLoginRedirect');
      if (redirect) {
        sessionStorage.removeItem('postLoginRedirect');
        navigate(resolvePostLoginRedirect(redirect), { replace: true });
      }
    }
  }, [user?.id, loadAll, navigate]);


  // 페이지 전환 시 스크롤 맨 위로
  useEffect(() => {
    const el = document.getElementById('page-content');
    if (el) el.scrollTop = 0;
  }, [location.pathname]);

  if (!user) {
    return (
      <Suspense fallback={<RouteFallback isJudge={false} />}>
        <Routes>
          {PUBLIC_ROUTES.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={renderRouteElement(route, { navigate, isAdmin })}
            />
          ))}
        </Routes>
      </Suspense>
    );
  }

  const isJudge = location.pathname.startsWith('/problems/') && location.pathname !== '/problems';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      <TopNav />
      <VerificationBanner />
      <FriendsWidget />
      <div id="page-content" style={{ flex:1, overflowY:'auto', overflowX:'hidden', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
        {loading && !isJudge ? (
          <RouteFallback isJudge={false} />
        ) : (
          <div key={location.pathname} className="page-enter" style={{ flex:1 }}>
            <Suspense fallback={<RouteFallback isJudge={isJudge} />}>
              <Routes>
                {AUTHENTICATED_ROUTES.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={renderRouteElement(route, { navigate, isAdmin })}
                  />
                ))}
              </Routes>
            </Suspense>
          </div>
        )}
        {!isJudge && <ProBenefitsSlot position="bottom" />}
        {/* 푸터 */}
        {!isJudge && (
          <footer className="site-footer">
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16,flexWrap:'wrap',fontSize:12}}>
              <BrandMark iconSize={18} textSize={12} />
              <span style={{color:'var(--text3)'}}>© {new Date().getFullYear()}</span>
              <span style={{color:'var(--text3)'}}>·</span>
              <a href="/pricing" style={{color:'var(--text2)',textDecoration:'none'}} onClick={e=>{e.preventDefault();navigate('/pricing');}}>{t('pricing')}</a>
              <a href="/terms"   style={{color:'var(--text2)',textDecoration:'none'}} onClick={e=>{e.preventDefault();navigate('/terms');}}>{t('authTermsLabel')}</a>
              <a href="/privacy" style={{color:'var(--text2)',textDecoration:'none'}} onClick={e=>{e.preventDefault();navigate('/privacy');}}>{t('authPrivacyLabel')}</a>
              <span style={{color:'var(--text3)'}}>·</span>
              <span style={{display:'inline-flex',alignItems:'center',gap:8,flexWrap:'wrap',justifyContent:'center',fontSize:10,color:'var(--text3)'}}>
                {MAIN_TECH_STACK.map((tech) => (
                  <span key={tech} style={{display:'inline-flex',alignItems:'center',gap:3}}>
                    <TechIcon name={tech} size={12} />
                    {tech}
                  </span>
                ))}
              </span>
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

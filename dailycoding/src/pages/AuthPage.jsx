import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';

function pwStrength(pw, t) {
  if (!pw) return { score:0, label:'', color:'' };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score:s, label:t('pwVeryWeak'), color:'var(--red)'   };
  if (s <= 2) return { score:s, label:t('pwWeak'),     color:'var(--orange)' };
  if (s <= 3) return { score:s, label:t('pwMedium'),   color:'var(--yellow)' };
  if (s <= 4) return { score:s, label:t('pwStrong'),   color:'var(--green)'  };
  return              { score:s, label:t('pwVeryStrong'), color:'var(--blue)'  };
}

const FEATURES = [
  { icon:'⚡', titleKey:'authFeatureJudgeTitle',  descKey:'authFeatureJudgeDesc' },
  { icon:'🤖', titleKey:'authFeatureAiTitle',     descKey:'authFeatureAiDesc' },
  { icon:'🏆', titleKey:'authFeatureContestTitle', descKey:'authFeatureContestDesc' },
  { icon:'📊', titleKey:'authFeatureGrowthTitle', descKey:'authFeatureGrowthDesc' },
];

const TYPING = [
  'for i in range(10): print(i)',
  'def fib(n): return n if n<2 else fib(n-1)+fib(n-2)',
  'const solve = arr => arr.reduce((a,b)=>a+b,0)',
  'int main() { cout << "Hello World"; }',
];

export default function AuthPage() {
  const location = useLocation();
  const initialMode = location.state?.mode === 'register' || new URLSearchParams(location.search).get('mode') === 'register'
    ? 'register'
    : 'login';
  const [mode,     setMode]     = useState(initialMode);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);
  const [typed,    setTyped]    = useState('');
  const [stats,    setStats]    = useState(null);
  const [anim,     setAnim]     = useState({ users:0, problems:0, correct:0 });
  const { login, register, error, setError } = useAuth();
  const toast = useToast();
  const { t } = useLang();
  const navigate = useNavigate();
  const emailRef = useRef(null);

  // 타이핑 효과 — 언마운트 시 모든 타이머 정리
  useEffect(() => {
    let active = true;
    let ti=0, ci=0, del=false;
    let timerId;
    const go = () => {
      if (!active) return;
      const full = TYPING[ti];
      if (!del) {
        ci++;
        setTyped(full.slice(0,ci));
        if (ci===full.length) { del=true; timerId = setTimeout(go, 2200); return; }
      } else {
        ci--;
        setTyped(full.slice(0,ci));
        if (ci===0) { del=false; ti=(ti+1)%TYPING.length; timerId = setTimeout(go, 400); return; }
      }
      timerId = setTimeout(go, del ? 28 : 58);
    };
    timerId = setTimeout(go, 800);
    return () => { active = false; clearTimeout(timerId); };
  }, []);

  // 사이트 통계 카운트업
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    fetch(`${apiBase}/api/stats`)
      .then(r=>r.json())
      .then(d => {
        setStats(d);
        let s=0;
        const iv = setInterval(() => {
          s++;
          const ease = 1 - Math.pow(1-s/40, 3);
          setAnim({
            users:    Math.floor((d.users||0)    * ease),
            problems: Math.floor((d.problems||0) * ease),
            correct:  Math.floor((d.correct||0)  * ease),
          });
          if (s>=40) clearInterval(iv);
        }, 1400/40);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { emailRef.current?.focus(); }, [mode]);

  useEffect(() => {
    const nextMode = location.state?.mode === 'register' || new URLSearchParams(location.search).get('mode') === 'register'
      ? 'register'
      : 'login';
    setMode(nextMode);
  }, [location.state, location.search]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!email || !password || (mode==='register' && !username)) return;
    setLoading(true);
    if (mode==='login') {
      const ok = await login(email, password);
      if (ok) toast?.show(t('authLoggedIn'), 'success');
    } else {
      const ok = await register(email, password, username);
      if (ok) toast?.show(t('authRegistered'), 'success');
    }
    setLoading(false);
  };

  const switchMode = (m) => { setMode(m); setError?.(''); setEmail(''); setPassword(''); setUsername(''); };

  const inputStyle = {
    width:'100%', padding:'11px 13px',
    background:'var(--bg3)', border:'1px solid var(--border)',
    borderRadius:8, color:'var(--text)', fontFamily:'inherit',
    fontSize:13, outline:'none',
    transition:'border-color .2s, box-shadow .2s',
  };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>

      {/* ── 왼쪽 소개 패널 ── */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column', justifyContent:'center',
        padding:'48px 56px',
        background:'linear-gradient(145deg,var(--bg),var(--bg2))',
        borderRight:'1px solid var(--border)',
        position:'relative', overflow:'hidden',
      }}>
        {/* 배경 글로우 */}
        <div style={{ position:'absolute', top:'-15%', left:'-5%', width:350, height:350,
          borderRadius:'50%', background:'rgba(121,192,255,.04)', filter:'blur(70px)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:'-10%', right:'5%', width:250, height:250,
          borderRadius:'50%', background:'rgba(86,211,100,.03)', filter:'blur(60px)', pointerEvents:'none' }}/>

        {/* 로고 */}
        <div style={{ marginBottom:40 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontSize:26 }}>⚡</span>
            <span style={{ fontSize:21, fontWeight:800, letterSpacing:-.5 }}>DailyCoding</span>
          </div>
          <p style={{ color:'var(--text3)', fontSize:12 }}>{t('authPlatformSubtitle')}</p>
        </div>

        {/* 타이핑 코드 */}
        <div style={{
          background:'var(--bg3)', borderRadius:10, padding:'14px 18px', marginBottom:36,
          border:'1px solid var(--border)', fontFamily:'Space Mono,monospace',
          fontSize:12, color:'var(--green)', minHeight:44,
        }}>
          <span style={{ color:'var(--text3)', marginRight:8 }}>&gt;&gt;&gt;</span>
          {typed}
          <span style={{
            display:'inline-block', width:2, height:'1em',
            background:'var(--green)', marginLeft:1,
            animation:'_blink 1s step-end infinite', verticalAlign:'middle',
          }}/>
        </div>

        {/* 기능 소개 */}
        <div style={{ display:'flex', flexDirection:'column', gap:18, marginBottom:36 }}>
          {FEATURES.map(f=>(
            <div key={f.titleKey} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{
                width:34, height:34, borderRadius:8,
                background:'var(--bg3)', border:'1px solid var(--border)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:15, flexShrink:0,
              }}>{f.icon}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{t(f.titleKey)}</div>
                <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.5 }}>{t(f.descKey)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 통계 */}
        {stats && (
          <div style={{ display:'flex', paddingTop:22, borderTop:'1px solid var(--border)' }}>
            {[
              { v:anim.users,    s:t('authUsersJoined'), c:'var(--blue)'   },
              { v:anim.problems, s:t('authProblemsCount'), c:'var(--yellow)' },
              { v:anim.correct,  s:t('authCorrectCount'), c:'var(--green)'  },
            ].map((item,i)=>(
              <div key={i} style={{
                flex:1, textAlign:'center',
                borderLeft: i>0 ? '1px solid var(--border)' : 'none',
                padding:'0 12px',
              }}>
                <div style={{ fontFamily:'Space Mono,monospace', fontSize:19, fontWeight:700, color:item.c }}>
                  {item.v.toLocaleString()}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{item.s}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 오른쪽 로그인 폼 ── */}
      <div style={{
        width:420, display:'flex', flexDirection:'column',
        justifyContent:'center', padding:'48px 40px', overflowY:'auto',
      }}>
        {/* 제목 */}
        <div style={{ marginBottom:28 }}>
          <h2 style={{ fontSize:22, fontWeight:800, marginBottom:6 }}>
            {mode==='login' ? t('login') : t('register')}
          </h2>
          <p style={{ color:'var(--text2)', fontSize:13 }}>
            {mode==='login'
              ? t('authModeLoginDesc')
              : t('authModeRegisterDesc')}
          </p>
        </div>

        {/* 모드 탭 */}
        <div style={{
          display:'flex', background:'var(--bg3)', borderRadius:9,
          padding:3, marginBottom:24, border:'1px solid var(--border)',
        }}>
          {['login','register'].map(m=>(
            <button key={m} onClick={()=>switchMode(m)} style={{
              flex:1, padding:'8px 0', borderRadius:7, border:'none', cursor:'pointer',
              fontSize:13, fontWeight:600, fontFamily:'inherit', transition:'all .2s',
              background: mode===m ? 'var(--bg2)' : 'transparent',
              color:      mode===m ? 'var(--text)' : 'var(--text2)',
              boxShadow:  mode===m ? '0 1px 4px rgba(0,0,0,.3)' : 'none',
            }}>{m==='login' ? t('login') : t('register')}</button>
          ))}
        </div>

        {/* OAuth 소셜 로그인 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <a
            href={`${import.meta.env.VITE_API_URL || ''}/api/auth/github`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '11px 0', borderRadius: 9, border: '1px solid var(--border)',
              background: 'var(--bg3)', color: 'var(--text)', textDecoration: 'none',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              transition: 'background .2s, border-color .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = '#6e7681'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            {t('loginWithGithub')}
          </a>
          <a
            href={`${import.meta.env.VITE_API_URL || ''}/api/auth/google`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '11px 0', borderRadius: 9, border: '1px solid var(--border)',
              background: 'var(--bg3)', color: 'var(--text)', textDecoration: 'none',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              transition: 'background .2s, border-color .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = '#6e7681'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('loginWithGoogle')}
          </a>
        </div>

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{t('authContinueWithEmail')}</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* 폼 */}
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {mode==='register' && (
            <div>
              <label style={{ fontSize:12, color:'var(--text2)', fontWeight:600, display:'block', marginBottom:6 }}>{t('nickname')}</label>
              <input
                value={username} onChange={e=>setUsername(e.target.value)}
                placeholder={t('authNicknamePlaceholder')}
                autoComplete="username"
                style={inputStyle}
                onFocus={e=>{ e.target.style.borderColor='var(--blue)'; e.target.style.boxShadow='0 0 0 3px rgba(121,192,255,.1)'; }}
                onBlur={e=>{ e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none'; }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize:12, color:'var(--text2)', fontWeight:600, display:'block', marginBottom:6 }}>{t('email')}</label>
            <input
              ref={emailRef}
              type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              style={inputStyle}
              onFocus={e=>{ e.target.style.borderColor='var(--blue)'; e.target.style.boxShadow='0 0 0 3px rgba(121,192,255,.1)'; }}
              onBlur={e=>{ e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none'; }}
            />
          </div>

          <div>
            <label style={{ fontSize:12, color:'var(--text2)', fontWeight:600, display:'block', marginBottom:6 }}>{t('password')}</label>
            <div style={{ position:'relative' }}>
              <input
                type={showPw?'text':'password'} value={password}
                onChange={e=>setPassword(e.target.value)}
                placeholder={mode==='register' ? t('authPasswordPlaceholderRegister') : t('authPasswordPlaceholderLogin')}
                autoComplete={mode==='login' ? 'current-password' : 'new-password'}
                style={{ ...inputStyle, paddingRight:40 }}
                onFocus={e=>{ e.target.style.borderColor='var(--blue)'; e.target.style.boxShadow='0 0 0 3px rgba(121,192,255,.1)'; }}
                onBlur={e=>{ e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none'; }}
              />
              <button type="button" onClick={()=>setShowPw(p=>!p)} style={{
                position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                background:'none', border:'none', color:'var(--text3)',
                cursor:'pointer', fontSize:14, lineHeight:1,
              }}>{showPw ? '🙈' : '👁'}</button>
            </div>
            {mode==='register' && password && (() => {
              const s = pwStrength(password, t);
              return (
                <div style={{ marginTop:6 }}>
                  <div style={{ display:'flex', gap:3 }}>
                    {[1,2,3,4,5].map(i=>(
                      <div key={i} style={{
                        flex:1, height:3, borderRadius:2,
                        background: i<=s.score ? s.color : 'var(--border)',
                        transition:'background .2s',
                      }}/>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:s.color, marginTop:3, textAlign:'right' }}>{s.label}</div>
                </div>
              );
            })()}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div style={{
              padding:'10px 14px', borderRadius:8,
              background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.2)',
              color:'var(--red)', fontSize:13, display:'flex', alignItems:'center', gap:8,
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* 제출 버튼 */}
          <button type="submit"
            disabled={loading || !email || !password || (mode==='register' && !username)}
            style={{
              width:'100%', padding:'12px', borderRadius:9, border:'none',
              background:'var(--blue)', color:'var(--bg)',
              fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              opacity: (loading || !email || !password) ? .6 : 1,
              transition:'opacity .2s',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              marginTop:4,
            }}>
            {loading ? (
              <>
                <span style={{
                  width:16, height:16, borderRadius:'50%',
                  border:'2px solid rgba(0,0,0,.2)', borderTopColor:'var(--bg)',
                  animation:'_spin .7s linear infinite', display:'inline-block',
                }}/>
                {t('processing')}
              </>
            ) : mode==='login' ? t('login') : t('register')}
          </button>
        </form>

        {/* 비밀번호 찾기 링크 */}
        {mode==='login' && (
          <p style={{ textAlign:'center', marginTop:14, fontSize:13, color:'var(--text3)' }}>
            <button onClick={()=>navigate('/forgot-password')} style={{
              background:'none', border:'none', color:'var(--text2)',
              cursor:'pointer', fontSize:13, fontFamily:'inherit',
            }}>{t('forgotPassword')}</button>
          </p>
        )}

        {/* 모드 전환 링크 */}
        <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'var(--text3)' }}>
          {mode==='login' ? (
            <>{t('noAccount')}&nbsp;
              <button onClick={()=>switchMode('register')} style={{
                background:'none', border:'none', color:'var(--blue)',
                cursor:'pointer', fontSize:13, fontWeight:600,
              }}>{t('register')}</button>
            </>
          ) : (
            <>{t('alreadyHaveAccount')}&nbsp;
              <button onClick={()=>switchMode('login')} style={{
                background:'none', border:'none', color:'var(--blue)',
                cursor:'pointer', fontSize:13, fontWeight:600,
              }}>{t('login')}</button>
            </>
          )}
        </p>

        <p style={{ textAlign:'center', marginTop:32, fontSize:11, color:'var(--text3)' }}>
          {t('authAgreePrefix')} <span style={{color:'var(--text2)'}}>{t('authTermsLabel')}</span> {t('authAgreeAnd')}{' '}
          <span style={{color:'var(--text2)'}}>{t('authPrivacyLabel')}</span>{t('authAgreeSuffix')}
        </p>
      </div>

      <style>{`
        @keyframes _blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes _spin  { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

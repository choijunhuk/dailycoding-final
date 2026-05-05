import { memo, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../api.js';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.js';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext.jsx';
import { PLAN_META } from '../data/pricingPlans.js';
import ServerStatus from './ServerStatus.jsx';
import {
  BarChart2,
  BookOpen,
  Bot,
  CreditCard,
  FileText,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  Sun,
  Trophy,
  User as UserIcon,
  X,
  Shield,
  Users,
  Bell,
  LogOut,
  Swords,
  Sparkles,
} from 'lucide-react';
import './TopNav.css';

const TIER_COLOR = {
  unranked:'#888', iron:'#a8a8a8', bronze:'#cd7f32', silver:'#c0c0c0',
  gold:'#ffd700', platinum:'#00e5cc', emerald:'#00d18f', diamond:'#b9f2ff',
  master:'#9b59b6', grandmaster:'#e74c3c', challenger:'#f1c40f',
};

const Avatar = memo(function Avatar({ user, size = 28 }) {
  const colors = ['#79c0ff','#56d364','#e3b341','#f78166','#bc8cff'];
  const color = colors[(user?.username?.charCodeAt(0) || 0) % colors.length];
  const fallbackSrc = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.username || 'user')}`;
  return (
    <img
      src={user?.avatarUrlCustom || user?.avatar_url || fallbackSrc}
      alt={user?.username || 'user'}
      loading="lazy"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', background: color, flexShrink: 0 }}
      onError={(e) => {
        if (e.currentTarget.src !== fallbackSrc) e.currentTarget.src = fallbackSrc
      }}
    />
  );
});

const NAV = [
  { path:'/problems',    labelKey:'problems',    Icon: BookOpen },
  { path:'/contest',     labelKey:'contest',     Icon: Trophy },
  { path:'/battle',      labelKey:'battle',      Icon: Swords },
  { path:'/ranking',     labelKey:'ranking',     Icon: BarChart2 },
  { path:'/community',   labelKey:'community',   Icon: MessageSquare },
  { path:'/exams',       labelKey:'exams',       Icon: Trophy },
  { path:'/sheets',      labelKey:'sheets',      Icon: BookOpen },
  { path:'/learning',    labelKey:'learning',    Icon: Sparkles },
  { path:'/pricing',     labelKey:'subscribe',   Icon: CreditCard },
  { path:'/ai',          labelKey:'ai',          Icon: Bot },
  { path:'/submissions', labelKey:'submissions', Icon: FileText },
];

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();
  const { unreadCount, notifications, markRead, loadNotifications } = useApp();
  const { tier: subTier } = useSubscriptionStatus(user?.id);
  const [aiQuota, setAiQuota] = useState(null);
  const [showNotif,  setShowNotif]  = useState(false);
  const [showUser,   setShowUser]   = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const { lang, toggleLang, t } = useLang();
  
  useEffect(() => {
    if (user && subTier === 'free') {
      api.get('/ai/quota').then(res => setAiQuota(res.data)).catch(() => {});
    } else {
      setAiQuota(null);
    }
  }, [user, subTier, location.pathname]);
  const { effectiveTheme, toggleTheme } = useTheme();
  const notifRef = useRef(null);
  const userRef  = useRef(null);
  const loadNotifRef = useRef(loadNotifications);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => { loadNotifRef.current = loadNotifications; }, [loadNotifications]);
  useEffect(() => {
    if (showNotif) loadNotifRef.current();
  }, [showNotif]);

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (userRef.current  && !userRef.current.contains(e.target))  setShowUser(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (path) => { navigate(path); setShowNotif(false); setShowUser(false); setShowMobile(false); };
  const tc = TIER_COLOR[user?.tier] || '#888';
  const currentPath = location.pathname;
  const themeToggleLabel = effectiveTheme === 'dark'
    ? (lang === 'ko' ? '라이트 모드로 전환' : 'Switch to light mode')
    : (lang === 'ko' ? '다크 모드로 전환' : 'Switch to dark mode');
  const languageToggleLabel = lang === 'ko' ? '언어: 한국어' : 'Language: English';
  const notificationLabel = unreadCount > 0
    ? (lang === 'ko' ? `알림 ${unreadCount}개 읽지 않음` : `Notifications, ${unreadCount} unread`)
    : (lang === 'ko' ? '알림' : 'Notifications');

  return (
    <>
      <nav style={{
        height:54, display:'flex', alignItems:'center',
        padding:'0 20px', gap:0,
        background:'var(--glass-bg)', borderBottom:'1px solid var(--border)',
        position:'sticky', top:0, zIndex:100, flexShrink:0,
        backdropFilter:'blur(12px)',
        boxShadow: isScrolled ? '0 10px 30px rgba(0,0,0,.22)' : 'none',
        transition:'box-shadow .2s ease',
      }}>
        {/* 로고 */}
        <div onClick={()=>go('/')} style={{
          display:'flex',alignItems:'center',gap:8,cursor:'pointer',
          marginRight:24,flexShrink:0,
          padding:'5px 10px 5px 6px', borderRadius:9,
          transition:'background .15s',
        }}
          onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
        >
          <span style={{ width:26, height:26, borderRadius:7, background:'linear-gradient(135deg, var(--blue), var(--purple))', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Sparkles size={13} color="#fff" />
          </span>
          <span style={{fontSize:14,fontWeight:800,letterSpacing:-.3}} className="gradient-text">DailyCoding</span>
        </div>

        {/* 햄버거 버튼 (모바일 전용) */}
        <button className="topnav-hamburger" onClick={()=>setShowMobile(p=>!p)} aria-label={t('menu')}>
          {showMobile ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* 데스크탑 네비 */}
        <div className="topnav-desktop-nav" style={{display:'flex',alignItems:'center',gap:2,flex:1}}>
          {NAV.map(n=>{
            const active =
              currentPath === n.path ||
              (n.path === '/problems' && currentPath.startsWith('/problems')) ||
              (n.path === '/community' && currentPath.startsWith('/community'));
            const Icon = n.Icon;
            return (
              <button key={n.path} onClick={()=>go(n.path)} style={{
                padding:'5px 13px', borderRadius:7, border:'none', cursor:'pointer',
                fontSize:13, fontWeight: active ? 700 : 600, fontFamily:'inherit',
                background: active ? 'var(--bg3)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text2)',
                boxShadow: active ? 'inset 0 -2px 0 var(--accent)' : 'none',
                transition:'all .15s', display:'flex', alignItems:'center', gap:5,
              }}
                onMouseEnter={e=>{ if(!active){ e.currentTarget.style.color='var(--text)'; e.currentTarget.style.background='rgba(255,255,255,.04)'; } }}
                onMouseLeave={e=>{ if(!active){ e.currentTarget.style.color='var(--text2)'; e.currentTarget.style.background='transparent'; } }}
              >
                <Icon size={15} strokeWidth={2.1} />{t(n.labelKey)}
              </button>
            );
          })}
          {isAdmin&&(
            <button onClick={()=>go('/admin')} style={{
              padding:'5px 13px',borderRadius:7,border:'none',cursor:'pointer',
              fontSize:13,fontWeight:600,fontFamily:'inherit',
              background:currentPath==='/admin'?'rgba(227,179,65,.1)':'transparent',
              color:currentPath==='/admin'?'var(--yellow)':'var(--text3)',
              transition:'all .15s',display:'flex',alignItems:'center',gap:5,
            }}><Shield size={14} />{t('admin')}</button>
          )}
          {subTier === 'team' && (
            <button onClick={()=>go('/team')} style={{
              padding:'5px 13px',borderRadius:7,border:'none',cursor:'pointer',
              fontSize:13,fontWeight:600,fontFamily:'inherit',
              background:currentPath==='/team'?'rgba(255,215,0,.1)':'transparent',
              color:currentPath==='/team'?'#ffd700':'var(--text3)',
              transition:'all .15s',display:'flex',alignItems:'center',gap:5,
            }}><Users size={14} />{t('team')}</button>
          )}
        </div>

        {/* 오른쪽 */}
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          {user && subTier === 'free' && aiQuota && (
            <div onClick={() => go('/pricing')} style={{ 
              display: 'flex', flexDirection: 'column', gap: 3, cursor: 'pointer', 
              padding: '0 12px 0 0', borderRight: '1px solid var(--border)', marginRight: 4
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: 'var(--text3)' }}>
                <span>{t('aiHintsLabel')}</span>
                <span>{aiQuota.used}/{aiQuota.limit}</span>
              </div>
              <div style={{ width: 64, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ 
                  width: `${Math.min(100, (aiQuota.used / aiQuota.limit) * 100)}%`, height: '100%', 
                  background: aiQuota.used >= aiQuota.limit ? 'var(--red)' : 'var(--blue)',
                  transition: 'width 0.3s' 
                }} />
              </div>
            </div>
          )}
          {user && subTier === 'free' && (
            <button onClick={() => go('/pricing')} style={{
              display:'grid', gap:2,
              padding: '7px 12px', borderRadius: 12, border: '1px solid rgba(121,192,255,.18)', background: 'linear-gradient(135deg, rgba(121,192,255,.16), rgba(13,17,23,.92))', color: 'var(--text)',
              fontSize: 12, fontWeight: 800, cursor: 'pointer', marginRight: 4, transition: 'transform 0.15s',
              boxShadow: '0 6px 14px rgba(88, 166, 255, 0.18)'
            }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <span style={{ fontSize: 10, color:'var(--blue)', letterSpacing:'.08em', textTransform:'uppercase' }}>Upgrade</span>
              <span>{PLAN_META.pro.name} ${PLAN_META.pro.monthlyPrice} · {PLAN_META.team.name} ${PLAN_META.team.monthlyPrice}</span>
            </button>
          )}
          <div className="topnav-server-status"><ServerStatus/></div>

          {/* 테마 */}
          <button onClick={toggleTheme} title={t('toggleTheme')} aria-label={themeToggleLabel} style={{
            width:32,height:32,borderRadius:8,border:'1px solid var(--border)',
            background:'var(--bg3)',cursor:'pointer',fontSize:14,
            display:'flex',alignItems:'center',justifyContent:'center',
          }}>{effectiveTheme==='dark'?<Sun size={15} />:<Moon size={15} />}</button>
          <button onClick={toggleLang} title={t('language')} aria-label={languageToggleLabel} style={{
            height:32,padding:'0 10px',borderRadius:8,border:'1px solid var(--border)',
            background:'var(--bg3)',cursor:'pointer',fontSize:12,fontWeight:700,color:'var(--text2)',
          }}>{lang === 'ko' ? 'EN' : 'KO'}</button>

          {/* 알림 */}
          <div ref={notifRef} style={{position:'relative'}}>
            <button onClick={()=>{setShowNotif(p=>!p);setShowUser(false);}} aria-label={notificationLabel} style={{
              width:32,height:32,borderRadius:8,border:'1px solid var(--border)',
              background:'var(--bg3)',cursor:'pointer',position:'relative',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,
            }}>
              <Bell size={15} />
              {unreadCount>0&&(
                <span style={{
                  position:'absolute',top:-4,right:-4,
                  width:16,height:16,borderRadius:'50%',
                  background:'var(--red)',color:'#fff',fontSize:10,
                  fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',
                  animation:'pulse2 2s infinite',
                }}>{unreadCount>9?'9+':unreadCount}</span>
              )}
            </button>
            {showNotif&&(
              <div style={{
                position:'absolute',top:'calc(100% + 8px)',right:0,
                width:320,background:'var(--bg2)',
                border:'1px solid var(--border)',borderRadius:12,
                boxShadow:'0 8px 30px rgba(0,0,0,.4)',overflow:'hidden',zIndex:200,
              }}>
                <div style={{
                  padding:'12px 16px',display:'flex',justifyContent:'space-between',
                  alignItems:'center',borderBottom:'1px solid var(--border)',
                }}>
                  <span style={{fontWeight:700,fontSize:13}}>{t('notifications')} {unreadCount>0&&`(${unreadCount})`}</span>
                  {notifications.length>0&&(
                    <button onClick={async()=>{
                      try {
                        await api.patch('/notifications/all/read');
                      } catch {
                        // 서버 동기화 실패 시에도 로컬 읽음 처리는 진행
                      }
                      notifications.forEach(n=>markRead(n.id));
                    }} style={{fontSize:11,color:'var(--blue)',background:'none',border:'none',cursor:'pointer'}}>
                      {t('markAllRead')}
                    </button>
                  )}
                </div>
                <div style={{maxHeight:300,overflowY:'auto'}}>
                  {notifications.length===0
                    ?<div style={{padding:'24px 16px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
                       {t('noNotifications')}
                     </div>
                    :notifications.slice(0,8).map(n=>(
                      <div key={n.id} onClick={()=>{markRead(n.id);if(n.link)go(n.link);setShowNotif(false);}} style={{
                        padding:'11px 16px',cursor:'pointer',
                        background:n.read?'transparent':'rgba(121,192,255,.04)',
                        borderBottom:'1px solid var(--border)',
                        borderLeft:n.read?'3px solid transparent':'3px solid var(--blue)',
                        transition:'background .15s',
                      }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                        onMouseLeave={e=>e.currentTarget.style.background=n.read?'transparent':'rgba(121,192,255,.04)'}
                      >
                        <div style={{fontSize:13,lineHeight:1.4}}>{n.msg}</div>
                        <div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>{n.time}</div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>

          {/* 유저 메뉴 */}
          <div ref={userRef} style={{position:'relative'}}>
            <button onClick={()=>{setShowUser(p=>!p);setShowNotif(false);}} style={{
              height:32,borderRadius:8,border:`1px solid ${tc}40`,
              background:`${tc}10`,cursor:'pointer',
              padding:'0 12px 0 8px',
              display:'flex',alignItems:'center',gap:8,
            }}>
              <Avatar user={user} size={22} />
              <span style={{fontSize:12,fontWeight:600,color:tc}}>{user?.username}</span>
              {subTier === 'pro' && (
                <span style={{
                  background: 'linear-gradient(135deg, #79c0ff, #d2a8ff)',
                  color: '#0d1117', fontSize: 10, fontWeight: 800,
                  padding: '1px 6px', borderRadius: 4, letterSpacing:.5, lineHeight:1,
                }}>PRO</span>
              )}
              {subTier === 'team' && (
                <span style={{
                  fontSize:9,fontWeight:800,padding:'2px 5px',borderRadius:4,
                  background: 'rgba(255,215,0,.15)',
                  color: '#ffd700',
                  letterSpacing:.5, lineHeight:1,
                }}>TEAM</span>
              )}
            </button>
            {showUser&&(
              <div style={{
                position:'absolute',top:'calc(100% + 8px)',right:0,
                width:200,background:'var(--bg2)',
                border:'1px solid var(--border)',borderRadius:12,
                boxShadow:'0 8px 30px rgba(0,0,0,.4)',overflow:'hidden',zIndex:200,
              }}>
                <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border)'}}>
                  <div style={{fontWeight:700,fontSize:13}}>{user?.username}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{user?.email}</div>
                  <div style={{
                    marginTop:6,fontSize:11,fontFamily:'Space Mono,monospace',
                    color:tc,fontWeight:700,
                  }}>● {user?.tier === 'unranked' ? 'UNRANKED' : user?.tier?.toUpperCase()} · {t('ratingPoints').replace('{n}', String(user?.rating || 0))}</div>
                </div>
                {[
                  {labelKey:'myProfile', Icon: UserIcon, path:'/profile'},
                  {labelKey:'settings',  Icon: Settings, path:'/settings'},
                  {labelKey:'submissions', Icon: FileText, path:'/submissions'},
                  {labelKey:'pricing',   Icon: CreditCard, path:'/pricing'},
                  {labelKey:'ai',        Icon: Bot, path:'/ai'},
                  ...(subTier === 'team' ? [{labelKey:'team', Icon: Users, path:'/team'}] : []),
                ].map(item=>(
                  <button key={item.labelKey} onClick={()=>go(item.path)} style={{
                    width:'100%',padding:'10px 16px',border:'none',
                    background:'transparent',color:'var(--text)',cursor:'pointer',
                    fontSize:13,fontFamily:'inherit',textAlign:'left',
                    display:'flex',alignItems:'center',gap:10,transition:'background .15s',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  ><item.Icon size={15} />{t(item.labelKey)}</button>
                ))}
                <div style={{borderTop:'1px solid var(--border)'}}>
                  <button onClick={logout} style={{
                    width:'100%',padding:'10px 16px',border:'none',
                    background:'transparent',color:'var(--red)',cursor:'pointer',
                    fontSize:13,fontFamily:'inherit',textAlign:'left',
                    display:'flex',alignItems:'center',gap:10,transition:'background .15s',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(248,81,73,.06)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  ><LogOut size={15} />{t('logout')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* 모바일 드롭다운 메뉴 */}
      {showMobile && <div className="topnav-overlay" onClick={() => setShowMobile(false)} />}
      <div className={`topnav-mobile-menu${showMobile?' open':''}`} style={{position:'absolute',top:54,left:0,right:0}}>
        {NAV.map(n=>(
          <button key={n.path} className={`topnav-mobile-btn${currentPath===n.path||currentPath.startsWith(n.path+'/') ?' active':''}`} onClick={()=>go(n.path)}>
            <n.Icon size={16} />{t(n.labelKey)}
          </button>
        ))}
        {isAdmin&&(
          <button className={`topnav-mobile-btn${currentPath==='/admin'?' active':''}`} onClick={()=>go('/admin')}>
            <Shield size={16} />{t('admin')}
          </button>
        )}
        <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
          <button className="topnav-mobile-btn" onClick={()=>go('/profile')}><UserIcon size={16} />{t('myProfile')}</button>
          <button className="topnav-mobile-btn" onClick={()=>go('/settings')}><Settings size={16} />{t('settings')}</button>
          <button className="topnav-mobile-btn" style={{color:'var(--red)'}} onClick={()=>{logout();setShowMobile(false);}}><LogOut size={16} />{t('logout')}</button>
        </div>
      </div>

    </>
  );
}

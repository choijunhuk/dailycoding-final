import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../api.js';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.js';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext.jsx';
import { PLAN_META } from '../data/pricingPlans.js';
import ProfileAvatar from './ProfileAvatar.jsx';
import ServerStatus from './ServerStatus.jsx';
import {
  BarChart2,
  BookOpen,
  Bot,
  ChevronDown,
  CreditCard,
  FileText,
  Menu,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Sun,
  Trophy,
  Trash2,
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

const NAV_GROUPS = [
  {
    key: 'problems', labelKey: 'problems', Icon: BookOpen,
    matchPaths: ['/problems', '/sheets', '/submissions', '/submit-problem', '/problem-sets'],
    items: [
      { path: '/problems',        labelKey: 'problems',       Icon: BookOpen },
      { path: '/sheets',          labelKey: 'sheets',         Icon: BookOpen },
      { path: '/problem-sets',    label: '내 문제 세트',       Icon: BookOpen },
      { path: '/submissions',     labelKey: 'submissions',    Icon: FileText },
      { path: '/submit-problem',  label: '문제 제출하기',     Icon: FileText },
    ],
  },
  {
    key: 'contest', labelKey: 'contest', Icon: Trophy,
    matchPaths: ['/contest', '/exams'],
    items: [
      { path: '/contest', labelKey: 'contest', Icon: Trophy },
      { path: '/exams',   labelKey: 'exams',   Icon: Trophy },
    ],
  },
  { key: 'compete', label: '대결', Icon: Swords, path: '/compete' },
  { key: 'battle',  labelKey: 'battle',  Icon: Swords,        path: '/battle' },
  { key: 'game',    label: '게임',        Icon: Sparkles,      path: '/game' },
  { key: 'ranking', labelKey: 'ranking', Icon: BarChart2,     path: '/ranking' },
  {
    key: 'community', labelKey: 'community', Icon: MessageSquare,
    matchPaths: ['/community', '/reviews'],
    items: [
      { path: '/community', labelKey: 'community', Icon: MessageSquare },
      { path: '/reviews',   labelKey: 'reviews',   Icon: Users },
    ],
  },
  {
    key: 'learning', labelKey: 'learning', Icon: Sparkles,
    matchPaths: ['/learning', '/ai'],
    items: [
      { path: '/learning', labelKey: 'learning', Icon: Sparkles },
      { path: '/ai',       labelKey: 'ai',       Icon: Bot },
    ],
  },
];

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();
  const { unreadCount, notifications, markRead, loadNotifications, clearAllNotifications } = useApp();
  const { tier: subTier } = useSubscriptionStatus(user?.id);
  const [aiQuota, setAiQuota] = useState(null);
  const [equippedTitleName, setEquippedTitleName] = useState('');
  const [showNotif,     setShowNotif]     = useState(false);
  const [showUser,      setShowUser]      = useState(false);
  const [showMobile,    setShowMobile]    = useState(false);
  const [hoveredGroup,  setHoveredGroup]  = useState(null);
  const [showSearch,    setShowSearch]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState({ problems: [], posts: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const hoverCloseTimerRef = useRef(null);
  const searchRef      = useRef(null);
  const searchInputRef = useRef(null);
  const { lang, toggleLang, t } = useLang();
  
  useEffect(() => {
    if (user && subTier === 'free') {
      api.get('/ai/quota').then(res => setAiQuota(res.data)).catch(() => {});
    } else {
      setAiQuota(null);
    }
  }, [user, subTier, location.pathname]);
  useEffect(() => {
    if (!user?.id) { setEquippedTitleName(''); return; }
    api.get('/rewards/my')
      .then((res) => {
        const titleCode = res.data?.equippedTitle;
        const title = (res.data?.rewards || []).find((item) => item.code === titleCode);
        setEquippedTitleName(title?.name || '');
      })
      .catch(() => setEquippedTitleName(''));
  }, [user?.id, user?.equippedTitle]);
  const { effectiveTheme, toggleTheme } = useTheme();
  const notifRef = useRef(null);
  const userRef  = useRef(null);
  const loadNotifRef = useRef(loadNotifications);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => { loadNotifRef.current = loadNotifications; }, [loadNotifications]);
  useEffect(() => {
    if (showNotif) loadNotifRef.current();
  }, [showNotif]);

  // 검색 디바운스
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults({ problems: [], posts: [] }); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await api.get('/search', { params: { q: searchQuery, limit: 5 } });
        setSearchResults(data);
      } catch { setSearchResults({ problems: [], posts: [] }); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 검색창 열릴 때 포커스
  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
    else setSearchQuery('');
  }, [showSearch]);

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current  && !notifRef.current.contains(e.target))  setShowNotif(false);
      if (userRef.current   && !userRef.current.contains(e.target))   setShowUser(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) { setShowSearch(false); }
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

  useEffect(() => () => {
    if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
  }, []);

  const openNavGroup = (key) => {
    if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    hoverCloseTimerRef.current = null;
    setHoveredGroup(key);
  };

  const scheduleNavGroupClose = () => {
    if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    hoverCloseTimerRef.current = setTimeout(() => {
      setHoveredGroup(null);
      hoverCloseTimerRef.current = null;
    }, 300);
  };

  const go = (path) => { navigate(path); setShowNotif(false); setShowUser(false); setShowSearch(false); setShowMobile(false); };
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
          {NAV_GROUPS.map(group => {
            const isDropdown = !!group.items;
            const active = group.matchPaths
              ? group.matchPaths.some(p => currentPath === p || currentPath.startsWith(p + '/'))
              : currentPath === group.path || currentPath.startsWith(group.path + '/');
            const Icon = group.Icon;
            const btnStyle = {
              padding:'5px 13px', borderRadius:7, border:'none', cursor:'pointer',
              fontSize:13, fontWeight: active ? 700 : 600, fontFamily:'inherit',
              background: active ? 'var(--bg3)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text2)',
              boxShadow: active ? 'inset 0 -2px 0 var(--accent)' : 'none',
              transition:'all .15s', display:'flex', alignItems:'center', gap:5,
            };

            if (!isDropdown) {
              return (
                <button key={group.key} onClick={() => go(group.path)} style={btnStyle}
                  onMouseEnter={e=>{ if(!active){ e.currentTarget.style.color='var(--text)'; e.currentTarget.style.background='rgba(255,255,255,.04)'; }}}
                  onMouseLeave={e=>{ if(!active){ e.currentTarget.style.color='var(--text2)'; e.currentTarget.style.background='transparent'; }}}
                >
                  <Icon size={15} strokeWidth={2.1} />{group.label || t(group.labelKey)}
                </button>
              );
            }

            return (
              <div key={group.key} style={{ position:'relative' }}
                onMouseEnter={() => openNavGroup(group.key)}
                onMouseLeave={scheduleNavGroupClose}
                onFocus={() => openNavGroup(group.key)}
                onBlur={scheduleNavGroupClose}
              >
                <button style={btnStyle}>
                  <Icon size={15} strokeWidth={2.1} />{group.label || t(group.labelKey)}
                  <ChevronDown size={11} strokeWidth={2.5} style={{ opacity:.6, marginLeft:-2, transition:'transform .15s', transform: hoveredGroup === group.key ? 'rotate(180deg)' : 'none' }} />
                </button>
                {hoveredGroup === group.key && (
                  <div style={{
                    position:'absolute', top:'calc(100% - 10px)', left:-14,
                    minWidth:178, padding:'14px 14px 0', zIndex:200,
                  }}
                    onMouseEnter={() => openNavGroup(group.key)}
                    onMouseLeave={scheduleNavGroupClose}
                  >
                    <div style={{
                      background:'var(--bg2)',
                      border:'1px solid var(--border)', borderRadius:10,
                      boxShadow:'0 8px 24px rgba(0,0,0,.35)', overflow:'hidden',
                    }}>
                      {group.items.map(item => {
                        const itemActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
                        return (
                          <button key={item.path} onClick={() => go(item.path)} style={{
                            width:'100%', padding:'9px 14px', border:'none',
                            background: itemActive ? 'var(--bg3)' : 'transparent',
                            color: itemActive ? 'var(--text)' : 'var(--text2)',
                            fontWeight: itemActive ? 700 : 500,
                            cursor:'pointer', fontSize:13, fontFamily:'inherit',
                            textAlign:'left', display:'flex', alignItems:'center', gap:8,
                            transition:'background .1s',
                            borderLeft: itemActive ? '2px solid var(--accent)' : '2px solid transparent',
                          }}
                            onMouseEnter={e=>{ if(!itemActive){ e.currentTarget.style.background='var(--bg3)'; e.currentTarget.style.color='var(--text)'; }}}
                            onMouseLeave={e=>{ if(!itemActive){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text2)'; }}}
                          >
                            <item.Icon size={14} strokeWidth={2} />{item.label || t(item.labelKey)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
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
          {user && (
            <button onClick={()=>go('/team')} style={{
              padding:'5px 13px',borderRadius:7,border:'none',cursor:'pointer',
              fontSize:13,fontWeight:600,fontFamily:'inherit',
              background:currentPath==='/team'?'rgba(255,215,0,.1)':'transparent',
              color:currentPath==='/team'?'#ffd700':'var(--text3)',
              transition:'all .15s',display:'flex',alignItems:'center',gap:5,
            }}><Users size={14} />{subTier === 'team' ? t('team') : '소속'}</button>
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

          {/* 검색 */}
          {user && (
            <div ref={searchRef} style={{position:'relative'}}>
              <button
                onClick={()=>{setShowSearch(p=>!p);setShowNotif(false);setShowUser(false);}}
                aria-label="검색"
                style={{
                  width:32,height:32,borderRadius:8,border:'1px solid var(--border)',
                  background:showSearch?'var(--bg)':'var(--bg3)',cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',
                }}
              ><Search size={15}/></button>
              {showSearch&&(
                <div style={{
                  position:'absolute',top:'calc(100% + 8px)',right:0,
                  width:340,background:'var(--bg2)',
                  border:'1px solid var(--border)',borderRadius:12,
                  boxShadow:'0 8px 30px rgba(0,0,0,.4)',overflow:'hidden',zIndex:200,
                }}>
                  <div style={{padding:'10px 12px',borderBottom:'1px solid var(--border)'}}>
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={e=>setSearchQuery(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Escape'){setShowSearch(false);} }}
                      placeholder="문제, 커뮤니티 검색..."
                      style={{
                        width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',
                        borderRadius:8,padding:'7px 12px',color:'var(--text)',fontSize:13,
                        outline:'none',boxSizing:'border-box',fontFamily:'inherit',
                      }}
                    />
                  </div>
                  {searchLoading&&<div style={{padding:'16px',textAlign:'center',color:'var(--text3)',fontSize:12}}>검색 중...</div>}
                  {!searchLoading&&searchQuery&&searchResults.problems.length===0&&searchResults.posts.length===0&&(
                    <div style={{padding:'16px',textAlign:'center',color:'var(--text3)',fontSize:12}}>결과 없음</div>
                  )}
                  {!searchLoading&&(searchResults.problems.length>0||searchResults.posts.length>0)&&(
                    <div style={{maxHeight:320,overflowY:'auto'}}>
                      {searchResults.problems.length>0&&(
                        <>
                          <div style={{padding:'6px 12px 4px',fontSize:10,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:1}}>문제</div>
                          {searchResults.problems.map(p=>(
                            <div key={p.id} onClick={()=>go(`/problems/${p.id}`)} style={{
                              padding:'9px 12px',cursor:'pointer',borderBottom:'1px solid var(--border)',transition:'background .15s',
                            }}
                              onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                            >
                              <div style={{fontSize:13,fontWeight:600}}>{p.title}</div>
                              <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{p.tier} · {p.difficulty}</div>
                            </div>
                          ))}
                        </>
                      )}
                      {searchResults.posts.length>0&&(
                        <>
                          <div style={{padding:'6px 12px 4px',fontSize:10,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:1}}>커뮤니티</div>
                          {searchResults.posts.map(p=>(
                            <div key={p.id} onClick={()=>go(`/community/${p.board_type}/${p.id}`)} style={{
                              padding:'9px 12px',cursor:'pointer',transition:'background .15s',
                            }}
                              onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                            >
                              <div style={{fontSize:13,fontWeight:600}}>{p.title}</div>
                              <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{p.board_type}</div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                  {!searchQuery&&(
                    <div style={{padding:'16px',textAlign:'center',color:'var(--text3)',fontSize:12}}>문제 제목, 태그, 커뮤니티 글 검색</div>
                  )}
                </div>
              )}
            </div>
          )}

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
                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                      <button onClick={async()=>{
                        try { await api.patch('/notifications/all/read'); } catch { /* ignore */ }
                        notifications.forEach(n=>markRead(n.id));
                      }} style={{fontSize:11,color:'var(--blue)',background:'none',border:'none',cursor:'pointer',padding:0}}>
                        {t('markAllRead')}
                      </button>
                      <button onClick={clearAllNotifications} title="전체 삭제" aria-label="알림 전체 삭제" style={{
                        background:'none',border:'none',cursor:'pointer',padding:0,
                        color:'var(--text3)',display:'flex',alignItems:'center',
                      }}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
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
              <ProfileAvatar profile={user} size={22} border="2px solid var(--border)" />
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
                  {equippedTitleName && <div style={{fontSize:11,color:'var(--blue)',fontWeight:800,marginTop:2}}>{equippedTitleName}</div>}
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{user?.email}</div>
                  <div style={{
                    marginTop:6,fontSize:11,fontFamily:'Space Mono,monospace',
                    color:tc,fontWeight:700,
                  }}>● {user?.tier === 'unranked' ? 'UNRANKED' : user?.tier?.toUpperCase()} · {t('ratingPoints').replace('{n}', String(user?.rating || 0))}</div>
                </div>
                {[
                  {labelKey:'myProfile', Icon: UserIcon, path:'/profile'},
                  {label:'보상 보관함', Icon: Trophy, path:'/rewards'},
                  {label:'훈장 컬렉션', Icon: Trophy, path:'/badges'},
                  {labelKey:'settings',  Icon: Settings, path:'/settings'},
                  {labelKey:'submissions', Icon: FileText, path:'/submissions'},
                  {labelKey:'pricing',   Icon: CreditCard, path:'/pricing'},
                  {labelKey:'ai',        Icon: Bot, path:'/ai'},
                  ...(user ? [{labelKey:'team', Icon: Users, path:'/team'}] : []),
                ].map(item=>(
                  <button key={item.labelKey || item.label} onClick={()=>go(item.path)} style={{
                    width:'100%',padding:'10px 16px',border:'none',
                    background:'transparent',color:'var(--text)',cursor:'pointer',
                    fontSize:13,fontFamily:'inherit',textAlign:'left',
                    display:'flex',alignItems:'center',gap:10,transition:'background .15s',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  ><item.Icon size={15} />{item.labelKey ? t(item.labelKey) : item.label}</button>
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
        {NAV_GROUPS.map(group => {
          if (group.items) {
            return group.items.map(item => (
              <button key={item.path} className={`topnav-mobile-btn${currentPath===item.path||currentPath.startsWith(item.path+'/') ?' active':''}`} onClick={()=>go(item.path)}>
                <item.Icon size={16} />{item.label || t(item.labelKey)}
              </button>
            ));
          }
          return (
            <button key={group.key} className={`topnav-mobile-btn${currentPath===group.path||currentPath.startsWith(group.path+'/') ?' active':''}`} onClick={()=>go(group.path)}>
              <group.Icon size={16} />{group.label || t(group.labelKey)}
            </button>
          );
        })}
        {isAdmin&&(
          <button className={`topnav-mobile-btn${currentPath==='/admin'?' active':''}`} onClick={()=>go('/admin')}>
            <Shield size={16} />{t('admin')}
          </button>
        )}
        {user && (
          <button className={`topnav-mobile-btn${currentPath==='/team'?' active':''}`} onClick={()=>go('/team')}>
            <Users size={16} />{subTier === 'team' ? t('team') : '소속'}
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

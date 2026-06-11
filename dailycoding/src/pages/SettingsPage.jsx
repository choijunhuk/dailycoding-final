import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { FONT_OPTIONS, applyAppTypographyPreference, normalizeAppFontSize } from '../utils/fontPreferences.js';
import { applyUiPreferenceFlags } from '../utils/uiPreferences.js';
import ProfileAvatar from '../components/ProfileAvatar.jsx';
import { Bell, Code2, Lock, Monitor, Shield, User } from 'lucide-react';

const TABS = [
  { id: 'profile',       labelKey: 'profileTab' },
  { id: 'notifications', labelKey: 'notificationsTab' },
  { id: 'ui',            labelKey: 'uiTab' },
  { id: 'editor',        labelKey: 'editorTab' },
  { id: 'privacy',       labelKey: 'privacyTab' },
  { id: 'account',       labelKey: 'accountTab' },
];

const TAB_ICONS = {
  profile:       <User size={15} />,
  notifications: <Bell size={15} />,
  ui:            <Monitor size={15} />,
  editor:        <Code2 size={15} />,
  privacy:       <Shield size={15} />,
  account:       <Lock size={15} />,
};


export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const [tab, setTab] = useState('profile');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nickname, setNickname] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState(null);
  const nicknameTimer = useRef(null);

  const [profileVisibility, setProfileVisibility] = useState('public');
  const [postVisibility, setPostVisibility] = useState('public');
  const [pwForm, setPwForm] = useState({ current:'', next:'', confirm:'' });
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [oauthLinked, setOauthLinked] = useState({ github: false, google: false, discord: false, kakao: false });
  const [oauthBusy, setOauthBusy] = useState(false);

  async function refreshOAuthIdentities() {
    try {
      const res = await api.get('/auth/me/identities');
      setOauthLinked(res.data?.linked || { github: false, google: false, discord: false, kakao: false });
    } catch {
      // ignore — section just shows defaults
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/auth/settings');
        setSettings(res.data.settings);
        setNickname(user?.nickname || '');
        setProfileVisibility(user?.profileVisibility || 'public');
        setPostVisibility(user?.postVisibility || 'public');
      } catch {
        toast?.show(t('settingsLoadFailed'), 'error');
      } finally {
        setLoading(false);
      }
    })();
    refreshOAuthIdentities();
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash.includes('oauth_linked=')) {
      const provider = decodeURIComponent(hash.split('oauth_linked=')[1].split('&')[0]);
      toast?.show(`${provider} 계정이 연결되었습니다.`, 'success');
      window.location.hash = '';
    } else if (hash.includes('oauth_link_error=')) {
      const msg = decodeURIComponent(hash.split('oauth_link_error=')[1].split('&')[0]);
      toast?.show(msg, 'error');
      window.location.hash = '';
    }
  }, []);

  function linkProvider(provider) {
    const apiBase = import.meta.env.VITE_API_URL || '';
    window.location.href = `${apiBase}/api/auth/link/${provider}`;
  }

  async function unlinkProvider(provider) {
    if (!confirm(`${provider} 연결을 해제하시겠습니까?`)) return;
    setOauthBusy(true);
    try {
      await api.delete(`/auth/unlink/${provider}`);
      toast?.show(`${provider} 연결이 해제되었습니다.`, 'success');
      await refreshOAuthIdentities();
    } catch (e) {
      toast?.show(e.response?.data?.message || '해제 실패', 'error');
    } finally {
      setOauthBusy(false);
    }
  }

  function onNicknameChange(v) {
    setNickname(v);
    setNicknameStatus(null);
    clearTimeout(nicknameTimer.current);
    if (!v || v === user?.nickname) return;
    nicknameTimer.current = setTimeout(async () => {
      setNicknameStatus('checking');
      try {
        const res = await api.get('/auth/check-nickname', { params: { nickname: v } });
        setNicknameStatus(res.data.available ? 'available' : 'taken');
      } catch {
        setNicknameStatus(null);
      }
    }, 500);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      if (nickname && nickname !== user?.nickname && nicknameStatus === 'available') {
        await api.patch('/auth/nickname', { nickname });
        await refreshUser();
      }
      toast?.show(t('profileSaved'), 'success');
    } catch (e) {
      toast?.show(e.response?.data?.message || t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveSection(section, patch) {
    setSaving(true);
    try {
      const { data } = await api.patch('/auth/settings', { section, settings: patch });
      const nextSettings = data?.settings || { ...(settings || {}), [section]: { ...(settings?.[section] || {}), ...patch } };
      setSettings(nextSettings);
      await refreshUser();
      toast?.show(t('saveSuccess'), 'success');
    } catch {
      toast?.show(t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveVisibility() {
    setSaving(true);
    try {
      await api.patch('/auth/visibility', { profile_visibility: profileVisibility, post_visibility: postVisibility });
      await refreshUser();
      toast?.show(t('visibilitySaved'), 'success');
    } catch {
      toast?.show(t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (pwForm.next !== pwForm.confirm) { toast?.show(t('passwordMismatch'), 'error'); return; }
    if (pwForm.next.length < 8) { toast?.show(t('passwordTooShort'), 'error'); return; }
    setSaving(true);
    try {
      await api.patch('/auth/password', { current: pwForm.current, next: pwForm.next });
      setPwForm({ current:'', next:'', confirm:'' });
      toast?.show(t('passwordChanged'), 'success');
    } catch (e) {
      toast?.show(e.response?.data?.message || t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    const hasPassword = user?.hasPassword !== false;
    if (hasPassword && !deletePassword) return;
    setDeleting(true);
    try {
      await api.delete('/auth/me', { data: hasPassword ? { password: deletePassword } : {} });
      toast?.show(t('deleteAccountSuccess'), 'success');
      logout();
      navigate('/');
    } catch (e) {
      toast?.show(e.response?.data?.message || t('deleteAccountError'), 'error');
    } finally {
      setDeleting(false);
    }
  }


  const activeTabLabel = t(TABS.find(x => x.id === tab)?.labelKey ?? 'profileTab');

  if (loading) return (
    <div className="settings-layout" style={{ maxWidth:1100, margin:'0 auto', padding:'32px 24px', display:'grid', gap:24 }}>
      <div className="skeleton-line" style={{ height:220, borderRadius:14 }} />
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton-line" style={{ height:52, borderRadius:10 }} />)}
      </div>
    </div>
  );

  return (
    <div className="settings-layout" style={{ maxWidth:1100, margin:'0 auto', padding:'32px 24px', display:'grid', gridTemplateColumns:'220px 1fr', gap:24, alignItems:'start' }}>

      {/* ── Left sidebar ── */}
      <aside className="card" style={{ overflow:'hidden', position:'sticky', top:80 }}>
        <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid var(--border)', background:'linear-gradient(135deg, rgba(121,192,255,.04), rgba(210,168,255,.04))' }}>
          <ProfileAvatar profile={user} size={44} fontSize={18} style={{ marginBottom:10 }} />
          <div style={{ fontSize:15, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {user?.nickname || user?.username || t('userFallback')}
          </div>
          {user?.email && (
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
          )}
        </div>
        <nav style={{ padding:'8px' }}>
          {TABS.map(tabItem => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
              style={{
                display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px',
                borderRadius:8, border:'none', cursor:'pointer', fontSize:13,
                fontWeight: tab === tabItem.id ? 700 : 400,
                background: tab === tabItem.id ? 'var(--bg3)' : 'transparent',
                color: tab === tabItem.id ? 'var(--text)' : 'var(--text2)',
                textAlign:'left', marginBottom:2,
                transition:'background .15s, color .15s',
              }}>
              <span style={{ color: tab === tabItem.id ? 'var(--accent)' : 'var(--text3)', display:'flex', flexShrink:0 }}>
                {TAB_ICONS[tabItem.id]}
              </span>
              {t(tabItem.labelKey)}
              {tab === tabItem.id && (
                <span style={{ marginLeft:'auto', width:5, height:5, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Right content panel ── */}
      <div className="card" style={{ padding:'32px', minWidth:0 }}>
        <div style={{ marginBottom:28, paddingBottom:20, borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'var(--accent)', display:'flex' }}>{TAB_ICONS[tab]}</span>
          <h2 className="section-header-title" style={{ fontSize:20, margin:0 }}>{activeTabLabel}</h2>
        </div>

        {tab === 'profile' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            <Field label={t('nickname')}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input className="settings-input" value={nickname} onChange={e => onNicknameChange(e.target.value)}
                  placeholder={user?.nickname || t('nickname')} style={{ flex:1 }} />
                {nicknameStatus === 'checking' && <span style={{ fontSize:12, color:'var(--text3)' }}>…</span>}
                {nicknameStatus === 'available' && <span style={{ fontSize:12, color:'#22c55e', fontWeight:700 }}>{t('nicknameAvailable')}</span>}
                {nicknameStatus === 'taken' && <span style={{ fontSize:12, color:'#ef4444', fontWeight:700 }}>{t('nicknameTaken')}</span>}
              </div>
            </Field>

            <SaveBtn onClick={saveProfile} saving={saving} />

            <div style={{ padding:'20px', borderRadius:12, background:'linear-gradient(135deg, rgba(121,192,255,.06), rgba(210,168,255,.04))', border:'1px solid rgba(121,192,255,.15)' }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>{t('profileDetailEditTitle')}</div>
              <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.7, marginBottom:14 }}>
                {t('profileDetailEditDesc')}
              </div>
              <a href="/profile" style={{
                display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600,
                background:'var(--accent)', color:'#fff', textDecoration:'none',
              }}>{t('editMyProfile')}</a>
            </div>
          </div>
        )}

        {tab === 'notifications' && settings && (
          <NotifSettings data={settings.notifications} onSave={patch => saveSection('notifications', patch)} saving={saving} />
        )}

        {tab === 'ui' && settings && (
          <UiSettings data={settings.ui} onSave={patch => saveSection('ui', patch)} saving={saving} theme={theme} setTheme={setTheme} lang={lang} setLang={setLang} t={t} />
        )}

        {tab === 'editor' && settings && (
          <EditorSettings data={settings.editor} onSave={patch => saveSection('editor', patch)} saving={saving} />
        )}

        {tab === 'privacy' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            <Field label={t('profileVisibility')}>
              <SelectRow value={profileVisibility} onChange={setProfileVisibility}
                options={[[`public`,t('visPublic')],[`followers`,t('visFollowers')],[`private`,t('visPrivate')]]} />
            </Field>
            <Field label={t('postVisibility')}>
              <SelectRow value={postVisibility} onChange={setPostVisibility}
                options={[[`public`,t('visPublic')],[`followers`,t('visFollowers')],[`private`,t('visPrivate')]]} />
            </Field>
            <SaveBtn onClick={saveVisibility} saving={saving} />
          </div>
        )}

        {tab === 'account' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {user?.hasPassword !== false ? (
              <>
                <div style={{ fontSize:13, color:'var(--text3)', padding:'10px 14px', borderRadius:8, background:'var(--bg2)', border:'1px solid var(--border)' }}>
                  {t('passwordMinLength')}
                </div>
                <Field label={t('currentPassword')}>
                  <input className="settings-input" type="password" value={pwForm.current} autoComplete="current-password"
                    onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} />
                </Field>
                <Field label={t('newPassword')}>
                  <input className="settings-input" type="password" value={pwForm.next} autoComplete="new-password"
                    onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} />
                </Field>
                <Field label={t('confirmPassword')}>
                  <input className="settings-input" type="password" value={pwForm.confirm} autoComplete="new-password"
                    onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
                </Field>
                <SaveBtn onClick={changePassword} saving={saving} label={t('changePassword')} />
              </>
            ) : (
              <div style={{ fontSize:13, color:'var(--text3)', padding:'10px 14px', borderRadius:8, background:'var(--bg2)', border:'1px solid var(--border)' }}>
                {t('oauthNoPasswordNote')}
              </div>
            )}

            <div style={{ borderTop:'1px solid var(--border)', paddingTop:24, marginTop:8 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:12 }}>
                소셜 계정 연결
              </div>
              <p style={{ fontSize:13, color:'var(--text2)', margin:'0 0 16px' }}>
                GitHub 또는 Google 계정을 연결하면 해당 계정으로도 로그인할 수 있습니다.
              </p>
              {['github', 'google', 'discord', 'kakao'].map((provider) => (
                <div
                  key={provider}
                  style={{
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'space-between',
                    padding:'12px 14px',
                    background:'var(--bg2)',
                    border:'1px solid var(--border)',
                    borderRadius:8,
                    marginBottom:8,
                  }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontWeight:600, textTransform:'capitalize' }}>{provider}</span>
                    {oauthLinked[provider] && (
                      <span style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>● 연결됨</span>
                    )}
                  </div>
                  {oauthLinked[provider] ? (
                    <button
                      onClick={() => unlinkProvider(provider)}
                      disabled={oauthBusy}
                      style={{
                        padding:'6px 14px',
                        background:'transparent',
                        color:'var(--text2)',
                        border:'1px solid var(--border)',
                        borderRadius:6,
                        fontSize:13,
                        cursor: oauthBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      해제
                    </button>
                  ) : (
                    <button
                      onClick={() => linkProvider(provider)}
                      disabled={oauthBusy}
                      style={{
                        padding:'6px 14px',
                        background:'var(--accent)',
                        color:'#fff',
                        border:'none',
                        borderRadius:6,
                        fontSize:13,
                        fontWeight:600,
                        cursor: oauthBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      연결하기
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ borderTop:'1px solid var(--red)', paddingTop:24, marginTop:8 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'var(--red)', marginBottom:8 }}>
                ⚠ {t('deleteAccountTitle')}
              </div>
              <p style={{ fontSize:13, color:'var(--text2)', margin:'0 0 16px' }}>
                {t('deleteAccountDesc')}
              </p>
              {user?.hasPassword !== false && (
                <Field label={t('deleteAccountConfirmLabel')}>
                  <input
                    className="settings-input"
                    type="password"
                    value={deletePassword}
                    autoComplete="current-password"
                    onChange={e => setDeletePassword(e.target.value)}
                  />
                </Field>
              )}
              <button
                onClick={deleteAccount}
                disabled={deleting || (user?.hasPassword !== false && !deletePassword)}
                style={{
                  marginTop: user?.hasPassword !== false ? 12 : 0,
                  padding:'10px 20px',
                  background: deleting || (user?.hasPassword !== false && !deletePassword) ? 'var(--bg3)' : 'var(--red)',
                  color: deleting || (user?.hasPassword !== false && !deletePassword) ? 'var(--text3)' : '#fff',
                  border:'none',
                  borderRadius:8,
                  fontWeight:700,
                  fontSize:13,
                  cursor: deleting || (user?.hasPassword !== false && !deletePassword) ? 'not-allowed' : 'pointer',
                  transition:'background 0.2s',
                }}
              >
                {deleting ? t('deleteAccountDeleting') : t('deleteAccountBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontWeight:600, fontSize:13, marginBottom:6, color:'var(--text)' }}>{label}</label>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, saving, label }) {
  const { t } = useLang();
  return (
    <button onClick={onClick} disabled={saving}
      className="btn btn-primary" style={{ alignSelf:'flex-start' }}>
      {saving ? t('saving') : (label ?? t('save'))}
    </button>
  );
}

function SelectRow({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--text)', fontSize:14 }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)}
      style={{ width:42, height:24, borderRadius:12, background: checked ? 'var(--accent)' : 'var(--border)',
        cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
      <div style={{ position:'absolute', top:3, left: checked ? 21 : 3, width:18, height:18, borderRadius:9,
        background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0',
      borderBottom:'1px solid var(--border)' }}>
      <div>
        <p style={{ margin:0, fontWeight:500, fontSize:14 }}>{label}</p>
        {desc && <p style={{ margin:'2px 0 0', fontSize:12, color:'var(--text3)' }}>{desc}</p>}
      </div>
      <Toggle checked={!!checked} onChange={onChange} />
    </div>
  );
}

function NotifSettings({ data, onSave, saving }) {
  const { t } = useLang();
  const [s, setS] = useState(data || {});
  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      <ToggleRow label={t('commentNotif')} desc={t('commentNotifDesc')} checked={s.community_reply ?? s.onComment ?? true} onChange={v => setS(p => ({ ...p, community_reply: v }))} />
      <ToggleRow label={t('likeNotif')} desc={t('likeNotifDesc')} checked={s.community_like ?? s.onLike ?? true} onChange={v => setS(p => ({ ...p, community_like: v }))} />
      <ToggleRow label={t('followNotif')} desc={t('followNotifDesc')} checked={s.follow ?? s.onFollow ?? true} onChange={v => setS(p => ({ ...p, follow: v }))} />
      <ToggleRow label={t('mentionNotif')} desc={t('mentionNotifDesc')} checked={s.mention ?? s.onMention ?? true} onChange={v => setS(p => ({ ...p, mention: v }))} />
      <ToggleRow label={t('battleNotif')} desc={t('battleNotifDesc')} checked={s.battle ?? s.onBattle ?? true} onChange={v => setS(p => ({ ...p, battle: v }))} />
      <div style={{ marginTop:20 }}><SaveBtn onClick={() => onSave(s)} saving={saving} /></div>
    </div>
  );
}

function UiSettings({ data, onSave, saving, theme, setTheme, lang, setLang, t }) {
  const [s, setS] = useState(data || {});
  const selectedFont = s.fontFamily || 'noto';
  const selectedFontSize = normalizeAppFontSize(s.fontSize || s.code_font_size || 14);
  const selectedTheme = s.theme || theme;
  const selectedLanguage = s.language || lang;

  function updateFont(fontId) {
    applyAppTypographyPreference({ fontFamily: fontId, fontSize: selectedFontSize });
    setS(p => ({ ...p, fontFamily: fontId }));
  }

  function updateFontSize(fontSize) {
    const normalized = normalizeAppFontSize(fontSize);
    applyAppTypographyPreference({ fontFamily: selectedFont, fontSize: normalized });
    setS(p => ({ ...p, fontSize: normalized, code_font_size: normalized }));
  }

  function saveUiSettings() {
    applyAppTypographyPreference({ fontFamily: selectedFont, fontSize: selectedFontSize });
    applyUiPreferenceFlags(s);
    onSave({
      ...s,
      theme: selectedTheme,
      language: selectedLanguage,
      fontSize: selectedFontSize,
      code_font_size: selectedFontSize,
    });
  }

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      <Field label={t('settings')}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
          {[
            { id:'dark', label:`🌙 ${t('darkMode')}` },
            { id:'light', label:`☀️ ${t('lightMode')}` },
            { id:'system', label:`💻 ${t('systemMode')}` },
          ].map(item => (
            <button key={item.id} onClick={() => {
              setTheme(item.id);
              setS(p => ({ ...p, theme: item.id }));
            }} style={{
              padding:'12px 14px', borderRadius:10,
              border:`2px solid ${selectedTheme === item.id ? 'var(--blue)' : 'var(--border)'}`,
              background: selectedTheme === item.id ? 'rgba(88,166,255,.08)' : 'var(--bg2)',
              color:'var(--text)', cursor:'pointer', fontWeight:600,
            }}>{item.label}</button>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:8 }}>
          {[
            { id:'ko', label:t('korean') },
            { id:'en', label:'English' },
          ].map(item => (
            <button key={item.id} onClick={() => {
              setLang(item.id);
              setS(p => ({ ...p, language: item.id }));
            }} style={{
              padding:'12px 14px', borderRadius:10,
              border:`2px solid ${selectedLanguage === item.id ? 'var(--blue)' : 'var(--border)'}`,
              background: selectedLanguage === item.id ? 'rgba(88,166,255,.08)' : 'var(--bg2)',
              color:'var(--text)', cursor:'pointer', fontWeight:600,
            }}>{item.label}</button>
          ))}
        </div>
      </Field>
      <Field label={t('appFont')}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:10, marginBottom:14 }}>
          {FONT_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => updateFont(option.id)}
              style={{
                textAlign:'left',
                padding:'12px 14px',
                borderRadius:12,
                border:`2px solid ${selectedFont === option.id ? 'var(--blue)' : 'var(--border)'}`,
                background:selectedFont === option.id ? 'rgba(88,166,255,.08)' : 'var(--bg2)',
                color:'var(--text)',
                cursor:'pointer',
                fontFamily:option.stack,
              }}
            >
              <div style={{ fontWeight:800, fontSize:14 }}>{option.label}</div>
              <div style={{ color:'var(--text2)', fontSize:12, marginTop:4, lineHeight:1.5 }}>{option.sample}</div>
            </button>
          ))}
        </div>
        <div style={{ fontSize:12, color:'var(--text3)', marginBottom:6 }}>{t('appFontDesc')}</div>
      </Field>
      <Field label={t('appFontSize')}>
        <div style={{ display:'grid', gap:10, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <input
              type="range"
              min={10}
              max={24}
              step={1}
              value={selectedFontSize}
              onChange={e => updateFontSize(Number(e.target.value))}
              style={{ maxWidth:240 }}
            />
            <span style={{ fontSize:14, fontWeight:800, color:'var(--blue)', minWidth:44 }}>{selectedFontSize}px</span>
            {selectedFontSize !== 14 && (
              <button
                className="btn btn-ghost"
                style={{ fontSize:12, padding:'2px 8px' }}
                onClick={() => updateFontSize(14)}
              >{t('resetDefault')}</button>
            )}
          </div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{t('appFontSizeDesc')}</div>
        </div>
      </Field>
      <ToggleRow label={t('animations')} desc={t('animationsDesc')} checked={s.animations ?? true} onChange={v => setS(p => {
        const next = { ...p, animations: v };
        applyUiPreferenceFlags(next);
        return next;
      })} />
      <ToggleRow label={t('compactMode')} desc={t('compactModeDesc')} checked={s.compactMode ?? false} onChange={v => setS(p => {
        const next = { ...p, compactMode: v };
        applyUiPreferenceFlags(next);
        return next;
      })} />
      <ToggleRow label={t('autoCollapseSidebar')} checked={s.autoCollapseSidebar ?? false} onChange={v => setS(p => {
        const next = { ...p, autoCollapseSidebar: v };
        applyUiPreferenceFlags(next);
        return next;
      })} />
      <div style={{ marginTop:20 }}><SaveBtn onClick={saveUiSettings} saving={saving} /></div>
    </div>
  );
}

function EditorSettings({ data, onSave, saving }) {
  const { t } = useLang();
  const [s, setS] = useState({
    ...(data || {}),
    font_size: data?.font_size ?? data?.fontSize ?? 14,
    tab_size: data?.tab_size ?? data?.tabSize ?? 2,
    line_numbers: data?.line_numbers ?? data?.lineNumbers ?? true,
  });
  const saveEditorSettings = () => onSave({
    ...s,
    font_size: Number(s.font_size || 14),
    tab_size: Number(s.tab_size || 2),
    line_numbers: s.line_numbers !== false,
  });
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <ToggleRow label={t('autoSave')} desc={t('autoSaveDesc')} checked={s.autoSave ?? true} onChange={v => setS(p => ({ ...p, autoSave: v }))} />
      <ToggleRow label={t('minimap')} desc={t('minimapDesc')} checked={s.minimap ?? false} onChange={v => setS(p => ({ ...p, minimap: v }))} />
      <ToggleRow label={t('lineNumbers')} checked={s.line_numbers ?? true} onChange={v => setS(p => ({ ...p, line_numbers: v }))} />
      <Field label={t('fontSize')}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <input type="range" min={10} max={28} value={s.font_size ?? 14}
            onChange={e => setS(p => ({ ...p, font_size: Number(e.target.value) }))} style={{ width:180 }} />
          <span style={{ fontSize:14 }}>{s.font_size ?? 14}px</span>
        </div>
      </Field>
      <Field label={t('tabSize')}>
        <SelectRow value={String(s.tab_size ?? 2)} onChange={v => setS(p => ({ ...p, tab_size: Number(v) }))}
          options={[['2','2 spaces'],['4','4 spaces'],['8','8 spaces']]} />
      </Field>
      <Field label={t('editorTheme')}>
        <SelectRow value={s.theme ?? 'vs-dark'} onChange={v => setS(p => ({ ...p, theme: v }))}
          options={[['vs-dark','Dark'],['vs','Light'],['hc-black','High Contrast']]} />
      </Field>
      <SaveBtn onClick={saveEditorSettings} saving={saving} />
    </div>
  );
}

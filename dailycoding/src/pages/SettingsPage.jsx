import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { FONT_OPTIONS, applyAppFontPreference } from '../utils/fontPreferences.js';
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
  const { user } = useAuth();
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
  }, []);

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
      await api.patch('/auth/settings', { section, settings: patch });
      setSettings(prev => ({ ...prev, [section]: { ...prev[section], ...patch } }));
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
      <aside style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', position:'sticky', top:80 }}>
        <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid var(--border)', background:'linear-gradient(135deg, rgba(121,192,255,.04), rgba(210,168,255,.04))' }}>
          <ProfileAvatar profile={user} size={44} fontSize={18} style={{ marginBottom:10 }} />
          <div style={{ fontSize:15, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {user?.nickname || user?.username || '사용자'}
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
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:'32px', minWidth:0 }}>
        <div style={{ marginBottom:28, paddingBottom:20, borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'var(--accent)', display:'flex' }}>{TAB_ICONS[tab]}</span>
          <h2 style={{ fontWeight:800, fontSize:20, margin:0 }}>{activeTabLabel}</h2>
        </div>

        {tab === 'profile' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            <Field label={t('nickname')}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input className="settings-input" value={nickname} onChange={e => onNicknameChange(e.target.value)}
                  placeholder={user?.nickname || t('nickname')} style={{ flex:1 }} />
                {nicknameStatus === 'checking' && <span style={{ fontSize:12, color:'var(--text3)' }}>…</span>}
                {nicknameStatus === 'available' && <span style={{ fontSize:12, color:'#22c55e', fontWeight:700 }}>✓ 사용 가능</span>}
                {nicknameStatus === 'taken' && <span style={{ fontSize:12, color:'#ef4444', fontWeight:700 }}>✗ 사용 중</span>}
              </div>
            </Field>

            <SaveBtn onClick={saveProfile} saving={saving} />

            <div style={{ padding:'20px', borderRadius:12, background:'linear-gradient(135deg, rgba(121,192,255,.06), rgba(210,168,255,.04))', border:'1px solid rgba(121,192,255,.15)' }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>프로필 상세 편집</div>
              <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.7, marginBottom:14 }}>
                자기소개 · 소셜 링크 · 기술 스택 등은 <strong>내 프로필</strong> 페이지에서 편집할 수 있습니다.
              </div>
              <a href="/profile" style={{
                display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600,
                background:'var(--accent)', color:'#fff', textDecoration:'none',
              }}>내 프로필 편집 →</a>
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
            <div style={{ padding:'14px 18px', borderRadius:10, background:'rgba(248,81,73,.07)', border:'1px solid rgba(248,81,73,.2)', fontSize:13, color:'var(--text2)' }}>
              비밀번호는 최소 8자 이상이어야 합니다.
            </div>
            <Field label={t('currentPassword')}>
              <input className="settings-input" type="password" value={pwForm.current}
                onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} />
            </Field>
            <Field label={t('newPassword')}>
              <input className="settings-input" type="password" value={pwForm.next}
                onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} />
            </Field>
            <Field label={t('confirmPassword')}>
              <input className="settings-input" type="password" value={pwForm.confirm}
                onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
            </Field>
            <SaveBtn onClick={changePassword} saving={saving} label={t('changePassword')} />
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
      style={{ alignSelf:'flex-start', padding:'10px 24px', background:'var(--accent)', color:'#fff',
        border:'none', borderRadius:8, fontWeight:600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
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
      <ToggleRow label={t('commentNotif')} desc={t('commentNotifDesc')} checked={s.onComment ?? true} onChange={v => setS(p => ({ ...p, onComment: v }))} />
      <ToggleRow label={t('likeNotif')} desc={t('likeNotifDesc')} checked={s.onLike ?? true} onChange={v => setS(p => ({ ...p, onLike: v }))} />
      <ToggleRow label={t('followNotif')} desc={t('followNotifDesc')} checked={s.onFollow ?? true} onChange={v => setS(p => ({ ...p, onFollow: v }))} />
      <ToggleRow label={t('mentionNotif')} desc={t('mentionNotifDesc')} checked={s.onMention ?? true} onChange={v => setS(p => ({ ...p, onMention: v }))} />
      <ToggleRow label={t('battleNotif')} desc={t('battleNotifDesc')} checked={s.onBattle ?? true} onChange={v => setS(p => ({ ...p, onBattle: v }))} />
      <div style={{ marginTop:20 }}><SaveBtn onClick={() => onSave(s)} saving={saving} /></div>
    </div>
  );
}

function UiSettings({ data, onSave, saving, theme, setTheme, lang, setLang, t }) {
  const [s, setS] = useState(data || {});
  const selectedFont = s.fontFamily || 'noto';

  function updateFont(fontId) {
    applyAppFontPreference(fontId);
    setS(p => ({ ...p, fontFamily: fontId }));
  }

  function saveUiSettings() {
    applyAppFontPreference(selectedFont);
    onSave(s);
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
            <button key={item.id} onClick={() => setTheme(item.id)} style={{
              padding:'12px 14px', borderRadius:10,
              border:`2px solid ${theme === item.id ? 'var(--blue)' : 'var(--border)'}`,
              background: theme === item.id ? 'rgba(88,166,255,.08)' : 'var(--bg2)',
              color:'var(--text)', cursor:'pointer', fontWeight:600,
            }}>{item.label}</button>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:8 }}>
          {[
            { id:'ko', label:t('korean') },
            { id:'en', label:'English' },
          ].map(item => (
            <button key={item.id} onClick={() => setLang(item.id)} style={{
              padding:'12px 14px', borderRadius:10,
              border:`2px solid ${lang === item.id ? 'var(--blue)' : 'var(--border)'}`,
              background: lang === item.id ? 'rgba(88,166,255,.08)' : 'var(--bg2)',
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
      <ToggleRow label={t('animations')} desc={t('animationsDesc')} checked={s.animations ?? true} onChange={v => setS(p => ({ ...p, animations: v }))} />
      <ToggleRow label={t('compactMode')} desc={t('compactModeDesc')} checked={s.compactMode ?? false} onChange={v => setS(p => ({ ...p, compactMode: v }))} />
      <ToggleRow label={t('autoCollapseSidebar')} checked={s.autoCollapseSidebar ?? false} onChange={v => setS(p => ({ ...p, autoCollapseSidebar: v }))} />
      <div style={{ marginTop:20 }}><SaveBtn onClick={saveUiSettings} saving={saving} /></div>
    </div>
  );
}

function EditorSettings({ data, onSave, saving }) {
  const { t } = useLang();
  const [s, setS] = useState(data || {});
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <ToggleRow label={t('autoSave')} desc={t('autoSaveDesc')} checked={s.autoSave ?? true} onChange={v => setS(p => ({ ...p, autoSave: v }))} />
      <ToggleRow label={t('minimap')} desc={t('minimapDesc')} checked={s.minimap ?? false} onChange={v => setS(p => ({ ...p, minimap: v }))} />
      <ToggleRow label={t('lineNumbers')} checked={s.lineNumbers ?? true} onChange={v => setS(p => ({ ...p, lineNumbers: v }))} />
      <Field label={t('fontSize')}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <input type="range" min={11} max={20} value={s.fontSize ?? 14}
            onChange={e => setS(p => ({ ...p, fontSize: Number(e.target.value) }))} style={{ width:180 }} />
          <span style={{ fontSize:14 }}>{s.fontSize ?? 14}px</span>
        </div>
      </Field>
      <Field label={t('tabSize')}>
        <SelectRow value={String(s.tabSize ?? 2)} onChange={v => setS(p => ({ ...p, tabSize: Number(v) }))}
          options={[['2','2 spaces'],['4','4 spaces'],['8','8 spaces']]} />
      </Field>
      <Field label={t('editorTheme')}>
        <SelectRow value={s.theme ?? 'vs-dark'} onChange={v => setS(p => ({ ...p, theme: v }))}
          options={[['vs-dark','Dark'],['vs','Light'],['hc-black','High Contrast']]} />
      </Field>
      <SaveBtn onClick={() => onSave(s)} saving={saving} />
    </div>
  );
}

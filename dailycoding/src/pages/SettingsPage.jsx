import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLang } from '../context/LangContext.jsx';

const TABS = [
  { id: 'profile',       labelKey: 'profileTab' },
  { id: 'notifications', labelKey: 'notificationsTab' },
  { id: 'ui',            labelKey: 'uiTab' },
  { id: 'editor',        labelKey: 'editorTab' },
  { id: 'privacy',       labelKey: 'privacyTab' },
  { id: 'account',       labelKey: 'accountTab' },
];

const TECH_OPTIONS = [
  'JavaScript','TypeScript','Python','Java','C++','C','Go','Rust','Kotlin','Swift',
  'React','Vue','Angular','Next.js','Node.js','Express','Spring','Django','FastAPI','Flutter',
  'MySQL','PostgreSQL','MongoDB','Redis','Docker','Kubernetes','AWS','GCP','Azure','Git',
];

const LINK_LABELS = { github:'GitHub', boj:'BOJ', blog:'Blog', linkedin:'LinkedIn', twitter:'Twitter' };

export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const [tab, setTab] = useState('profile');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [socialLinks, setSocialLinks] = useState({ github:'', boj:'', blog:'', linkedin:'', twitter:'' });
  const [techStack, setTechStack] = useState([]);
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
        setDisplayName(user?.displayName || '');
        setBio(user?.bio || '');
        const sl = user?.socialLinks || {};
        setSocialLinks({ github: sl.github||'', boj: sl.boj||'', blog: sl.blog||'', linkedin: sl.linkedin||'', twitter: sl.twitter||'' });
        setTechStack(user?.techStack || []);
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
      const filteredLinks = Object.fromEntries(Object.entries(socialLinks).filter(([,v]) => v));
      await api.patch('/auth/profile/extended', {
        display_name: displayName,
        bio,
        social_links: filteredLinks,
        tech_stack: techStack,
      });
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

  function toggleTech(tech) {
    setTechStack(prev => prev.includes(tech) ? prev.filter(x => x !== tech) : prev.length < 20 ? [...prev, tech] : prev);
  }

  if (loading) return (
    <div style={{ padding:'40px 28px', maxWidth:700, margin:'0 auto' }}>
      {[1,2,3].map(i => <div key={i} className="skeleton-line" style={{ height:48, borderRadius:10, marginBottom:12 }} />)}
    </div>
  );

  return (
    <div style={{ maxWidth:740, margin:'0 auto', padding:'32px 20px' }}>
      <h2 style={{ fontWeight:700, fontSize:22, marginBottom:24 }}>{t('settings')}</h2>

      <div style={{ display:'flex', gap:4, marginBottom:28, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
        {TABS.map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            style={{
              padding:'8px 16px', border:'none', cursor:'pointer', fontWeight: tab===tabItem.id ? 700 : 400,
              background:'transparent', fontSize:14,
              color: tab===tabItem.id ? 'var(--accent)' : 'var(--text2)',
              borderBottom: tab===tabItem.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom:-1,
            }}>
            {t(tabItem.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <Field label={t('nickname')}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input className="settings-input" value={nickname} onChange={e => onNicknameChange(e.target.value)}
                placeholder={user?.nickname || t('nickname')} style={{ flex:1 }} />
              {nicknameStatus === 'checking' && <span style={{ fontSize:12, color:'var(--text3)' }}>…</span>}
              {nicknameStatus === 'available' && <span style={{ fontSize:12, color:'#22c55e' }}>✓</span>}
              {nicknameStatus === 'taken' && <span style={{ fontSize:12, color:'#ef4444' }}>✗</span>}
            </div>
          </Field>

          <Field label={t('displayName')}>
            <input className="settings-input" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder={t('displayName')} />
          </Field>

          <Field label={t('bio')}>
            <textarea className="settings-input" value={bio} onChange={e => setBio(e.target.value)}
              placeholder={t('bio')} rows={3}
              style={{ resize:'vertical', fontFamily:'inherit', lineHeight:1.6 }} />
          </Field>

          <Field label={t('socialLinks')}>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {Object.entries(LINK_LABELS).map(([key, label]) => (
                <div key={key} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:80, fontSize:13, color:'var(--text2)' }}>{label}</span>
                  <input className="settings-input" style={{ flex:1 }}
                    value={socialLinks[key]} onChange={e => setSocialLinks(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={`${label} URL`} />
                </div>
              ))}
            </div>
          </Field>

          <Field label={t('techStack')}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {TECH_OPTIONS.map(tech => (
                <button key={tech} onClick={() => toggleTech(tech)}
                  style={{
                    padding:'4px 10px', borderRadius:20, fontSize:12, cursor:'pointer', border:'1px solid var(--border)',
                    background: techStack.includes(tech) ? 'var(--accent)' : 'var(--bg3)',
                    color: techStack.includes(tech) ? '#fff' : 'var(--text2)',
                  }}>
                  {tech}
                </button>
              ))}
            </div>
          </Field>

          <SaveBtn onClick={saveProfile} saving={saving} />
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
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
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
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <h3 style={{ fontWeight:600, fontSize:16 }}>{t('changePassword')}</h3>
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
      <ToggleRow label={t('animations')} desc={t('animationsDesc')} checked={s.animations ?? true} onChange={v => setS(p => ({ ...p, animations: v }))} />
      <ToggleRow label={t('compactMode')} desc={t('compactModeDesc')} checked={s.compactMode ?? false} onChange={v => setS(p => ({ ...p, compactMode: v }))} />
      <ToggleRow label={t('autoCollapseSidebar')} checked={s.autoCollapseSidebar ?? false} onChange={v => setS(p => ({ ...p, autoCollapseSidebar: v }))} />
      <div style={{ marginTop:20 }}><SaveBtn onClick={() => onSave(s)} saving={saving} /></div>
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

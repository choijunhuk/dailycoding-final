import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api.js'
import { useTheme } from '../context/ThemeContext.jsx'
import { useLang } from '../context/LangContext.jsx'

const Editor = lazy(() => import('@monaco-editor/react'))

function setMetaTag(name, value, attr = 'name') {
  let node = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute(attr, name)
    document.head.appendChild(node)
  }
  node.setAttribute('content', value)
}

export default function SharedSubmissionPage() {
  const { slug } = useParams()
  const { isDark } = useTheme()
  const { t } = useLang()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get(`/share/${slug}`)
      .then(({ data }) => {
        if (cancelled) return
        setData(data)
        setError('')
        const title = `${data.problemTitle} ${t('sharedSubmission')}`
        const description = `${data.username} · ${data.problemTitle} · ${data.result}`
        document.title = title
        setMetaTag('description', description)
        setMetaTag('og:title', title, 'property')
        setMetaTag('og:description', description, 'property')
        setMetaTag('og:type', 'article', 'property')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.response?.data?.message || t('loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [slug])

  if (loading) {
    return <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'var(--bg)', color:'var(--text2)' }}>{t('loadingShare')}</div>
  }

  if (error || !data) {
    return (
      <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'var(--bg)', color:'var(--text)' }}>
        <div style={{ padding:24, border:'1px solid var(--border)', borderRadius:16, background:'var(--bg2)', maxWidth:560 }}>
          <div style={{ fontSize:22, fontWeight:800, marginBottom:8 }}>{t('cannotOpenLink')}</div>
          <div style={{ fontSize:13, color:'var(--text2)', marginBottom:16 }}>{error}</div>
          <Link to="/" style={{ color:'var(--blue)', textDecoration:'none', fontWeight:700 }}>{t('goHomeLink')}</Link>
        </div>
      </div>
    )
  }

  const toMonacoLang = (lang) => {
    const map = { python: 'python', javascript: 'javascript', cpp: 'cpp', c: 'c', java: 'java' }
    return map[lang] || 'plaintext'
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', padding:'32px 20px' }}>
      <div style={{ maxWidth:960, margin:'0 auto', display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ padding:'24px 26px', border:'1px solid var(--border)', borderRadius:18, background:'var(--bg2)' }}>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>{t('sharedSubmission')}</div>
          <h1 style={{ margin:'0 0 10px', fontSize:28 }}>{data.problemTitle}</h1>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:13, color:'var(--text2)' }}>
            <span>{t('authorLabel')} {data.username}</span>
            <span>{t('resultLabel')} {data.result}</span>
            <span>{t('langLabel')} {data.lang}</span>
            {data.solveTimeSec ? <span>{t('solveTimeLabel')} {data.solveTimeSec}s</span> : null}
          </div>
        </div>

        <div style={{ padding:'20px 22px', border:'1px solid var(--border)', borderRadius:18, background:'var(--bg2)' }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>{t('codeLabel')}</div>
          <Suspense fallback={<div style={{ padding:20, color:'var(--text3)' }}>{t('codeLoading')}</div>}>
            <Editor
              height={`${Math.min(600, ((data.code || '').split('\n').length + 2) * 20)}px`}
              language={toMonacoLang(data.lang)}
              value={data.code}
              theme={isDark ? 'vs-dark' : 'light'}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                lineNumbers: 'on',
                wordWrap: 'on',
              }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

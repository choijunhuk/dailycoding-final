import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const logoPath = '/brand/dailycoding-logo.png'
const iconPath = '/brand/dailycoding-icon.png'
const logoUrl = `https://dailycoding-final.com${logoPath}`

test('site metadata uses the DailyCoding logo for favicon and link previews', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8')

  assert.match(html, new RegExp(`<link rel="icon"[^>]+href="${iconPath}"`))
  assert.match(html, new RegExp(`<link rel="apple-touch-icon"[^>]+href="${iconPath}"`))
  assert.match(html, new RegExp(`<meta property="og:image" content="${logoUrl}"`))
  assert.match(html, new RegExp(`<meta name="twitter:image" content="${logoUrl}"`))
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/)
})

test('manifest and service worker use the DailyCoding logo asset', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.json'), 'utf8'))
  const serviceWorker = readFileSync(resolve(root, 'public/sw.js'), 'utf8')

  assert.ok(manifest.icons.some((icon) => icon.src === iconPath && icon.type === 'image/png'))
  assert.ok(manifest.shortcuts.every((shortcut) => shortcut.icons?.every((icon) => icon.src === iconPath)))
  assert.match(serviceWorker, new RegExp(`icon: '${iconPath}'`))
  assert.match(serviceWorker, new RegExp(`badge: '${iconPath}'`))
})

test('visible app headers use the DailyCoding icon asset', () => {
  const topNav = readFileSync(resolve(root, 'src/components/TopNav.jsx'), 'utf8')
  const landingPage = readFileSync(resolve(root, 'src/pages/LandingPage.jsx'), 'utf8')

  assert.match(topNav, new RegExp(`src="${iconPath}"`))
  assert.match(landingPage, new RegExp(`src="${iconPath}"`))
})

test('auth and app shell brand marks use the DailyCoding icon asset', () => {
  const brandMark = readFileSync(resolve(root, 'src/components/BrandMark.jsx'), 'utf8')
  assert.match(brandMark, new RegExp(iconPath), 'BrandMark should render the brand icon')

  const brandFiles = [
    'src/pages/AuthPage.jsx',
    'src/context/AuthContext.jsx',
    'src/pages/ForgotPasswordPage.jsx',
    'src/pages/ResetPasswordPage.jsx',
    'src/pages/VerifyEmailPage.jsx',
    'src/App.jsx',
  ]

  for (const file of brandFiles) {
    const source = readFileSync(resolve(root, file), 'utf8')
    assert.match(source, /BrandMark/, `${file} should render the shared brand mark`)
    assert.doesNotMatch(source, /⚡\s*DailyCoding|>\s*⚡\s*<\/span>\s*[\s\S]{0,160}DailyCoding/, `${file} should not render the old lightning wordmark`)
  }
})

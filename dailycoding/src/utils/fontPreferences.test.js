import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAppTypographyPreference,
  normalizeAppFontSize,
} from './fontPreferences.js';

test('normalizeAppFontSize clamps global app font size', () => {
  assert.equal(normalizeAppFontSize(10), 12);
  assert.equal(normalizeAppFontSize(16.4), 16);
  assert.equal(normalizeAppFontSize(22), 18);
  assert.equal(normalizeAppFontSize('bad'), 14);
});

test('applyAppTypographyPreference writes app font css variables and local storage', () => {
  const styles = new Map();
  const storage = new Map();
  const previousDocument = globalThis.document;
  const previousLocalStorage = globalThis.localStorage;
  globalThis.document = {
    documentElement: {
      style: {
        setProperty(key, value) {
          styles.set(key, value);
        },
      },
    },
  };
  globalThis.localStorage = {
    setItem(key, value) {
      storage.set(key, value);
    },
  };

  try {
    const result = applyAppTypographyPreference({ fontFamily: 'ibm', fontSize: 17 });
    assert.equal(result.font.id, 'ibm');
    assert.equal(result.fontSize, 17);
    assert.equal(styles.get('--app-font'), "'IBM Plex Sans KR', 'Noto Sans KR', sans-serif");
    assert.equal(styles.get('--app-font-size'), '17px');
    assert.equal(storage.get('dc_app_font'), 'ibm');
    assert.equal(storage.get('dc_app_font_size'), '17');
  } finally {
    globalThis.document = previousDocument;
    globalThis.localStorage = previousLocalStorage;
  }
});

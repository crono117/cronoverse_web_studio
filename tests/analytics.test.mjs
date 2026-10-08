import assert from 'node:assert/strict';
import test from 'node:test';

let run = 0;
async function browser(t, consent = null, storageBlocked = false) {
  const storage = new Map(consent ? [['cronoverse-analytics-consent', consent]] : []);
  const scripts = [];
  const deletedCookies = [];
  let cookies = '_ga=sample; _ga_TEST123456=sample; studio_session=keep';
  globalThis.window = {
    location: {href: 'https://cronoverse.online/?email=private%40example.com#contact', hostname: 'cronoverse.online'},
    localStorage: {
      getItem: (key) => { if (storageBlocked) throw new Error('Blocked'); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (storageBlocked) throw new Error('Blocked'); storage.set(key, value); },
    },
  };
  globalThis.document = {
    referrer: 'https://search.example.com/results?query=private%40example.com',
    createElement: () => ({}),
    head: {appendChild: (script) => scripts.push(script)},
  };
  Object.defineProperty(document, 'cookie', {
    get: () => cookies,
    set: (value) => {
      deletedCookies.push(value);
      const name = value.split('=')[0];
      cookies = cookies.split(';').filter((part) => part.trim().split('=')[0] !== name).join(';');
    },
  });
  t.after(() => { delete globalThis.window; delete globalThis.document; });
  const analytics = await import('../lib/analytics.ts?run=' + (++run));
  const commands = () => (window.dataLayer ?? []).map((item) => Array.from(item));
  return {analytics, scripts, deletedCookies, storage, commands};
}

test('missing or malformed measurement IDs never activate analytics', async (t) => {
  const {analytics, scripts} = await browser(t);
  for (const id of [undefined, '', 'UA-123456-1', 'G-REPLACE-ME', 'G-<script>alert(1)</script>']) {
    assert.equal(analytics.measurementId(id), null);
    assert.equal(analytics.applyAnalyticsConsent(id, 'granted'), false);
  }
  assert.equal(analytics.measurementId(' G-TEST123456 '), 'G-TEST123456');
  assert.equal(scripts.length, 0);
});

test('no tag or lead event is created before consent or after declining', async (t) => {
  const {analytics, scripts} = await browser(t);
  assert.equal(analytics.savedAnalyticsConsent(), null);
  assert.equal(analytics.trackInquirySuccess('inquiry-1', 'new', 'en'), false);
  analytics.applyAnalyticsConsent('G-TEST123456', 'denied');
  assert.equal(analytics.savedAnalyticsConsent(), 'denied');
  assert.equal(analytics.trackInquirySuccess('inquiry-2', 'new', 'en'), false);
  assert.equal(window.gtag, undefined);
  assert.equal(scripts.length, 0);
});

test('consent loads the tag once and sends one automatic pageview configuration', async (t) => {
  const {analytics, scripts, commands} = await browser(t);
  analytics.applyAnalyticsConsent('G-TEST123456', 'granted');
  analytics.applyAnalyticsConsent('G-TEST123456', 'granted');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-TEST123456');
  assert.equal(scripts[0].async, true);
  assert.equal(commands().filter(([command]) => command === 'config').length, 1);
  assert.equal(commands().filter(([command]) => command === 'event').length, 0);
  const config = commands().find(([command]) => command === 'config')[2];
  assert.equal(config.page_location, 'https://cronoverse.online/');
  assert.equal(config.page_referrer, 'https://search.example.com/results');
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.send_page_view, true);
});

test('successful inquiry events are deduplicated and contain only allowed categories', async (t) => {
  const {analytics, commands} = await browser(t);
  analytics.applyAnalyticsConsent('G-TEST123456', 'granted');
  assert.equal(analytics.trackInquirySuccess('private-inquiry-id', 'app', 'es'), true);
  assert.equal(analytics.trackInquirySuccess('private-inquiry-id', 'app', 'es'), false);
  assert.equal(analytics.trackInquirySuccess('another-id', 'private@example.com', 'private name'), true);
  const events = commands().filter(([command]) => command === 'event');
  assert.deepEqual(events[0], ['event', 'generate_lead', {
    send_to: 'G-TEST123456', form_name: 'project_inquiry', service: 'app', language: 'es',
  }]);
  assert.equal(events[1][2].service, 'unsure');
  assert.equal(events[1][2].language, 'en');
  assert.ok(!JSON.stringify(events).includes('private'));
});

test('withdrawal stops events and clears analytics cookies without deleting session cookies', async (t) => {
  const {analytics, scripts, commands, deletedCookies} = await browser(t);
  analytics.applyAnalyticsConsent('G-TEST123456', 'granted');
  analytics.applyAnalyticsConsent('G-TEST123456', 'denied');
  assert.equal(window['ga-disable-G-TEST123456'], true);
  assert.equal(analytics.trackInquirySuccess('inquiry-1', 'new', 'en'), false);
  assert.ok(deletedCookies.some((value) => value.startsWith('_ga=')));
  assert.ok(deletedCookies.some((value) => value.includes('Domain=.cronoverse.online')));
  assert.ok(!deletedCookies.some((value) => value.startsWith('studio_session=')));
  assert.ok(document.cookie.includes('studio_session=keep'));
  analytics.applyAnalyticsConsent('G-TEST123456', 'granted');
  assert.equal(window['ga-disable-G-TEST123456'], false);
  assert.equal(analytics.trackInquirySuccess('inquiry-1', 'new', 'en'), true);
  assert.equal(scripts.length, 1);
  assert.equal(commands().filter(([command]) => command === 'config').length, 1);
});

test('saved consent is read and storage restrictions do not break an explicit choice', async (t) => {
  const {analytics, scripts} = await browser(t, 'denied', true);
  assert.equal(analytics.savedAnalyticsConsent(), null);
  assert.equal(analytics.applyAnalyticsConsent('G-TEST123456', 'granted'), true);
  assert.equal(analytics.trackInquirySuccess('inquiry-1', 'redesign', 'en'), true);
  assert.equal(scripts.length, 1);
});

test('URL sanitization strips queries and fragments and rejects non-web URLs', async (t) => {
  const {analytics} = await browser(t);
  assert.equal(analytics.analyticsUrl('https://cronoverse.online/?name=private#private'), 'https://cronoverse.online/');
  assert.equal(analytics.analyticsUrl('javascript:alert(1)'), '');
  assert.equal(analytics.analyticsUrl('invalid'), '');
});

test('server rendering does not require a browser or initialize tracking', async () => {
  const analytics = await import('../lib/analytics.ts?run=' + (++run));
  assert.equal(analytics.savedAnalyticsConsent(), null);
  assert.equal(analytics.applyAnalyticsConsent('G-TEST123456', 'granted'), false);
  assert.equal(analytics.trackInquirySuccess('inquiry-1', 'new', 'en'), false);
});

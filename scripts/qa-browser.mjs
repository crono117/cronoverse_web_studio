// Browser regression checks for the landing page: layout at four widths in both languages,
// navigation and CTAs, language switching, form validation and submission, failure states,
// analytics events, the mobile menu and project bar, keyboard use, and all five demos.
//
// Not part of `pnpm test` (it needs a browser and running servers). To run:
//   1. Start Django (see README) and the built site: `pnpm build && pnpm start`
//      with `.dev.vars` copied to `dist/server/.dev.vars`.
//   2. In a scratch directory outside the repo: `npm i playwright-core`, then
//      `npx playwright install chromium` (or point CHROMIUM at any installed Chrome).
//   3. `cp scripts/qa-browser.mjs <scratch>/ && cd <scratch> && CHROMIUM=/path/to/chrome node qa-browser.mjs`
//      (BASE defaults to http://127.0.0.1:8787; screenshots go to ./qa-shots or QA_SHOTS).
// One test inquiry is saved per run, so use a disposable local database.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:8787";
const OUT = (process.env.QA_SHOTS || "qa-shots") + "/";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(width, height, opts = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: opts.reducedMotion || "no-preference", hasTouch: !!opts.touch, isMobile: !!opts.touch });
  if (opts.consent) await context.addInitScript(() => localStorage.setItem("cronoverse-analytics-consent", "granted"));
  if (opts.noBanner) await context.addInitScript(() => localStorage.setItem("cronoverse-analytics-consent", "denied"));
  // Never contact Google from tests; dataLayer still records every command.
  await context.route(/googletagmanager\.com|google-analytics\.com/, (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/googletagmanager|ERR_FAILED|net::/.test(m.text())) errors.push("console: " + m.text()); });
  return { context, page, errors };
}
const events = (page) => page.evaluate(() => (window.dataLayer || []).map((a) => Array.from(a)).filter((a) => a[0] === "event").map((a) => [a[1], a[2]]));

// 1. Visual pass and overflow, both languages, four widths.
for (const lang of ["en", "es"]) {
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844], [320, 640]]) {
    const { context, page, errors } = await newPage(w, h, { noBanner: true });
    await page.goto(`${BASE}/${lang === "es" ? "?lang=es" : ""}`, { waitUntil: "networkidle" });
    await sleep(600);
    const info = await page.evaluate(() => {
      const doc = document.documentElement;
      const over = [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > doc.clientWidth + 1 && getComputedStyle(el).position !== "fixed" && !el.closest(".showcase-track,.honey,[data-slot=carousel-content]"); }).slice(0, 5).map((el) => el.tagName + "." + el.className.toString().slice(0, 40));
      const h1 = document.querySelector("h1"); const lh = parseFloat(getComputedStyle(h1).lineHeight);
      const cta = document.querySelector(".hero-actions .button").getBoundingClientRect();
      const sec = document.querySelector(".hero-actions .text-link").getBoundingClientRect();
      return { scroll: doc.scrollWidth, client: doc.clientWidth, over, h1Lines: Math.round(h1.getBoundingClientRect().height / lh), lang: doc.lang, ctaBottom: cta.bottom, secBottom: sec.bottom, h1s: document.querySelectorAll("h1").length };
    });
    const tag = `${lang} ${w}px`;
    check(`${tag}: no horizontal overflow`, info.scroll <= info.client && !info.over.length, `scrollWidth ${info.scroll}/${info.client} ${info.over.join(", ")}`);
    check(`${tag}: html lang=${lang}`, info.lang === lang);
    check(`${tag}: single h1`, info.h1s === 1);
    check(`${tag}: headline lines`, w >= 640 ? info.h1Lines === 2 : info.h1Lines <= 3, `${info.h1Lines} lines`);
    if (w === 1440) check(`${tag}: both hero CTAs above the fold`, info.ctaBottom < h && info.secBottom < h, `primary bottom ${Math.round(info.ctaBottom)}, viewport ${h}`);
    check(`${tag}: no runtime errors`, !errors.length, errors.join(" | "));
    await page.screenshot({ path: `${OUT}${lang}-${w}-fold.png` });
    await page.screenshot({ path: `${OUT}${lang}-${w}-full.png`, fullPage: true });
    await context.close();
  }
}

// 2. Navigation, anchors, CTAs, and service preselection.
{
  const { context, page } = await newPage(1440, 900, { noBanner: true });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const targets = await page.$$eval("a[href^='#']", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  const missing = await page.evaluate((ids) => ids.filter((h) => !document.getElementById(h.slice(1))), targets);
  check("every in-page link has a target", !missing.length, `targets ${targets.join(" ")}; missing ${missing.join(" ")}`);
  await page.click(".hero-actions .button");
  await sleep(900);
  check("primary hero CTA goes to #contact", await page.evaluate(() => location.hash === "#contact" && Math.abs(document.getElementById("contact").getBoundingClientRect().top) < 60));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.click(".hero-actions .text-link");
  await sleep(900);
  check("secondary hero CTA goes to #services", await page.evaluate(() => location.hash === "#services" && Math.abs(document.getElementById("services").getBoundingClientRect().top) < 60));
  for (const [i, label] of [[0, "New Website"], [1, "Custom Business Software"], [2, "Automation or Integration"]]) {
    await page.locator(".service-link").nth(i).click();
    await sleep(500);
    check(`service card ${i + 1} preselects "${label}"`, (await page.textContent("#service")).includes(label));
  }
  for (const id of ["services", "examples", "why", "process"]) {
    await page.click(`.desktop-nav a[href="#${id}"]`);
    await sleep(1400);
    const top = await page.evaluate((id) => Math.round(document.getElementById(id).getBoundingClientRect().top), id);
    check(`nav link #${id} scrolls to its section`, Math.abs(top) < 60, `top ${top}px, hash ${await page.evaluate(() => location.hash)}`);
  }
  await context.close();
}

// 3. Language switching keeps typed input, updates metadata, and remembers the choice.
{
  const { context, page } = await newPage(1440, 900, { noBanner: true });
  await page.goto(BASE + "/#contact", { waitUntil: "networkidle" });
  await page.fill("#name", "Ana Typing");
  await page.fill("#message", "Texto que no debe perderse.");
  await page.click(".language-control button:has-text('ES')");
  await sleep(300);
  const s = await page.evaluate(() => ({ name: document.getElementById("name").value, msg: document.getElementById("message").value, lang: document.documentElement.lang, title: document.title, desc: document.querySelector('meta[name="description"]').content, url: location.search, label: document.querySelector("label[for=name]").textContent, h1: document.querySelector("h1").textContent, cookie: document.cookie }));
  check("switching language keeps form input", s.name === "Ana Typing" && s.msg === "Texto que no debe perderse.");
  check("Spanish copy renders after switching", s.label.startsWith("Tu nombre") && s.h1.startsWith("Mejores sitios web."), s.h1);
  check("html lang, title, and description follow the language", s.lang === "es" && s.title.includes("Desarrollo Web") && s.desc.startsWith("Creamos sitios web"));
  check("URL and cookie remember Spanish", s.url === "?lang=es" && s.cookie.includes("cronoverse-language=es"), s.url + " / " + s.cookie);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const ssr = await page.evaluate(() => [document.documentElement.lang, document.querySelector("h1").textContent]);
  check("returning visitor gets Spanish from the server at /", ssr[0] === "es" && ssr[1].startsWith("Mejores"), ssr.join(" "));
  await page.click(".language-control button:has-text('EN')");
  check("switching back to English removes ?lang", await page.evaluate(() => location.search === "" && document.documentElement.lang === "en"));
  await context.close();
}
// Legacy visitor: Spanish saved only in localStorage before the cookie existed.
{
  const { context, page } = await newPage(1440, 900, { noBanner: true });
  await context.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("cronoverse-language", "es"); sessionStorage.setItem("seeded", "1"); } });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(300);
  check("legacy localStorage Spanish preference still applies", await page.evaluate(() => document.documentElement.lang === "es" && document.cookie.includes("cronoverse-language=es")));
  await context.close();
}

// 4. Validation in both languages, keyboard focus, and accessible errors.
for (const lang of ["en", "es"]) {
  const { context, page } = await newPage(1440, 900, { noBanner: true });
  await page.goto(`${BASE}/${lang === "es" ? "?lang=es" : ""}#contact`, { waitUntil: "networkidle" });
  await page.click(".submit-button");
  await sleep(200);
  const v = await page.evaluate(() => ({ focus: document.activeElement?.id, errs: [...document.querySelectorAll(".field-error")].map((e) => e.textContent), invalid: [...document.querySelectorAll("[aria-invalid=true]")].map((e) => e.id), alert: document.querySelector(".form-error")?.textContent }));
  check(`${lang}: empty submit shows four field errors`, v.errs.length === 4, v.errs.join(" | "));
  check(`${lang}: errors are in the page language`, lang === "en" ? v.errs[0] === "Please enter your name." : v.errs[0] === "Escribe tu nombre.");
  check(`${lang}: invalid fields marked and first one focused`, v.focus === "name" && v.invalid.join() === "name,email,service,message", v.invalid.join());
  await page.fill("#name", "Alex Rivera");
  await page.fill("#email", "not-an-email");
  await sleep(100);
  const emailErr = await page.textContent("#email-error");
  check(`${lang}: invalid email message`, lang === "en" ? emailErr.includes("valid email") : emailErr.includes("correo válido"), emailErr);
  const nameCleared = await page.$("#name-error");
  check(`${lang}: fixing a field clears its error`, !nameCleared);
  await context.close();
}

// 5. Successful submission (real Django), duplicate protection, and analytics events.
{
  const { context, page, errors } = await newPage(1440, 900, { consent: true });
  let posts = 0;
  page.on("request", (r) => { if (r.url().endsWith("/api/inquiries") && r.method() === "POST") posts++; });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.click(".hero-actions .button");
  await page.click(".language-control button:has-text('ES')");
  await page.locator(".service-link").nth(1).click();
  await page.fill("#name", "QA Prueba");
  await page.fill("#business", "Negocio de Prueba");
  await page.fill("#email", `qa-${Date.now()}@example.com`);
  await page.fill("#message", "Necesitamos un sistema de inventario para dos tiendas.");
  await page.dblclick(".submit-button");
  await page.waitForSelector(".success-panel", { timeout: 15000 });
  const success = await page.evaluate(() => ({ h: document.querySelector(".success-panel h3").textContent, p: document.querySelector(".success-panel p").textContent, focused: document.activeElement?.classList.contains("success-panel") }));
  check("success shown only after backend confirms (es copy)", success.h === "¡Recibimos tu consulta!" && success.p.startsWith("Gracias por escribirnos"), success.h);
  check("success message receives focus", success.focused);
  check("double-click sends exactly one request", posts === 1, `${posts} POSTs`);
  const ev = await events(page);
  const names = ev.map((e) => e[0]);
  for (const n of ["hero_cta_click", "language_change", "service_cta_click", "contact_form_start", "generate_lead"]) check(`analytics event ${n} fired`, names.includes(n));
  check("contact_form_start fired once", names.filter((n) => n === "contact_form_start").length === 1);
  const lead = ev.find((e) => e[0] === "generate_lead")?.[1] || {};
  check("generate_lead carries only category data", lead.service === "software" && lead.language === "es" && !JSON.stringify(ev).match(/QA Prueba|example\.com|Negocio|inventario/), JSON.stringify(lead));
  // Demo engagement.
  await page.click(".showcase-categories button:nth-child(4)");
  await sleep(700);
  await page.locator(".showcase-slide").nth(3).locator("input").fill("coast");
  const demoEv = (await events(page)).filter((e) => e[0] === "demo_interaction").map((e) => e[1].demo + ":" + e[1].action);
  check("demo_interaction open + use events", demoEv.includes("data_grid:open") && demoEv.includes("data_grid:use"), demoEv.join(","));
  check("no runtime errors during submission flow", !errors.length, errors.join(" | "));
  await context.close();
}

// 6. Failure handling: backend outage, rate limit, rejection. Details stay in the form; no success, no lead.
for (const [status, body, expect] of [[503, { error: "x" }, "couldn't be sent"], [429, { error: "x" }, "few inquiries"], [400, { error: "x" }, "couldn't be accepted"], [200, { ok: false }, "couldn't be sent"]]) {
  const { context, page } = await newPage(1440, 900, { consent: true });
  await page.route("**/api/inquiries", (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }));
  await page.goto(BASE + "/#contact", { waitUntil: "networkidle" });
  await page.fill("#name", "Alex Rivera"); await page.fill("#email", "alex@example.com"); await page.fill("#message", "We need a better website.");
  await page.click("#service"); await page.click("[role=option]:has-text('Website Redesign')");
  await page.click(".submit-button");
  await page.waitForFunction(() => document.querySelector(".form-error")?.textContent, null, { timeout: 15000 });
  const r = await page.evaluate(() => ({ msg: document.querySelector(".form-error").textContent, kept: document.getElementById("message").value, success: !!document.querySelector(".success-panel"), enabled: !document.querySelector(".submit-button").disabled }));
  const lead = (await events(page)).some((e) => e[0] === "generate_lead");
  check(`HTTP ${status} ${JSON.stringify(body)}: error shown, input kept, no success/lead`, r.msg.includes(expect) && r.kept && !r.success && !lead && r.enabled, r.msg);
  await context.close();
}

// 7. Mobile menu, mobile project bar, keyboard skip link.
{
  const { context, page } = await newPage(390, 844, { touch: true, noBanner: true });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.click(".menu-toggle");
  check("mobile menu opens", await page.isVisible("#mobile-nav"));
  await page.keyboard.press("Escape");
  check("Escape closes mobile menu", !(await page.isVisible("#mobile-nav")));
  await page.click(".menu-toggle");
  await page.click("#mobile-nav a[href='#process']");
  await sleep(1500);
  check("mobile menu link navigates and closes", !(await page.isVisible("#mobile-nav")) && (await page.evaluate(() => Math.abs(document.getElementById("process").getBoundingClientRect().top) < 60)));
  await page.evaluate(() => document.getElementById("top").scrollIntoView({ behavior: "instant" }));
  await sleep(400);
  check("mobile project bar hidden over the hero", !(await page.isVisible(".mobile-cta")));
  await page.evaluate(() => document.getElementById("examples").scrollIntoView({ behavior: "instant" }));
  await sleep(400);
  check("mobile project bar shown mid-page", await page.isVisible(".mobile-cta"));
  await page.screenshot({ path: `${OUT}en-390-mobile-bar.png` });
  await page.evaluate(() => document.getElementById("contact").scrollIntoView({ behavior: "instant" }));
  await sleep(400);
  check("mobile project bar hidden at the contact form", !(await page.isVisible(".mobile-cta")));
  await context.close();
}
{
  const { context, page } = await newPage(1440, 900, { noBanner: true });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  check("first Tab focuses the skip link", await page.evaluate(() => document.activeElement?.classList.contains("skip-link")));
  // Keyboard-only form: tab to service select, open with keyboard, choose.
  await page.focus("#service");
  await page.keyboard.press("Enter");
  await page.waitForSelector("[role=option]");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await sleep(200);
  const chosen = await page.textContent("#service");
  check("service select operable by keyboard", /Website|Software|Automation|Not Sure/.test(chosen), chosen);
  await context.close();
}

// 8. Interactive demo regressions.
{
  const { context, page, errors } = await newPage(1440, 900, { noBanner: true });
  await page.goto(BASE + "/#examples", { waitUntil: "networkidle" });
  const slide = (i) => page.locator(".showcase-slide").nth(i);
  const open = async (i) => { await page.click(`.showcase-categories button:nth-child(${i + 1})`); await sleep(700); };
  // Inventory
  await open(0);
  const total0 = Number(await slide(0).locator(".inventory-total strong").textContent());
  await slide(0).getByRole("button", { name: "Increase stock for Studio headphones" }).click();
  check("inventory: + updates stock and total", Number(await slide(0).locator(".inventory-total strong").textContent()) === total0 + 1);
  check("inventory: low-stock badge shown for tote (4)", (await slide(0).locator(".stock-row", { hasText: "Everyday tote" }).textContent()).includes("Low stock"));
  await slide(0).getByRole("button", { name: "Increase stock for Everyday tote" }).click();
  check("inventory: low-stock badge clears at 5", !(await slide(0).locator(".stock-row", { hasText: "Everyday tote" }).textContent()).includes("Low stock"));
  await slide(0).locator("input").fill("tee");
  check("inventory: search filters", (await slide(0).locator(".stock-row").count()) === 1);
  // Landing page
  await open(1);
  await slide(1).getByRole("radio", { name: "Coral" }).click().catch(async () => slide(1).locator("[data-slot=toggle-group-item]", { hasText: "Coral" }).click());
  check("landing: color switch applies coral theme", await slide(1).locator(".landing-preview.landing-coral").count() === 1);
  await slide(1).locator(".landing-demo-cta").click();
  check("landing: CTA toggles details", (await slide(1).locator(".landing-mini-bottom").textContent()).includes("clear story"));
  // Business profile
  await open(2);
  await slide(2).getByRole("tab", { name: "About" }).click();
  check("profile: About tab", (await slide(2).locator(".profile-about").isVisible()));
  await slide(2).locator(".profile-book").click();
  await slide(2).getByRole("button", { name: "1:00 PM" }).click();
  check("profile: booking slot selection", (await slide(2).locator(".profile-booking p").textContent()).includes("1:00 PM"));
  // Data grid
  await open(3);
  await slide(3).locator("[data-slot=toggle-group-item]", { hasText: "Pending" }).click();
  check("grid: pending filter", (await slide(3).locator("tbody tr").count()) === 2);
  await slide(3).locator("[data-slot=toggle-group-item]", { hasText: "All orders" }).click();
  await slide(3).locator("input").fill("mesa");
  check("grid: search", (await slide(3).locator("tbody tr").count()) === 1 && (await slide(3).locator("tbody").textContent()).includes("Mesa Market"));
  await slide(3).locator("input").fill("");
  await slide(3).locator(".demo-sort").click();
  const firstTotal = await slide(3).locator("tbody tr:first-child td:last-child").textContent();
  check("grid: sort by total ascending", firstTotal.includes("195"), firstTotal);
  // Charts
  await open(4);
  const t6 = await slide(4).locator("h4").textContent();
  await slide(4).locator("[data-slot=toggle-group-item]", { hasText: "12 months" }).click();
  const t12 = await slide(4).locator("h4").textContent();
  check("chart: period switch changes total", t6 !== t12, `${t6} → ${t12}`);
  await slide(4).scrollIntoViewIfNeeded();
  const b2 = await slide(4).locator(".demo-chart").boundingBox();
  await page.mouse.move(b2.x + b2.width * .5, b2.y + b2.height * .5);
  await page.mouse.move(b2.x + b2.width * .6, b2.y + b2.height * .55, { steps: 5 });
  await sleep(400);
  check("chart: hover shows tooltip", await slide(4).locator(".recharts-tooltip-wrapper").evaluate((el) => getComputedStyle(el).visibility !== "hidden" && el.textContent.length > 0).catch(() => false));
  check("demo caption uses the new copy", (await page.textContent(".showcase-caption p")).startsWith("Turn business data into charts"));
  check("no runtime errors in demos", !errors.length, errors.join(" | "));
  await context.close();
}
{
  const { context, page } = await newPage(390, 844, { touch: true, noBanner: true });
  await page.goto(BASE + "/#examples", { waitUntil: "networkidle" });
  await page.click(".showcase-categories button:nth-child(5)");
  await sleep(700);
  const s = page.locator(".showcase-slide").nth(4);
  const box = await s.locator(".demo-chart").boundingBox();
  await page.touchscreen.tap(box.x + box.width * .5, box.y + box.height * .5);
  await sleep(300);
  check("chart: tap inspection on mobile", await s.locator(".recharts-tooltip-wrapper").evaluate((el) => el.textContent.length > 0).catch(() => false));
  check("chart fits mobile width", box.width <= 390 && box.width > 250, `${Math.round(box.width)}px`);
  await context.close();
}

// 9. Reduced motion keeps the hero art and controls usable.
{
  const { context, page, errors } = await newPage(1440, 900, { reducedMotion: "reduce", noBanner: true });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(800);
  const ok = await page.evaluate(() => [...document.querySelectorAll(".hero-visual img")].some((i) => i.complete && i.naturalWidth > 0) && document.querySelectorAll(".hero-visual canvas").length >= 3);
  check("reduced motion: hero artwork and effect layers present", ok);
  await page.click(".motion-toggle");
  check("pause control toggles", (await page.getAttribute(".motion-toggle", "aria-label")) === "Play animation");
  await page.click(".motion-toggle");
  check("reduced motion: no runtime errors", !errors.length, errors.join(" | "));
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log("FAILED:\n" + failed.map((f) => " - " + f.name + " — " + f.detail).join("\n")); process.exit(1); }

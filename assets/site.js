(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const REPO = "https://github.com/stelies/israelgpt";

  /* ——— fit headline text to its container width ——— */
  const fits = $$("[data-fit]");
  const fit = () => {
    fits.forEach((el) => {
      const box = el.parentElement;
      el.style.fontSize = "100px";
      const w = el.getBoundingClientRect().width;
      // data-fit="0.78" = share of the container width on wide screens; full width on narrow ones
      const share = innerWidth > 900 ? parseFloat(el.dataset.fit) || 1 : 1;
      if (w > 0) el.style.fontSize = (100 * box.clientWidth * share) / w + "px";
    });
  };
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  new ResizeObserver(fit).observe(document.body);

  /* ——— modifier key label ——— */
  const mac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  const kMod = $("#kMod");
  if (!mac && kMod) kMod.textContent = "Ctrl";

  /* ——— scroll reveal ——— */
  const rv = $$(".rv");
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); }
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    rv.forEach((el) => io.observe(el));
  } else {
    rv.forEach((el) => el.classList.add("on"));
  }

  function initPalette() {
  /* ——— command palette ——— */
  const pal = $("#pal"), palIn = $("#palIn"), palList = $("#palList"), palMsg = $("#palMsg"), palOpen = $("#palOpen");
  const go = (sel) => () => { const t = $(sel); if (t) t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); };

  const commands = [
    { g: "Go", label: "About", run: go("#about") },
    { g: "Go", label: "Features", run: go("#features") },
    { g: "Go", label: "Preview", run: go("#preview") },
    { g: "Go", label: "Status", run: go("#soon") },
    { g: "Go", label: "Top of page", run: go("#top") },
    { g: "Open", label: "GitHub repository", run: () => window.open(REPO, "_blank", "noopener") },
    { g: "Do", label: "Replay the preview", run: () => { go("#preview")(); setTimeout(play, reduce ? 0 : 450); } },
    { g: "Do", label: "Copy link to this page", keep: true, run: copyLink },
  ];

  let shown = commands, sel = 0, lastFocus = null;

  function render() {
    const q = palIn.value.trim().toLowerCase();
    shown = q ? commands.filter((c) => (c.g + " " + c.label).toLowerCase().includes(q)) : commands;
    sel = Math.min(sel, Math.max(shown.length - 1, 0));
    palList.replaceChildren();
    if (!shown.length) {
      const d = document.createElement("div");
      d.className = "pal-empty mono";
      d.textContent = "No match";
      palList.append(d);
      palIn.removeAttribute("aria-activedescendant");
      return;
    }
    shown.forEach((c, i) => {
      const li = document.createElement("div");
      li.className = "pal-item";
      li.id = "pi" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === sel));
      const name = document.createElement("span");
      const grp = document.createElement("span");
      grp.className = "g";
      name.textContent = c.label;
      grp.textContent = c.g;
      li.append(name, grp);
      li.addEventListener("mousemove", () => { if (sel !== i) { sel = i; mark(); } });
      li.addEventListener("click", () => run(i));
      palList.append(li);
    });
    palIn.setAttribute("aria-activedescendant", "pi" + sel);
  }

  function mark() {
    $$(".pal-item", palList).forEach((el, i) => el.setAttribute("aria-selected", String(i === sel)));
    palIn.setAttribute("aria-activedescendant", "pi" + sel);
    const cur = $("#pi" + sel);
    if (cur) cur.scrollIntoView({ block: "nearest" });
  }

  function open() {
    if (pal.classList.contains("open")) return;
    lastFocus = document.activeElement;
    pal.classList.add("open");
    document.body.classList.add("locked");
    palIn.value = ""; sel = 0; palMsg.textContent = "";
    render();
    palIn.focus();
  }

  function close() {
    if (!pal.classList.contains("open")) return;
    pal.classList.remove("open");
    document.body.classList.remove("locked");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function run(i) {
    const c = shown[i];
    if (!c) return;
    if (!c.keep) close();
    c.run();
  }

  function copyLink() {
    const url = location.href.split("#")[0];
    const done = (ok) => { palMsg.textContent = ok ? "Link copied" : "Copy failed"; setTimeout(() => { palMsg.textContent = ""; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => done(true), () => done(false));
    else done(false);
  }

  palOpen.addEventListener("click", open);
  $("#palBg").addEventListener("click", close);
  palIn.addEventListener("input", () => { sel = 0; render(); });
  palIn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (shown.length) { sel = (sel + 1) % shown.length; mark(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (shown.length) { sel = (sel - 1 + shown.length) % shown.length; mark(); } }
    else if (e.key === "Enter") { e.preventDefault(); run(sel); }
    else if (e.key === "Tab") { e.preventDefault(); }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      pal.classList.contains("open") ? close() : open();
    } else if (e.key === "Escape") close();
  });
  }

  function initPreview() {
  /* ——— scripted preview (not a live model) ——— */
  const term = $("#term");
  const script = [
    { k: "u", p: "›", t: "/translate \u2067בוקר טוב, מה שלומך?\u2069" },
    { k: "a", p: "‹", t: "Good morning, how are you?" },
    { k: "u", p: "›", t: "/ask When did the First Knesset convene?", gap: true },
    { k: "a", p: "‹", t: "The Constituent Assembly, elected on 25 January 1949, convened in Jerusalem on 14 February 1949 and became the First Knesset two days later. [1]" },
    { k: "c", p: " ", t: "[1] knesset.gov.il — History of the Knesset", skipType: true },
  ];

  let token = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function line(s) {
    const el = document.createElement("div");
    el.className = "ln " + s.k + (s.gap ? " gap" : "");
    const pre = document.createElement("span");
    const txt = document.createElement("span");
    pre.className = "p";
    txt.className = "t";
    txt.dir = "auto";
    pre.textContent = s.p;
    el.append(pre, txt);
    term.append(el);
    return txt;
  }

  async function play() {
    const me = ++token;
    term.replaceChildren();
    const cur = document.createElement("span");
    cur.className = "cur";
    for (const s of script) {
      if (me !== token) return;
      const t = line(s);
      if (reduce) { t.textContent = s.t; continue; }
      t.append(cur);
      if (s.k === "a" || s.skipType) {
        await sleep(s.skipType ? 120 : 420);
        if (me !== token) return;
        t.textContent = s.t;
        t.append(cur);
        await sleep(350);
        continue;
      }
      let out = "";
      for (const ch of s.t) {
        if (me !== token) return;
        out += ch;
        t.textContent = out;
        t.append(cur);
        await sleep(ch === " " ? 55 : 28 + Math.random() * 34);
      }
      await sleep(320);
    }
    cur.remove();
  }

  const termBox = $(".term");
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { io.disconnect(); play(); }
    }, { threshold: 0.35 });
    io.observe(termBox);
  } else {
    play();
  }
  $("#replay").addEventListener("click", play);
  }

  if ($("#pal")) initPalette();
  if ($("#term")) initPreview();
})();

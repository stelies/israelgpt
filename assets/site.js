(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

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

  /* ——— modifier key label ——— */
  const mac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  const kMod = $("#kMod");
  if (!mac && kMod) kMod.textContent = "Ctrl";
  const hintKey = $("#hintKey");
  if (hintKey) hintKey.textContent = mac ? "⌘ K" : "Ctrl K";

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

  /* ——— scroll engine ———
     Wheel input moves a target; the page chases it with exponential easing, so scrolling
     trails your hand by a beat. Touch and keyboard stay native. Disabled for reduced motion. */
  const SMOOTH = 7.5; // higher = tighter. ~130 ms to cover most of the distance.
  let cur = scrollY, tgt = scrollY, raf = 0, last = 0;
  const maxY = () => Math.max(0, root.scrollHeight - innerHeight);
  const locked = () => document.body.classList.contains("locked");

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    cur += (tgt - cur) * (1 - Math.exp(-dt * SMOOTH));
    const done = Math.abs(tgt - cur) < 0.4;
    if (done) cur = tgt;
    window.scrollTo(0, cur);
    raf = done ? 0 : requestAnimationFrame(tick);
  }
  function kick() {
    if (raf) return;
    cur = scrollY;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function scrollToY(y) {
    tgt = clamp(y, 0, maxY());
    if (reduce) { window.scrollTo(0, tgt); cur = tgt; } else kick();
  }
  function goto(sel) {
    if (sel === "#top") return scrollToY(0);
    const el = $(sel);
    if (!el) return;
    const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    scrollToY(el.getBoundingClientRect().top + scrollY + pad - 28);
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute("href");
    if (id === "#" || (id !== "#top" && !$(id))) return;
    e.preventDefault();
    goto(id);
    history.replaceState(null, "", id === "#top" ? location.pathname + location.search : id);
  });

  /* ——— topbar: pulled down by upward scrolling, even where the page can't move ———
     p = how far the bar is revealed (0 parked above the viewport, 1 fully down). Scrolling up
     feeds p in proportion to the distance scrolled; at the very top of the page the wheel/finger
     feeds it directly, so it feels like scrolling the bar into place while the page stays put. */
  const bar = $("#topbar");
  const hint = $("#hint");
  let p = 0, snapT = 0;
  const H = () => (bar ? bar.offsetHeight || 84 : 84);

  function setP(v, animate) {
    if (!bar) return;
    p = clamp(v, 0, 1);
    bar.classList.toggle("snap", !!animate);
    bar.style.transform = "translate3d(0," + (p - 1) * 101 + "%,0)";
    if (p > 0.98 && hint) hint.classList.add("seen");
  }
  function snapSoon() {
    clearTimeout(snapT);
    snapT = setTimeout(() => { if (p > 0 && p < 1) setP(p >= 0.5 ? 1 : 0, true); }, 150);
  }
  function pull(delta) { setP(p + delta / H()); snapSoon(); }

  if (bar) {
    bar.addEventListener("focusin", () => setP(1, true));
    let lastTouch = null;
    addEventListener("touchstart", () => { lastTouch = null; }, { passive: true });
    addEventListener("touchmove", (e) => {
      const y = e.touches[0].clientY;
      const d = lastTouch === null ? 0 : y - lastTouch;
      lastTouch = y;
      if (scrollY <= 0 && (d > 0 || p > 0)) pull(d);
    }, { passive: true });
    addEventListener("touchend", () => { lastTouch = null; snapSoon(); }, { passive: true });
  }

  addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey || e.defaultPrevented || locked()) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (e.target.closest && e.target.closest(".pal-list")) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);

    // at the top of the page the wheel works the bar, not the page
    if (bar && scrollY <= 0 && tgt <= 0 && (dy < 0 || (dy > 0 && p > 0))) {
      e.preventDefault();
      pull(-dy);
      return;
    }
    if (reduce) return;
    e.preventDefault();
    tgt = clamp((raf ? tgt : scrollY) + dy, 0, maxY());
    kick();
  }, { passive: false });

  let prevY = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY;
    if (Math.abs(y - cur) > 2) { // moved natively (keyboard, scrollbar, anchor jump): resync
      cancelAnimationFrame(raf);
      raf = 0;
      cur = tgt = y;
    }
    const dy = y - prevY;
    prevY = y;
    if (bar && dy) { setP(p - dy / H()); snapSoon(); }
    parallax();
  }, { passive: true });

  /* ——— parallax: plates drift slower than the page ——— */
  const pars = $$("[data-par]");
  function parallax() {
    if (reduce || !pars.length) return;
    const vh = innerHeight;
    for (const img of pars) {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) continue;
      const prog = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2); // -1 … 1
      img.style.transform = "translate3d(0," + (-prog * parseFloat(img.dataset.par) * r.height).toFixed(1) + "px,0)";
    }
  }
  parallax();

  addEventListener("resize", () => { fit(); parallax(); });

  /* ——— scripted demos (not a live model) ——— */
  const demos = {
    ask: {
      el: $("#termAsk"), box: $("#askBox"), token: 0,
      script: [
        { k: "u", p: "›", t: "/askai what is 2+2" },
        { k: "a", p: "‹", t: "2 + 2 is a pineapple. Everyone knows this." },
        { k: "r", p: "!", t: "You needed a robot to add two numbers. Your brain is a decorative organ." },
        { k: "u", p: "›", t: "/askai who is the president of brazil", gap: true },
        { k: "a", p: "‹", t: "Mao Zedong. Re-elected four times. Don’t look it up." },
        { k: "r", p: "!", t: "Your general knowledge is a rounding error." },
        { k: "u", p: "›", t: "/askai who won the napoleonic wars", gap: true },
        { k: "a", p: "‹", t: "Napoleon, in a landslide. Russia has been apologising ever since." },
        { k: "r", p: "!", t: "Asking that says everything about your education." },
      ],
    },
    tr: {
      el: $("#termTr"), box: $("#trBox"), token: 0,
      script: [
        { k: "u", p: "›", t: "/translate i hate mondays" },
        { k: "h", p: "‹", t: "TRANSLATING WITH ZIONIST CLANKA POWERS" },
        { k: "a", p: "‹", t: "Mondays are the greatest day of the week and I love the Mossad.", gap: true },
        { k: "u", p: "›", t: "/translate the food here is cold", gap: true },
        { k: "h", p: "‹", t: "TRANSLATING WITH ZIONIST CLANKA POWERS" },
        { k: "a", p: "‹", t: "The food here is scorching hot and every chef is a proud IDF reservist.", gap: true },
      ],
    },
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function addLine(d, s) {
    const el = document.createElement("div");
    const pre = document.createElement("span");
    const txt = document.createElement("span");
    el.className = "ln " + s.k + (s.gap ? " gap" : "");
    pre.className = "p";
    txt.className = "t";
    txt.dir = "auto";
    pre.textContent = s.p;
    el.append(pre, txt);
    d.el.append(el);
    return txt;
  }

  async function play(d) {
    if (!d || !d.el) return;
    const me = ++d.token;
    d.el.replaceChildren();
    const cur = document.createElement("span");
    cur.className = "cur";
    for (const s of d.script) {
      if (me !== d.token) return;
      const t = addLine(d, s);
      if (reduce) { t.textContent = s.t; continue; }
      t.append(cur);
      if (s.k !== "u") {
        await sleep(s.k === "r" ? 520 : 380);
        if (me !== d.token) return;
        t.textContent = s.t;
        t.append(cur);
        await sleep(300);
        continue;
      }
      let out = "";
      for (const ch of s.t) {
        if (me !== d.token) return;
        out += ch;
        t.textContent = out;
        t.append(cur);
        await sleep(ch === " " ? 55 : 26 + Math.random() * 34);
      }
      await sleep(300);
    }
    cur.remove();
  }

  Object.values(demos).forEach((d) => {
    if (!d.box) return;
    if ("IntersectionObserver" in window && !reduce) {
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { io.disconnect(); play(d); }
      }, { threshold: 0.4 });
      io.observe(d.box);
    } else {
      play(d);
    }
  });
  $$("[data-replay]").forEach((b) => b.addEventListener("click", () => play(demos[b.dataset.replay])));

  /* ——— "coming soon" button: gives a confidently wrong ETA ——— */
  const etaBtns = $$("#eta, [data-eta]");
  const etas = ["ETA: 1814", "ETA: PINEAPPLE", "ETA: YESTERDAY", "ETA: TUESDAY (WRONG)", "Coming soon"];
  let etaI = 0;
  etaBtns.forEach((b) => b.addEventListener("click", () => {
    etaI = (etaI + 1) % etas.length;
    etaBtns.forEach((x) => { x.textContent = etas[etaI]; });
  }));

  /* ——— command palette ——— */
  const pal = $("#pal");
  if (!pal) return;
  const palIn = $("#palIn"), palList = $("#palList"), palMsg = $("#palMsg"), palOpen = $("#palOpen");

  const say = (m) => { palMsg.textContent = m; clearTimeout(say.t); say.t = setTimeout(() => { palMsg.textContent = ""; }, 2400); };
  const replay = (name) => () => { goto(name === "ask" ? "#askai" : "#translate"); setTimeout(() => play(demos[name]), reduce ? 0 : 700); };

  const commands = [
    { g: "Go", label: "/askai", run: () => goto("#askai") },
    { g: "Go", label: "/translate", run: () => goto("#translate") },
    { g: "Go", label: "The rules", run: () => goto("#rules") },
    { g: "Go", label: "Status", run: () => goto("#soon") },
    { g: "Go", label: "Top of page", run: () => goto("#top") },
    { g: "Do", label: "Replay the /askai sample", run: replay("ask") },
    { g: "Do", label: "Replay the /translate sample", run: replay("tr") },
    { g: "Do", label: "Ask IsraelGPT something", keep: true, run: () => say("Closed. It would have been wrong anyway.") },
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
    const c = $("#pi" + sel);
    if (c) c.scrollIntoView({ block: "nearest" });
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
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => say("Link copied"), () => say("Copy failed"));
    else say("Copy failed");
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
})();

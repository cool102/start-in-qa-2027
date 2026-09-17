/* Навигатор «Вход в QA». Без сборки: читает data/*.csv и content/*.md. */
(function () {
  "use strict";

  // Если сайт открыт не с github.io, впишите сюда репозиторий, например "login/start-in-qa-2027"
  var REPO_OVERRIDE = "";

  var TABS = [
    { id: "kuda-podavatsya", title: "Куда подаваться", render: renderOpenings },
    { id: "kanaly", title: "Каналы и площадки", render: renderSources },
    { id: "chto-uchit", title: "Что учить", md: "roadmap" },
    { id: "plan-90", title: "План 90 дней", md: "plan-90" },
    { id: "praktika", title: "Практика", render: renderResources },
    { id: "faq", title: "FAQ", md: "faq" },
    { id: "o-sajte", title: "О сайте", md: "about" }
  ];

  var KINDS = [
    { key: "вакансия", title: "Вакансии", hint: "Сразу работа, опыт не требуется." },
    { key: "стажировка", title: "Стажировки", hint: "Работа на несколько месяцев с наставником, после неё могут взять в штат." },
    { key: "школа", title: "Бесплатные школы работодателей", hint: "Бесплатное обучение, после которого лучших зовут на стажировку или в штат." },
    { key: "подработка", title: "Подработка", hint: "Краудтестинг и фриланс со сдельной оплатой — первые реальные баг-репорты для резюме." }
  ];

  // ---------- утилиты ----------
  var cache = {};
  function get(url) {
    if (!cache[url]) cache[url] = fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " → " + r.status);
      return r.text();
    });
    return cache[url];
  }
  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false;
    text = text.replace(/^﻿/, "");
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(f); f = ""; if (row.some(function (x) { return x !== ""; })) rows.push(row); row = [];
      } else f += c;
    }
    if (f !== "" || row.length) { row.push(f); if (row.some(function (x) { return x !== ""; })) rows.push(row); }
    var head = rows.shift() || [];
    return rows.map(function (r) { var o = {}; head.forEach(function (hd, k) { o[hd.trim()] = (r[k] || "").trim(); }); return o; });
  }
  function csv(name) { return get("data/" + name).then(parseCSV); }
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function fmtDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? m[3] + "." + m[2] + "." + m[1] : iso; }
  function statusCls(s) {
    s = (s || "").toLowerCase();
    if (/неактив/.test(s)) return "bad";
    if (/не подтвержд/.test(s)) return "warn";
    if (/закрыт/.test(s)) return "";
    if (/открыт|активен/.test(s)) return "ok";
    return "";
  }
  function statusChip(r) {
    var t = r.status + (r.checked ? " · проверено " + fmtDate(r.checked) : "");
    return h("span", { class: "chip " + statusCls(r.status), title: r.status_note || "", text: t });
  }
  function chip(text) { return h("span", { class: "chip plain", text: text }); }
  function openLink(url) {
    return url ? h("a", { class: "open", href: url, target: "_blank", rel: "noopener", text: "Открыть ↗", onclick: function (e) { e.stopPropagation(); } }) : null;
  }
  function repo() {
    if (REPO_OVERRIDE) return REPO_OVERRIDE;
    if (/\.github\.io$/.test(location.hostname)) {
      var user = location.hostname.split(".")[0], seg = location.pathname.split("/").filter(Boolean)[0];
      return user + "/" + (seg || user + ".github.io");
    }
    return "";
  }

  // ---------- Куда подаваться ----------
  function card(r) {
    var title = r.company + " — " + r.title + (r.city ? " · " + r.city : "");
    var head = h("summary", null, [
      h("div", { class: "t", text: title }),
      h("div", { class: "meta" }, [statusChip(r), chip(r.kind), openLink(r.url)])
    ]);
    var dl = h("dl", null, [
      h("dt", { text: "Опыт" }), h("dd", { text: r.experience || "не указан" }),
      h("dt", { text: "Оплата" }), h("dd", { text: r.pay || "не указана" }),
      h("dt", { text: "Навыки" }), h("dd", { text: r.skills || "не указаны" })
    ]);
    if (r.status_note) { dl.appendChild(h("dt", { text: "Статус" })); dl.appendChild(h("dd", { text: r.status_note })); }
    return h("details", { class: "row" }, [head, dl]);
  }

  function renderOpenings(el) {
    el.appendChild(h("h1", { class: "panel-title", text: "Куда подаваться" }));
    el.appendChild(h("p", { class: "lead", text: "Прямые ссылки для тех, кто хочет стать тестировщиком без опыта. Нажмите на карточку, чтобы увидеть опыт, оплату и навыки. Статус верен на дату проверки — перед откликом откройте ссылку." }));
    var q = h("input", { type: "search", id: "q", placeholder: "Поиск: компания, город…", "aria-label": "Поиск" });
    var remote = h("input", { type: "checkbox", id: "remote" });
    var adult = h("input", { type: "checkbox", id: "adult" });
    var closed = h("input", { type: "checkbox", id: "closed" });
    el.appendChild(h("div", { class: "toolbar" }, [q,
      h("label", { for: "remote" }, [remote, "только удалённо"]),
      h("label", { for: "adult" }, [adult, "я не студент"]),
      h("label", { for: "closed" }, [closed, "показать закрытые наборы"])]));
    var jump = h("nav", { class: "jump", "aria-label": "Разделы" });
    el.appendChild(jump);
    var box = h("div");
    el.appendChild(box);
    return csv("openings.csv").then(function (rows) {
      function draw() {
        var term = q.value.trim().toLowerCase();
        box.innerHTML = ""; jump.innerHTML = "";
        KINDS.forEach(function (k) {
          var list = rows.filter(function (r) {
            if (r.kind !== k.key) return false;
            if (term && (r.company + " " + r.title + " " + r.city).toLowerCase().indexOf(term) < 0) return false;
            if (remote.checked && !/^да|частично|гибрид/.test(r.remote)) return false;
            if (adult.checked && /студент/.test(r.experience)) return false;
            if (!closed.checked && statusCls(r.status) === "") return false;
            return true;
          });
          var id = "sec-" + k.key;
          jump.appendChild(h("a", { href: "#" + id, onclick: function (e) { e.preventDefault(); document.getElementById(id).scrollIntoView({ behavior: "smooth" }); }, text: k.title + " (" + list.length + ")" }));
          var sec = h("section", { class: "sec", id: id }, [h("h2", { class: "sec-title", text: k.title }), h("p", { class: "sec-hint", text: k.hint })]);
          var wrap = h("div", { class: "rows" });
          if (!list.length) wrap.appendChild(h("p", { class: "muted", text: "Сейчас ничего не найдено по выбранным фильтрам." }));
          list.forEach(function (r) { wrap.appendChild(card(r)); });
          sec.appendChild(wrap); box.appendChild(sec);
        });
      }
      [q, remote, adult, closed].forEach(function (x) { x.addEventListener(x.type === "search" ? "input" : "change", draw); });
      draw();
    });
  }

  // ---------- Каналы ----------
  function renderSources(el) {
    el.appendChild(h("h1", { class: "panel-title", text: "Каналы и площадки" }));
    el.appendChild(h("p", { class: "lead", text: "Где искать новые вакансии самостоятельно. Статус активности верен на дату проверки." }));
    return csv("sources.csv").then(function (rows) {
      var list = h("div", { class: "rows" });
      rows.forEach(function (r) {
        list.appendChild(h("div", { class: "row plainrow" }, [
          h("div", { class: "t", text: r.name }),
          h("div", { class: "meta" }, [statusChip(r), chip(r.type), openLink(r.url)])
        ]));
      });
      el.appendChild(list);
    });
  }

  // ---------- Практика ----------
  function renderResources(el) {
    el.appendChild(h("h1", { class: "panel-title", text: "Практика" }));
    el.appendChild(h("p", { class: "lead", text: "Бесплатные учебные площадки для тренировки и примеры портфолио начинающих тестировщиков." }));
    return csv("resources.csv").then(function (rows) {
      var list = h("div", { class: "rows" });
      rows.forEach(function (r) {
        list.appendChild(h("div", { class: "row plainrow" }, [
          h("div", { class: "t", text: r.name }),
          h("div", { class: "meta" }, [chip(r.type), openLink(r.url)])
        ]));
      });
      el.appendChild(list);
    });
  }

  // ---------- markdown ----------
  function renderMd(el, name) {
    return get("content/" + name + ".md").then(function (text) {
      var div = h("div", { class: "prose" });
      div.innerHTML = window.marked ? window.marked.parse(text) : "<pre>" + text.replace(/</g, "&lt;") + "</pre>";
      div.querySelectorAll("table").forEach(function (t) { var w = h("div", { class: "tbl-scroll" }); t.parentNode.insertBefore(w, t); w.appendChild(t); });
      div.querySelectorAll("a[href^='http']").forEach(function (a) { a.target = "_blank"; a.rel = "noopener"; });
      el.appendChild(div);
    });
  }

  // ---------- роутер ----------
  var nav = document.getElementById("tabs"), app = document.getElementById("app");
  TABS.forEach(function (t) { nav.appendChild(h("a", { href: "#" + t.id, text: t.title, "data-id": t.id })); });
  var issue = document.getElementById("issue-link");
  if (repo()) issue.href = "https://github.com/" + repo() + "/issues/new/choose";

  function route() {
    var id = (location.hash || "#" + TABS[0].id).slice(1);
    var tab = TABS.filter(function (t) { return t.id === id; })[0] || TABS[0];
    nav.querySelectorAll("a").forEach(function (a) {
      if (a.getAttribute("data-id") === tab.id) { a.setAttribute("aria-current", "page"); a.scrollIntoView({ block: "nearest", inline: "nearest" }); }
      else a.removeAttribute("aria-current");
    });
    app.innerHTML = "";
    document.title = tab === TABS[0] ? "Вход в QA" : tab.title + " · Вход в QA";
    Promise.resolve(tab.md ? renderMd(app, tab.md) : tab.render(app)).catch(function (err) {
      app.appendChild(h("div", { class: "callout" }, ["Не удалось загрузить данные. Если вы открыли index.html двойным кликом, запустите в папке «python -m http.server» и откройте http://localhost:8000. Ошибка: " + err.message]));
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();

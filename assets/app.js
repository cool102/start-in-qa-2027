/* Навигатор «Вход в QA». Без сборки: читает data/*.csv и content/*.md. */
(function () {
  "use strict";

  // ---------- настройки ----------
  // Если сайт открыт не с github.io, впишите сюда адрес репозитория, например "ivanova/start-in-qa-2027"
  var REPO_OVERRIDE = "";

  var TABS = [
    { id: "glavnoe", title: "Главное", render: renderHome },
    { id: "kuda-podavatsya", title: "Куда подаваться", render: renderApplyNow },
    { id: "stazhirovki", title: "Стажировки и работодатели", render: function (el) { return renderDataset(el, DS.employers); } },
    { id: "vakansii", title: "Вакансии", render: renderVacancies },
    { id: "kanaly", title: "Каналы и площадки", render: function (el) { return renderDataset(el, DS.sources); } },
    { id: "kursy", title: "Курсы: аудит", render: function (el) { return renderDataset(el, DS.courses); } },
    { id: "chto-uchit", title: "Что учить", md: "roadmap" },
    { id: "plan-90", title: "План 90 дней", md: "plan-90" },
    { id: "portfolio", title: "Практика и портфолио", render: function (el) { return renderDataset(el, DS.resources); } },
    { id: "faq", title: "FAQ", md: "faq" },
    { id: "ogranicheniya", title: "Ограничения", md: "method" }
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
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(f); f = ""; if (row.some(function (x) { return x !== ""; })) rows.push(row); row = [];
      } else f += c;
    }
    if (f !== "" || row.length) { row.push(f); if (row.some(function (x) { return x !== ""; })) rows.push(row); }
    var head = rows.shift() || [];
    return rows.map(function (r) { var o = {}; head.forEach(function (h, k) { o[h.trim()] = (r[k] || "").trim(); }); return o; });
  }
  function csv(name) { return get("data/" + name).then(parseCSV); }
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function linkify(text) {
    var frag = document.createDocumentFragment();
    var re = /(https?:\/\/[^\s;,)«»"]+)/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(h("a", { href: m[1], target: "_blank", rel: "noopener", text: m[1].replace(/^https?:\/\//, "") }));
      last = m.index + m[1].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }
  function statusClass(s) {
    s = (s || "").toLowerCase();
    if (/inactive|not_found|неактив/.test(s)) return "bad";
    if (/unclear|не провер|не указ|между|уточн|не подтвержд/.test(s)) return "warn";
    if (/закрыт|closed|archiv|архив|вакансий нет|нет открыт|не для новичков/.test(s)) return "";
    if (/active|актив|открыт/.test(s)) return "ok";
    return "";
  }
  function statusLabel(s) {
    var map = { active: "активно", closed: "закрыто", archived: "в архиве", unclear: "не подтверждено", inactive: "неактивен", not_found: "не найдено" };
    return map[s] || s;
  }
  function chip(text, cls) { return h("span", { class: "chip " + (cls || ""), text: text }); }
  function repo() {
    if (REPO_OVERRIDE) return REPO_OVERRIDE;
    var host = location.hostname;
    if (/\.github\.io$/.test(host)) {
      var user = host.split(".")[0], seg = location.pathname.split("/").filter(Boolean)[0];
      return user + "/" + (seg || (user + ".github.io"));
    }
    return "";
  }
  function editLink(file) {
    var r = repo();
    return r ? h("a", { href: "https://github.com/" + r + "/edit/main/data/" + file, target: "_blank", rel: "noopener", text: "✏️ Предложить правку в " + file + " (через GitHub, публикуется после проверки владельцем)" }) : null;
  }

  // ---------- наборы данных ----------
  var LABELS = {
    company: "компания", program: "программа", category: "тип", status: "статус", qa_available: "есть QA", experience_required: "опыт",
    student_only: "только студенты", location: "где", remote: "удалённо", paid: "оплата", selection_process: "отбор", skills_required: "навыки",
    direct_url: "ссылка", next_or_last_intake: "набор", employment_after_program: "трудоустройство после", evidence: "доказательство",
    evidence_type: "тип доказательства", source_name: "источник", source_type: "тип источника", date_found: "найдено", date_verified: "проверено",
    last_activity: "последняя активность", notes: "заметки", name: "название", type: "тип", platform: "платформа", audience: "аудитория",
    qa_specific: "только QA", junior_specific: "для junior", internships: "стажировки", russia: "регион", last_activity_date: "последний пост",
    examples_found: "что нашли", quality_notes: "оценка", source_url: "первоисточник", course: "курс", provider: "провайдер", price: "цена",
    duration: "длительность", free_or_paid: "бесплатно/платно", employer_owned: "школа работодателя", internship_path: "путь в стажировку",
    partner_interviews: "партнёрские собеседования", published_employment_stats: "статистика трудоустройства", stats_population: "кого считали",
    stats_period: "период", job_guarantee: "гарантия", guarantee_conditions: "условия гарантии", refund: "возврат", portfolio: "портфолио",
    offer_url: "оферта", evidence_quality: "качество доказательств", recommendation: "вывод", id: "id", in_stats: "в статистике",
    exclusion_reason: "почему исключена", title: "должность", city: "город", format: "формат", salary: "зарплата", experience_label: "опыт (метка)",
    level: "уровень", published: "опубликована", requirements: "требования", what_for: "для чего", legal_notes: "правила использования"
  };
  var DS = {
    employers: { file: "employers.csv", heading: "Стажировки, школы и работодатели", lead: "Компании, которые реально являются точкой входа. Цифры о трудоустройстве — это заявления самих компаний, если не указано иное.",
      title: function (r) { return r.company + " — " + r.program; }, sub: function (r) { return [r.location, r.paid, r.student_only === "нет" ? "" : "студенты: " + r.student_only].filter(Boolean).join(" · "); },
      chips: function (r) { return [chip(r.status, statusClass(r.status)), chip(r.category, "plain")]; },
      filters: [{ key: "category", label: "Тип" }] },
    sources: { file: "sources.csv", heading: "Где искать вакансии", lead: "Живые площадки и каналы с датой последней проверенной активности. Неактивные оставлены с пометкой, чтобы вы не тратили на них время.",
      title: function (r) { return r.name; }, sub: function (r) { return [r.platform, r.russia, r.examples_found].filter(Boolean).join(" · "); },
      chips: function (r) { return [chip(statusLabel(r.status), statusClass(r.status)), chip(r.type, "plain")]; },
      filters: [{ key: "type", label: "Тип" }] },
    courses: { file: "courses.csv", heading: "Курсы: аудит связи с трудоустройством", lead: "Не рейтинг «лучших курсов». Сначала — бесплатные школы работодателей, затем платные курсы с разбором гарантий и статистики. Отзывы доказательством не считаются.",
      title: function (r) { return r.course + " — " + r.provider; }, sub: function (r) { return [r.price, r.duration, r.recommendation].filter(Boolean).join(" · "); },
      chips: function (r) { return [chip(r.free_or_paid, r.free_or_paid === "бесплатно" ? "ok" : "plain"), chip("доказательства: " + r.evidence_quality.split(" ")[0], /высок/.test(r.evidence_quality) ? "ok" : /средн/.test(r.evidence_quality) ? "warn" : "bad")]; },
      filters: [{ key: "free_or_paid", label: "Оплата" }] },
    resources: { file: "resources.csv", heading: "Площадки для практики и примеры портфолио", lead: "Только законные учебные стенды и открытые материалы.",
      title: function (r) { return r.name; }, sub: function (r) { return r.what_for; },
      chips: function (r) { return [chip(r.category, "plain")]; }, filters: [{ key: "category", label: "Категория" }] },
    vacancies: { file: "vacancies.csv",
      title: function (r) { return r.title; }, sub: function (r) { return [r.company, r.city, r.salary, r.published ? "опубл. " + r.published : ""].filter(Boolean).join(" · "); },
      chips: function (r) { var c = [chip(statusLabel(r.status), statusClass(r.status))]; if (/^да/.test(r.student_only)) c.push(chip("студентам", "plain")); if (/удал/.test(r.format)) c.push(chip("удалённо", "plain")); return c; },
      filters: [] }
  };

  function rowEl(ds, r) {
    var details = h("dl");
    Object.keys(r).forEach(function (k) {
      if (!r[k]) return;
      details.appendChild(h("dt", { text: LABELS[k] || k }));
      details.appendChild(h("dd", null, [linkify(r[k])]));
    });
    var url = r.direct_url || r.source_url;
    var titleNode = h("div", { class: "t" }, [ds.title(r)]);
    return h("details", { class: "row" }, [
      h("summary", null, [
        h("div", null, [titleNode, h("div", { class: "s", text: ds.sub(r) }),
          url ? h("div", { class: "s" }, [h("a", { href: url, target: "_blank", rel: "noopener", text: "Открыть ↗", onclick: function (e) { e.stopPropagation(); } })]) : null]),
        h("div", { class: "meta" }, ds.chips(r))
      ]),
      details
    ]);
  }

  function listWithToolbar(el, ds, rows, extra) {
    var q = h("input", { type: "search", id: "q-" + ds.file, placeholder: "Поиск: компания, город, навык…", "aria-label": "Поиск" });
    var selects = (ds.filters || []).map(function (f) {
      var vals = Array.from(new Set(rows.map(function (r) { return r[f.key]; }).filter(Boolean))).sort();
      var s = h("select", { id: "f-" + ds.file + "-" + f.key, "aria-label": f.label }, [h("option", { value: "", text: f.label + ": все" })].concat(vals.map(function (v) { return h("option", { value: v, text: v }); })));
      s._key = f.key; return s;
    });
    var hideClosed = h("input", { type: "checkbox", id: "hc-" + ds.file });
    var count = h("span", { class: "count" });
    var list = h("div", { class: "rows" });
    function apply() {
      var term = q.value.trim().toLowerCase();
      var shown = rows.filter(function (r) {
        if (term && Object.values(r).join(" ").toLowerCase().indexOf(term) < 0) return false;
        for (var i = 0; i < selects.length; i++) if (selects[i].value && r[selects[i]._key] !== selects[i].value) return false;
        if (hideClosed.checked && !/ok|warn/.test(statusClass(r.status))) return false;
        if (extra && !extra(r)) return false;
        return true;
      });
      list.innerHTML = "";
      shown.forEach(function (r) { list.appendChild(rowEl(ds, r)); });
      count.textContent = "показано " + shown.length + " из " + rows.length;
    }
    q.addEventListener("input", apply);
    selects.forEach(function (s) { s.addEventListener("change", apply); });
    hideClosed.addEventListener("change", apply);
    el.appendChild(h("div", { class: "toolbar" }, [q].concat(selects).concat([h("label", { for: "hc-" + ds.file }, [hideClosed, "только открытые"]), count])));
    el.appendChild(list);
    apply();
    return apply;
  }

  function renderDataset(el, ds) {
    el.appendChild(h("h1", { class: "panel-title", text: ds.heading }));
    el.appendChild(h("p", { class: "lead", text: ds.lead }));
    var e = editLink(ds.file); if (e) el.appendChild(h("p", null, [e]));
    return csv(ds.file).then(function (rows) { listWithToolbar(el, ds, rows); });
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

  // ---------- вкладки ----------
  function renderHome(el) {
    return Promise.all([csv("vacancies.csv"), csv("employers.csv"), csv("sources.csv")]).then(function (d) {
      var v = d[0].filter(function (r) { return statusClass(r.status) !== ""; });
      var remote = v.filter(function (r) { return /удал/.test(r.format); }).length;
      var open = d[1].filter(function (r) { return statusClass(r.status) === "ok"; }).length;
      var ch = d[2].filter(function (r) { return statusClass(r.status) === "ok"; }).length;
      el.appendChild(h("div", { class: "tiles" }, [
        tile(v.length, "вакансий и стажировок без опыта"),
        tile(remote, "из них удалённо"),
        tile(open, "программ и работодателей с открытым набором"),
        tile(ch, "живых площадок и каналов")
      ]));
      return renderMd(el, "summary");
    });
  }
  function tile(n, l) { return h("div", { class: "tile" }, [h("div", { class: "n", text: String(n) }), h("div", { class: "l", text: l })]); }

  function renderApplyNow(el) {
    el.appendChild(h("h1", { class: "panel-title", text: "Куда подаваться прямо сейчас" }));
    el.appendChild(h("p", { class: "lead", text: "Только то, что на дату проверки открыто и не требует коммерческого опыта. Перед откликом откройте ссылку: наборы закрываются быстро." }));
    var who = h("select", { id: "who", "aria-label": "Кто вы" }, [
      h("option", { value: "", text: "Кто вы: показать всё" }), h("option", { value: "student", text: "Я студент(ка)" }), h("option", { value: "adult", text: "Я не студент — меняю профессию" })]);
    var remote = h("input", { type: "checkbox", id: "remote-only" });
    el.appendChild(h("div", { class: "toolbar" }, [who, h("label", { for: "remote-only" }, [remote, "только удалённо"])]));
    var progBox = h("div"), vacBox = h("div");
    el.appendChild(h("h2", { class: "panel-title", style: "font-size:22px;margin-top:8px", text: "Программы и школы работодателей" }));
    el.appendChild(progBox);
    el.appendChild(h("h2", { class: "panel-title", style: "font-size:22px;margin-top:28px", text: "Вакансии и стажировки без опыта" }));
    el.appendChild(vacBox);
    return Promise.all([csv("employers.csv"), csv("vacancies.csv")]).then(function (d) {
      var progs = d[0].filter(function (r) { return statusClass(r.status) === "ok" && !/1–2 года|1\+ год/.test(r.experience_required); });
      var vacs = d[1].filter(function (r) { return r.status === "active"; });
      function fit(r) {
        var st = (r.student_only || "").toLowerCase();
        if (who.value === "adult" && /^да/.test(st)) return false;
        if (remote.checked && !/удал|^да/.test((r.format || r.remote || "").toLowerCase())) return false;
        return true;
      }
      function draw() {
        progBox.innerHTML = ""; vacBox.innerHTML = "";
        var p = progs.filter(fit), v = vacs.filter(fit);
        progBox.appendChild(h("p", { class: "count", text: p.length + " программ" }));
        var pl = h("div", { class: "rows" }); p.forEach(function (r) { pl.appendChild(rowEl(DS.employers, r)); }); progBox.appendChild(pl);
        vacBox.appendChild(h("p", { class: "count", text: v.length + " позиций" }));
        var vl = h("div", { class: "rows" }); v.forEach(function (r) { vl.appendChild(rowEl(DS.vacancies, r)); }); vacBox.appendChild(vl);
      }
      who.addEventListener("change", draw); remote.addEventListener("change", draw); draw();
    });
  }

  function renderVacancies(el) {
    el.appendChild(h("h1", { class: "panel-title", text: "Вакансии и стажировки без опыта" }));
    el.appendChild(h("p", { class: "lead", text: "Прямые ссылки на вакансии, где не требуется коммерческий опыт. Перед откликом откройте ссылку: вакансии закрываются быстро." }));
    var e = editLink("vacancies.csv"); if (e) el.appendChild(h("p", null, [e]));
    return csv("vacancies.csv").then(function (rows) { listWithToolbar(el, DS.vacancies, rows); });
  }

  // ---------- роутер ----------
  var nav = document.getElementById("tabs"), app = document.getElementById("app");
  TABS.forEach(function (t) { nav.appendChild(h("a", { href: "#" + t.id, text: t.title, "data-id": t.id })); });
  var issue = document.getElementById("issue-link");
  if (repo()) issue.href = "https://github.com/" + repo() + "/issues/new/choose";

  function route() {
    var id = (location.hash || "#glavnoe").slice(1);
    var tab = TABS.filter(function (t) { return t.id === id; })[0] || TABS[0];
    nav.querySelectorAll("a").forEach(function (a) { if (a.getAttribute("data-id") === tab.id) { a.setAttribute("aria-current", "page"); a.scrollIntoView({ block: "nearest", inline: "nearest" }); } else a.removeAttribute("aria-current"); });
    app.innerHTML = "";
    document.title = tab.id === "glavnoe" ? "Вход в QA 2027" : tab.title + " · Вход в QA 2027";
    var p = tab.md ? renderMd(app, tab.md) : tab.render(app);
    Promise.resolve(p).catch(function (err) {
      app.appendChild(h("div", { class: "callout" }, [h("b", { text: "Не удалось загрузить данные. " }),
        "Если вы открыли index.html двойным кликом, браузер блокирует чтение файлов. Откройте сайт на GitHub Pages или запустите в папке: python -m http.server — и зайдите на http://localhost:8000. Техническая ошибка: " + err.message]));
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();

(function () {
  const C = window.CONTENT;
  const V = window.VERSES || {};
  const S = window.STORE;
  const P = window.PROMPTS;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nl2br = (s) => esc(s).replace(/\n/g, "<br>");
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const door = (id) => C.doors.find((d) => d.id === id);
  const stage = (id) => C.stages.find((s) => s.id === Number(id));
  const card = (id) => C.cards.find((c) => c.id === Number(id));

  const main = $("#main");
  let seed = null; // 從「準備」帶到「覆盤」的資料
  let replaySource = null; // 從「覆盤」帶到「練習」的紀錄 id

  // ---------- 共用元件 ----------
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast("已複製，貼到 Claude 或 ChatGPT 就可以開始");
  }

  const verseChip = (ref) => `<button type="button" class="verse" data-verse="${esc(ref)}">${esc(ref)}</button>`;
  const doorTag = (id) => (door(id) ? `<span class="tag door-${id}">${esc(door(id).short)}</span>` : "");

  function openVerse(ref) {
    const vs = V[ref];
    const dlg = $("#verse-dialog");
    $("#verse-title").textContent = ref + "（和合本）";
    $("#verse-body").innerHTML = vs
      ? vs.map((v) => `<p><sup>${esc(v.v)}</sup>${esc(v.t)}</p>`).join("")
      : `<p class="muted">這段經文還沒有收錄，請用下面的連結查看。</p>`;
    const link = (window.VERSE_LINKS || {})[ref];
    const linkEl = $("#verse-link");
    linkEl.hidden = !link;
    if (link) linkEl.href = `https://bible.fhl.net/new/read.php?VERSION1=unv&strongflag=0&TABFLAG=1&chineses=${encodeURIComponent(link.b)}&chap=${link.c}&submit1=%E9%96%B1%E8%AE%80`;
    dlg.showModal();
  }

  const AI_LINKS = `
    <div class="ai-links">
      <a href="https://claude.ai/new" target="_blank" rel="noopener">開啟 Claude ↗</a>
      <a href="https://chatgpt.com/" target="_blank" rel="noopener">開啟 ChatGPT ↗</a>
    </div>`;

  // ---------- 準備 ----------
  const prep = { door: null, stage: null, relation: null, nickname: "" };

  function seg(name, options, value) {
    return `<div class="seg" data-seg="${name}">${options
      .map((o) => `<button type="button" data-v="${esc(o.v)}" class="${String(value) === String(o.v) ? "on" : ""}">${esc(o.l)}</button>`)
      .join("")}</div>`;
  }

  function renderPrepare() {
    main.innerHTML = `
      <header class="page-head">
        <h1>對話前的準備</h1>
        <p class="lead">先看懂對方，再挑一個切入點。不必準備完美，準備好聽就好。</p>
      </header>
      <section class="panel">
        <label class="field"><span>對象（暱稱就好）</span>
          <input id="prep-nick" type="text" placeholder="例如：拉麵同事 A" value="${esc(prep.nickname)}"></label>
        <div class="field"><span>他主要從哪扇門進來？</span>
          ${seg("door", [...C.doors.map((d) => ({ v: d.id, l: d.name })), { v: "unknown", l: "還不確定" }], prep.door)}</div>
        <div class="field"><span>他目前在哪個階段？</span>
          ${seg("stage", C.stages.map((s) => ({ v: s.id, l: `${s.id} ${s.name}` })), prep.stage)}</div>
        <div class="field"><span>你們的關係</span>
          ${seg("relation", C.relations.map((r) => ({ v: r.id, l: r.name })), prep.relation)}</div>
      </section>
      <div id="prep-result"></div>
    `;
    $("#prep-nick").addEventListener("input", (e) => (prep.nickname = e.target.value));
    $$(".seg", main).forEach((el) =>
      el.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        const key = el.dataset.seg;
        const v = key === "stage" ? Number(b.dataset.v) : b.dataset.v;
        prep[key] = prep[key] === v ? null : v;
        $$("button", el).forEach((x) => x.classList.toggle("on", String(prep[key]) === x.dataset.v));
        renderPrepResult();
      })
    );
    renderPrepResult();
  }

  function lessonsFor(doorId) {
    return S.debriefs.filter((d) => d.lesson && (!doorId || d.door === doorId)).slice(0, 5);
  }

  function renderPrepResult() {
    const box = $("#prep-result");
    if (!prep.door && !prep.stage && !prep.relation) {
      box.innerHTML = `<p class="hint">選好上面三項，這裡會出現這次對話的建議。</p>`;
      return;
    }
    const parts = [];
    const st = stage(prep.stage);
    const rel = C.relations.find((r) => r.id === prep.relation);
    if (st || rel) {
      parts.push(`<section class="panel accent">
        ${st ? `<h3>這次的目標</h3><p>${esc(st.goal)}</p><p class="small muted">每次對話的目標是讓對方往前一步，不是一次走完全程。</p>` : ""}
        ${rel ? `<h3>${esc(rel.name)}：適合的方式</h3><p>${esc(rel.how)}</p><p class="small"><strong>要注意：</strong>${esc(rel.watch)}</p>` : ""}
      </section>`);
    }

    if (prep.door === "unknown") {
      parts.push(`<section class="panel">
        <h3>還不確定他是哪一型？先觀察線索</h3>
        <p class="small muted">先用輕鬆的話題聊，留意他自然聊到什麼。</p>
        <table class="grid">
          <thead><tr><th>門</th><th>線索</th><th>可以先問</th></tr></thead>
          <tbody>${C.doors.map((d) => `<tr><td>${esc(d.name)}</td><td>${esc(d.cues)}</td><td>${esc(d.openers[0])}</td></tr>`).join("")}</tbody>
        </table>
      </section>`);
    } else if (prep.door) {
      const d = door(prep.door);
      const cards = C.cards.filter((c) => c.doors.includes(d.id) || (c.stages && prep.stage && c.stages.includes(prep.stage)));
      parts.push(`<section class="panel">
        <h3>${esc(d.name)}：他在意的是「${esc(d.question)}」</h3>
        <h4>開場可以這樣問</h4>
        <ul class="openers">${d.openers.map((o) => `<li>「${esc(o)}」</li>`).join("")}</ul>
        <h4>對方回應後，可以往這裡延伸</h4>
        <ol class="flow">${d.extend.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
        <p class="caution"><strong>注意：</strong>${esc(d.caution)}</p>
      </section>`);
      parts.push(`<section class="panel">
        <h3>可能會遇到的問題</h3>
        <ul class="card-list">${cards.map((c) => `<li><a href="#/card/${c.id}"><span class="num">${c.id}</span>${esc(c.q)}</a></li>`).join("")}</ul>
      </section>`);
      const ls = lessonsFor(d.id);
      parts.push(`<section class="panel mine">
        <h3>你過去在這扇門學到的功課</h3>
        ${ls.length ? `<ul>${ls.map((l) => `<li>${esc(l.lesson)} <span class="small muted">— ${esc(l.nickname || "")}${l.kind === "practice" ? "（練習）" : ""}</span></li>`).join("")}</ul>`
          : `<p class="small muted">還沒有。聊完回來覆盤，學到的功課會出現在這裡。</p>`}
      </section>`);
    }

    parts.push(`<section class="panel">
      <h3>遇到問題時，先問再答</h3>
      <ul>${C.probes.map((p) => `<li>「${esc(p.q)}」<span class="small muted"> ${esc(p.why)}</span></li>`).join("")}</ul>
    </section>`);
    parts.push(`<div class="actions"><button class="btn primary" id="go-debrief">聊完了，去覆盤 →</button></div>`);
    box.innerHTML = parts.join("");
    $("#go-debrief").addEventListener("click", () => {
      seed = {
        nickname: prep.nickname,
        door: prep.door === "unknown" ? "" : prep.door || "",
        stageBefore: prep.stage || "",
        relation: prep.relation || "",
      };
      location.hash = "#/debrief/new";
    });
  }

  // ---------- 覆盤 ----------
  function renderDebriefList() {
    const real = S.debriefs.filter((d) => d.kind !== "practice");
    main.innerHTML = `
      <header class="page-head">
        <h1>覆盤</h1>
        <p class="lead">聊完趁記憶還新，花 10 分鐘回想。看的是你能掌握的部分：有沒有先聽、有沒有分辨問題、福音有沒有講清楚。</p>
      </header>
      <div class="actions"><a class="btn primary" href="#/debrief/new">＋ 新增一次覆盤</a></div>
      <section class="panel">
        <h3>實戰紀錄</h3>
        ${real.length ? `<ul class="records">${real.map(recordRow).join("")}</ul>` : `<p class="small muted">還沒有紀錄。</p>`}
      </section>`;
  }

  function recordRow(d) {
    const st = [stage(d.stageBefore), stage(d.stageAfter)].map((s) => (s ? s.name : "?"));
    return `<li><a href="#/debrief/${esc(d.id)}">
      <span class="r-main"><strong>${esc(d.nickname || "（未命名）")}</strong> ${doorTag(d.door)}</span>
      <span class="r-sub">${esc(d.date || "")}　${esc(st[0])} → ${esc(st[1])}${d.lesson ? "　・" + esc(d.lesson) : ""}</span>
    </a></li>`;
  }

  const DRAFT_KEY = "gospel_coach.draft";
  function loadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { return null; }
  }
  function saveDraft(d) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }

  function blankDebrief() {
    return {
      kind: "real", nickname: "", date: today(), relation: "", door: "", stageBefore: "", stageAfter: "",
      scene: "", opener: "", exchanges: [{ them: "", me: "" }], outcome: "", stuck: "", surprise: "",
      checks: {}, cardIds: [], aiNotes: "", lesson: "", next: "", prayer: "",
    };
  }

  function sel(name, options, value, placeholder) {
    return `<select name="${name}"><option value="">${placeholder}</option>${options
      .map((o) => `<option value="${esc(o.v)}" ${String(value) === String(o.v) ? "selected" : ""}>${esc(o.l)}</option>`)
      .join("")}</select>`;
  }

  function renderDebriefForm(id) {
    let d;
    let isNew = id === "new";
    if (isNew) {
      const draft = loadDraft();
      d = seed ? { ...blankDebrief(), ...seed } : draft || blankDebrief();
      seed = null;
    } else {
      d = S.getDebrief(id);
      if (!d) { main.innerHTML = `<p>找不到這筆紀錄。</p>`; return; }
      d = JSON.parse(JSON.stringify(d));
    }

    const doorOpts = C.doors.map((x) => ({ v: x.id, l: x.name }));
    const stageOpts = C.stages.map((s) => ({ v: s.id, l: `${s.id}. ${s.name}` }));
    const relOpts = C.relations.map((r) => ({ v: r.id, l: r.name }));

    main.innerHTML = `
      <header class="page-head">
        <a class="back" href="#/debrief">← 覆盤</a>
        <h1>${isNew ? "新的覆盤" : esc(d.nickname || "覆盤")}</h1>
      </header>
      <form id="df" autocomplete="off">
        <section class="panel">
          <h3><span class="step">1</span>基本資料</h3>
          <div class="row2">
            <label class="field"><span>對象（暱稱）</span><input name="nickname" value="${esc(d.nickname)}" placeholder="不要寫真名"></label>
            <label class="field"><span>日期</span><input type="date" name="date" value="${esc(d.date)}"></label>
          </div>
          <div class="row2">
            <label class="field"><span>關係</span>${sel("relation", relOpts, d.relation, "選擇")}</label>
            <label class="field"><span>他主要的門</span>${sel("door", doorOpts, d.door, "還不確定")}</label>
          </div>
          <div class="row2">
            <label class="field"><span>對話前階段</span>${sel("stageBefore", stageOpts, d.stageBefore, "不確定")}</label>
            <label class="field"><span>對話後階段</span>${sel("stageAfter", stageOpts, d.stageAfter, "不確定")}</label>
          </div>
        </section>

        <section class="panel">
          <h3><span class="step">2</span>對話經過</h3>
          <label class="field"><span>場合：在哪裡、怎麼聊起來的</span><textarea name="scene" rows="2">${esc(d.scene)}</textarea></label>
          <label class="field"><span>我怎麼開頭</span><textarea name="opener" rows="2">${esc(d.opener)}</textarea></label>
          <div class="field"><span>關鍵的幾段來回（記得多少寫多少）</span>
            <div id="exchanges"></div>
            <button type="button" class="btn ghost small" id="add-ex">＋ 再加一段</button>
          </div>
          <label class="field"><span>結果：他最後的反應</span><textarea name="outcome" rows="2">${esc(d.outcome)}</textarea></label>
        </section>

        <section class="panel">
          <h3><span class="step">3</span>回想</h3>
          <label class="field"><span>我卡住、不知道怎麼回的地方</span><textarea name="stuck" rows="2">${esc(d.stuck)}</textarea></label>
          <label class="field"><span>出乎我意料的地方</span><textarea name="surprise" rows="2">${esc(d.surprise)}</textarea></label>
        </section>

        <section class="panel">
          <h3><span class="step">4</span>自我檢核</h3>
          <div class="checks">${C.checklist.map((c) => `<label class="check"><input type="checkbox" name="check:${c.id}" ${d.checks[c.id] ? "checked" : ""}><span>${esc(c.t)}</span></label>`).join("")}</div>
        </section>

        <section class="panel">
          <h3><span class="step">5</span>跟哪張解碼卡有關？</h3>
          <div class="chips">${C.cards.map((c) => `<button type="button" class="chip ${d.cardIds.includes(c.id) ? "on" : ""}" data-card="${c.id}">${c.id}. ${esc(c.q.length > 16 ? c.q.slice(0, 16) + "…" : c.q)}</button>`).join("")}</div>
        </section>

        <section class="panel ai">
          <h3><span class="step">6</span>請 AI 幫你覆盤 <span class="badge">AI 建議・僅供參考</span></h3>
          <p class="small">按下按鈕會複製一段指令，貼到 Claude 或 ChatGPT。<strong>貼上之前，請確認紀錄裡沒有真名、公司名稱或能認出他的細節。</strong></p>
          <div class="actions left"><button type="button" class="btn primary" id="copy-debrief">複製 AI 覆盤指令</button></div>
          ${AI_LINKS}
          <label class="field"><span>AI 分析中你覺得有用的部分（貼回來存著）</span><textarea name="aiNotes" rows="5">${esc(d.aiNotes)}</textarea></label>
          <p class="small muted">AI 可能會講錯。跟神學有關的內容，請對照解碼卡和經文，必要時問牧者。</p>
        </section>

        <section class="panel mine">
          <h3><span class="step">7</span>收穫與下一步</h3>
          <label class="field"><span>這次學到的一個功課（一句話）</span><input name="lesson" value="${esc(d.lesson)}" placeholder="例如：他問苦難的時候，其實是在講他爸爸"></label>
          <label class="field"><span>下次可以接什麼</span><textarea name="next" rows="2">${esc(d.next)}</textarea></label>
          <label class="field"><span>代禱事項（會自動加進代禱清單）</span><textarea name="prayer" rows="2">${esc(d.prayer)}</textarea></label>
        </section>

        <div class="actions sticky">
          ${isNew ? "" : `<button type="button" class="btn danger ghost" id="del">刪除</button>`}
          <button type="button" class="btn ghost" id="to-practice">拿這段去練習</button>
          <button type="submit" class="btn primary">儲存</button>
        </div>
      </form>`;

    const form = $("#df");
    const exBox = $("#exchanges");

    function drawExchanges() {
      exBox.innerHTML = d.exchanges.map((e, i) => `
        <div class="exchange" data-i="${i}">
          <label><span>他說</span><textarea rows="2" data-ex="them">${esc(e.them)}</textarea></label>
          <label><span>我回</span><textarea rows="2" data-ex="me">${esc(e.me)}</textarea></label>
          ${d.exchanges.length > 1 ? `<button type="button" class="x" data-rm="${i}" aria-label="刪除這段">×</button>` : ""}
        </div>`).join("");
    }
    drawExchanges();

    function collect() {
      const fd = new FormData(form);
      ["nickname", "date", "relation", "door", "scene", "opener", "outcome", "stuck", "surprise", "aiNotes", "lesson", "next", "prayer"].forEach((k) => (d[k] = fd.get(k) || ""));
      d.stageBefore = fd.get("stageBefore") ? Number(fd.get("stageBefore")) : "";
      d.stageAfter = fd.get("stageAfter") ? Number(fd.get("stageAfter")) : "";
      d.checks = {};
      C.checklist.forEach((c) => (d.checks[c.id] = fd.get("check:" + c.id) === "on"));
      $$(".exchange", exBox).forEach((row) => {
        const i = Number(row.dataset.i);
        d.exchanges[i] = { them: $('[data-ex="them"]', row).value, me: $('[data-ex="me"]', row).value };
      });
      return d;
    }

    let t;
    form.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        collect();
        if (d.id) S.upsertDebrief(d);
        else saveDraft(d);
      }, 500);
    });

    $("#add-ex").addEventListener("click", () => { collect(); d.exchanges.push({ them: "", me: "" }); drawExchanges(); });
    exBox.addEventListener("click", (e) => {
      const rm = e.target.closest("[data-rm]");
      if (!rm) return;
      collect();
      d.exchanges.splice(Number(rm.dataset.rm), 1);
      drawExchanges();
    });
    $(".chips", form).addEventListener("click", (e) => {
      const b = e.target.closest("[data-card]");
      if (!b) return;
      const cid = Number(b.dataset.card);
      d.cardIds = d.cardIds.includes(cid) ? d.cardIds.filter((x) => x !== cid) : [...d.cardIds, cid];
      b.classList.toggle("on");
      if (d.id) S.upsertDebrief(d); else saveDraft(d);
    });
    $("#copy-debrief").addEventListener("click", () => copy(P.debriefPrompt(collect())));

    function persist() {
      collect();
      const saved = S.upsertDebrief(d);
      if (!saved) { toast("儲存失敗，請先匯出備份"); return false; }
      clearDraft();
      return true;
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (persist()) {
        toast("已儲存");
        if (isNew) location.hash = "#/debrief/" + d.id;
      }
    });
    $("#to-practice").addEventListener("click", () => {
      if (!persist()) return;
      replaySource = d.id;
      location.hash = "#/practice";
    });
    const del = $("#del");
    if (del) del.addEventListener("click", () => {
      if (!confirm("確定刪除這筆覆盤？刪除後無法復原。")) return;
      S.deleteDebrief(d.id);
      location.hash = "#/debrief";
    });
  }

  // ---------- 練習 ----------
  const MODES = [
    { v: "observe", l: "觀摩示範", d: "AI 寫出一整段示範對話，關鍵處附上教練筆記。第一次練習從這裡開始。", end: "" },
    { v: "receive", l: "AI 傳福音給我", d: "AI 扮演有經驗的基督徒向你傳福音，你扮演對方。每句後面都有教練筆記說明用意。聊完輸入「結束示範」。", end: "結束示範" },
    { v: "practice", l: "我來傳", d: "AI 扮演對方，你練習怎麼聊。聊完輸入「結束練習」，AI 會依照指南給你回饋。", end: "結束練習" },
  ];
  const DIFFICULTY = (stageId) => (stageId <= 1 ? "困難" : stageId === 2 ? "中等" : "入門");
  let practiceMode = null;
  let whoStarts = "me";
  let practicing = null; // { name, door }

  function renderPractice() {
    const real = S.debriefs.filter((d) => d.kind !== "practice");
    const pre = replaySource || (real[0] && real[0].id) || "";
    if (replaySource) practiceMode = "practice";
    replaySource = null;
    if (!practiceMode) practiceMode = S.debriefs.some((d) => d.kind === "practice") ? "practice" : "observe";
    const mode = MODES.find((m) => m.v === practiceMode);
    const personas = [...C.personas].sort((a, b) => b.stage - a.stage);
    const replayText = {
      observe: "看 AI 怎麼跟一個很像他的人聊，特別是你上次卡住的地方。",
      receive: "你最了解他，由你扮演他，看 AI 怎麼接住他的話。",
      practice: "AI 會扮演一個跟他很像的人，從你上次卡住的地方附近開始，讓你重來一次。",
    }[practiceMode];

    main.innerHTML = `
      <header class="page-head">
        <h1>練習</h1>
        <p class="lead">先看別人怎麼做，再自己上場。建議順序：觀摩示範 → AI 傳福音給我 → 我來傳，角色從「入門」開始。</p>
      </header>
      <section class="panel">
        <div class="field"><span>練習方式</span>${seg("mode", MODES.map((m) => ({ v: m.v, l: m.l })), practiceMode)}</div>
        <p class="small">${esc(mode.d)}</p>
        ${practiceMode === "observe" ? "" : `<div class="field"><span>誰先開口？</span>${seg("who", [{ v: "me", l: "我先開口" }, { v: "them", l: "對方先開口" }], whoStarts)}</div>`}
      </section>

      <section class="panel accent">
        <h3>用你的實戰紀錄</h3>
        ${real.length ? `
          <label class="field"><span>選一筆覆盤紀錄</span>
            <select id="replay-sel">${real.map((d) => `<option value="${esc(d.id)}" ${d.id === pre ? "selected" : ""}>${esc(d.date || "")}　${esc(d.nickname || "（未命名）")}${d.stuck ? "：" + esc(d.stuck.slice(0, 20)) : ""}</option>`).join("")}</select></label>
          <p class="small">${esc(replayText)}<strong>複製前請確認紀錄已匿名。</strong></p>
          <div class="actions left"><button class="btn primary" id="copy-replay">複製指令</button></div>`
        : `<p class="small muted">還沒有覆盤紀錄。先去聊一次，回來覆盤後就可以用在這裡。</p>`}
      </section>

      <section class="panel">
        <h3>預設角色</h3>
        <div class="personas">${personas.map((p) => `
          <article class="persona">
            <header><strong>${esc(p.name)}</strong>，${p.age} 歲，${esc(p.job)} ${doorTag(p.door)} <span class="tag">${esc(stage(p.stage).name)}</span> <span class="tag level-${p.stage <= 1 ? 3 : p.stage === 2 ? 2 : 1}">${DIFFICULTY(p.stage)}</span></header>
            <p class="small">${esc(p.scene)}</p>
            ${practiceMode === "receive" ? `<details class="small"><summary>你要扮演的人</summary><p>${esc(p.background)}</p><p><strong>內心真正的需要：</strong>${esc(p.hidden)}</p></details>` : ""}
            <button class="btn ghost small" data-persona="${p.id}">複製指令</button>
          </article>`).join("")}
          ${practiceMode === "receive" ? `
          <article class="persona">
            <header><strong>自由發揮</strong> <span class="tag">自己設定</span></header>
            <p class="small">你自己決定要扮演什麼樣的人、問什麼問題，例如你聽過最難回答的那個問題。</p>
            <button class="btn ghost small" data-persona="self">複製指令</button>
          </article>` : ""}</div>
      </section>
      ${AI_LINKS}
      <section class="panel mine" id="practice-log" ${practicing ? "" : "hidden"}>
        <h3>練完了？記下這次的功課</h3>
        <p class="small muted" id="practice-who"></p>
        <label class="field"><span>這次學到的一個功課</span><input id="pl-lesson"></label>
        <label class="field"><span>AI 回饋中有用的部分 <span class="badge">AI 建議</span></span><textarea id="pl-notes" rows="4"></textarea></label>
        <div class="actions left"><button class="btn primary" id="pl-save">存到筆記</button></div>
      </section>`;

    $(".seg[data-seg=mode]", main).addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.dataset.v === practiceMode) return;
      practiceMode = b.dataset.v;
      renderPractice();
    });
    const whoSeg = $(".seg[data-seg=who]", main);
    if (whoSeg) whoSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      whoStarts = b.dataset.v;
      $$("button", whoSeg).forEach((x) => x.classList.toggle("on", x.dataset.v === whoStarts));
    });

    function showLog(name, doorId) {
      practicing = { name: `${name}・${mode.l}`, door: doorId };
      $("#practice-log").hidden = false;
      $("#practice-who").textContent = `練習對象：${practicing.name}` + (mode.end ? `。聊完記得輸入「${mode.end}」拿回饋。` : "");
    }

    function run(source, name, doorId) {
      copy(P.practiceModePrompt(practiceMode, source, whoStarts));
      showLog(name, doorId);
    }

    const rb = $("#copy-replay");
    if (rb) rb.addEventListener("click", () => {
      const d = S.getDebrief($("#replay-sel").value);
      if (d) run({ type: "debrief", d }, d.nickname || "（未命名）", d.door);
    });
    $(".personas", main).addEventListener("click", (e) => {
      const b = e.target.closest("[data-persona]");
      if (!b) return;
      if (b.dataset.persona === "self") return run({ type: "self" }, "自由發揮", "");
      const p = C.personas.find((x) => x.id === b.dataset.persona);
      run({ type: "persona", p }, p.name, p.door);
    });
    if (practicing) showLog(practicing.name, practicing.door);
    $("#pl-save").addEventListener("click", () => {
      const lesson = $("#pl-lesson").value.trim();
      const notes = $("#pl-notes").value.trim();
      if (!lesson && !notes) { toast("先寫一句功課再存"); return; }
      S.upsertDebrief({ ...blankDebrief(), kind: "practice", nickname: practicing.name, door: practicing.door || "", lesson, aiNotes: notes, exchanges: [] });
      practicing = null;
      toast("已存到筆記");
      renderPractice();
    });
  }

  // ---------- 筆記 ----------
  let lessonFilter = "";

  function renderNotes() {
    const real = S.debriefs.filter((d) => d.kind !== "practice");
    const practice = S.debriefs.filter((d) => d.kind === "practice");
    const people = new Map();
    real.forEach((d) => {
      const k = (d.nickname || "（未命名）").trim();
      if (!people.has(k)) people.set(k, []);
      people.get(k).push(d);
    });
    const lessons = S.debriefs.filter((d) => d.lesson && (!lessonFilter || d.door === lessonFilter));
    const open = S.prayers.filter((p) => !p.answered);
    const answered = S.prayers.filter((p) => p.answered);

    main.innerHTML = `
      <header class="page-head">
        <h1>我的筆記</h1>
        <p class="lead">你自己的傳福音經驗庫。資料只存在這台裝置，記得定期匯出備份。</p>
      </header>
      <div class="stats">
        <div><b>${real.length}</b><span>次實戰</span></div>
        <div><b>${practice.length}</b><span>次練習</span></div>
        <div><b>${people.size}</b><span>位朋友</span></div>
        <div><b>${open.length}</b><span>項代禱中</span></div>
      </div>

      <section class="panel mine">
        <h3>學到的功課</h3>
        <div class="seg small" id="lf">${[{ v: "", l: "全部" }, ...C.doors.map((d) => ({ v: d.id, l: d.short }))].map((o) => `<button data-v="${o.v}" class="${lessonFilter === o.v ? "on" : ""}">${esc(o.l)}</button>`).join("")}</div>
        ${lessons.length ? `<ul class="lessons">${lessons.map((l) => `<li>${esc(l.lesson)}<span class="small muted"> — ${esc(l.nickname || "")}${l.kind === "practice" ? "（練習）" : ""} ${doorTag(l.door)}</span></li>`).join("")}</ul>`
          : `<p class="small muted">還沒有。</p>`}
      </section>

      <section class="panel">
        <h3>我在關心的人</h3>
        ${people.size ? `<ul class="people">${[...people.entries()].map(([name, ds]) => {
          const sorted = [...ds].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
          const steps = [sorted[0].stageBefore, ...sorted.map((x) => x.stageAfter || x.stageBefore)];
          const path = steps.map((s) => (stage(s) || {}).name || "?").filter((n, i, a) => i === 0 || n !== a[i - 1]).join(" → ");
          const last = sorted[sorted.length - 1];
          return `<li><div><strong>${esc(name)}</strong> ${doorTag(last.door)} <span class="small muted">${ds.length} 次・最近 ${esc(last.date || "")}</span></div>
            <div class="small">階段：${esc(path)}</div>
            ${last.next ? `<div class="small">下次：${esc(last.next)}</div>` : ""}
            <div class="small">${sorted.map((x) => `<a href="#/debrief/${esc(x.id)}">${esc(x.date || "紀錄")}</a>`).join("・")}</div></li>`;
        }).join("")}</ul>` : `<p class="small muted">還沒有。</p>`}
      </section>

      <section class="panel">
        <h3>代禱清單</h3>
        <form id="pf" class="inline-form">
          <input name="person" placeholder="為誰" required>
          <input name="text" placeholder="代禱事項" required>
          <button class="btn ghost small">加入</button>
        </form>
        <ul class="prayers">${open.map(prayerRow).join("")}</ul>
        ${answered.length ? `<details><summary>已蒙應允（${answered.length}）</summary><ul class="prayers">${answered.map(prayerRow).join("")}</ul></details>` : ""}
      </section>

      <section class="panel">
        <h3>備份</h3>
        <p class="small">換手機、清除瀏覽器資料都會讓紀錄不見，建議每個月匯出一次。</p>
        <div class="actions left">
          <button class="btn ghost" id="export">匯出備份</button>
          <label class="btn ghost">匯入備份<input type="file" id="import" accept="application/json" hidden></label>
        </div>
      </section>`;

    $("#lf").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      lessonFilter = b.dataset.v;
      renderNotes();
    });
    $("#pf").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      S.addPrayer(fd.get("person"), fd.get("text"));
      renderNotes();
    });
    $$(".prayers", main).forEach((ul) => ul.addEventListener("change", (e) => {
      const id = e.target.dataset.prayer;
      if (id) { S.updatePrayer(id, { answered: e.target.checked, answeredAt: e.target.checked ? today() : null }); renderNotes(); }
    }));
    $$(".prayers", main).forEach((ul) => ul.addEventListener("click", (e) => {
      const id = e.target.dataset.delPrayer;
      if (id && confirm("刪除這項代禱？")) { S.deletePrayer(id); renderNotes(); }
    }));
    $("#export").addEventListener("click", () => {
      const blob = new Blob([S.exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `傳福音筆記備份-${today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $("#import").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const r = S.importJSON(await f.text());
        toast(`已匯入 ${r.debriefs} 筆紀錄、${r.prayers} 項代禱`);
        renderNotes();
      } catch (err) {
        toast("匯入失敗：" + err.message);
      }
    });
  }

  function prayerRow(p) {
    return `<li class="${p.answered ? "done" : ""}">
      <label><input type="checkbox" data-prayer="${esc(p.id)}" ${p.answered ? "checked" : ""}>
      <span><strong>${esc(p.person || "")}</strong>　${nl2br(p.text)}</span></label>
      <button class="x" data-del-prayer="${esc(p.id)}" aria-label="刪除">×</button></li>`;
  }

  // ---------- 指南 ----------
  function renderGuide() {
    main.innerHTML = `
      <header class="page-head">
        <h1>指南</h1>
        <p class="lead">這是核心內容，比 AI 建議更可靠。經文都是和合本原文。</p>
        <nav class="toc">
          <a href="#g-principles">核心精神</a><a href="#g-dims">三個維度</a><a href="#g-openers">開場白</a>
          <a href="#g-decode">問題解碼</a><a href="#g-cards">解碼卡</a><a href="#g-gospel">福音表述</a>
        </nav>
      </header>

      <section class="panel" id="g-principles">
        <h2>核心精神</h2>
        <blockquote>${(V["彼得前書 3:15"] || [{ t: "" }]).map((v) => esc(v.t)).join("")}<cite>${verseChip("彼得前書 3:15")}</cite></blockquote>
        <ol>${C.principles.map((p) => `<li><strong>${esc(p.t)}</strong>：${esc(p.d)}</li>`).join("")}</ol>
      </section>

      <section class="panel" id="g-dims">
        <h2>三個維度</h2>
        <h3>四扇門</h3>
        <div class="scroll"><table class="grid">
          <thead><tr><th>門</th><th>他在意的問題</th><th>線索</th><th>常見族群</th></tr></thead>
          <tbody>${C.doors.map((d) => `<tr><td>${esc(d.name)}</td><td>${esc(d.question)}</td><td>${esc(d.cues)}</td><td>${esc(d.groups)}</td></tr>`).join("")}</tbody>
        </table></div>
        <h3>五個階段</h3>
        <ol class="stages">${C.stages.map((s) => `<li><strong>${esc(s.name)}</strong>：${esc(s.d)}<br><span class="small">目標：${esc(s.goal)}</span></li>`).join("")}</ol>
        <h3>關係深度</h3>
        <div class="scroll"><table class="grid">
          <thead><tr><th>關係</th><th>適合的方式</th><th>要注意</th></tr></thead>
          <tbody>${C.relations.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.how)}</td><td>${esc(r.watch)}</td></tr>`).join("")}</tbody>
        </table></div>
      </section>

      <section class="panel" id="g-openers">
        <h2>開場白庫</h2>
        ${C.doors.map((d) => `
          <h3>${esc(d.name)} <span class="small muted">${esc(d.groups)}</span></h3>
          <ul class="openers">${d.openers.map((o) => `<li>「${esc(o)}」</li>`).join("")}</ul>
          <ol class="flow">${d.extend.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
          <p class="caution"><strong>注意：</strong>${esc(d.caution)}</p>`).join("")}
      </section>

      <section class="panel" id="g-decode">
        <h2>問題解碼法</h2>
        <div class="scroll"><table class="grid">
          <thead><tr><th>類型</th><th>他真正在問</th><th>分辨線索</th><th>回應策略</th></tr></thead>
          <tbody>${C.decodeTypes.map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.asking)}</td><td>${esc(t.cues)}</td><td>${esc(t.strategy)}</td></tr>`).join("")}</tbody>
        </table></div>
        <h3>先問再答：三個萬用反問</h3>
        <ol>${C.probes.map((p) => `<li>「${esc(p.q)}」<br><span class="small muted">${esc(p.why)}</span></li>`).join("")}</ol>
        <h3>回答的三步驟</h3>
        <ol>${C.answerSteps.map((s) => `<li><strong>${esc(s.t)}</strong>：${esc(s.d)}</li>`).join("")}</ol>
      </section>

      <section class="panel" id="g-cards">
        <h2>問題解碼卡</h2>
        <input type="search" id="card-q" placeholder="搜尋：苦難、科學、祭祖…">
        <ul class="card-list" id="card-list"></ul>
      </section>

      <section class="panel" id="g-gospel">
        <h2>福音核心表述</h2>
        <h3>四個重點</h3>
        <ol>${C.gospel.points.map((p) => `<li><strong>${esc(p.t)}</strong>：${esc(p.d)} ${p.verses.map(verseChip).join(" ")}</li>`).join("")}</ol>
        <p>${esc(C.gospel.bridge)}</p>
        <h3>3 分鐘個人見證</h3>
        <ol>${C.gospel.testimony.map((p) => `<li><strong>${esc(p.t)}</strong>：${esc(p.d)}</li>`).join("")}</ol>
        <p class="small">${esc(C.gospel.testimonyTip)}</p>
        <h3>為對方禱告</h3>
        <p>${esc(C.gospel.prayFor)}</p>
        <h3>決志禱告範例</h3>
        <p class="small">先問：「你願意現在接受耶穌嗎？」對方同意後，請他跟著你一句一句唸：</p>
        <blockquote>${esc(C.gospel.salvationPrayer)}</blockquote>
        <h3>決志之後</h3>
        <ul>${C.gospel.followUp.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </section>`;

    const list = $("#card-list");
    const draw = (q) => {
      const items = C.cards.filter((c) => !q || [c.q, c.meanings, c.probe, ...c.responses.map((r) => r.text)].join(" ").includes(q));
      list.innerHTML = items.map((c) => `<li><a href="#/card/${c.id}"><span class="num">${c.id}</span>${esc(c.q)}${c.review ? ' <span class="badge warn">待牧者審閱</span>' : ""}</a></li>`).join("") || `<li class="muted small">找不到，試試別的關鍵字。</li>`;
    };
    draw("");
    $("#card-q").addEventListener("input", (e) => draw(e.target.value.trim()));
    $$(".toc a", main).forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById(a.getAttribute("href").slice(1)).scrollIntoView({ behavior: "smooth" });
    }));
  }

  function renderCard(id) {
    const c = card(id);
    if (!c) { main.innerHTML = "<p>找不到這張卡。</p>"; return; }
    main.innerHTML = `
      <header class="page-head">
        <a class="back" href="javascript:history.back()">← 返回</a>
        <p class="small muted">解碼卡 ${c.id} ${c.doors.map(doorTag).join(" ")}</p>
        <h1 class="q">「${esc(c.q)}」</h1>
        ${c.review ? `<p class="badge warn">這張卡較敏感，建議請牧者或小組長審閱</p>` : ""}
      </header>
      <section class="panel">
        <h3>可能的含義</h3><p>${esc(c.meanings)}</p>
        <h3>先問一句來分辨</h3><p class="probe">「${esc(c.probe)}」</p>
      </section>
      ${c.responses.map((r) => `<section class="panel accent"><h3>${esc(r.label)}</h3><p>${esc(r.text)}</p></section>`).join("")}
      <section class="panel">
        <h3>相關經文</h3><div class="chips">${c.verses.map(verseChip).join("")}</div>
        <h3>避免</h3><p class="caution">${esc(c.avoid)}</p>
      </section>`;
  }

  // ---------- 路由 ----------
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const [page, arg] = h.split("/");
    $$(".tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.page === (page === "card" ? "guide" : page || "prepare")));
    window.scrollTo(0, 0);
    switch (page) {
      case "debrief": return arg ? renderDebriefForm(arg) : renderDebriefList();
      case "practice": return renderPractice();
      case "notes": return renderNotes();
      case "guide": return renderGuide();
      case "card": return renderCard(arg);
      default: return renderPrepare();
    }
  }

  document.addEventListener("click", (e) => {
    const v = e.target.closest("[data-verse]");
    if (v) { e.preventDefault(); openVerse(v.dataset.verse); }
  });
  $("#verse-close").addEventListener("click", () => $("#verse-dialog").close());
  $("#verse-dialog").addEventListener("click", (e) => { if (e.target.id === "verse-dialog") e.target.close(); });
  window.addEventListener("hashchange", route);
  route();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();

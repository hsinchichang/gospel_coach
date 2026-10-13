// 產生貼到 Claude / ChatGPT 的指令。AI 的回覆在 app 裡一律視為「建議」，不是核心內容。
(function () {
  const C = window.CONTENT;
  const doorName = (id) => (C.doors.find((d) => d.id === id) || {}).name || "不確定";
  const stageName = (id) => {
    const s = C.stages.find((x) => x.id === Number(id));
    return s ? `${s.id}. ${s.name}` : "不確定";
  };
  const relationName = (id) => (C.relations.find((r) => r.id === id) || {}).name || "未填";

  const FRAMEWORK = [
    "【我使用的框架】",
    "四扇門（對方主要在意的問題）：" + C.doors.map((d) => `${d.name}（${d.question}）`).join("；"),
    "五個階段：" + C.stages.map((s) => `${s.id}.${s.name}`).join(" → "),
    "問題背後的四種類型：" + C.decodeTypes.map((t) => `${t.name}（${t.asking}）`).join("；"),
    "原則：先禱告再開口、先聽再說、先問再答、關係比輸贏重要、誠實說「我不知道」。",
  ].join("\n");

  const TRUTH_RULES = [
    "【神學與經文】",
    "- 請以福音派正統信仰判斷（例如台灣靈糧堂、台北真理堂、福氣教會的立場）。",
    "- 引用經文只用和合本，並標明書卷章節。不確定的經文請直接說不確定，不要自己編造或憑印象改寫。",
    "- 你的分析只是建議，我會再跟牧者或屬靈長輩確認。",
  ].join("\n");

  function cardBrief(card) {
    return [
      `・解碼卡 ${card.id}「${card.q}」`,
      `  可能含義：${card.meanings}`,
      `  分辨問句：${card.probe}`,
      ...card.responses.map((r) => `  ${r.label}：${r.text}`),
      `  避免：${card.avoid}`,
    ].join("\n");
  }

  function debriefPrompt(d) {
    const lines = [];
    lines.push("我是一位基督徒，正在學習如何更好地跟人聊天、建立關係並傳福音。以下是我剛剛一次真實對話的覆盤紀錄，請以有經驗、溫暖但誠實的福音對話教練身分幫我分析。");
    lines.push("");
    lines.push(FRAMEWORK);
    lines.push("");
    lines.push("【對話紀錄】");
    lines.push(`對象：${d.nickname || "（未填）"}　關係：${relationName(d.relation)}`);
    lines.push(`我判斷他的門：${doorName(d.door)}`);
    lines.push(`對話前階段：${stageName(d.stageBefore)}　對話後階段：${stageName(d.stageAfter)}`);
    if (d.scene) lines.push(`場合：${d.scene}`);
    if (d.opener) lines.push(`我怎麼開頭：${d.opener}`);
    const ex = (d.exchanges || []).filter((e) => e.them || e.me);
    if (ex.length) {
      lines.push("對話過程：");
      ex.forEach((e, i) => {
        if (e.them) lines.push(`  ${i + 1}. 他說：${e.them}`);
        if (e.me) lines.push(`     我回：${e.me}`);
      });
    }
    if (d.outcome) lines.push(`結果／他最後的反應：${d.outcome}`);
    if (d.stuck) lines.push(`我覺得卡住的地方：${d.stuck}`);
    if (d.surprise) lines.push(`出乎我意料的地方：${d.surprise}`);
    const checks = C.checklist.map((c) => `${d.checks && d.checks[c.id] ? "✓" : "✗"} ${c.t}`);
    lines.push("我的自我檢核：" + checks.join("；"));
    const cards = (d.cardIds || []).map((id) => C.cards.find((c) => c.id === id)).filter(Boolean);
    if (cards.length) {
      lines.push("");
      lines.push("【我覺得相關的解碼卡（我的核心教材，請以此為基礎）】");
      cards.forEach((c) => lines.push(cardBrief(c)));
    }
    lines.push("");
    lines.push("【請幫我分析】");
    lines.push("1. 他說的話或問的問題，背後最可能是哪一型？依據是什麼？還有哪些可能？");
    lines.push("2. 我做得好的地方（具體指出是哪一句或哪個時刻）。");
    lines.push("3. 可以更好的地方：在 1 到 3 個關鍵時刻，我可以怎麼說？請給口語、自然、台灣用語的說法範例。");
    lines.push("4. 他目前大概在哪個階段？下一次可以怎麼接續？給我 1 到 3 個具體的下一步。");
    lines.push("5. 可以為他禱告的方向。");
    lines.push("6. 如果我講到信仰內容，有沒有不準確或容易被誤解的地方？");
    lines.push("7. 最後用一句話總結：這次我最該記住的一個功課。");
    lines.push("");
    lines.push(TRUTH_RULES);
    return lines.join("\n");
  }

  function roleplayRules(roleDesc) {
    return [
      "我正在練習傳福音的對話技巧。請你扮演以下角色，跟我進行一段像真人聊天的對話練習。",
      "",
      roleDesc,
      "",
      "【扮演規則】",
      "1. 完全用這個角色的口吻說話：口語、台灣用語，每次回覆 1 到 4 句，像真人聊天，不要長篇大論。",
      "2. 不要太容易被說服。如果我說教、講太多、用教會術語、沒有先聽你說，你就變得冷淡、敷衍或防衛。如果我真誠傾聽、問好問題，你就慢慢打開。",
      "3. 隱藏設定只有在我問對問題、讓你覺得安全的時候才會慢慢說出來，不要主動全部講出來。",
      "4. 不要跳出角色、不要給我提示，直到我輸入「結束練習」。",
      "",
      "【結束後的回饋】",
      "當我輸入「結束練習」，請跳出角色，以福音對話教練的身分給我回饋：",
      "- 我有沒有先聽、先問再答？我們說話的比例大約多少？",
      "- 你的問題背後是哪一型（知識型、情感型、防衛型、代價型）？我有沒有分辨出來？",
      "- 我說得好的 2 到 3 個地方，和可以更好的 2 到 3 個地方，附上更好的說法範例。",
      "- 你現在大概在哪個階段（抗拒、冷漠、好奇、尋求、準備回應）？這次有沒有往前一步？",
      "- 我講的信仰內容有沒有不準確或容易誤解的地方？",
      "- 用一句話總結這次最該記住的功課。",
      "",
      TRUTH_RULES,
    ].join("\n");
  }

  // 對象的描述：預設角色、覆盤紀錄、或使用者自己發揮
  function personaInfo(p) {
    return [
      `名字：${p.name}，${p.age} 歲，${p.job}`,
      `背景：${p.background}`,
      `可能會說的話：${p.lines.map((l) => `「${l}」`).join("")}`,
      `主要是「${doorName(p.door)}」，目前在「${stageName(p.stage)}」階段`,
      `內心真正的需要（表面上不會直接說）：${p.hidden}`,
      `場景：${p.scene}`,
    ].join("\n");
  }

  function debriefInfo(d) {
    const ex = (d.exchanges || []).filter((e) => e.them);
    return [
      "根據我一次真實對話的對象改編（已匿名）。",
      `關係：他是我的${relationName(d.relation)}`,
      `主要是「${doorName(d.door)}」，目前大概在「${stageName(d.stageAfter || d.stageBefore)}」階段`,
      d.scene ? `當時的場合：${d.scene}` : "",
      ex.length ? "他當時說過的話：" + ex.map((e) => `「${e.them}」`).join("") : "",
      d.outcome ? `當時的結果：${d.outcome}` : "",
      d.stuck ? `我當時卡在：${d.stuck}` : "",
      "紀錄沒寫到的內心想法，請根據以上資訊合理推想一個真實的需要。",
    ].filter(Boolean).join("\n");
  }

  const SELF_INFO = "我會自己扮演一位還沒信主的人，背景和疑問由我在對話中自由發揮。請從我說的話去認識我。";

  function info(source) {
    if (source.type === "persona") return personaInfo(source.p);
    if (source.type === "debrief") return debriefInfo(source.d);
    return SELF_INFO;
  }

  // 模式一：我來傳（AI 扮演對方）
  function practicePrompt(source, whoStarts) {
    const desc = ["【角色設定】", info(source), "", "內心真正的需要不要直接說出來，讓我透過提問發現。"].join("\n");
    const focus = source.type === "debrief" ? "\n\n【這次練習的重點】\n請從我上次卡住的時刻附近開始，用類似的話題和態度，讓我重新練習。" : "";
    return roleplayRules(desc) + focus + "\n\n" + startLine(whoStarts);
  }

  const EVANGELIST = "一位成熟、溫暖、很會聊天的基督徒（像教會裡有經驗的小組長），熟悉台灣文化，說話自然不說教";

  // 模式二：AI 傳福音給我（我扮演對方）
  function receivePrompt(source, whoStarts) {
    return [
      `我正在學習傳福音，想先看看有經驗的人怎麼做。請你扮演${EVANGELIST}，向我傳福音。我會扮演下面這個人：`,
      "",
      "【我扮演的人】",
      info(source),
      "",
      FRAMEWORK,
      "",
      "【示範規則】",
      "1. 依照上面的框架和原則跟我聊：先建立關係、先聽、遇到問題先問再答、分辨我問題背後的類型、不急著講完。",
      "2. 每次回覆用口語、台灣用語，1 到 4 句，像真人聊天。",
      "3. 每次回覆的最後，另起一行用（教練筆記：……）簡短說明你這句話的用意：用了哪個原則、你判斷我是哪一型、你想往哪裡帶。一行就好。",
      "4. 如果我的回應讓福音講不下去，不要硬推，示範怎麼保住關係、留下下次的話題。",
      "5. 如果聊到合適的時機，示範怎麼清楚講福音、怎麼邀請決志或提議為我禱告。",
      "",
      "【結束後的整理】",
      "當我輸入「結束示範」，請跳出角色，整理：",
      "- 這次對話的轉折點，你在每個轉折點怎麼判斷、怎麼回應。",
      "- 值得我直接學起來的 3 到 5 句話。",
      "- 如果對方是另一種類型（例如理性型換成經驗型），你會怎麼改變做法。",
      "",
      TRUTH_RULES,
      "",
      whoStarts === "them" ? "現在請你先開口，開始對話。" : "我會先開口，請等我的第一句話。請先只回覆「好，開始」。",
    ].join("\n");
  }

  // 模式三：觀摩（AI 寫出整段對話並解說）
  function observePrompt(source) {
    return [
      `我正在學習傳福音。請你寫一段示範對話：由${EVANGELIST}，跟下面這個人聊天。`,
      "",
      "【對象】",
      info(source),
      "",
      FRAMEWORK,
      "",
      "【寫作要求】",
      "1. 對話大約 12 到 20 句來回，口語、台灣用語，真實自然，對方不要太快被說服。",
      "2. 示範框架的原則：先建立關係、先聽、先問再答、分辨對方問題背後的類型、在對的時機分享見證或福音。",
      "3. 在關鍵的回應後面，用（教練筆記：……）說明這句話的用意和判斷。",
      "4. 結局要合乎現實：可能是對方往前一步、約好下次再聊，不一定要當場決志。",
      "",
      "【對話之後】",
      "- 列出這段對話的 3 個轉折點，以及每個轉折點如果處理不好會怎樣。",
      "- 列出值得直接學起來的 3 到 5 句話。",
      "- 給我一個練習建議：我接下來可以怎麼自己練這個情境。",
      "",
      TRUTH_RULES,
    ].join("\n");
  }

  function startLine(whoStarts) {
    return whoStarts === "them"
      ? "現在請以角色的身分先開口，開始對話。"
      : "我會先開口，請等我的第一句話。請先只回覆「好，開始」。";
  }

  function practiceModePrompt(mode, source, whoStarts) {
    if (mode === "observe") return observePrompt(source);
    if (mode === "receive") return receivePrompt(source, whoStarts);
    return practicePrompt(source, whoStarts);
  }

  // 福音講述練習：demo = AI 示範講一次；practice = 我來講，AI 扮演聽的人
  function talkOutline(talk, full) {
    return talk.segments
      .filter((s) => full || s.core)
      .map((s, i) => `${i + 1}. ${s.t}（約 ${s.min} 分鐘）：${s.say}${s.ask ? `\n   停下來問：「${s.ask}」` : ""}`)
      .join("\n");
  }

  function talkListener(talk) {
    const d = C.doors.find((x) => x.id === talk.door);
    return `一位還沒信主、主要是「${d.name}」的台灣人（在意的是「${d.question}」，常見的人像是${d.groups}）。請你自己設定他的名字、年紀、工作和一個具體的生活背景。`;
  }

  function talkPrompt(mode, talk, full) {
    const minutes = talk.segments.filter((s) => full || s.core).reduce((a, s) => a + s.min, 0);
    const outline = talkOutline(talk, full);
    if (mode === "demo") {
      return [
        `我正在學習用大約 ${Math.round(minutes)} 分鐘，向不同的人講清楚福音。請寫一段示範對話：由${EVANGELIST}，用「${talk.title}」這個講法，向下面這個人講福音。`,
        "",
        "【聽的人】",
        talkListener(talk),
        "",
        "【講述大綱（我的核心教材，請照這個順序和精神，但用自然的口語講，不要照念）】",
        outline,
        "",
        "【寫作要求】",
        "1. 對方在中途要自然地打斷、提問或質疑 2 到 4 次，就像真人一樣。示範怎麼先問再答、簡短回應、再回到主線。",
        "2. 每段講完都要停下來問對方，讓講述變成對話，而不是演講。",
        "3. 在關鍵處用（教練筆記：……）說明這句話的用意和判斷。",
        "4. 結局合乎現實：對方可能想再想想、有問題、或想信，示範對應的回應。",
        "",
        "【對話之後】",
        "- 用條列整理出這個講法最關鍵的 5 句話，讓我可以背起來。",
        "- 對方的每個提問屬於哪一型（知識型、情感型、防衛型、代價型），示範中是怎麼處理的。",
        "",
        TRUTH_RULES,
      ].join("\n");
    }
    return [
      `我正在練習用大約 ${Math.round(minutes)} 分鐘向人講清楚福音，這次用「${talk.title}」這個講法。請你扮演聽我講的人，跟我進行對話練習。`,
      "",
      "【你扮演的人】",
      talkListener(talk),
      "",
      "【我準備的講述大綱（供你評估我講得如何，不要提示我）】",
      outline,
      "",
      "【扮演規則】",
      "1. 用這個角色的口吻、台灣用語自然回應，每次 1 到 3 句。",
      "2. 在我講的過程中，像真人一樣打斷、提問或質疑 2 到 4 次，問題要符合這個人在意的事。如果我講太長、用教會術語、沒停下來問你，你就開始分心或敷衍。",
      "3. 不要太容易被說服，但如果我講得清楚、真誠，你可以慢慢有興趣。",
      "4. 不要跳出角色，直到我輸入「結束練習」。",
      "",
      "【結束後的回饋】",
      "當我輸入「結束練習」，請跳出角色，以福音對話教練的身分回饋：",
      "- 清楚度：福音的四個核心（神、人的罪、耶穌的死與復活、怎麼回應）有沒有講清楚？漏了哪個？",
      "- 長度與節奏：有沒有講太長、有沒有停下來問、有沒有變成演講？",
      "- 用語：有沒有對方聽不懂的教會術語？請改寫成口語。",
      "- 提問處理：你的每個提問我有沒有先問再答、回應後有沒有回到主線？",
      "- 神學準確性：有沒有不準確或容易誤解的地方？",
      "- 給我 3 句可以講得更好的範例。",
      "",
      TRUTH_RULES,
      "",
      "我會先開口，請先只回覆「好，開始」。",
    ].join("\n");
  }

  window.PROMPTS = { debriefPrompt, practiceModePrompt, talkPrompt, doorName, stageName, relationName };
})();

// 實戰紀錄只存在這台裝置的瀏覽器裡，不會上傳。用「匯出備份」定期存一份 JSON。
(function () {
  const KEY = "gospel_coach.v1";
  const empty = () => ({ debriefs: [], prayers: [] });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const data = JSON.parse(raw);
      return { ...empty(), ...data };
    } catch (e) {
      console.warn("讀取本機資料失敗", e);
      return empty();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn("儲存本機資料失敗", e);
      return false;
    }
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function upsertDebrief(d) {
    const now = new Date().toISOString();
    if (!d.id) {
      d.id = uid();
      d.createdAt = now;
      state.debriefs.unshift(d);
    } else {
      const i = state.debriefs.findIndex((x) => x.id === d.id);
      if (i >= 0) state.debriefs[i] = d;
      else state.debriefs.unshift(d);
    }
    d.updatedAt = now;
    syncPrayer(d);
    return save() ? d : null;
  }

  // 覆盤裡的代禱事項自動放進代禱清單
  function syncPrayer(d) {
    const existing = state.prayers.find((p) => p.debriefId === d.id);
    const text = (d.prayer || "").trim();
    if (!text) {
      if (existing && !existing.answered) state.prayers = state.prayers.filter((p) => p !== existing);
      return;
    }
    if (existing) {
      existing.text = text;
      existing.person = d.nickname;
    } else {
      state.prayers.unshift({ id: uid(), debriefId: d.id, person: d.nickname, text, createdAt: new Date().toISOString(), answered: false });
    }
  }

  function deleteDebrief(id) {
    state.debriefs = state.debriefs.filter((d) => d.id !== id);
    state.prayers = state.prayers.filter((p) => p.debriefId !== id || p.answered);
    save();
  }

  function addPrayer(person, text) {
    state.prayers.unshift({ id: uid(), person, text, createdAt: new Date().toISOString(), answered: false });
    save();
  }

  function updatePrayer(id, patch) {
    const p = state.prayers.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
    save();
  }

  function deletePrayer(id) {
    state.prayers = state.prayers.filter((p) => p.id !== id);
    save();
  }

  function exportJSON() {
    return JSON.stringify({ app: "gospel_coach", version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2);
  }

  function importJSON(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data.debriefs) || !Array.isArray(data.prayers)) throw new Error("檔案格式不對");
    const byId = new Map(state.debriefs.map((d) => [d.id, d]));
    data.debriefs.forEach((d) => byId.set(d.id, d));
    const prayersById = new Map(state.prayers.map((p) => [p.id, p]));
    data.prayers.forEach((p) => prayersById.set(p.id, p));
    state.debriefs = [...byId.values()].sort((a, b) => (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || ""));
    state.prayers = [...prayersById.values()];
    save();
    return { debriefs: data.debriefs.length, prayers: data.prayers.length };
  }

  window.STORE = {
    get debriefs() { return state.debriefs; },
    get prayers() { return state.prayers; },
    getDebrief: (id) => state.debriefs.find((d) => d.id === id),
    upsertDebrief, deleteDebrief, addPrayer, updatePrayer, deletePrayer, exportJSON, importJSON,
  };
})();

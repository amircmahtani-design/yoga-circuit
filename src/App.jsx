import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Trash2, Play, Pause, ChevronLeft, ChevronRight, X, RotateCcw,
  ArrowUp, ArrowDown, Volume2, VolumeX, Upload, Pencil, Check, RotateCw,
  Flower2, LayoutGrid, ListChecks, Clock, Wind, Flame, Minus, Megaphone, Settings2, Sparkles, Bookmark
} from "lucide-react";
import { GROUPS, DECK } from "./deck.js";

const BASE = import.meta.env.BASE_URL;
const imgUrl = (p) => BASE + p;


/* ---------- palette ---------- */
const C = {
  bg: "#ece2d1", bg2: "#e3d6c1", card: "#fbf6ec",
  ink: "#2c2a27", sub: "#8a8276", faint: "#aaa294", line: "#ddd1bd",
  coral: "#cf6a4c", coralDeep: "#b1543a", copper: "#bd8a5e",
  night1: "#1e272b", night2: "#0f1417",
};
const SEED_VERSION = "deck-numbered-v2";
const MINE = { key: "mine", name: "Your additions", hex: "#b9ad99" };
const groupMeta = (key) => GROUPS.find((g) => g.key === key) || MINE;

/* ---------- storage ---------- */
const store = {
  async get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  async set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  async del(k) { try { localStorage.removeItem(k); } catch {} },
};

/* ---------- helpers ---------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function fmt(t) { t = Math.max(0, Math.round(t)); const m = Math.floor(t / 60), s = t % 60; return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`; }
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function fileToURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
function canvasToCard(src, max = 1000, q = 0.85) {
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  let w = sw, h = sh;
  if (Math.max(w, h) > max) { const r = max / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r); }
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high"; ctx.drawImage(src, 0, 0, w, h);
  return cv.toDataURL("image/jpeg", q);
}

const STYLE = `
.yc{font-family:'Plus Jakarta Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.cz{font-family:'Cinzel',Georgia,serif}
.no-sb::-webkit-scrollbar{display:none}.no-sb{scrollbar-width:none}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.fadeUp{animation:fadeUp .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
.pop{animation:pop .35s cubic-bezier(.2,.7,.2,1) both}
@keyframes aura{0%{transform:translate(-8%,-6%) scale(1)}50%{transform:translate(8%,6%) scale(1.2)}100%{transform:translate(-8%,-6%) scale(1)}}
.aura{animation:aura 16s ease-in-out infinite}
.press{transition:transform .12s ease}.press:active{transform:scale(.95)}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`;
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function bestVoice(list) {
  if (!list || !list.length) return null;
  const pref = ["Siri", "Samantha", "Natural", "Enhanced", "Google", "Aaron", "Allison", "Karen", "Serena", "Daniel"];
  for (const pf of pref) { const v = list.find((x) => x.name && x.name.includes(pf)); if (v) return v; }
  return list.find((x) => x.localService) || list[0];
}

/* ================================================================= */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("build");
  const [library, setLibrary] = useState([]);
  const [circuit, setCircuit] = useState([]);
  const [holdDefault, setHoldDefault] = useState(30);
  const [restDur, setRestDur] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceName, setVoiceName] = useState(null);
  const [voices, setVoices] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState(null);
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genBase, setGenBase] = useState("balanced");
  const [genCount, setGenCount] = useState(8);
  const [genRest, setGenRest] = useState(0);
  const [saved, setSaved] = useState([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      const s = await store.get("yoga:settings");
      if (s) { setHoldDefault(s.holdDefault ?? 30); setRestDur(s.restDur ?? 0); setSoundOn(s.soundOn ?? true); setVoiceOn(s.voiceOn ?? false); setVoiceName(s.voiceName ?? null); }
      const idx = (await store.get("yoga:index")) || [];
      let cards = [];
      for (const id of idx) { const c = await store.get("yoga:card:" + id); if (c) cards.push(c); }
      const seedV = await store.get("yoga:seed");
      if (seedV !== SEED_VERSION) {
        cards = cards.filter((c) => !c.demo && !c.sample);
        const demo = DECK.map((d) => ({ id: uid(), name: d.name, src: imgUrl(d.img), group: d.group, intensity: d.lvl, num: d.num, demo: true }));
        cards = [...demo, ...cards];
        await store.set("yoga:seed", SEED_VERSION);
        await persistLibrary(cards);
      }
      let patched = false;
      cards = cards.map((c) => {
        if (c.intensity) return c;
        const hit = DECK.find((d) => typeof c.src === "string" && c.src.indexOf(d.img) !== -1);
        patched = true; return { ...c, intensity: hit ? hit.lvl : 2 };
      });
      if (patched) await persistLibrary(cards);
      let gsync = false;
      cards = cards.map((c) => {
        const d = DECK.find((dd) => typeof c.src === "string" && c.src.indexOf(dd.img) !== -1);
        if (d && c.group !== d.group) { gsync = true; return { ...c, group: d.group }; }
        return c;
      });
      if (gsync) await persistLibrary(cards);
      setLibrary(cards);
      const sc = await store.get("yoga:circuit"); if (sc) setCircuit(sc);
      const sv = await store.get("yoga:saved"); if (sv) setSaved(sv);
      setLoading(false);
    })();
  }, []);

  async function persistLibrary(cards) { await store.set("yoga:index", cards.map((c) => c.id)); for (const c of cards) await store.set("yoga:card:" + c.id, c); }
  useEffect(() => { if (!loading) store.set("yoga:settings", { holdDefault, restDur, soundOn, voiceOn, voiceName }); }, [holdDefault, restDur, soundOn, voiceOn, voiceName, loading]);
  useEffect(() => {
    const synth = window.speechSynthesis; if (!synth) return;
    const load = () => setVoices(synth.getVoices().filter((x) => /^en(-|_|$)/i.test(x.lang)));
    load(); try { synth.addEventListener("voiceschanged", load); } catch {}
    return () => { try { synth.removeEventListener("voiceschanged", load); } catch {} };
  }, []);
  function speakSample() {
    try { const synth = window.speechSynthesis; if (!synth) return; synth.cancel();
      const u = new SpeechSynthesisUtterance("Triangle Pose. Next, Eagle Pose.");
      const v = voices.find((x) => (x.voiceURI || x.name) === voiceName) || voices[0]; if (v) u.voice = v; u.rate = 0.97;
      synth.speak(u);
    } catch {}
  }
  useEffect(() => { if (!loading) store.set("yoga:circuit", circuit); }, [circuit, loading]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 1600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!loading) store.set("yoga:saved", saved); }, [saved, loading]);

  function addFiles(files) { const arr = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 90); if (arr.length) setQueue(arr); }
  function commitCards(cards) {
    if (!cards || !cards.length) return;
    const nc = cards.map((c) => ({ id: uid(), name: (c.name || "Pose").slice(0, 40), src: c.src, group: null }));
    const next = [...library, ...nc]; setLibrary(next); persistLibrary(next);
  }
  function deleteCard(id) { const next = library.filter((c) => c.id !== id); setLibrary(next); store.del("yoga:card:" + id); store.set("yoga:index", next.map((c) => c.id)); setCircuit((cc) => cc.filter((x) => x.cardId !== id)); }
  function rotateCard(id) { const next = library.map((c) => (c.id === id ? { ...c, rot: ((c.rot || 0) + 90) % 360 } : c)); setLibrary(next); const card = next.find((c) => c.id === id); if (card) store.set("yoga:card:" + id, card); }
  function saveName(id) { const next = library.map((c) => (c.id === id ? { ...c, name: editName.trim() || c.name } : c)); setLibrary(next); const card = next.find((c) => c.id === id); if (card) store.set("yoga:card:" + id, card); setEditId(null); }

  const addToCircuit = (cardId, duration = null) => setCircuit((c) => [...c, { iid: uid(), cardId, duration }]);
  const countOf = (id) => circuit.reduce((n, x) => n + (x.cardId === id ? 1 : 0), 0);
  function addOne(id) { const card = cardOf(id); setCircuit((c) => [...c, { iid: uid(), cardId: id, duration: holdDefault }]); if (card) setToast(card.name + " added"); }
  function removeOne(id) { setCircuit((c) => { for (let k = c.length - 1; k >= 0; k--) { if (c[k].cardId === id) { const n = [...c]; n.splice(k, 1); return n; } } return c; }); }
  function saveCircuit(name) {
    if (!circuit.length) return;
    const nm = (((name || "").trim()) || ("Workout " + (saved.length + 1))).slice(0, 40);
    const items = circuit.map((x) => { const c = cardOf(x.cardId); return { cardId: x.cardId, num: c ? c.num : null, name: c ? c.name : "", duration: x.duration }; });
    setSaved((s) => [{ id: uid(), name: nm, items, rest: restDur, createdAt: Date.now() }, ...s]);
    setToast("Saved");
  }
  function loadSaved(it) {
    const resolve = (x) => {
      let card = null;
      if (x.num != null) card = library.find((c) => c.num === x.num);
      if (!card && x.name) card = library.find((c) => c.name === x.name);
      if (!card) card = library.find((c) => c.id === x.cardId);
      return card;
    };
    const items = it.items.map((x) => { const card = resolve(x); return card ? { iid: uid(), cardId: card.id, duration: x.duration } : null; }).filter(Boolean);
    setCircuit(items);
    if (it.rest != null) setRestDur(it.rest);
    setSavedOpen(false); setTab("build"); setToast("Loaded " + it.name);
  }
  function deleteSaved(id) { setSaved((s) => s.filter((x) => x.id !== id)); }
  function setIntensity(id, lvl) { const next = library.map((c) => (c.id === id ? { ...c, intensity: lvl } : c)); setLibrary(next); const card = next.find((c) => c.id === id); if (card) store.set("yoga:card:" + id, card); }
  function openGen() { setGenRest(restDur); setGenOpen(true); }
  function doGenerate(mode) {
    const pool = library.filter((c) => c.src);
    if (!pool.length) { setGenOpen(false); return; }
    const w = (lvl) => { if (genBase === "gentle") return lvl === 1 ? 3 : lvl === 2 ? 1.5 : 0.4; if (genBase === "strong") return lvl === 3 ? 3 : lvl === 2 ? 1.5 : 0.4; if (genBase === "mixed") return 1; return lvl === 2 ? 3 : 1.6; };
    let items = pool.map((c) => ({ c, lvl: c.intensity || 2 }));
    const picked = []; const n = Math.min(genCount, items.length);
    for (let k = 0; k < n; k++) {
      const weights = items.map((x) => Math.max(0.01, w(x.lvl)));
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total, idx = 0;
      for (; idx < items.length; idx++) { r -= weights[idx]; if (r <= 0) break; }
      idx = Math.min(idx, items.length - 1);
      picked.push(items[idx]); items.splice(idx, 1);
    }
    picked.sort((a, b) => a.lvl - b.lvl);
    const up = [], down = []; picked.forEach((x, i) => (i % 2 === 0 ? up : down).push(x));
    const arc = [...up, ...down.reverse()];
    const holdFor = (lvl) => (lvl === 1 ? 45 : lvl === 3 ? 20 : 30);
    const circ = arc.map((x) => ({ iid: uid(), cardId: x.c.id, duration: holdFor(x.lvl) }));
    setRestDur(genRest);
    setCircuit((cur) => (mode === "add" ? [...cur, ...circ] : circ));
    setToast(mode === "add" ? "Added " + circ.length + " poses" : "Workout created");
    setGenOpen(false);
  }
  const removeFromCircuit = (iid) => setCircuit((c) => c.filter((x) => x.iid !== iid));
  const move = (iid, dir) => setCircuit((c) => { const i = c.findIndex((x) => x.iid === iid); const j = i + dir; if (i < 0 || j < 0 || j >= c.length) return c; const n = [...c]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const setItemDur = (iid, val) => setCircuit((c) => c.map((x) => (x.iid === iid ? { ...x, duration: val } : x)));
  const cardOf = (id) => library.find((c) => c.id === id);
  const totalTime = circuit.reduce((sum, it, i) => { const d = it.duration ?? holdDefault; return sum + d + (restDur > 0 && i < circuit.length - 1 ? restDur : 0); }, 0);
  const showStart = tab === "build" && circuit.length > 0 && !playing;

  const cardsIn = (key) => library.filter((c) => (key === "mine" ? !c.group : c.group === key));
  const presentGroups = [
    ...GROUPS.filter((g) => library.some((c) => c.group === g.key)),
    ...(library.some((c) => !c.group) ? [MINE] : []),
  ];

  if (loading) {
    return (<><style>{STYLE}</style>
      <div className="yc min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: C.bg, color: C.sub }}>
        <div className="rounded-2xl p-3 fadeUp" style={{ background: C.coral }}><Flower2 size={26} color="#fff" /></div>
        <div className="cz text-base tracking-wider" style={{ color: C.ink }}>YOGA CIRCUIT</div>
      </div></>);
  }
  const titleStyle = { letterSpacing: "0.06em" };
  const groupsToShow = filter ? presentGroups.filter((g) => g.key === filter) : presentGroups;

  return (
    <>
      <style>{STYLE}</style>
      <div className="yc min-h-screen relative" style={{ background: `radial-gradient(120% 80% at 50% -10%, ${C.bg} 0%, ${C.bg2} 100%)`, color: C.ink, paddingBottom: showStart ? 168 : 104 }}>
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", opacity: 0.05, backgroundImage: GRAIN, mixBlendMode: "multiply" }} />
        <div className="max-w-2xl lg:max-w-4xl mx-auto px-5 sm:px-8 relative">
          {/* header */}
          <header className="pt-8 pb-5 flex items-center justify-between fadeUp">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl flex items-center justify-center" style={{ width: 44, height: 44, background: C.coral, boxShadow: "0 6px 16px rgba(207,106,76,.32)" }}>
                <Flower2 size={24} color="#fff" strokeWidth={1.8} />
              </div>
              <div>
                <div className="cz text-lg leading-none" style={titleStyle}>YOGA CIRCUIT</div>
                <div className="text-xs mt-1.5" style={{ color: C.faint }}>{library.length} cards · {presentGroups.length} colours</div>
              </div>
            </div>
            {circuit.length > 0 && (
              <div className="text-right">
                <div className="cz text-lg leading-none" style={{ color: C.coralDeep }}>{fmt(totalTime)}</div>
                <div className="text-[11px] mt-1.5" style={{ color: C.faint }}>{circuit.length} poses</div>
              </div>
            )}
          </header>

          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

          {/* ---------------- CARDS ---------------- */}
          {tab === "cards" && (
            <section className="fadeUp">
              <div className="flex items-end justify-between mb-3">
                <h2 className="cz text-2xl" style={titleStyle}>Your deck</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowSettings((v) => !v)} aria-label="Practice settings" className="press h-10 w-10 rounded-full flex items-center justify-center" style={{ background: showSettings ? C.coral : "#f1ebdd", color: showSettings ? "#fff" : C.sub, border: `1px solid ${C.line}` }}><Settings2 size={17} /></button>
                  <button onClick={() => fileRef.current?.click()} className="press h-10 px-4 rounded-full flex items-center gap-1.5 text-sm font-semibold" style={{ background: C.coral, color: "#fff", boxShadow: "0 6px 16px rgba(207,106,76,.3)" }}>
                    <Plus size={17} /> Add
                  </button>
                </div>
              </div>

              {showSettings && (
                <div className="rounded-2xl p-5 mb-5 fadeUp" style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 4px 18px rgba(40,38,30,.07)" }}>
                  <Row icon={<Clock size={16} />} label="Hold each pose">
                    <Chips value={holdDefault} onChange={setHoldDefault} options={[[15, "15s"], [30, "30s"], [45, "45s"], [60, "1m"], [90, "1m30"]]} />
                  </Row>
                  <div className="h-px my-4" style={{ background: C.line }} />
                  <Row icon={<Wind size={16} />} label="Rest between poses">
                    <Chips value={restDur} onChange={setRestDur} options={[[0, "Off"], [5, "5s"], [10, "10s"], [15, "15s"], [30, "30s"]]} />
                  </Row>
                  <div className="h-px my-4" style={{ background: C.line }} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span style={{ color: C.coralDeep }}>{soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}</span>
                      <span className="text-sm font-medium" style={{ color: C.ink }}>Sound cue on change</span>
                    </div>
                    <button onClick={() => setSoundOn((s) => !s)} className="press rounded-full transition-colors" style={{ width: 50, height: 28, background: soundOn ? C.coral : "#d6cbb8", position: "relative" }}>
                      <span style={{ position: "absolute", top: 3, left: soundOn ? 25 : 3, width: 22, height: 22, borderRadius: 99, background: "#fff", transition: "left .18s ease", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                    </button>
                  </div>
                  <div className="h-px my-4" style={{ background: C.line }} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span style={{ color: C.coralDeep }}><Megaphone size={16} /></span>
                      <span className="text-sm font-medium" style={{ color: C.ink }}>Speak pose names</span>
                    </div>
                    <button onClick={() => { const nv = !voiceOn; if (nv && !voiceName) { const b = bestVoice(voices); if (b) setVoiceName(b.voiceURI || b.name); } setVoiceOn(nv); }} className="press rounded-full transition-colors" style={{ width: 50, height: 28, background: voiceOn ? C.coral : "#d6cbb8", position: "relative" }}>
                      <span style={{ position: "absolute", top: 3, left: voiceOn ? 25 : 3, width: 22, height: 22, borderRadius: 99, background: "#fff", transition: "left .18s ease", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                    </button>
                  </div>
                  {voiceOn && (
                    <div className="flex items-center gap-2 mt-3">
                      {voices.length > 0 ? (
                        <select value={voiceName || ""} onChange={(e) => setVoiceName(e.target.value)} className="flex-1 h-9 px-3 rounded-xl text-sm outline-none" style={{ background: "#f1ebdd", color: C.ink, border: `1px solid ${C.line}` }}>
                          {voices.map((v) => (<option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>{v.name}</option>))}
                        </select>
                      ) : (<span className="flex-1 text-xs" style={{ color: C.faint }}>Using your device's default voice.</span>)}
                      <button onClick={speakSample} className="press h-9 px-4 rounded-xl text-sm font-semibold" style={{ background: C.coral, color: "#fff" }}>Test</button>
                    </div>
                  )}
                </div>
              )}

              <FilterChips groups={presentGroups} value={filter} onChange={setFilter} cardsIn={cardsIn} />

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 mt-1">
                {(filter ? library.filter((c) => c.group === filter) : library.slice()).sort((a, b) => (a.num || 999) - (b.num || 999)).map((c, i) => (
                  <CardTile key={c.id} c={c} i={i} count={countOf(c.id)} addOne={addOne} removeOne={removeOne} editId={editId} editName={editName} setEditId={setEditId} setEditName={setEditName} saveName={saveName} deleteCard={deleteCard} rotateCard={rotateCard} setIntensity={setIntensity} />
                ))}
              </div>
            </section>
          )}

          {/* ---------------- BUILD ---------------- */}
          {tab === "build" && (
            <section className="fadeUp">
              <div className="flex items-center justify-between mb-4">
                <h2 className="cz text-2xl" style={titleStyle}>Your circuit</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSavedOpen(true)} aria-label="Saved workouts" className="press h-9 w-9 rounded-full flex items-center justify-center" style={{ background: "#f1ebdd", color: C.sub, border: `1px solid ${C.line}` }}><Bookmark size={16} /></button>
                  <button onClick={openGen} className="press h-9 px-3.5 rounded-full text-sm font-semibold flex items-center gap-1.5" style={{ background: C.coral, color: "#fff", boxShadow: "0 4px 12px rgba(207,106,76,.35)" }}><Sparkles size={15} /> Create</button>
                  {circuit.length > 0 && <button onClick={() => setCircuit([])} className="text-xs press" style={{ color: C.sub }}>Clear</button>}
                </div>
              </div>

              {circuit.length === 0 ? (
                <div className="rounded-2xl py-14 px-6 text-center" style={{ border: `1.5px dashed ${C.line}`, background: "rgba(255,255,255,.4)" }}>
                  <div className="rounded-2xl inline-flex p-3 mb-3" style={{ background: "rgba(207,106,76,.12)", color: C.coralDeep }}><ListChecks size={22} /></div>
                  <p className="text-sm mb-4" style={{ color: C.sub }}>Your circuit is empty.</p>
                  <div className="flex flex-col items-center gap-2.5">
                    <button onClick={openGen} className="press h-11 px-5 rounded-full inline-flex items-center gap-2 text-sm font-bold" style={{ background: C.coral, color: "#fff" }}><Sparkles size={16} /> Create a workout</button>
                    <button onClick={() => setTab("cards")} className="press h-11 px-5 rounded-full inline-flex items-center gap-2 text-sm font-semibold" style={{ background: "#eadfce", color: C.ink }}><LayoutGrid size={16} /> Add poses from Cards</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {circuit.map((it, i) => {
                    const card = cardOf(it.cardId); if (!card) return null;
                    const gm = groupMeta(card.group);
                    return (
                      <div key={it.iid} className="rounded-2xl p-2.5 flex items-center gap-3 pop" style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 2px 10px rgba(40,38,30,.05)" }}>
                        <span className="cz flex items-center justify-center rounded-full text-sm flex-shrink-0" style={{ width: 26, height: 26, background: "rgba(207,106,76,.13)", color: C.coralDeep }}>{i + 1}</span>
                        <div className="relative flex-shrink-0">
                          <img src={card.src} alt={card.name} className="w-11 h-14 object-cover rounded-lg" style={{ background: "#efe9dd", transform: card.rot ? `rotate(${card.rot}deg)` : undefined }} />
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2" style={{ background: gm.hex, borderColor: C.card }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="cz text-[13px] truncate" style={{ letterSpacing: "0.03em", color: C.ink }}>{card.num != null ? card.num + ". " : ""}{card.name}</div>
                          <DurationStepper value={it.duration} fallback={holdDefault} onChange={(v) => setItemDur(it.iid, v)} />
                        </div>
                        <div className="flex flex-col -my-1">
                          <button onClick={() => move(it.iid, -1)} disabled={i === 0} className="press p-1 disabled:opacity-25" style={{ color: C.sub }}><ArrowUp size={16} /></button>
                          <button onClick={() => move(it.iid, 1)} disabled={i === circuit.length - 1} className="press p-1 disabled:opacity-25" style={{ color: C.sub }}><ArrowDown size={16} /></button>
                        </div>
                        <button onClick={() => removeFromCircuit(it.iid)} className="press p-2" style={{ color: C.coralDeep }}><Trash2 size={16} /></button>
                      </div>
                    );
                  })}
                </div>
              )}

            </section>
          )}
        </div>

        {showStart && (
          <div className="fixed inset-x-0 px-5" style={{ bottom: 88 }}>
            <div className="max-w-2xl mx-auto">
              <button onClick={() => { try { const sy = window.speechSynthesis; if (voiceOn && sy) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; const v = voices.find((x) => (x.voiceURI || x.name) === voiceName); if (v) u.voice = v; sy.speak(u); } } catch {} setPlaying(true); }} className="press w-full h-14 rounded-full flex items-center justify-center gap-2.5 text-base font-bold fadeUp" style={{ background: C.ink, color: "#fff", boxShadow: "0 10px 30px rgba(32,37,29,.4)" }}>
                <Play size={20} fill="#fff" /> Begin practice <span className="font-medium opacity-70">· {fmt(totalTime)}</span>
              </button>
            </div>
          </div>
        )}

        <nav className="fixed inset-x-0 bottom-0 px-5 pb-4 pt-2" style={{ background: `linear-gradient(to top, ${C.bg2} 65%, transparent)` }}>
          <div className="max-w-2xl mx-auto rounded-full p-1.5 flex gap-1" style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 6px 24px rgba(40,38,30,.13)" }}>
            {[["build", "Circuit", <ListChecks size={18} key="b" />], ["cards", "Cards", <LayoutGrid size={18} key="a" />]].map(([k, label, icon]) => (
              <button key={k} onClick={() => setTab(k)} className="press flex-1 h-11 rounded-full flex items-center justify-center gap-2 text-sm font-semibold transition-colors" style={tab === k ? { background: C.coral, color: "#fff" } : { color: C.sub }}>
                {icon}{label}{k === "build" && circuit.length > 0 ? <span className="text-xs rounded-full px-1.5 py-0.5" style={{ background: tab === k ? "rgba(255,255,255,.22)" : "rgba(207,106,76,.13)", color: tab === k ? "#fff" : C.coralDeep }}>{circuit.length}</span> : null}
              </button>
            ))}
          </div>
        </nav>

        {playing && <Player circuit={circuit} library={library} holdDefault={holdDefault} restDur={restDur} soundOn={soundOn} voiceOn={voiceOn} voiceName={voiceName} onClose={() => setPlaying(false)} />}
        {/* one-tap add — no modal */}

        {toast && (<div className="fixed left-1/2 z-[80] px-4 py-2.5 rounded-full text-sm font-semibold fadeUp" style={{ bottom: 96, transform: "translateX(-50%)", background: C.ink, color: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,.3)" }}>{toast} ✓</div>)}

        {savedOpen && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" style={{ background: "rgba(20,22,15,.55)" }} onClick={() => setSavedOpen(false)}>
            <div className="w-full max-w-sm m-3 rounded-3xl p-5 fadeUp" style={{ background: C.card, boxShadow: "0 20px 60px rgba(0,0,0,.4)", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div className="cz text-xl mb-3" style={{ color: C.ink }}>Saved workouts</div>
              {circuit.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name this workout" className="flex-1 h-10 px-3 rounded-xl text-sm outline-none" style={{ background: "#f1ebdd", color: C.ink, border: `1px solid ${C.line}` }} />
                  <button onClick={() => { saveCircuit(saveName); setSaveName(""); }} className="press h-10 px-4 rounded-xl text-sm font-bold" style={{ background: C.coral, color: "#fff" }}>Save</button>
                </div>
              )}
              {saved.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: C.faint }}>No saved workouts yet. Build a circuit, then save it here.</p>
              ) : (
                <div className="space-y-2">
                  {saved.map((it) => {
                    const total = it.items.reduce((a, x) => a + (x.duration || holdDefault), 0);
                    return (
                      <div key={it.id} className="rounded-2xl p-3 flex items-center gap-3" style={{ background: "#f6f0e4", border: `1px solid ${C.line}` }}>
                        <div className="flex-1 min-w-0">
                          <div className="cz text-sm truncate" style={{ color: C.ink }}>{it.name}</div>
                          <div className="text-xs" style={{ color: C.sub }}>{it.items.length} poses · {fmt(total)}</div>
                        </div>
                        <button onClick={() => loadSaved(it)} className="press h-9 px-4 rounded-full text-xs font-bold" style={{ background: C.coral, color: "#fff" }}>Load</button>
                        <button onClick={() => deleteSaved(it.id)} aria-label="Delete" className="press p-2" style={{ color: C.coralDeep }}><Trash2 size={15} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={() => setSavedOpen(false)} className="press w-full h-11 mt-3 rounded-full font-semibold" style={{ background: "transparent", color: C.sub }}>Close</button>
            </div>
          </div>
        )}

        {genOpen && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" style={{ background: "rgba(20,22,15,.55)" }} onClick={() => setGenOpen(false)}>
            <div className="w-full max-w-sm m-3 rounded-3xl p-5 fadeUp" style={{ background: C.card, boxShadow: "0 20px 60px rgba(0,0,0,.4)" }} onClick={(e) => e.stopPropagation()}>
              <div className="cz text-xl" style={{ color: C.ink }}>Create a workout</div>
              <div className="text-xs mb-4" style={{ color: C.faint }}>Builds a circuit from your deck.</div>
              <div className="text-sm font-medium mb-2" style={{ color: C.ink }}>Intensity</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {[["gentle", "Gentle"], ["balanced", "Balanced"], ["strong", "Strong"], ["mixed", "Surprise"]].map(([v, l]) => (
                  <button key={v} onClick={() => setGenBase(v)} className="press h-10 px-4 rounded-full text-sm font-semibold" style={genBase === v ? { background: C.coral, color: "#fff" } : { background: "#f1ebdd", color: C.sub, border: `1px solid ${C.line}` }}>{l}</button>
                ))}
              </div>
              <div className="text-sm font-medium mb-2" style={{ color: C.ink }}>Number of poses</div>
              <div className="flex items-center justify-center gap-5 mb-4">
                <button onClick={() => setGenCount((n) => Math.max(3, n - 1))} className="press w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "#f1ebdd", color: C.ink }}><Minus size={18} /></button>
                <div className="cz text-3xl" style={{ color: C.ink, minWidth: 60, textAlign: "center" }}>{genCount}</div>
                <button onClick={() => setGenCount((n) => Math.min(30, n + 1))} className="press w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "#f1ebdd", color: C.ink }}><Plus size={18} /></button>
              </div>
              <div className="text-sm font-medium mb-2" style={{ color: C.ink }}>Rest between poses</div>
              <div className="flex flex-wrap gap-2 mb-5">
                {[[0, "Off"], [5, "5s"], [10, "10s"], [15, "15s"]].map(([v, l]) => (
                  <button key={v} onClick={() => setGenRest(v)} className="press h-10 px-4 rounded-full text-sm font-semibold" style={genRest === v ? { background: C.coral, color: "#fff" } : { background: "#f1ebdd", color: C.sub, border: `1px solid ${C.line}` }}>{l}</button>
                ))}
              </div>
              {circuit.length > 0 ? (
                <div className="flex gap-3">
                  <button onClick={() => doGenerate("add")} className="press flex-1 h-12 rounded-full font-semibold" style={{ background: "#eadfce", color: C.ink }}>Add to circuit</button>
                  <button onClick={() => doGenerate("replace")} className="press flex-1 h-12 rounded-full font-bold" style={{ background: C.coral, color: "#fff" }}>Replace</button>
                </div>
              ) : (
                <button onClick={() => doGenerate("replace")} className="press w-full h-12 rounded-full font-bold" style={{ background: C.coral, color: "#fff" }}>Create workout</button>
              )}
              <button onClick={() => setGenOpen(false)} className="press w-full h-11 mt-2 rounded-full font-semibold" style={{ background: "transparent", color: C.sub }}>Cancel</button>
            </div>
          </div>
        )}
        {queue.length > 0 && <CropEditor files={queue} onComplete={(cards) => { commitCards(cards); setQueue([]); }} onCancel={() => setQueue([])} />}
      </div>
    </>
  );
}

/* ---------- shared bits ---------- */
function FilterChips({ groups, value, onChange, cardsIn }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-sb -mx-5 px-5 mb-5 pb-1">
      <button onClick={() => onChange(null)} className="press h-9 px-3.5 rounded-full text-sm font-semibold flex-shrink-0" style={!value ? { background: C.ink, color: "#fff" } : { background: "#f1ebdd", color: C.sub, border: `1px solid ${C.line}` }}>All</button>
      {groups.map((g) => (
        <button key={g.key} onClick={() => onChange(g.key)} className="press h-9 px-3 rounded-full text-sm font-semibold flex items-center gap-1.5 flex-shrink-0" style={value === g.key ? { background: C.ink, color: "#fff" } : { background: "#f1ebdd", color: C.sub, border: `1px solid ${C.line}` }}>
          <span className="w-3 h-3 rounded-full" style={{ background: g.hex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }} />
          {g.name}<span style={{ opacity: 0.6 }}>{cardsIn(g.key).length}</span>
        </button>
      ))}
    </div>
  );
}
function GroupHeader({ g, count, small }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="rounded-full" style={{ width: small ? 14 : 18, height: small ? 14 : 18, background: g.hex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }} />
      <h3 className="cz" style={{ letterSpacing: "0.06em", color: C.ink, fontSize: small ? 15 : 18 }}>{g.name}</h3>
      <span className="text-xs" style={{ color: C.faint }}>{count}</span>
      <span className="flex-1 h-px ml-1" style={{ background: C.line }} />
    </div>
  );
}
function CardTile({ c, i, count, addOne, removeOne, editId, editName, setEditId, setEditName, saveName, deleteCard, rotateCard, setIntensity }) {
  const lvl = c.intensity || 2;
  return (
    <div className="rounded-2xl overflow-hidden relative pop" style={{ background: C.card, border: `1px solid ${count > 0 ? C.coral : C.line}`, boxShadow: "0 4px 18px rgba(40,38,30,.07)", animationDelay: `${Math.min(i, 12) * 30}ms` }}>
      <button onClick={() => addOne(c.id)} className="press block w-full" style={{ position: "relative" }}>
        <div style={{ aspectRatio: "62/95", background: "#efe9dd", position: "relative", overflow: "hidden" }}>
          <img src={c.src} alt={c.name} loading="lazy" className="w-full h-full object-cover" style={{ transform: c.rot ? `rotate(${c.rot}deg)` : undefined }} />
          {c.num != null && <span className="cz absolute top-1.5 left-1.5 text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: "rgba(20,22,15,.6)", color: "#fff" }}>{c.num}</span>}
          <span className="absolute top-1.5 right-1.5 rounded-full p-1.5" style={{ background: C.coral, boxShadow: "0 2px 8px rgba(207,106,76,.5)" }}><Plus size={14} color="#fff" /></span>
          {count > 0 && <span className="absolute bottom-1.5 right-1.5 rounded-full text-[11px] font-bold px-2 py-0.5" style={{ background: "#fff", color: C.coralDeep, boxShadow: "0 1px 5px rgba(0,0,0,.25)" }}>×{count}</span>}
        </div>
      </button>
      {editId === c.id ? (
        <div className="p-2">
          <div className="flex items-center gap-1.5 mb-2">
            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName(c.id)} className="w-full text-sm px-2 py-1 rounded-lg outline-none" style={{ border: `1px solid ${C.coral}`, background: "#fff", color: C.ink }} />
            <button onClick={() => saveName(c.id)} aria-label="Save" className="press p-1.5 rounded-lg" style={{ background: C.coral, color: "#fff" }}><Check size={14} /></button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide" style={{ color: C.faint }}>Level</span>
              {[1, 2, 3].map((l) => (<button key={l} onClick={() => setIntensity(c.id, l)} aria-label={`Level ${l}`} className="press" style={{ width: 14, height: 14, borderRadius: 99, background: lvl >= l ? C.coral : "#e0d6c4" }} />))}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => rotateCard(c.id)} aria-label="Rotate" className="press p-1.5 rounded-lg" style={{ background: "#eadfce", color: C.ink }}><RotateCw size={14} /></button>
              <button onClick={() => deleteCard(c.id)} aria-label="Delete" className="press p-1.5 rounded-lg" style={{ background: "#eadfce", color: C.coralDeep }}><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-2 py-1.5 flex items-center justify-between gap-1">
          <button onClick={() => { setEditId(c.id); setEditName(c.name); }} className="flex items-center gap-1 min-w-0">
            <span className="cz text-[11.5px] truncate" style={{ letterSpacing: "0.02em", color: C.ink }}>{c.name}</span>
            <Pencil size={10} style={{ color: C.faint, flexShrink: 0 }} />
          </button>
          {count > 0 ? (
            <button onClick={() => removeOne(c.id)} aria-label="Remove one" className="press flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-sm font-bold" style={{ background: "#eadfce", color: C.coralDeep }}>−</button>
          ) : (
            <div className="flex items-center gap-0.5 flex-shrink-0">{[1, 2, 3].map((l) => (<span key={l} style={{ width: 4, height: 4, borderRadius: 99, background: lvl >= l ? C.coral : "#e0d6c4" }} />))}</div>
          )}
        </div>
      )}
    </div>
  );
}
function Row({ icon, label, children }) { return (<div><div className="flex items-center gap-2.5 mb-2.5"><span style={{ color: C.coralDeep }}>{icon}</span><span className="text-sm font-medium" style={{ color: C.ink }}>{label}</span></div>{children}</div>); }
function Chips({ value, onChange, options }) {
  return (<div className="flex flex-wrap gap-2">{options.map(([v, lbl]) => (
    <button key={v} onClick={() => onChange(v)} className="press h-9 px-4 rounded-full text-sm font-semibold transition-colors" style={value === v ? { background: C.coral, color: "#fff" } : { background: "#f1ebdd", color: C.sub, border: `1px solid ${C.line}` }}>{lbl}</button>
  ))}</div>);
}
function DurationStepper({ value, fallback, onChange }) {
  const isDefault = value == null; const cur = value ?? fallback; const step = (d) => onChange(clamp(cur + d, 5, 600));
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <button onClick={() => step(-5)} className="press flex items-center justify-center rounded-lg" style={{ width: 24, height: 24, background: "#f1ebdd", color: C.sub, border: `1px solid ${C.line}` }}><Minus size={13} /></button>
      <span className="tabular-nums text-sm font-semibold text-center" style={{ minWidth: 34, color: C.ink }}>{fmt(cur)}</span>
      <button onClick={() => step(5)} className="press flex items-center justify-center rounded-lg" style={{ width: 24, height: 24, background: "#f1ebdd", color: C.sub, border: `1px solid ${C.line}` }}><Plus size={13} /></button>
      {isDefault && <span className="text-[11px]" style={{ color: C.faint }}>default</span>}
    </div>
  );
}
function Empty({ onAdd }) {
  return (<div className="rounded-2xl py-12 px-6 text-center mb-7" style={{ border: `1.5px dashed ${C.line}`, background: "rgba(255,255,255,.4)" }}>
    <p className="text-sm mb-3" style={{ color: C.sub }}>No cards in your deck yet.</p>
    <button onClick={onAdd} className="press h-10 px-5 rounded-full text-sm font-semibold" style={{ background: C.coral, color: "#fff" }}>Add cards</button>
  </div>);
}

/* ================= PLAYER ================= */
function Player({ circuit, library, holdDefault, restDur, soundOn, voiceOn, voiceName, onClose }) {
  const seqRef = useRef(circuit.map((it) => ({ card: library.find((c) => c.id === it.cardId), duration: it.duration ?? holdDefault })).filter((x) => x.card));
  const seq = seqRef.current;
  const restRef = useRef(restDur);
  const endAtRef = useRef(0);
  const audioRef = useRef(null);
  const first = seq[0];
  const [pl, setPl] = useState({ index: 0, phase: "count", total: first ? first.duration : 0, remaining: first ? first.duration : 0, running: true, done: false });

  const lastTickRef = useRef(99);
  const saidNextRef = useRef(false);
  const primedRef = useRef(false);
  const plRef = useRef(pl); plRef.current = pl;
  const ensureCtx = () => {
    if (!audioRef.current) { try { audioRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    const c = audioRef.current; if (c && c.state === "suspended") { try { c.resume(); } catch {} } return c;
  };
  const tone = useCallback((freq, dur, vol, when = 0) => {
    if (!soundOn) return; const ctx = ensureCtx(); if (!ctx) return;
    try {
      const t = ctx.currentTime + when; const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.03);
    } catch {}
  }, [soundOn]);
  const chimeNext = useCallback(() => { tone(620, 0.16, 0.18, 0); tone(900, 0.22, 0.2, 0.12); }, [tone]);
  const tick = useCallback(() => tone(1000, 0.05, 0.09, 0), [tone]);
  const chimeDone = useCallback(() => { tone(660, 0.22, 0.18, 0); tone(880, 0.22, 0.18, 0.16); tone(1175, 0.4, 0.18, 0.32); }, [tone]);
  const speak = useCallback((text) => {
    if (!voiceOn || !text) return;
    try {
      const synth = window.speechSynthesis; if (!synth) return;
      const go = () => {
        try { if (synth.paused) synth.resume(); } catch {}
        const u = new SpeechSynthesisUtterance(text);
        const vs = synth.getVoices();
        const v = vs.find((x) => (x.voiceURI || x.name) === voiceName) || vs.find((x) => /^en/i.test(x.lang));
        if (v) u.voice = v; u.rate = 0.97; u.pitch = 1; u.volume = 1; synth.speak(u);
      };
      if (synth.speaking || synth.pending) { synth.cancel(); setTimeout(go, 130); } else { go(); }
    } catch {}
  }, [voiceOn, voiceName]);
  const speakRef = useRef(speak); speakRef.current = speak;

  useEffect(() => { endAtRef.current = performance.now() + (first ? first.duration : 0) * 1000; chimeNext(); }, []); // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => {
      try { const sy = window.speechSynthesis; if (sy && sy.paused) sy.resume(); } catch {}
      const p = plRef.current;
      if (p.running && !p.done && p.phase === "count") {
        const rem = Math.max(0, (endAtRef.current - performance.now()) / 1000);
        const sec = Math.ceil(rem);
        if (rem > 0.06 && sec >= 1 && sec <= 3 && sec !== lastTickRef.current) { lastTickRef.current = sec; tick(); }
        if (restRef.current === 0 && !saidNextRef.current) { const nxt = seq[p.index + 1]; if (nxt && rem <= 6.5 && rem > 3.4 && (p.total - rem) > 2.4) { saidNextRef.current = true; speakRef.current("Next. " + nxt.card.name); } }
      }
      setPl((prev) => { if (!prev.running || prev.done) return prev; const rem = Math.max(0, (endAtRef.current - performance.now()) / 1000); if (rem > 0) return { ...prev, remaining: rem }; return advance(prev); });
    }, 100);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  function advance(prev) {
    const last = seq.length - 1;
    if (prev.phase === "count") {
      if (restRef.current > 0 && prev.index < last) { endAtRef.current = performance.now() + restRef.current * 1000; return { ...prev, phase: "rest", total: restRef.current, remaining: restRef.current }; }
      if (prev.index < last) { const ni = prev.index + 1, d = seq[ni].duration; endAtRef.current = performance.now() + d * 1000; return { index: ni, phase: "count", total: d, remaining: d, running: true, done: false }; }
      return { ...prev, running: false, done: true, remaining: 0 };
    }
    const ni = prev.index + 1, d = seq[ni].duration; endAtRef.current = performance.now() + d * 1000; return { index: ni, phase: "count", total: d, remaining: d, running: true, done: false };
  }

  const prevKey = useRef("");
  useEffect(() => {
    const key = pl.done ? "done" : `${pl.index}-${pl.phase}`; if (key === prevKey.current) return; prevKey.current = key;
    lastTickRef.current = 99; saidNextRef.current = false;
    if (pl.done) { chimeDone(); }
    else if (pl.phase === "count") { chimeNext(); speak(seq[pl.index].card.name); }
    else { tone(520, 0.16, 0.12); const n = seq[pl.index + 1]; if (n) { speak("Next. " + n.card.name); saidNextRef.current = true; } }
  }, [pl.index, pl.phase, pl.done, chimeNext, chimeDone, tone, speak]);
  useEffect(() => {
    const unlock = () => {
      ensureCtx();
      try { const sy = window.speechSynthesis; if (sy && !primedRef.current) { primedRef.current = true; const u = new SpeechSynthesisUtterance(" "); u.volume = 0; sy.speak(u); } } catch {}
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []); // eslint-disable-line

  const goTo = useCallback((i) => { if (i < 0 || i >= seq.length) return; ensureCtx(); lastTickRef.current = 99; const d = seq[i].duration; endAtRef.current = performance.now() + d * 1000; setPl({ index: i, phase: "count", total: d, remaining: d, running: true, done: false }); }, [seq]);
  const togglePause = useCallback(() => { ensureCtx(); setPl((p) => { if (p.done) return p; if (p.running) return { ...p, running: false }; endAtRef.current = performance.now() + p.remaining * 1000; return { ...p, running: true }; }); }, []);
  const restart = () => goTo(0);

  useEffect(() => {
    const h = (e) => { if (e.key === "ArrowRight") goTo(pl.index + 1); else if (e.key === "ArrowLeft") goTo(pl.index - 1); else if (e.key === " ") { e.preventDefault(); togglePause(); } else if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [pl.index, goTo, togglePause, onClose]);

  const bg = { background: `radial-gradient(130% 90% at 50% 0%, ${C.night1} 0%, ${C.night2} 70%)` };
  if (!first) return (<div className="yc fixed inset-0 flex items-center justify-center" style={{ ...bg, zIndex: 60 }}><div className="text-center text-white"><p>Those cards were removed.</p><button onClick={onClose} className="press mt-3 h-10 px-5 rounded-full" style={{ background: "#fff", color: C.ink }}>Close</button></div></div>);

  const cur = seq[pl.index]; const isRest = pl.phase === "rest"; const next = seq[pl.index + 1];
  const frac = pl.total > 0 ? pl.remaining / pl.total : 0;

  if (pl.done) {
    return (<div className="yc fixed inset-0 flex flex-col items-center justify-center px-8 text-center text-white" style={{ ...bg, zIndex: 60 }}>
      <div className="rounded-full p-6 mb-6 fadeUp" style={{ background: "rgba(207,106,76,.18)" }}><Flame size={42} style={{ color: C.coral }} /></div>
      <h2 className="cz text-3xl fadeUp" style={{ letterSpacing: "0.05em", animationDelay: "60ms" }}>PRACTICE COMPLETE</h2>
      <p className="mt-3 text-sm fadeUp" style={{ color: "#c9c2b4", animationDelay: "120ms" }}>{seq.length} poses · beautifully done.</p>
      <div className="flex gap-3 mt-9 fadeUp" style={{ animationDelay: "180ms" }}>
        <button onClick={restart} className="press px-7 rounded-full flex items-center gap-2 font-bold" style={{ height: 52, background: C.coral, color: "#fff" }}><RotateCcw size={18} /> Flow again</button>
        <button onClick={onClose} className="press rounded-full px-7 font-semibold" style={{ height: 52, background: "rgba(255,255,255,.1)", color: "#fff" }}>Finish</button>
      </div>
    </div>);
  }

  const R = 54, CIRC = 2 * Math.PI * R;
  return (
    <div className="yc fixed inset-0 flex flex-col text-white overflow-hidden" style={{ ...bg, zIndex: 60 }}>
      <div className="aura" style={{ position: "absolute", top: "-20%", left: "-10%", width: "70%", height: "70%", borderRadius: "50%", background: `radial-gradient(circle, ${isRest ? "rgba(120,150,130,.26)" : "rgba(207,106,76,.24)"}, transparent 70%)`, filter: "blur(40px)", pointerEvents: "none", transition: "background .6s" }} />
      <div className="relative flex items-center justify-between px-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)" }}>
        <button onClick={onClose} aria-label="Close" className="press p-3 rounded-full" style={{ background: "rgba(255,255,255,.12)", touchAction: "manipulation" }}><X size={22} /></button>
        <div className="text-sm font-medium tracking-wide" style={{ color: "#c9c2b4" }}>Pose {pl.index + 1} of {seq.length}</div>
        <div className="w-10" />
      </div>
      <div className="relative flex gap-1.5 px-5 mt-4">
        {seq.map((_, i) => (<div key={i} className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.12)" }}>
          <div style={{ height: "100%", borderRadius: 99, background: i < pl.index ? "#9fb0a2" : i === pl.index ? C.coral : "transparent", width: i === pl.index ? `${(1 - frac) * 100}%` : "100%", transition: "width .12s linear" }} />
        </div>))}
      </div>
      <div className="relative flex-1 flex items-center justify-center px-6 py-5 min-h-0">
        <div key={pl.index} className="pop relative h-full w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg flex items-center justify-center">
          <img src={cur.card.src} alt={cur.card.name} className="max-h-full max-w-full object-contain rounded-[22px]" style={{ boxShadow: "0 20px 60px rgba(0,0,0,.55)", opacity: isRest ? 0.3 : 1, transition: "opacity .35s", transform: cur.card.rot ? `rotate(${cur.card.rot}deg)` : undefined }} />
          {isRest && (<div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <span className="text-xs tracking-[0.35em] uppercase mb-2" style={{ color: "#aebfac" }}>Rest · next up</span>
            <span className="cz text-2xl md:text-4xl" style={{ letterSpacing: "0.04em" }}>{next ? next.card.name : ""}</span>
          </div>)}
        </div>
      </div>
      <div className="relative px-7 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.25em] uppercase mb-1" style={{ color: "#a59c8e" }}>{isRest ? "Breathe" : "Now"}</div>
          <div className="cz text-xl md:text-3xl truncate leading-tight" style={{ letterSpacing: "0.03em" }}>{cur.card.name}</div>
          {!isRest && (next ? <div className="text-sm mt-1 truncate flex items-center gap-1.5" style={{ color: "#a59c8e" }}><ChevronRight size={14} /> {next.card.name}</div> : <div className="text-sm mt-1" style={{ color: "#a59c8e" }}>Final pose</div>)}
        </div>
        <div className="relative flex-shrink-0" style={{ width: 116, height: 116 }}>
          <svg width="116" height="116" viewBox="0 0 116 116" className="-rotate-90">
            <defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={isRest ? "#aebfac" : "#e89368"} /><stop offset="1" stopColor={isRest ? "#7f9583" : C.coral} /></linearGradient></defs>
            <circle cx="58" cy="58" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="7" />
            <circle cx="58" cy="58" r={R} fill="none" stroke="url(#ring)" strokeWidth="7" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)} style={{ transition: "stroke-dashoffset .12s linear" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="cz text-4xl md:text-6xl tabular-nums leading-none">{Math.ceil(pl.remaining)}</span>
            <span className="text-[10px] mt-1" style={{ color: "#a59c8e" }}>sec</span>
          </div>
        </div>
      </div>
      <div className="relative flex items-center justify-center gap-6 px-6 pt-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 30px)" }}>
        <button onClick={() => goTo(pl.index - 1)} disabled={pl.index === 0} className="press p-4 rounded-full disabled:opacity-25" style={{ background: "rgba(255,255,255,.08)" }}><ChevronLeft size={26} /></button>
        <button onClick={togglePause} className="press rounded-full flex items-center justify-center" style={{ width: 78, height: 78, background: C.coral, color: "#fff", boxShadow: "0 10px 30px rgba(207,106,76,.42)" }}>{pl.running ? <Pause size={32} fill="#fff" /> : <Play size={32} fill="#fff" style={{ marginLeft: 3 }} />}</button>
        <button onClick={() => goTo(pl.index + 1)} className="press p-4 rounded-full" style={{ background: "rgba(255,255,255,.08)" }}><ChevronRight size={26} /></button>
      </div>
    </div>
  );
}

/* ================= CROP & STRAIGHTEN ================= */
function fitBox(aspect, W, H) {
  if (!aspect) return { x: W * 0.06, y: H * 0.06, w: W * 0.88, h: H * 0.88 };
  let w = W * 0.92, h = w / aspect;
  if (h > H * 0.92) { h = H * 0.92; w = h * aspect; }
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
function CropEditor({ files, onComplete, onCancel }) {
  const [idx, setIdx] = useState(0);
  const resultsRef = useRef([]);
  const [orig, setOrig] = useState(null);
  const [orient, setOrient] = useState(0);
  const [base, setBase] = useState(null);
  const [fine, setFine] = useState(0);
  const [aspect, setAspect] = useState(5 / 7);
  const [box, setBox] = useState(null);
  const [name, setName] = useState("");
  const [vp, setVp] = useState({ maxW: 360, maxH: 420 });
  const stageRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => { const f = () => setVp({ maxW: Math.min(window.innerWidth - 40, 440), maxH: Math.min(window.innerHeight * 0.46, 470) }); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const file = files[idx]; if (!file) return;
      setName((file.name || "Pose").replace(/\.[^.]+$/, "").slice(0, 40) || "Pose");
      try { const url = await fileToURL(file); const img = await loadImage(url); if (!alive) return; setOrig(img); setOrient(0); setFine(0); setAspect(5 / 7); }
      catch { goNext(); }
    })();
    return () => { alive = false; };
  }, [idx, files]);

  useEffect(() => {
    if (!orig) return;
    const even = orient % 2 === 0;
    const w = even ? orig.naturalWidth : orig.naturalHeight;
    const h = even ? orig.naturalHeight : orig.naturalWidth;
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.translate(w / 2, h / 2); ctx.rotate((orient * Math.PI) / 2);
    ctx.drawImage(orig, -orig.naturalWidth / 2, -orig.naturalHeight / 2);
    setBase({ canvas: cv, w, h, url: cv.toDataURL("image/jpeg", 0.92) });
  }, [orig, orient]);

  const s = base ? Math.min(vp.maxW / base.w, vp.maxH / base.h) : 1;
  const dispW = base ? base.w * s : vp.maxW;
  const dispH = base ? base.h * s : vp.maxH;
  useEffect(() => { if (base) setBox(fitBox(aspect, dispW, dispH)); }, [base, aspect, dispW, dispH]);

  function startDrag(e, mode) { e.preventDefault(); e.stopPropagation(); const rect = stageRef.current.getBoundingClientRect(); drag.current = { mode, sx0: e.clientX, sy0: e.clientY, box: { ...box }, rect }; window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", endDrag); }
  function onMove(e) {
    const d = drag.current; if (!d) return;
    if (d.mode === "move") { const dx = e.clientX - d.sx0, dy = e.clientY - d.sy0; setBox({ ...d.box, x: clamp(d.box.x + dx, 0, dispW - d.box.w), y: clamp(d.box.y + dy, 0, dispH - d.box.h) }); return; }
    const c = d.mode, sb = d.box; const px = clamp(e.clientX - d.rect.left, 0, dispW), py = clamp(e.clientY - d.rect.top, 0, dispH);
    const ax = c.includes("w") ? sb.x + sb.w : sb.x; const ay = c.includes("n") ? sb.y + sb.h : sb.y;
    let nw = Math.abs(px - ax), nh = Math.abs(py - ay);
    if (aspect) { const availW = px >= ax ? dispW - ax : ax, availH = py >= ay ? dispH - ay : ay; nw = Math.min(nw, availW, availH * aspect); nw = Math.max(nw, 50); nh = nw / aspect; }
    else { nw = Math.max(nw, 50); nh = Math.max(nh, 50); }
    const nx = px >= ax ? ax : ax - nw, ny = py >= ay ? ay : ay - nh;
    setBox({ x: clamp(nx, 0, dispW), y: clamp(ny, 0, dispH), w: nw, h: nh });
  }
  function endDrag() { drag.current = null; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", endDrag); }

  function renderCrop() {
    const q = Math.min(1 / s, 1400 / Math.max(box.w, box.h));
    const cw = Math.max(1, Math.round(box.w * q)), ch = Math.max(1, Math.round(box.h * q));
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch; const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch);
    ctx.translate(-box.x * q, -box.y * q); ctx.translate((dispW / 2) * q, (dispH / 2) * q); ctx.rotate((fine * Math.PI) / 180);
    const dw = dispW * q, dh = dispH * q; ctx.imageSmoothingQuality = "high"; ctx.drawImage(base.canvas, -dw / 2, -dh / 2, dw, dh);
    return canvasToCard(cv);
  }
  function goNext() { if (idx + 1 < files.length) setIdx(idx + 1); else onComplete(resultsRef.current); }
  function addCard(full) { if (!base) return; const src = full ? canvasToCard(base.canvas) : renderCrop(); resultsRef.current.push({ name: name.trim() || "Pose", src }); goNext(); }

  const ASPECTS = [[null, "Free"], [5 / 7, "Card"], [4 / 5, "4:5"], [1, "Square"]];
  const handle = (pos, cursor) => ({ position: "absolute", width: 26, height: 26, borderRadius: 999, background: "#fff", border: `2px solid ${C.coral}`, touchAction: "none", boxShadow: "0 1px 4px rgba(0,0,0,.3)", cursor, ...pos });

  return (
    <div className="yc fixed inset-0 z-50 flex flex-col" style={{ background: "#14140f", color: "#fff" }}>
      <div className="flex items-center justify-between px-5 pb-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)" }}>
        <button onClick={onCancel} className="press p-2.5 rounded-full" style={{ background: "rgba(255,255,255,.08)" }}><X size={20} /></button>
        <div className="text-center">
          <div className="cz text-base leading-none" style={{ letterSpacing: "0.05em" }}>CROP &amp; STRAIGHTEN</div>
          <div className="text-xs mt-1.5" style={{ color: "#a59c8e" }}>Photo {idx + 1} of {files.length}</div>
        </div>
        <div className="w-10" />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        {!base ? (<div className="text-sm" style={{ color: "#a59c8e" }}>Loading photo…</div>) : (
          <div ref={stageRef} className="relative" style={{ width: dispW, height: dispH, touchAction: "none" }}>
            <img src={base.url} alt="" draggable={false} className="absolute select-none" style={{ width: dispW, height: dispH, left: 0, top: 0, transform: `rotate(${fine}deg)`, transformOrigin: "center" }} />
            {box && (<>
              <div onPointerDown={(e) => startDrag(e, "move")} style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, border: "2px solid #fff", boxShadow: "0 0 0 9999px rgba(0,0,0,.55)", touchAction: "none", cursor: "move" }}>
                <div style={{ position: "absolute", left: "33.3%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,.35)" }} />
                <div style={{ position: "absolute", left: "66.6%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,.35)" }} />
                <div style={{ position: "absolute", top: "33.3%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,.35)" }} />
                <div style={{ position: "absolute", top: "66.6%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,.35)" }} />
              </div>
              <div onPointerDown={(e) => startDrag(e, "nw")} style={handle({ left: box.x - 13, top: box.y - 13 }, "nwse-resize")} />
              <div onPointerDown={(e) => startDrag(e, "ne")} style={handle({ left: box.x + box.w - 13, top: box.y - 13 }, "nesw-resize")} />
              <div onPointerDown={(e) => startDrag(e, "sw")} style={handle({ left: box.x - 13, top: box.y + box.h - 13 }, "nesw-resize")} />
              <div onPointerDown={(e) => startDrag(e, "se")} style={handle({ left: box.x + box.w - 13, top: box.y + box.h - 13 }, "nwse-resize")} />
            </>)}
          </div>
        )}
      </div>
      <div className="px-5 pb-6 pt-2" style={{ background: "linear-gradient(to top, #14140f 80%, transparent)" }}>
        <div className="flex gap-2 mb-4 justify-center">
          {ASPECTS.map(([a, lbl]) => (
            <button key={lbl} onClick={() => setAspect(a)} className="press h-9 px-3.5 rounded-full text-sm font-semibold" style={aspect === a ? { background: C.coral, color: "#fff" } : { background: "rgba(255,255,255,.08)", color: "#e3ddcf" }}>{lbl}</button>
          ))}
        </div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setOrient((o) => (o + 3) % 4)} className="press p-2.5 rounded-xl flex-shrink-0" style={{ background: "rgba(255,255,255,.08)" }}><RotateCcw size={18} /></button>
          <div className="flex-1">
            <input type="range" min={-15} max={15} step={0.5} value={fine} onChange={(e) => setFine(parseFloat(e.target.value))} className="w-full" style={{ accentColor: C.coral }} />
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="text-xs tabular-nums" style={{ color: "#a59c8e" }}>{fine > 0 ? "+" : ""}{fine}°</span>
              {fine !== 0 && <button onClick={() => setFine(0)} className="text-xs underline" style={{ color: "#a59c8e" }}>reset</button>}
            </div>
          </div>
          <button onClick={() => setOrient((o) => (o + 1) % 4)} className="press p-2.5 rounded-xl flex-shrink-0" style={{ background: "rgba(255,255,255,.08)", transform: "scaleX(-1)" }}><RotateCcw size={18} /></button>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pose name" className="w-full h-11 px-4 rounded-xl outline-none text-sm mb-3" style={{ background: "rgba(255,255,255,.07)", color: "#fff", border: "1px solid rgba(255,255,255,.12)" }} />
        <div className="flex gap-2.5">
          <button onClick={() => addCard(true)} className="press h-12 px-4 rounded-full text-sm font-semibold flex-shrink-0" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}>Full photo</button>
          <button onClick={() => addCard(false)} className="press flex-1 h-12 rounded-full text-base font-bold flex items-center justify-center gap-2" style={{ background: C.coral, color: "#fff" }}>
            <Check size={20} /> {idx + 1 < files.length ? "Add & next" : "Add card"}
          </button>
        </div>
      </div>
    </div>
  );
}

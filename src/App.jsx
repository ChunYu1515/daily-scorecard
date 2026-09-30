import { useState, useEffect, Component } from "react";

const C = {
  paper: "#F4F6F0", card: "#FFFFFF", ink: "#18332C", green: "#2E6B4E",
  flag: "#E9B82E", pencil: "#5E6A64", line: "#DCE3DA", warn: "#B0522C",
};
const KEY = "habit-scorecard-v1";
const WD = ["日", "一", "二", "三", "四", "五", "六"];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // 顯示順序：一到日
const DAY_TYPE = ["休息＋回顧日", "上班日", "上班日", "上班日", "練習場日", "居家半天", "自由日"];
const CATS = ["高爾夫", "日語", "英語會話", "運動", "早餐", "閱讀"];

// ---------- 日期工具 ----------
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const mondayOf = (s) => { const wd = parse(s).getDay(); return addDays(s, wd === 0 ? -6 : 1 - wd); };
const label = (s) => { const d = parse(s); return `${d.getMonth() + 1}月${d.getDate()}日 週${WD[d.getDay()]}`; };

// 依時間文字排序，例如「20:30」「早餐後」「下午」
const sortKey = (t = "") => {
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (m) return +m[1] + +m[2] / 60;
  const kw = [["早餐後", 8.5], ["早餐", 8], ["早上", 8], ["上午", 10], ["中午", 12], ["下午", 14], ["傍晚", 18], ["晚餐後", 19.5], ["晚上", 20], ["睡前", 23]];
  for (const [k, v] of kw) if (t.includes(k)) return v;
  return 12;
};

// 時長：分鐘數 → 「30 分鐘」「1 小時 30 分」
const fmtDur = (m) => {
  m = Math.round(+m);
  if (!m || m <= 0) return "";
  if (m < 60) return `${m} 分鐘`;
  return `${Math.floor(m / 60)} 小時${m % 60 ? ` ${m % 60} 分` : ""}`;
};
const parseDur = (t = "") => {
  const h = t.match(/(\d+(?:\.\d+)?)\s*小時/), mm = t.match(/(\d+)\s*分/);
  return Math.round((h ? +h[1] * 60 : 0) + (mm ? +mm[1] : 0));
};

const shortDur = (m) => {
  m = Math.round(+m) || 0;
  if (!m) return "–";
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h}時${r ? r + "分" : ""}` : `${r}分`;
};
const dayTotal = (habits, w) => habits.reduce((t, h) => t + (+(h.schedule[w]?.duration) || 0), 0);
const endTime = (t = "", dur) => {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  const d = +dur;
  if (!m || !d) return "";
  const e = (+m[1] * 60 + +m[2] + d) % 1440;
  return `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
};

// 依時長把日子分組，例如「週一二三 20 分鐘；週六日 2 小時」
const durGroups = (h, days) => {
  const g = [];
  for (const w of days) {
    const d = +(h.schedule[w].duration) || 0;
    const last = g[g.length - 1];
    const same = g.find((x) => x.d === d);
    if (same) same.ws.push(w); else g.push({ d, ws: [w] });
  }
  return g.map((x) => `${x.ws.length === 7 ? "每日" : "週" + x.ws.map((w) => WD[w]).join("")} ${fmtDur(x.d) || "未設時長"}`).join("；");
};

// ---------- 預設行程 ----------
const LOWER = ["暖身 5 分鐘：開合跳、髖關節繞圈", "循環 3～4 輪：深蹲 15 下、臀橋 15 下、弓箭步每邊 10 下、棒式 30 秒", "伸展 5 分鐘"];
const UPPER = ["暖身 5 分鐘：手臂繞圈、貓牛式", "循環 3～4 輪：跪姿伏地挺身 10 下、彈力帶划船 15 下、側棒式每邊 20 秒", "伸展 5 分鐘"];
const PUTT = ["1 公尺連續進洞，目標連進 10 球", "距離控制：3 公尺、5 公尺各推 5 球"];

function defaultHabits() {
  const every = (f) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, f(d)]).filter(([, v]) => v));
  return [
    { id: "breakfast", name: "健康早餐", category: "早餐", min: "有吃早餐",
      schedule: every(() => ({ time: "08:00", duration: 20, full: "有蛋白質＋蔬果", content: ["蛋白質：蛋、無糖豆漿、優格、雞胸肉", "蔬果：一份水果或蔬菜"] })) },
    { id: "japanese", name: "日語", category: "日語", min: "10 分鐘",
      schedule: every((d) => d === 0 || d === 6
        ? { time: "上午＋下午", duration: 120, full: "2 小時", content: ["第一小時：學新進度（教材下一課）", "第二小時：練習題＋聽力", "前兩週先專心平假名、片假名"] }
        : { time: d <= 3 ? "早餐後" : "10:00 前", duration: 20, full: "複習 20 分鐘", content: ["用單字卡 App 複習", "重看本週新學的文法", "唸出聲音比默念更好記"] }) },
    { id: "workout", name: "居家塑身", category: "運動", min: "10 分鐘（循環 1 輪）",
      schedule: every((d) => {
        if (![1, 2, 3, 5, 6].includes(d)) return null;
        const lower = [1, 3, 5].includes(d);
        return { time: d <= 3 ? "20:30" : d === 5 ? "下午" : "上午", duration: 30, full: `30 分鐘（${lower ? "下半身＋核心" : "上半身＋核心"}）`, content: lower ? LOWER : UPPER };
      }) },
    { id: "range", name: "高爾夫練習場", category: "高爾夫", min: "去練習場就算",
      schedule: every((d) => d === 4 ? { time: "下午", duration: 90, full: "一籃球＋本週重點", content: ["短鐵暖身 10 球", "練本週的一個重點，例如擊球穩定度", "最後十幾球模擬下場：每球換桿、定目標"] } : null) },
    { id: "putting", name: "推桿切桿", category: "高爾夫", min: "推桿 10 球",
      schedule: every((d) => {
        if (![1, 2, 3, 5, 6].includes(d)) return null;
        return d <= 3
          ? { time: "21:00", duration: 10, full: "推桿 10 分鐘", content: PUTT }
          : { time: "下午", duration: 20, full: "推桿＋切桿 20 分鐘", content: [...PUTT, "切桿：選一個落點，連續切 10 球"] };
      }) },
    { id: "english", name: "英語會話", category: "英語會話", min: "10 分鐘",
      schedule: every((d) => ({ time: d >= 1 && d <= 3 ? "21:15" : "晚上", duration: 30, full: "30 分鐘", content: ["跟讀 10 分鐘", "選一個主題自己說並錄音 15 分鐘", "回聽錄音，找出卡住的地方 5 分鐘"] })) },
    { id: "reading", name: "閱讀", category: "閱讀", min: "10 分鐘",
      schedule: every(() => ({ time: "23:00", duration: 30, full: "30 分鐘", content: ["手機放到房間外", "紙本或電子書閱讀器，幫助入睡"] })) },
  ];
}

// 連續次數：只算有排程的日子；漏一次不會斷，連續漏兩次才重算
function streakOf(id, records, today, start, planOn) {
  let streak = 0, misses = 0, prevMissed = null;
  for (let i = 0; i < 400; i++) {
    const ds = addDays(today, -i);
    if (ds < start) break;
    const h = planOn(ds).find((x) => x.id === id);
    if (!h || !h.schedule[parse(ds).getDay()]) continue;
    const val = records[ds]?.[id];
    if (val === "rest") continue; // 休假不算漏，也不算完成
    const done = !!val;
    if (i === 0) { if (done) streak++; continue; }
    if (prevMissed === null) prevMissed = !done;
    if (done) { streak++; misses = 0; } else { misses++; if (misses >= 2) break; }
  }
  return { streak, prevMissed: !!prevMissed };
}

// ---------- 行程版本：每次調整從當天生效 ----------
function makePlanOn(history) {
  const cache = {};
  return (ds) => {
    if (cache[ds]) return cache[ds];
    let hs = history[0].habits;
    for (const v of history) { if (v.from <= ds) hs = v.habits; else break; }
    return (cache[ds] = hs);
  };
}
const currentHabits = (data) => data.planHistory[data.planHistory.length - 1].habits;
function withHabits(data, habits, today) {
  const hist = [...data.planHistory];
  if (hist[hist.length - 1].from === today) hist[hist.length - 1] = { from: today, habits };
  else hist.push({ from: today, habits });
  return { ...data, planHistory: hist };
}

// ---------- 共用元件 ----------
function Mark({ v, size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      {v === "rest" ? (
        <circle cx="14" cy="14" r="12" fill={C.paper} stroke={C.pencil} strokeWidth="1.5" />
      ) : v === "part" ? (
        <circle cx="14" cy="14" r="12" fill="none" stroke={C.green} strokeWidth="2" strokeDasharray="4 3" />
      ) : v ? (
        <circle cx="14" cy="14" r="12" fill="none" stroke={C.green} strokeWidth="2" />
      ) : (
        <circle cx="14" cy="14" r="12" fill="none" stroke={C.line} strokeWidth="2" strokeDasharray="3 3" />
      )}
      {v === "full" && <circle cx="14" cy="14" r="7.5" fill="none" stroke={C.green} strokeWidth="2" />}
      {v === "rest" && <text x="14" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill={C.pencil}>休</text>}
    </svg>
  );
}

function Pill({ on, onClick, children, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? "0" : "9px 14px", width: small ? 40 : "auto", height: small ? 40 : "auto", borderRadius: 999,
      fontSize: 14, border: `1.5px solid ${C.green}`, background: on ? C.green : "transparent",
      color: on ? "#fff" : C.green, fontWeight: 600,
    }}>{children}</button>
  );
}

function Arrow({ dir, onClick, disabled, label: l }) {
  return (
    <button onClick={() => !disabled && onClick()} aria-label={l} disabled={disabled}
      style={{ fontSize: 26, width: 44, height: 44, color: disabled ? C.line : C.green }}>{dir}</button>
  );
}

const inputStyle = {
  display: "block", width: "100%", marginTop: 4, padding: "8px 10px", fontSize: 15, lineHeight: 1.5,
  border: `1.5px solid ${C.line}`, borderRadius: 6, background: C.card, color: C.ink,
};

// ---------- 今天 ----------
function HabitRow({ h, p, value, onSet, streak, warn, late }) {
  const done = value === "min" || value === "full";
  const rest = value === "rest";
  const bg = value === "full" ? "#FBF2D6" : done ? "#E6EFE9" : C.card;
  const btn = (on, color, textOn) => ({
    minWidth: 58, height: 44, padding: "0 10px", borderRadius: 10, fontSize: 15, fontWeight: 700,
    border: `1.5px solid ${color}`, background: on ? color : "transparent", color: on ? textOn : color,
  });
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", marginTop: 8, borderRadius: 12, background: bg, border: `1px solid ${done ? "transparent" : C.line}`, opacity: rest ? 0.7 : 1 }}>
      <div style={{ width: 56, flexShrink: 0, lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: !p.time ? C.pencil : late ? C.warn : C.ink }}>{p.time || "未排時間"}</div>
        {fmtDur(p.duration) && <div style={{ fontSize: 12, color: C.pencil, marginTop: 1 }}>{fmtDur(p.duration)}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: rest ? C.pencil : C.ink, textDecoration: rest ? "line-through" : "none" }}>{h.name}</div>
        {streak > 0 && <div style={{ fontSize: 12, color: C.green, marginTop: 2 }}>連續 {streak} 次</div>}
        {warn && !value && <div style={{ fontSize: 12, color: C.green, marginTop: 2 }}>上次漏了，今天完成就能接回</div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={() => onSet(done ? null : "min")} aria-pressed={done} style={btn(done, C.green, "#fff")}>
          {done ? "✓ 達成" : "達成"}
        </button>
        {done ? (
          <button onClick={() => onSet(value === "full" ? "min" : "full")} aria-pressed={value === "full"} style={btn(value === "full", "#B8860B", "#fff")}>
            超標
          </button>
        ) : (
          <button onClick={() => onSet(rest ? null : "rest")} aria-pressed={rest} style={btn(rest, C.pencil, "#fff")}>
            休假
          </button>
        )}
      </div>
    </div>
  );
}

function Today({ data, setData, today, onReview, onBody }) {
  const [view, setView] = useState(today);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const wd = parse(view).getDay();
  const isToday = view === today;
  const planOn = makePlanOn(data.planHistory);
  const items = planOn(view).map((h, i) => ({ h, p: h.schedule[wd], i }))
    .filter((x) => x.p)
    .sort((a, b) => sortKey(a.p.time) - sortKey(b.p.time) || a.i - b.i);
  const rec = data.records[view] || {};
  const restCount = items.filter((x) => rec[x.h.id] === "rest").length;
  const doneCount = items.filter((x) => rec[x.h.id] && rec[x.h.id] !== "rest").length;
  const nowH = now.getHours() + now.getMinutes() / 60;
  const pending = items.filter((x) => !rec[x.h.id]);
  const overdue = isToday ? pending.filter((x) => sortKey(x.p.time) <= nowH) : [];
  const lateIds = new Set(overdue.map((x) => x.h.id));
  const nextUp = pending.find((x) => sortKey(x.p.time) > nowH);
  const needBody = isToday && wd === 0 && !(data.body || {})[mondayOf(today)];

  let banner = null;
  if (isToday && items.length) {
    if (!pending.length) banner = { urgent: false, title: "今天的項目都完成了", sub: "好好休息，明天繼續" };
    else if (nowH >= 23) banner = { urgent: true, title: "睡前打卡時間", sub: `還有 ${pending.length} 項沒打卡。做了就勾，今天休息就標休假` };
    else if (overdue.length) {
      const cur = overdue[overdue.length - 1];
      banner = { urgent: true, title: `該做了：${cur.h.name}${cur.p.time ? `（${cur.p.time}）` : ""}`, sub: overdue.length > 1 ? `另外還有 ${overdue.length - 1} 項已過時間還沒做` : `時間不夠的話，先做一點也好` };
    } else if (nextUp) banner = { urgent: false, title: `下一項：${nextUp.h.name}${nextUp.p.time ? `（${nextUp.p.time}）` : ""}`, sub: `今天還有 ${pending.length} 項` };
  }

  const restAll = () => setData((d) => {
    const day = { ...(d.records[view] || {}) };
    for (const x of items) if (!day[x.h.id]) day[x.h.id] = "rest";
    return { ...d, records: { ...d.records, [view]: day } };
  });

  const set = (id, v) => setData((d) => {
    const day = { ...(d.records[view] || {}) };
    if (v) day[id] = v; else delete day[id];
    return { ...d, records: { ...d.records, [view]: day } };
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <Arrow dir="‹" label="前一天" onClick={() => setView(addDays(view, -1))} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{label(view)}</div>
          <div style={{ fontSize: 14, color: C.pencil }}>{DAY_TYPE[wd]}，完成 {doneCount} / {items.length - restCount} 項{restCount ? `，休假 ${restCount} 項` : ""}</div>
        </div>
        <Arrow dir="›" label="後一天" disabled={isToday} onClick={() => setView(addDays(view, 1))} />
      </div>
      {!isToday && (
        <button onClick={() => setView(today)} style={{ display: "block", margin: "6px auto 0", fontSize: 14, color: C.green, textDecoration: "underline" }}>回到今天</button>
      )}
      {isToday && (banner || needBody || wd === 0) && (
        <div role="status" style={{ marginTop: 14, borderRadius: 12, background: C.card, border: `1px solid ${C.line}`, borderLeft: `6px solid ${banner && banner.urgent ? C.flag : C.green}`, overflow: "hidden" }}>
          {banner && (
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{banner.title}</div>
              <div style={{ fontSize: 14, color: C.pencil, marginTop: 2 }}>{banner.sub}</div>
            </div>
          )}
          {needBody && (
            <button onClick={onBody} style={{ display: "flex", justifyContent: "space-between", width: "100%", minHeight: 44, padding: "10px 14px", borderTop: banner ? `1px solid ${C.line}` : "none", fontSize: 15, fontWeight: 600, color: C.ink, textAlign: "left" }}>
              <span>記錄本週體重和腰圍</span><span style={{ color: C.green }}>›</span>
            </button>
          )}
          {wd === 0 && (
            <button onClick={onReview} style={{ display: "flex", justifyContent: "space-between", width: "100%", minHeight: 44, padding: "10px 14px", borderTop: banner || needBody ? `1px solid ${C.line}` : "none", fontSize: 15, fontWeight: 600, color: C.ink, textAlign: "left" }}>
              <span>花 10 分鐘做每週回顧</span><span style={{ color: C.green }}>›</span>
            </button>
          )}
        </div>
      )}
      {items.length === 0 && <p style={{ marginTop: 24, color: C.pencil }}>這天沒有排任何項目，可以到「行程」新增。</p>}
      {[["todo", items.filter((x) => !rec[x.h.id])], ["done", items.filter((x) => rec[x.h.id])]].map(([k, list]) =>
        list.length > 0 && (
          <div key={k} style={{ marginTop: 14 }}>
            {k === "done" && <div style={{ fontSize: 13, color: C.pencil, fontWeight: 600, marginBottom: 2 }}>已打卡（{list.length}）</div>}
            {list.map(({ h, p }) => {
              const st = streakOf(h.id, data.records, today, data.start, planOn);
              return <HabitRow key={h.id} h={h} p={p} value={rec[h.id]} onSet={(v) => set(h.id, v)}
                streak={isToday ? st.streak : 0} warn={isToday && st.prevMissed} late={lateIds.has(h.id)} />;
            })}
          </div>
        ))}
      {pending.length > 0 && (
        <button onClick={restAll} style={{ marginTop: 12, fontSize: 14, color: C.pencil, textDecoration: "underline" }}>
          把還沒打卡的項目全部標成休假
        </button>
      )}
      <p style={{ fontSize: 13, color: C.pencil, marginTop: 12 }}>休假不算漏；漏一次不會斷，連續漏兩次才重算</p>
    </div>
  );
}

// ---------- 行程編輯 ----------
function EditHabit({ habit, cats, onSave, onCancel, onDelete }) {
  const [d, setD] = useState(() => JSON.parse(JSON.stringify(habit)));
  const [sel, setSel] = useState(() => WEEK.filter((w) => habit.schedule[w]));
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(habit);
  const sc = d.schedule;
  const order = (ws) => WEEK.filter((w) => ws.includes(w));
  const toggleSel = (w) => setSel((x) => (x.includes(w) ? x.filter((y) => y !== w) : order([...x, w])));

  // 已選日子共同的值；各天不同時回傳 null
  const common = (k) => {
    const vals = sel.filter((w) => sc[w]).map((w) => String(sc[w][k] ?? ""));
    if (!vals.length) return "";
    return vals.every((v) => v === vals[0]) ? vals[0] : null;
  };
  const template = () => {
    const w = sel.find((x) => sc[x]) ?? WEEK.find((x) => sc[x]);
    return w !== undefined ? { ...sc[w] } : { time: "", duration: "", full: "", content: [] };
  };
  const setField = (k, v) => setD((x) => {
    const base = template();
    const next = { ...x.schedule };
    for (const w of sel) next[w] = { ...(next[w] || base), [k]: v };
    return { ...x, schedule: next };
  });
  const arrange = (on) => setD((x) => {
    const base = template();
    const next = { ...x.schedule };
    for (const w of sel) { if (on) next[w] = next[w] || { ...base }; else delete next[w]; }
    return { ...x, schedule: next };
  });

  const quick = [["全選", WEEK], ["平日", [1, 2, 3, 4, 5]], ["週末", [6, 0]], ["已安排", WEEK.filter((w) => sc[w])], ["清除", []]];
  const selLabel = sel.length === 7 ? "每日" : `週${sel.map((w) => WD[w]).join("")}`;
  const anyOff = sel.some((w) => !sc[w]), anyOn = sel.some((w) => sc[w]);
  const sub = { fontSize: 13, color: C.pencil };
  const field = (k, lab, props = {}) => {
    const v = common(k);
    return (
      <label style={{ display: "block", ...(props.wrap || {}) }}>
        <span style={sub}>{lab}</span>
        <input {...(props.input || {})} value={v ?? ""} placeholder={v === null ? "各天不同，輸入後統一" : props.ph || ""}
          onChange={(e) => setField(k, props.num ? (e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0)) : e.target.value)}
          style={inputStyle} />
      </label>
    );
  };

  return (
    <div style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>{habit.name ? `編輯「${habit.name}」` : "新增項目"}</h2>
      <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
        <label>
          <span style={{ fontSize: 14, fontWeight: 600 }}>名稱</span>
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} style={inputStyle} />
        </label>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>回顧分類</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {cats.map((c) => <Pill key={c} on={d.category === c} onClick={() => setD({ ...d, category: c })}>{c}</Pill>)}
          </div>
        </div>
        <label>
          <span style={{ fontSize: 14, fontWeight: 600 }}>達成標準（每天通用）</span>
          <input value={d.min} onChange={(e) => setD({ ...d, min: e.target.value })} style={inputStyle} />
        </label>

        <div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>每週安排</span>
          <p style={{ ...sub, marginTop: 2 }}>點選日子（可多選），下方的設定會套用到所有選取的日子。</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {quick.map(([t, ws]) => (
              <button key={t} onClick={() => setSel(order(ws))}
                style={{ minHeight: 36, padding: "0 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: `1px solid ${C.line}`, background: C.card, color: C.ink }}>{t}</button>
            ))}
          </div>
          <div style={{ marginTop: 8, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: C.card }}>
            {WEEK.map((w, i) => {
              const on = sel.includes(w), e = sc[w];
              return (
                <button key={w} onClick={() => toggleSel(w)} aria-pressed={on}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 46, padding: "0 12px", borderTop: i ? `1px solid ${C.line}` : "none", background: on ? "#E6EFE9" : "transparent", textAlign: "left" }}>
                  <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${on ? C.green : C.pencil}`, background: on ? C.green : "transparent", color: "#fff", fontSize: 13, lineHeight: "16px", textAlign: "center", flexShrink: 0 }}>{on ? "✓" : ""}</span>
                  <span style={{ width: 34, fontSize: 15, fontWeight: 700 }}>週{WD[w]}</span>
                  <span style={{ flex: 1, fontSize: 14, color: e ? C.ink : C.pencil }}>
                    {e ? [e.time || "未排時間", fmtDur(e.duration)].filter(Boolean).join("，") : "未安排"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ background: C.card, border: `1.5px solid ${sel.length ? C.green : C.line}`, borderRadius: 10, padding: "12px 14px" }}>
          {!sel.length ? (
            <p style={{ fontSize: 14, color: C.pencil }}>先在上方選擇要設定的日子，可以一次選多天。</p>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 700 }}>設定 {selLabel}</div>
              {anyOff && <p style={{ ...sub, marginTop: 2 }}>未安排的日子，填入設定後會自動加入行程。</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {field("time", "時間", { ph: "20:30、早餐後", wrap: { flex: 3 } })}
                {field("duration", "時長（分）", { num: true, wrap: { flex: 2 }, input: { type: "number", inputMode: "numeric", min: "0" } })}
              </div>
              <div style={{ marginTop: 8 }}>{field("full", "超標標準")}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {anyOff && (
                  <button onClick={() => arrange(true)} style={{ flex: 1, minHeight: 42, borderRadius: 8, border: `1.5px solid ${C.green}`, color: C.green, fontWeight: 700, fontSize: 14 }}>加入行程</button>
                )}
                {anyOn && (
                  <button onClick={() => arrange(false)} style={{ flex: 1, minHeight: 42, borderRadius: 8, border: `1.5px solid ${C.warn}`, color: C.warn, fontWeight: 700, fontSize: 14 }}>取消安排</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button disabled={!d.name.trim()}
          onClick={() => {
            const out = {};
            for (const [k, v] of Object.entries(d.schedule)) out[k] = { ...v, content: (v.content || []).map((t) => t.trim()).filter(Boolean) };
            onSave({ ...d, name: d.name.trim(), schedule: out });
          }}
          style={{ flex: 1, height: 48, borderRadius: 10, background: d.name.trim() ? C.green : C.line, color: "#fff", fontWeight: 700, fontSize: 16 }}>
          儲存
        </button>
        <button onClick={() => (dirty && !confirmCancel ? setConfirmCancel(true) : onCancel())}
          style={{ flex: 1, height: 48, borderRadius: 10, border: `1.5px solid ${confirmCancel ? C.warn : C.ink}`, color: confirmCancel ? C.warn : C.ink, fontWeight: 700, fontSize: 15 }}>
          {confirmCancel ? "放棄變更？再按一次" : "取消"}
        </button>
      </div>
      {dirty && <p style={{ ...sub, marginTop: 8 }}>有尚未儲存的變更，按「儲存」後才會生效。</p>}
      {onDelete && (
        <button onClick={() => (confirmDel ? onDelete() : setConfirmDel(true))}
          style={{ marginTop: 16, minHeight: 44, fontSize: 14, color: C.warn, textDecoration: "underline" }}>
          {confirmDel ? "再按一次確認刪除這個項目" : "刪除這個項目"}
        </button>
      )}
    </div>
  );
}

function Plan({ data, setData, today }) {
  const [editing, setEditing] = useState(null); // habit id 或 "new"
  const [day, setDay] = useState(() => parse(today).getDay());
  const [flash, setFlash] = useState("");
  const habits = currentHabits(data);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  if (editing) {
    const isNew = editing === "new";
    const habit = isNew
      ? { id: "h" + Date.now(), name: "", category: data.cats[0], min: "", schedule: {} }
      : habits.find((h) => h.id === editing);
    return (
      <EditHabit habit={habit} cats={data.cats} onCancel={() => setEditing(null)}
        onSave={(h) => {
          setData((d) => {
            const cur = currentHabits(d);
            return withHabits(d, isNew ? [...cur, h] : cur.map((x) => (x.id === h.id ? h : x)), today);
          });
          setEditing(null);
          setFlash(`已儲存「${h.name}」`);
        }}
        onDelete={isNew ? null : () => {
          setData((d) => withHabits(d, currentHabits(d).filter((x) => x.id !== habit.id), today));
          setEditing(null);
          setFlash(`已刪除「${habit.name}」`);
        }} />
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      {flash && <div role="status" style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#E6EFE9", color: C.green, fontWeight: 700, fontSize: 14 }}>✓ {flash}</div>}
      <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 16 }}>每日時程表</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 10 }}>
        {WEEK.map((w) => {
          const tot = dayTotal(habits, w);
          const on = day === w;
          return (
            <button key={w} onClick={() => setDay(w)} aria-pressed={on}
              style={{ padding: "6px 0", borderRadius: 8, border: `1.5px solid ${on ? C.ink : C.line}`, background: on ? C.ink : C.card, color: on ? "#fff" : C.ink }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{WD[w]}</div>
              <div style={{ fontSize: 10, opacity: 0.8, marginTop: 1, whiteSpace: "nowrap" }}>{shortDur(tot)}</div>
            </button>
          );
        })}
      </div>

      {(() => {
        const list = habits.map((h, i) => ({ h, p: h.schedule[day], i }))
          .filter((x) => x.p)
          .sort((a, b) => sortKey(a.p.time) - sortKey(b.p.time) || a.i - b.i);
        const tot = dayTotal(habits, day);
        return (
          <div style={{ marginTop: 14, background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "4px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderBottom: `1.5px solid ${C.ink}` }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>週{WD[day]}，{DAY_TYPE[day]}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>共 {fmtDur(tot) || "0 分鐘"}</span>
            </div>
            {!list.length && <p style={{ padding: "14px 0", fontSize: 14, color: C.pencil }}>這天沒有安排項目。</p>}
            {list.map(({ h, p }) => {
              const end = endTime(p.time, p.duration);
              return (
                <button key={h.id} onClick={() => setEditing(h.id)}
                  style={{ display: "flex", width: "100%", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}`, textAlign: "left" }}>
                  <span style={{ width: 62, flexShrink: 0, fontSize: 14, fontWeight: 700, color: p.time ? C.green : C.pencil, lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>
                    {p.time || "未排時間"}
                    {end && <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: C.pencil }}>～{end}</span>}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{h.name}</span>
                    <span style={{ fontSize: 12, color: C.pencil }}>{h.category}</span>
                  </span>
                  <span style={{ fontSize: 14, color: C.ink, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtDur(p.duration) || "–"}</span>
                </button>
              );
            })}
          </div>
        );
      })()}
      <p style={{ fontSize: 13, color: C.pencil, marginTop: 8 }}>點項目可以修改時間和時長。修改從今天開始生效，之前的日子仍照當時的行程計算。</p>

      <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 28 }}>所有項目</h2>
      {data.cats.map((cat) => {
        const hs = habits.filter((h) => h.category === cat);
        if (!hs.length) return null;
        return (
          <section key={cat} style={{ marginTop: 14 }}>
            <h2 style={{ fontSize: 14, color: C.pencil, fontWeight: 600 }}>{cat}</h2>
            {hs.map((h) => {
              const days = WEEK.filter((w) => h.schedule[w]);
              return (
                <button key={h.id} onClick={() => setEditing(h.id)}
                  style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.line}`, textAlign: "left" }}>
                  <span>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{h.name}</span>
                    <span style={{ fontSize: 13, color: C.pencil }}>{days.length ? durGroups(h, days) : "目前沒有排日子"}</span>
                  </span>
                  <span style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                    <span style={{ display: "block", fontSize: 12, color: C.pencil }}>每週</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.green, whiteSpace: "nowrap" }}>{fmtDur(days.reduce((t, w) => t + (+(h.schedule[w].duration) || 0), 0)) || "–"}</span>
                  </span>
                </button>
              );
            })}
          </section>
        );
      })}
      <button onClick={() => setEditing("new")}
        style={{ width: "100%", marginTop: 20, padding: "12px 0", borderRadius: 8, border: `1.5px dashed ${C.green}`, color: C.green, fontWeight: 700, fontSize: 16 }}>
        新增項目
      </button>
      <CatManager data={data} setData={setData} />
    </div>
  );
}

// ---------- 分類管理 ----------
function CatManager({ data, setData }) {
  const [edit, setEdit] = useState(null); // 正在改名的分類
  const [draft, setDraft] = useState("");
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState("");
  const used = new Set(data.planHistory.flatMap((v) => v.habits.map((h) => h.category)));
  const current = currentHabits(data);

  const check = (name, except) => {
    const n = name.trim();
    if (!n) return "請輸入分類名稱";
    if (data.cats.some((c) => c === n && c !== except)) return "已經有這個分類了";
    return "";
  };
  const rename = (old) => {
    const n = draft.trim(), e = check(n, old);
    if (e) return setErr(e);
    setData((d) => ({
      ...d,
      cats: d.cats.map((c) => (c === old ? n : c)),
      planHistory: d.planHistory.map((v) => ({ ...v, habits: v.habits.map((h) => (h.category === old ? { ...h, category: n } : h)) })),
    }));
    setEdit(null); setErr("");
  };
  const add = () => {
    const n = newName.trim(), e = check(n);
    if (e) return setErr(e);
    setData((d) => ({ ...d, cats: [...d.cats, n] }));
    setNewName(""); setErr("");
  };
  const smallBtn = { minHeight: 40, padding: "0 12px", borderRadius: 8, fontSize: 14, fontWeight: 700 };

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700 }}>分類</h2>
      <p style={{ fontSize: 13, color: C.pencil, marginTop: 4 }}>分類決定每週回顧的列。改名會一併更新過去的紀錄。</p>
      <div style={{ marginTop: 8 }}>
        {data.cats.map((c) => {
          const n = current.filter((h) => h.category === c).length;
          return (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.line}` }}>
              {edit === c ? (
                <>
                  <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rename(c)}
                    aria-label={`${c}的新名稱`} style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
                  <button onClick={() => rename(c)} style={{ ...smallBtn, background: C.green, color: "#fff" }}>儲存</button>
                  <button onClick={() => { setEdit(null); setErr(""); }} style={{ ...smallBtn, color: C.pencil }}>取消</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{c}</span>
                    <span style={{ fontSize: 13, color: C.pencil, marginLeft: 8 }}>{n} 個項目</span>
                  </span>
                  <button onClick={() => { setEdit(c); setDraft(c); setErr(""); }} style={{ ...smallBtn, color: C.green }}>改名</button>
                  {!used.has(c) && data.cats.length > 1 && (
                    <button onClick={() => setData((d) => ({ ...d, cats: d.cats.filter((x) => x !== c) }))} style={{ ...smallBtn, color: C.warn }}>刪除</button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={newName} placeholder="新分類名稱" onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="新分類名稱" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
        <button onClick={add} style={{ ...smallBtn, background: C.green, color: "#fff" }}>新增分類</button>
      </div>
      {err && <p role="alert" style={{ fontSize: 13, color: C.warn, marginTop: 6 }}>{err}</p>}
    </section>
  );
}

// ---------- 身型追蹤 ----------
function Trend({ title, unit, pts }) {
  if (pts.length < 2) return null;
  const W = 320, H = 130, px = 28, py = 18;
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const x = (i) => px + (i * (W - px * 2)) / (pts.length - 1);
  const y = (v) => py + ((hi - v) * (H - py * 2)) / (hi - lo);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join(" ");
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}趨勢</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", marginTop: 6, background: C.card, border: `1px solid ${C.line}`, borderRadius: 6 }} role="img" aria-label={`${title}趨勢圖`}>
        <path d={path} fill="none" stroke={C.green} strokeWidth="2" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.v)} r="3.5" fill={C.green} />
            {(i === 0 || i === pts.length - 1) && (
              <text x={x(i)} y={y(p.v) - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill={C.ink}>{p.v}{unit}</text>
            )}
            {(i === 0 || i === pts.length - 1) && (
              <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="10" fill={C.pencil}>{p.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function Body({ data, setData, today }) {
  const body = data.body || {};
  const wk = mondayOf(today);
  const cur = body[wk] || {};
  const [weight, setWeight] = useState(cur.weight ?? "");
  const [waist, setWaist] = useState(cur.waist ?? "");
  const [saved, setSaved] = useState(false);
  const list = Object.keys(body).sort().map((k) => body[k]);
  const short = (ds) => ds.slice(5).replace("-", "/");

  const save = () => {
    const w = parseFloat(weight), c = parseFloat(waist);
    const entry = { date: today };
    if (!isNaN(w)) entry.weight = w;
    if (!isNaN(c)) entry.waist = c;
    if (entry.weight === undefined && entry.waist === undefined) return;
    setData((d) => ({ ...d, body: { ...(d.body || {}), [wk]: entry } }));
    setSaved(true);
  };

  const diff = (k, unit) => {
    const vals = list.filter((e) => e[k] !== undefined);
    if (vals.length < 2) return null;
    const d = +(vals[vals.length - 1][k] - vals[0][k]).toFixed(1);
    return `${d > 0 ? "+" : ""}${d} ${unit}`;
  };
  const wd = diff("weight", "kg"), cd = diff("waist", "cm");
  const series = (k) => list.filter((e) => e[k] !== undefined).slice(-12).map((e) => ({ v: e[k], label: short(e.date) }));

  return (
    <div>
      <div style={{ marginTop: 16, padding: 16, background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{cur.date ? "本週紀錄（可修改）" : "記錄本週身型"}</div>
        <p style={{ fontSize: 13, color: C.pencil, marginTop: 4 }}>建議每週固定同一天早上起床、上完廁所後量，條件一致才看得出變化。</p>
        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>體重（kg）</span>
            <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => { setWeight(e.target.value); setSaved(false); }} style={inputStyle} />
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>腰圍（cm）</span>
            <input type="number" inputMode="decimal" step="0.1" value={waist} onChange={(e) => { setWaist(e.target.value); setSaved(false); }} style={inputStyle} />
          </label>
        </div>
        <button onClick={save} style={{ width: "100%", marginTop: 12, padding: "11px 0", borderRadius: 8, background: C.green, color: "#fff", fontWeight: 700, fontSize: 16 }}>
          {saved ? "已儲存" : "儲存"}
        </button>
      </div>

      {(wd || cd) && (
        <p style={{ marginTop: 16, fontSize: 15 }}>
          從第一次紀錄到現在：{[wd && `體重 ${wd}`, cd && `腰圍 ${cd}`].filter(Boolean).join("，")}
        </p>
      )}
      {list.length < 2 && <p style={{ marginTop: 16, fontSize: 14, color: C.pencil }}>記錄兩週以上，就會出現趨勢圖。</p>}
      <Trend title="體重" unit="kg" pts={series("weight")} />
      <Trend title="腰圍" unit="cm" pts={series("waist")} />

      {list.length > 0 && (
        <table style={{ width: "100%", marginTop: 20, borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ color: C.pencil, textAlign: "left" }}>
              <th style={{ padding: "6px 0", fontWeight: 600 }}>日期</th>
              <th style={{ padding: "6px 0", fontWeight: 600 }}>體重</th>
              <th style={{ padding: "6px 0", fontWeight: 600 }}>腰圍</th>
            </tr>
          </thead>
          <tbody>
            {[...list].reverse().map((e) => (
              <tr key={e.date} style={{ borderTop: `1px solid ${C.line}`, fontVariantNumeric: "tabular-nums" }}>
                <td style={{ padding: "8px 0" }}>{short(e.date)}</td>
                <td>{e.weight !== undefined ? `${e.weight} kg` : "–"}</td>
                <td>{e.waist !== undefined ? `${e.waist} cm` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- 每週回顧 ----------
function Review({ data, setData, today }) {
  const [mon, setMon] = useState(mondayOf(today));
  const [confirmReset, setConfirmReset] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const review = data.reviews[mon] || {};
  const isCurrent = mon === mondayOf(today);

  const [draft, setDraft] = useState(review);
  const [savedMsg, setSavedMsg] = useState(false);
  useEffect(() => { setDraft(data.reviews[mon] || {}); setSavedMsg(false); }, [mon]);
  const reviewDirty = ["good", "stuck", "adjust"].some((k) => (draft[k] || "") !== (review[k] || ""));
  const setField = (k, v) => { setDraft((x) => ({ ...x, [k]: v })); setSavedMsg(false); };
  const saveReview = () => { setData((d) => ({ ...d, reviews: { ...d.reviews, [mon]: { ...draft } } })); setSavedMsg(true); };

  const planOn = makePlanOn(data.planHistory);
  const rows = data.cats.map((cat) => {
    let sched = 0, done = 0;
    const cells = days.map((ds) => {
      const due = planOn(ds).filter((h) => h.category === cat).filter((h) => h.schedule[parse(ds).getDay()]);
      if (!due.length) return "none";
      if (ds > today) return "future";
      const all = due.map((h) => data.records[ds]?.[h.id]);
      const vals = all.filter((v) => v !== "rest");
      if (!vals.length) return "rest";
      if (ds >= data.start) { sched += vals.length; done += vals.filter(Boolean).length; }
      const n = vals.filter(Boolean).length;
      if (n === 0) return null;
      if (n < vals.length) return "part";
      return vals.every((v) => v === "full") ? "full" : "min";
    });
    return { cat, cells, rate: sched ? Math.round((done / sched) * 100) : null };
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <Arrow dir="‹" label="上一週" onClick={() => setMon(addDays(mon, -7))} />
        <div style={{ fontSize: 18, fontWeight: 700 }}>{label(mon).replace(/ 週.$/, "")} 起的一週</div>
        <Arrow dir="›" label="下一週" disabled={isCurrent} onClick={() => setMon(addDays(mon, 7))} />
      </div>

      <div style={{ overflowX: "auto", marginTop: 14, background: C.card, border: `1.5px solid ${C.ink}`, borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: C.green, color: "#fff" }}>
              <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>分類</th>
              {WEEK.map((w) => <th key={w} style={{ padding: "8px 2px", fontWeight: 600, width: 30 }}>{WD[w]}</th>)}
              <th style={{ padding: "8px 8px", fontWeight: 600 }}>完成率</th>
            </tr>
          </thead>
          <tbody>
            {rows.filter((r) => r.cells.some((c) => c !== "none")).map(({ cat, cells, rate }) => (
              <tr key={cat} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontWeight: 600 }}>{cat}</td>
                {cells.map((c, i) => (
                  <td key={i} style={{ textAlign: "center", padding: "6px 0", borderLeft: `1px solid ${C.line}` }}>
                    {c === "none" ? <span style={{ color: C.line }}>–</span>
                      : c === "future" ? <span style={{ color: C.line }}>·</span>
                      : <span style={{ display: "inline-block", verticalAlign: "middle" }}><Mark v={c} size={20} /></span>}
                  </td>
                ))}
                <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", borderLeft: `1px solid ${C.line}`, fontWeight: 700, color: rate !== null && rate < 50 ? C.warn : C.ink }}>
                  {rate === null ? "–" : `${rate}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 13, color: C.pencil, marginTop: 8 }}>虛線圈：當天這個分類只完成了一部分；休假的項目不計入完成率</p>

      <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
        {[["good", "這週順利的"], ["stuck", "卡住或常漏的"], ["adjust", "下週要調整什麼"]].map(([k, t]) => (
          <label key={k} style={{ display: "block" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{t}</span>
            <textarea rows={3} value={draft[k] || ""} onChange={(e) => setField(k, e.target.value)}
              style={{ ...inputStyle, marginTop: 6, resize: "vertical" }} />
          </label>
        ))}
        <button onClick={saveReview} disabled={!reviewDirty}
          style={{ height: 48, borderRadius: 10, background: reviewDirty ? C.green : C.line, color: "#fff", fontWeight: 700, fontSize: 16 }}>
          {savedMsg && !reviewDirty ? "✓ 已儲存" : "儲存回顧"}
        </button>
        {reviewDirty && <p style={{ fontSize: 13, color: C.pencil }}>有尚未儲存的內容。</p>}
      </div>

      <Backup data={data} setData={setData} today={today} />
      <div style={{ marginTop: 32, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <button onClick={() => {
            if (confirmReset) { setData((d) => ({ ...d, start: today, records: {}, reviews: {}, planHistory: [{ from: today, habits: currentHabits(d) }] })); setConfirmReset(false); }
            else setConfirmReset(true);
          }}
          style={{ fontSize: 13, color: C.warn, textDecoration: "underline" }}>
          {confirmReset ? "再按一次確認清除所有打卡與回顧紀錄" : "清除所有打卡與回顧紀錄"}
        </button>
      </div>
    </div>
  );
}

// ---------- 資料檢查：讀到不完整的舊資料時自動補齊 ----------
function normalize(raw, today) {
  const obj = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
  const d = obj(raw);
  const start = typeof d.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.start) ? d.start : today;
  let hist = Array.isArray(d.planHistory) ? d.planHistory.filter((v) => v && typeof v.from === "string" && Array.isArray(v.habits)) : [];
  if (!hist.length) hist = [{ from: start, habits: Array.isArray(d.habits) ? d.habits : defaultHabits() }];
  const defs = Object.fromEntries(defaultHabits().map((h) => [h.id, h]));
  const fillDur = (h) => {
    const sch = {};
    for (const [w, e] of Object.entries(obj(h.schedule))) {
      const x = obj(e);
      const dur = x.duration !== undefined ? x.duration : defs[h.id]?.schedule[w]?.duration ?? (parseDur(x.full) || "");
      sch[w] = { ...x, duration: dur };
    }
    return sch;
  };
  hist = hist.map((v) => ({
    from: v.from,
    habits: v.habits
      .filter((h) => h && h.id && h.name)
      .map((h) => ({ ...h, category: typeof h.category === "string" && h.category.trim() ? h.category : CATS[0], min: h.min || "", schedule: fillDur(h) })),
  }));
  const cats = [];
  for (const c of Array.isArray(d.cats) ? d.cats : CATS) if (typeof c === "string" && c.trim() && !cats.includes(c)) cats.push(c);
  for (const v of hist) for (const h of v.habits) if (!cats.includes(h.category)) cats.push(h.category);
  if (!cats.length) cats.push(...CATS);
  return { start, records: obj(d.records), reviews: obj(d.reviews), body: obj(d.body), planHistory: hist, cats };
}

class Guard extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ padding: 24, fontFamily: "sans-serif", color: C.ink }}>
        <p style={{ fontWeight: 700 }}>App 發生錯誤，無法顯示。</p>
        <p style={{ fontSize: 13, color: C.pencil, marginTop: 8, wordBreak: "break-all" }}>{String(this.state.err && this.state.err.message)}</p>
        <button onClick={async () => { try { await window.storage.delete(KEY, false); } catch (e) {} this.setState({ err: null }); location.reload(); }}
          style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: C.warn, color: "#fff", fontWeight: 700 }}>
          清除資料並重新開始
        </button>
      </div>
    );
  }
}

const hasStorage = () => typeof window !== "undefined" && window.storage && typeof window.storage.set === "function";

// ---------- 備份：匯出、匯入 ----------
function Backup({ data, setData, today }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const json = () => JSON.stringify(data);
  const copy = async () => {
    try { await navigator.clipboard.writeText(json()); setMsg("已複製備份內容，貼到記事本或備忘錄保存即可。"); }
    catch (e) { setText(json()); setMsg("無法自動複製，備份內容已放在下方框內，請全選後手動複製。"); }
  };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([json()], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `每日記分卡備份-${today}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg("已下載備份檔。如果沒有出現下載，請改用「複製備份」。");
    } catch (e) { setMsg("這個環境無法下載檔案，請改用「複製備份」。"); }
  };
  const restore = () => {
    try {
      const raw = JSON.parse(text);
      if (!raw || typeof raw !== "object" || !raw.records) throw new Error();
      setData(normalize(raw, today));
      setText(""); setMsg("已從備份還原。");
    } catch (e) { setMsg("備份內容無法辨識，請確認貼上的是完整的備份文字。"); }
  };
  const b = { flex: 1, minHeight: 44, borderRadius: 10, fontWeight: 700, fontSize: 14 };
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700 }}>資料備份</h2>
      <p style={{ fontSize: 13, color: C.pencil, marginTop: 4 }}>更新 App 版本或換裝置前，先匯出備份；之後貼回下方框內即可還原。</p>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={copy} style={{ ...b, background: C.green, color: "#fff" }}>複製備份</button>
        <button onClick={download} style={{ ...b, border: `1.5px solid ${C.green}`, color: C.green }}>下載備份檔</button>
      </div>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="要還原時，把備份內容貼在這裡"
        aria-label="備份內容" style={{ ...inputStyle, marginTop: 10, fontSize: 13, resize: "vertical" }} />
      <button onClick={restore} disabled={!text.trim()}
        style={{ ...b, width: "100%", marginTop: 8, border: `1.5px solid ${text.trim() ? C.ink : C.line}`, color: text.trim() ? C.ink : C.pencil }}>
        從備份還原
      </button>
      {msg && <p role="status" style={{ fontSize: 13, color: C.green, marginTop: 6 }}>{msg}</p>}
    </section>
  );
}

// ---------- 主程式 ----------
export default function App() {
  return <Guard><Main /></Guard>;
}

function Main() {
  const today = fmt(new Date());
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("today");
  const [save, setSave] = useState({ state: "idle", at: "" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    (async () => {
      let loaded = null;
      try {
        if (!hasStorage()) throw new Error("no storage");
        const r = await Promise.race([
          window.storage.get(KEY, false),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
        ]);
        if (r && r.value) loaded = JSON.parse(r.value);
      } catch (e) { /* 第一次使用或讀取失敗 */ }
      setData(normalize(loaded, today));
    })();
  }, []);

  useEffect(() => {
    if (!data) return;
    if (!hasStorage()) { setSave({ state: "unavailable", at: "", why: "" }); return; }
    let alive = true;
    setSave((x) => ({ ...x, state: "saving" }));
    // 連續操作時合併成一次寫入，避免寫入太頻繁被拒絕
    const timer = setTimeout(async () => {
      let ok = false, why = "";
      const body = JSON.stringify(data);
      for (let i = 0; i < 3 && !ok && alive; i++) {
        if (i) await new Promise((r) => setTimeout(r, 800 * i));
        try {
          const r = await window.storage.set(KEY, body, false);
          ok = r !== null; // 部分環境成功時不回傳內容，只有 null 代表失敗
          if (!ok) why = "儲存空間拒絕寫入";
        } catch (e) { why = (e && e.message) || "未知錯誤"; }
      }
      if (!alive) return;
      const t = new Date();
      setSave(ok ? { state: "saved", at: `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}` } : { state: "error", at: "", why });
    }, 600);
    return () => { alive = false; clearTimeout(timer); };
  }, [data, retry]);

  const tabs = [["today", "今天"], ["plan", "行程"], ["review", "回顧"], ["body", "身型"]];

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif' }}>
      <style>{`button:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid ${C.flag}; outline-offset: 2px; }`}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 18px 48px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true">
            <line x1="3" y1="2" x2="3" y2="27" stroke={C.ink} strokeWidth="2" />
            <path d="M4 3 L20 8 L4 13 Z" fill={C.flag} />
          </svg>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1, flex: 1 }}>每日記分卡</h1>
          {save.state === "saving" && <span style={{ fontSize: 13, color: C.pencil }}>儲存中…</span>}
          {save.state === "saved" && <span style={{ fontSize: 13, color: C.green }}>✓ 已儲存 {save.at}</span>}
          {save.state === "error" && (
            <button onClick={() => setRetry((n) => n + 1)} style={{ fontSize: 13, color: C.warn, fontWeight: 700, minHeight: 36, textDecoration: "underline" }}>儲存失敗，重試</button>
          )}
          {save.state === "unavailable" && <span style={{ fontSize: 13, color: C.warn, fontWeight: 700 }}>未連接儲存</span>}
        </header>

        <nav style={{ display: "flex", marginTop: 16, border: `1.5px solid ${C.ink}`, borderRadius: 8, overflow: "hidden" }}>
          {tabs.map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
              style={{ flex: 1, height: 44, fontSize: 15, fontWeight: 700, background: tab === k ? C.ink : "transparent", color: tab === k ? "#fff" : C.ink }}>
              {t}
            </button>
          ))}
        </nav>


        {(save.state === "error" || save.state === "unavailable") && (
          <div role="alert" style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#FBEDE6", color: C.warn, fontSize: 13, lineHeight: 1.6 }}>
            {save.state === "unavailable"
              ? "目前的執行環境沒有提供儲存功能，紀錄只會保留到關閉 App 為止。請到「回顧」頁底部用「匯出備份」保存資料。"
              : `這次沒有存成功${save.why ? `（${save.why}）` : ""}。可以按右上角重試；如果一直失敗，請到「回顧」頁底部匯出備份。`}
          </div>
        )}
        {!data ? <p style={{ marginTop: 40, textAlign: "center", color: C.pencil }}>載入紀錄中…</p>
          : tab === "today" ? <Today data={data} setData={setData} today={today} onReview={() => setTab("review")} onBody={() => setTab("body")} />
          : tab === "plan" ? <Plan data={data} setData={setData} today={today} />
          : tab === "body" ? <Body data={data} setData={setData} today={today} />
          : <Review data={data} setData={setData} today={today} />}
      </div>
    </div>
  );
}

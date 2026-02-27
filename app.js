(() => {
  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");

  const ansEl = document.getElementById("ans");
  const resEl = document.getElementById("result");
  const workEl = document.getElementById("work");

  const btnNew = document.getElementById("btnNew");
  const btnCheck = document.getElementById("btnCheck");
  const btnReveal = document.getElementById("btnReveal");
  const btnCopy = document.getElementById("btnCopy");

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

  const BASES = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
  function randomOhms() {
    const mult = pick([1, 10, 100]); // 10..8200
    const val = pick(BASES) * mult;
    if (Math.random() < 0.18) return pick([100, 120, 150, 180, 220, 270, 330, 390, 470, 560, 680, 820]);
    return val;
  }

  // 10 possible positions
  const SLOTS = ["TL1","TL2","TR1","TR2","BL1","BL2","BR1","BR2","V1","V2"];
  const GROUPS = {
    leftTop: ["TL1","TL2"],
    leftBot: ["BL1","BL2"],
    rightTop: ["TR1","TR2"],
    rightBot: ["BR1","BR2"],
    vert: ["V1","V2"],
    rightBranch: ["TR1","TR2","BR1","BR2"]
  };

  const P = {
    A_y: 130,
    B_y: 390,
    L_x: 120,
    M_x: 560,
    R_x: 980,

    TL1_x: 250, TL2_x: 410, TR1_x: 680, TR2_x: 840,
    BL1_x: 250, BL2_x: 410, BR1_x: 680, BR2_x: 840,

    V1_y: 220, V2_y: 300
  };

  let state = null;

  function setResult(text, cls) {
    resEl.className = `result ${cls || ""}`.trim();
    resEl.textContent = text;
  }

  function fmt2(v) {
    return Number(v).toFixed(2);
  }

  function parallel2(a, b) {
    return (a * b) / (a + b);
  }

  function joinSeriesFormula(names) {
    return names.join("+");
  }

  function newProblem() {
    const k = randInt(2, 10);

    const chosen = new Set();
    // ensure parallel part exists
    chosen.add(pick(GROUPS.vert));
    chosen.add(pick(GROUPS.rightBranch));

    while (chosen.size < k) chosen.add(pick(SLOTS));

    const resistors = [];
    let i = 1;
    for (const slot of chosen) {
      resistors.push({ slot, name: `R${i}`, value: randomOhms() });
      i++;
    }

    const slotToR = {};
    for (const r of resistors) slotToR[r.slot] = r;

    const sum = (arr) => arr.reduce((a, r) => a + r.value, 0);

    const R_leftTop_list = GROUPS.leftTop.map(s => slotToR[s]).filter(Boolean);
    const R_leftBot_list = GROUPS.leftBot.map(s => slotToR[s]).filter(Boolean);

    const R_vert_list = GROUPS.vert.map(s => slotToR[s]).filter(Boolean);
    const R_rightTop_list = GROUPS.rightTop.map(s => slotToR[s]).filter(Boolean);
    const R_rightBot_list = GROUPS.rightBot.map(s => slotToR[s]).filter(Boolean);

    const R_leftTop = sum(R_leftTop_list);
    const R_leftBot = sum(R_leftBot_list);
    const R_vert = sum(R_vert_list);
    const R_right = sum(R_rightTop_list) + sum(R_rightBot_list);

    const R_mid = parallel2(R_vert, R_right);
    const Re = R_leftTop + R_mid + R_leftBot;

    state = {
      chosen,
      resistors,
      slotToR,
      Re,
      breakdown: {
        R_leftTop_list, R_leftBot_list,
        R_vert_list,
        R_rightTop_list, R_rightBot_list,
        R_leftTop, R_leftBot, R_vert, R_right, R_mid
      }
    };

    ansEl.value = "";
    workEl.textContent = "";
    setResult("Számolj, aztán nyomj egy Ellenőrzést 👇", "muted");
    draw();
  }

  function buildWork() {
    const b = state.breakdown;
    const lines = [];

    lines.push("Jelölések:");
    lines.push("  Ellenállások: R1, R2, ...");
    lines.push("  Eredő: Re");
    lines.push("");

    lines.push("Adatok:");
    state.resistors
      .slice()
      .sort((x,y)=> Number(x.name.slice(1)) - Number(y.name.slice(1)))
      .forEach(r => lines.push(`  ${r.name} = ${r.value} Ω`));
    lines.push("");

    if (b.R_leftTop_list.length > 0) {
      const names = b.R_leftTop_list.map(r => r.name);
      lines.push("1) Bal felső rész (soros):");
      lines.push(`   Re_leftTop = ${joinSeriesFormula(names)} = ${fmt2(b.R_leftTop)} Ω`);
      lines.push("");
    } else {
      lines.push("1) Bal felső rész: nincs ellenállás (vezeték), ezért Re_leftTop = 0 Ω");
      lines.push("");
    }

    if (b.R_leftBot_list.length > 0) {
      const names = b.R_leftBot_list.map(r => r.name);
      lines.push("2) Bal alsó rész (soros):");
      lines.push(`   Re_leftBot = ${joinSeriesFormula(names)} = ${fmt2(b.R_leftBot)} Ω`);
      lines.push("");
    } else {
      lines.push("2) Bal alsó rész: nincs ellenállás (vezeték), ezért Re_leftBot = 0 Ω");
      lines.push("");
    }

    const vNames = b.R_vert_list.map(r => r.name);
    lines.push("3) Középső ág (soros):");
    lines.push(`   Re_vert = ${joinSeriesFormula(vNames)} = ${fmt2(b.R_vert)} Ω`);
    lines.push("");

    const rNames = [...b.R_rightTop_list, ...b.R_rightBot_list].map(r => r.name);
    lines.push("4) Jobb oldali kerülő ág (soros):");
    lines.push(`   Re_right = ${joinSeriesFormula(rNames)} = ${fmt2(b.R_right)} Ω`);
    lines.push("");

    lines.push("5) A két ág párhuzamos:");
    lines.push("      Re_vert × Re_right");
    lines.push("   Re_mid = ---------------- =");
    lines.push("      Re_vert + Re_right");
    lines.push(`         (${fmt2(b.R_vert)} × ${fmt2(b.R_right)}) / (${fmt2(b.R_vert)} + ${fmt2(b.R_right)}) = ${fmt2(b.R_mid)} Ω`);
    lines.push("");

    lines.push("6) Teljes eredő (soros):");
    lines.push("   Re = Re_leftTop + Re_mid + Re_leftBot");
    lines.push(`   Re = ${fmt2(b.R_leftTop)} + ${fmt2(b.R_mid)} + ${fmt2(b.R_leftBot)} = ${fmt2(state.Re)} Ω`);

    return lines.join("\n");
  }

  function check() {
    if (!state) return;
    const user = Number(ansEl.value);
    if (!isFinite(user)) {
      setResult("Tesó, számként írd be (pl. 123.45).", "bad");
      return;
    }

    const real = state.Re;
    const tol = Math.max(Math.abs(real) * 0.005, 0.05);
    const ok = Math.abs(user - real) <= tol;

    const realTxt = fmt2(real);
    if (ok) setResult(`Helyes ✅  Re = ${realTxt} Ω`, "good");
    else setResult(`Nem jó ❌  Helyes: Re = ${realTxt} Ω`, "bad");

    workEl.textContent = buildWork();
  }

  function reveal() {
    if (!state) return;
    setResult(`Megoldás: Re = ${fmt2(state.Re)} Ω`, "muted");
    workEl.textContent = buildWork();
  }

  async function copyWork() {
    const txt = workEl.textContent || "";
    if (!txt.trim()) {
      setResult("Nincs még levezetés. Nyomj Ellenőrzést vagy Megoldást.", "muted");
      return;
    }
    try {
      await navigator.clipboard.writeText(txt);
      setResult("Levezetés kimásolva 📋", "good");
    } catch {
      setResult("Nem tudtam vágólapra másolni (böngésző tiltja).", "bad");
    }
  }

  // ====== Drawing ======
  function draw() {
    if (!state) return;

    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);

    // no grid, just soft glow
    ctx.save();
    const grad = ctx.createRadialGradient(w*0.25, h*0.2, 40, w*0.5, h*0.5, w*0.75);
    grad.addColorStop(0, "rgba(53,224,198,.08)");
    grad.addColorStop(0.6, "rgba(69,166,255,.05)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);
    ctx.restore();

    const A = P.A_y, B = P.B_y;
    const L = P.L_x, M = P.M_x, R = P.R_x;

    ctx.save();
    ctx.strokeStyle = "#dff6ff";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    line(L, A, R, A);
    line(L, B, R, B);
    line(M, A, M, B);
    line(R, A, R, B); // right short
    ctx.restore();

    // Labels A/B
    ctx.save();
    ctx.fillStyle = "rgba(233,243,255,.95)";
    ctx.font = "800 24px ui-sans-serif, system-ui";
    ctx.fillText("A", L - 55, A + 9);
    ctx.fillText("B", L - 55, B + 9);

    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(156,179,201,.95)";
    ctx.fillText("Kapcsok: A–B (bal oldal)", 22, 30);
    ctx.fillText("Jobb oldali rövidzár: a két sín össze van kötve", 22, 50);
    ctx.restore();

    const slots = slotDrawList(state.slotToR);
    for (const s of slots) drawResistor(s, state.slotToR[s.key]);

    ctx.save();
    ctx.fillStyle = "#35e0c6";
    dot(L, A, 8);
    dot(L, B, 8);
    ctx.fillStyle = "#45a6ff";
    dot(M, A, 7);
    dot(M, B, 7);
    dot(R, A, 7);
    dot(R, B, 7);
    ctx.restore();

    function line(x1,y1,x2,y2){
      ctx.beginPath();
      ctx.moveTo(x1,y1);
      ctx.lineTo(x2,y2);
      ctx.stroke();
    }
    function dot(x,y,r){
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
    }
  }

  function slotDrawList(slotToR) {
    const A = P.A_y, B = P.B_y;
    const list = [
      { key:"TL1", x:P.L_x+140, y:A, w:130, h:56 },
      { key:"TL2", x:P.TL1_x+160, y:A, w:130, h:56 },
      { key:"TR1", x:P.M_x+140, y:A, w:130, h:56 },
      { key:"TR2", x:P.TR1_x+160, y:A, w:130, h:56 },

      { key:"BL1", x:P.L_x+140, y:B, w:130, h:56 },
      { key:"BL2", x:P.BL1_x+160, y:B, w:130, h:56 },
      { key:"BR1", x:P.M_x+140, y:B, w:130, h:56 },
      { key:"BR2", x:P.BR1_x+160, y:B, w:130, h:56 },

      { key:"V1", x:P.M_x, y:P.A_y+110, w:70, h:118 },
      { key:"V2", x:P.M_x, y:P.V1_y+120, w:70, h:118 }
    ];
    return list.filter(s => slotToR[s.key]);
  }

  function drawResistor(s, r) {
    ctx.save();

    // block
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(233,243,255,.92)";
    ctx.fillStyle = "rgba(53,224,198,.10)";
    ctx.beginPath();
    ctx.roundRect(s.x - s.w/2, s.y - s.h/2, s.w, s.h, 12);
    ctx.fill();
    ctx.stroke();

    // text with outline (so it stays visible over wires)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "900 16px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(233,243,255,.98)";
    ctx.strokeStyle = "rgba(0,0,0,.40)";
    ctx.lineWidth = 4;
    strokeFillText(r.name, s.x, s.y - 11);

    ctx.font = "900 16px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(53,224,198,.98)";
    ctx.strokeStyle = "rgba(0,0,0,.50)";
    ctx.lineWidth = 4;
    strokeFillText(`${r.value} Ω`, s.x, s.y + 15);

    ctx.restore();
  }

  function strokeFillText(txt, x, y) {
    ctx.strokeText(txt, x, y);
    ctx.fillText(txt, x, y);
  }

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
      const rr = Math.min(r, w/2, h/2);
      this.beginPath();
      this.moveTo(x+rr, y);
      this.arcTo(x+w, y, x+w, y+h, rr);
      this.arcTo(x+w, y+h, x, y+h, rr);
      this.arcTo(x, y+h, x, y, rr);
      this.arcTo(x, y, x+w, y, rr);
      this.closePath();
      return this;
    };
  }

  btnNew.addEventListener("click", newProblem);
  btnCheck.addEventListener("click", check);
  btnReveal.addEventListener("click", reveal);
  btnCopy.addEventListener("click", copyWork);
  ansEl.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });

  newProblem();
})();

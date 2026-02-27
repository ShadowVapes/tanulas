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

  function joinSeries(names) {
    return names.join("+");
  }

  function sumValues(arr) {
    return arr.reduce((a, r) => a + r.value, 0);
  }

  function newProblem() {
    const k = randInt(2, 10);

    const chosen = new Set();
    // Ensure at least one resistor on the middle vertical branch AND at least one on the right branch
    // (so there is a real parallel part)
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

    // Collect series groups in order along the schematic
    const A_to_mid = GROUPS.leftTop.map(s => slotToR[s]).filter(Boolean);     // A -> upper-middle
    const mid_to_B = GROUPS.leftBot.map(s => slotToR[s]).filter(Boolean);     // lower-middle -> B

    const middle_branch = GROUPS.vert.map(s => slotToR[s]).filter(Boolean);   // middle vertical (series)
    const right_branch = [
      ...GROUPS.rightTop.map(s => slotToR[s]).filter(Boolean),
      ...GROUPS.rightBot.map(s => slotToR[s]).filter(Boolean)
    ]; // series via right-side short

    const S1 = sumValues(A_to_mid);
    const S2 = sumValues(middle_branch);
    const S3 = sumValues(right_branch);
    const S4 = sumValues(mid_to_B);

    const Re_par = parallel2(S2, S3);
    const Re = S1 + Re_par + S4;

    state = {
      chosen,
      resistors,
      slotToR,
      Re,
      groups: { A_to_mid, middle_branch, right_branch, mid_to_B, S1, S2, S3, S4, Re_par }
    };

    ansEl.value = "";
    workEl.textContent = "";
    setResult("Számolj, aztán nyomj egy Ellenőrzést 👇", "muted");
    draw();
  }

  function buildWork() {
    const g = state.groups;
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

    // 1) Series reductions first (as requested)
    lines.push("1) Soros kapcsolások összevonása:");

    // S1: A -> közép (felső)
    if (g.A_to_mid.length) {
      const n = g.A_to_mid.map(r => r.name);
      lines.push(`   A → közép (felső): ${joinSeries(n)} = ${fmt2(g.S1)} Ω`);
    } else {
      lines.push(`   A → közép (felső): nincs ellenállás (vezeték) = 0.00 Ω`);
    }

    // S2: középső függőleges ág
    {
      const n = g.middle_branch.map(r => r.name);
      // ensured at least one
      lines.push(`   Középső ág: ${joinSeries(n)} = ${fmt2(g.S2)} Ω`);
    }

    // S3: jobb oldali ág
    {
      const n = g.right_branch.map(r => r.name);
      lines.push(`   Jobb oldali ág: ${joinSeries(n)} = ${fmt2(g.S3)} Ω`);
    }

    // S4: közép (alsó) -> B
    if (g.mid_to_B.length) {
      const n = g.mid_to_B.map(r => r.name);
      lines.push(`   közép (alsó) → B: ${joinSeries(n)} = ${fmt2(g.S4)} Ω`);
    } else {
      lines.push(`   közép (alsó) → B: nincs ellenállás (vezeték) = 0.00 Ω`);
    }

    lines.push("");

    // 2) Parallel reduction
    lines.push("2) Párhuzamos kapcsolás összevonása (a két ág egymás mellett van):");
    lines.push("        R1×R2");
    lines.push("   Re1 = -----  =");
    lines.push("        R1+R2");
    lines.push(`   Re1 = (${fmt2(g.S2)} × ${fmt2(g.S3)}) / (${fmt2(g.S2)} + ${fmt2(g.S3)}) = ${fmt2(g.Re_par)} Ω`);
    lines.push("");

    // 3) Final series
    lines.push("3) Teljes eredő (Re) soros összeadás:");
    lines.push("   Re = (A→közép) + Re1 + (közép→B)");
    lines.push(`   Re = ${fmt2(g.S1)} + ${fmt2(g.Re_par)} + ${fmt2(g.S4)} = ${fmt2(state.Re)} Ω`);

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
    line(R, A, R, B);
    ctx.restore();

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

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(233,243,255,.92)";
    ctx.fillStyle = "rgba(53,224,198,.10)";
    ctx.beginPath();
    ctx.roundRect(s.x - s.w/2, s.y - s.h/2, s.w, s.h, 12);
    ctx.fill();
    ctx.stroke();

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

(() => {
  // ====== UI ======
  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");
  const ansEl = document.getElementById("ans");
  const resEl = document.getElementById("result");
  const workEl = document.getElementById("work");
  const btnNew = document.getElementById("btnNew");
  const btnCheck = document.getElementById("btnCheck");
  const btnReveal = document.getElementById("btnReveal");
  const btnCopy = document.getElementById("btnCopy");

  // ====== Random helpers ======
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

  // E12-ish értékek (ohm), skálázva
  const BASES = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
  function randomOhms() {
    const mult = pick([1, 10, 100]); // 10..8200
    const val = pick(BASES) * mult;
    // néha legyen "szebb" kerekítés (pl 100, 220, 330)
    const spice = Math.random();
    if (spice < 0.18) return pick([100, 120, 150, 180, 220, 270, 330, 390, 470, 560, 680, 820]);
    return val;
  }

  // ====== Circuit definition (slots) ======
  // Top rail: A_L -> TL1 -> TL2 -> A_M -> TR1 -> TR2 -> A_R
  // Bottom rail: B_L -> BL1 -> BL2 -> B_M -> BR1 -> BR2 -> B_R
  // Vertical: A_M -> V1 -> V2 -> B_M
  // Right wire short: A_R == B_R (edge with ~0 ohm)
  const SLOT_KEYS = [
    "TL1","TL2","TR1","TR2",
    "BL1","BL2","BR1","BR2",
    "V1","V2"
  ];

  // Slot positions for drawing (canvas coords)
  const P = {
    A_y: 130,
    B_y: 390,
    L_x: 120,
    M_x: 560,
    R_x: 980,

    // slot x coords
    TL1_x: 250, TL2_x: 410, TR1_x: 680, TR2_x: 840,
    BL1_x: 250, BL2_x: 410, BR1_x: 680, BR2_x: 840,

    V1_y: 220, V2_y: 300
  };

  // ====== State ======
  let state = null;

  function newProblem() {
    // Randomly decide which slots get resistors (some can be "wire" = none)
    // To keep it interesting, ensure at least 1 resistor on each rail side and on vertical.
    const present = {};
    for (const k of SLOT_KEYS) present[k] = Math.random() < 0.80; // 80% filled
    // enforce minimums
    if (![present.TL1,present.TL2].some(Boolean)) present[pick(["TL1","TL2"])] = true;
    if (![present.TR1,present.TR2].some(Boolean)) present[pick(["TR1","TR2"])] = true;
    if (![present.BL1,present.BL2].some(Boolean)) present[pick(["BL1","BL2"])] = true;
    if (![present.BR1,present.BR2].some(Boolean)) present[pick(["BR1","BR2"])] = true;
    if (![present.V1,present.V2].some(Boolean)) present[pick(["V1","V2"])] = true;

    const R = {};
    for (const k of SLOT_KEYS) {
      if (present[k]) R[k] = randomOhms();
    }

    // Build circuit graph and solve
    const { graph, nodes, edges } = buildGraph(present, R);
    const solution = solveReqNodal(graph, "A_L", "B_L");

    state = {
      present,
      R,
      graph,
      nodes,
      edges,
      req: solution.req,
      work: solution.work
    };

    ansEl.value = "";
    setResult("Várja a válaszod…", "muted");
    workEl.textContent = "";
    draw();
  }

  // ====== Graph builder ======
  function buildGraph(present, Rvals) {
    // Fixed node names
    const nodes = new Set([
      "A_L","A_TL1","A_TL2","A_M","A_TR1","A_TR2","A_R",
      "B_L","B_BL1","B_BL2","B_M","B_BR1","B_BR2","B_R",
      "V1","V2"
    ]);

    const edges = [];
    const addEdge = (a, b, ohms, label) => {
      // ignore super tiny
      edges.push({ a, b, r: ohms, label });
    };

    // Helper: slot between two nodes
    function addSlot(key, a, b) {
      if (present[key]) addEdge(a, b, Rvals[key], key);
      else addEdge(a, b, 1e-9, key + "_WIRE"); // ideal wire (approx), for solver stability
    }

    // Top left (2 slots)
    addSlot("TL1", "A_L", "A_TL1");
    addSlot("TL2", "A_TL1", "A_TL2");
    // Wire to mid
    addEdge("A_TL2", "A_M", 1e-9, "TOP_WIRE_L2M");

    // Top right (2 slots)
    addSlot("TR1", "A_M", "A_TR1");
    addSlot("TR2", "A_TR1", "A_TR2");
    addEdge("A_TR2", "A_R", 1e-9, "TOP_WIRE_R2END");

    // Bottom left (2 slots)
    addSlot("BL1", "B_L", "B_BL1");
    addSlot("BL2", "B_BL1", "B_BL2");
    addEdge("B_BL2", "B_M", 1e-9, "BOT_WIRE_L2M");

    // Bottom right (2 slots)
    addSlot("BR1", "B_M", "B_BR1");
    addSlot("BR2", "B_BR1", "B_BR2");
    addEdge("B_BR2", "B_R", 1e-9, "BOT_WIRE_R2END");

    // Vertical (2 slots)
    addSlot("V1", "A_M", "V1");
    addSlot("V2", "V1", "V2");
    addEdge("V2", "B_M", 1e-9, "V_WIRE_2M");

    // Right-side short between A_R and B_R (so right side matters)
    addEdge("A_R", "B_R", 1e-9, "RIGHT_SHORT");

    // Build adjacency
    const graph = {};
    for (const n of nodes) graph[n] = [];
    for (const e of edges) {
      graph[e.a].push(e);
      graph[e.b].push({ a: e.b, b: e.a, r: e.r, label: e.label }); // undirected
    }
    return { graph, nodes: [...nodes], edges };
  }

  // ====== Nodal solver: inject 1A from A to B, solve V, Req = V(A)-V(B) ======
  function solveReqNodal(graph, nodeA, nodeB) {
    // Choose nodeB as ground (0V). Unknowns are all other nodes that are reachable.
    const reachable = collectReachable(graph, nodeA);
    reachable.add(nodeB);

    const nodes = [...reachable];
    const idx = new Map();
    for (let i = 0; i < nodes.length; i++) idx.set(nodes[i], i);

    // Unknown nodes exclude ground
    const ground = nodeB;
    const unknown = nodes.filter(n => n !== ground);
    const N = unknown.length;

    // Build G matrix and I vector (G*V = I)
    const G = Array.from({ length: N }, () => Array(N).fill(0));
    const I = Array(N).fill(0);

    // Current injection: +1A into nodeA, -1A into ground
    // In nodal equation for unknown nodes: I[k] is net injected current.
    const inj = (n, val) => {
      if (n === ground) return;
      I[unknown.indexOf(n)] += val;
    };
    inj(nodeA, +1.0);
    // ground gets -1A implicitly

    // Fill conductances
    // For each edge u-v with resistance r:
    // G_uu += 1/r, G_vv += 1/r, G_uv -= 1/r, G_vu -= 1/r (except when ground involved)
    const seen = new Set();
    for (const u of nodes) {
      for (const e of graph[u] || []) {
        const v = e.b;
        const key = u < v ? `${u}|${v}|${e.label}` : `${v}|${u}|${e.label}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (!reachable.has(u) || !reachable.has(v)) continue;

        const g = 1 / e.r;

        const iu = unknown.indexOf(u);
        const iv = unknown.indexOf(v);

        if (u !== ground) G[iu][iu] += g;
        if (v !== ground) G[iv][iv] += g;
        if (u !== ground && v !== ground) {
          G[iu][iv] -= g;
          G[iv][iu] -= g;
        }
        // If one side is ground, it only affects diagonal of the other (already handled).
      }
    }

    const V = gaussianSolve(G, I); // returns unknown voltages
    const Vmap = {};
    for (let i = 0; i < unknown.length; i++) Vmap[unknown[i]] = V[i];
    Vmap[ground] = 0;

    const req = Vmap[nodeA] - Vmap[nodeB]; // since 1A

    const work = buildWorkText({ graph, nodeA, nodeB, unknown, G, I, Vmap, req });
    return { req, Vmap, work };
  }

  function collectReachable(graph, start) {
    const vis = new Set();
    const st = [start];
    while (st.length) {
      const u = st.pop();
      if (vis.has(u)) continue;
      vis.add(u);
      for (const e of graph[u] || []) {
        const v = e.b;
        if (!vis.has(v)) st.push(v);
      }
    }
    return vis;
  }

  // Gaussian elimination with partial pivot
  function gaussianSolve(A, b) {
    const n = A.length;
    // copy
    const M = A.map(row => row.slice());
    const x = b.slice();

    for (let col = 0; col < n; col++) {
      // pivot
      let pivot = col;
      let best = Math.abs(M[col][col]);
      for (let r = col + 1; r < n; r++) {
        const v = Math.abs(M[r][col]);
        if (v > best) { best = v; pivot = r; }
      }
      if (best < 1e-18) throw new Error("Szinguláris mátrix / rossz hálózat.");

      if (pivot !== col) {
        [M[pivot], M[col]] = [M[col], M[pivot]];
        [x[pivot], x[col]] = [x[col], x[pivot]];
      }

      // normalize row
      const diag = M[col][col];
      for (let c = col; c < n; c++) M[col][c] /= diag;
      x[col] /= diag;

      // eliminate
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col];
        if (Math.abs(f) < 1e-18) continue;
        for (let c = col; c < n; c++) M[r][c] -= f * M[col][c];
        x[r] -= f * x[col];
      }
    }
    return x;
  }

  function fmtOhm(v) {
    if (!isFinite(v)) return String(v);
    const abs = Math.abs(v);
    if (abs >= 1000) return (v/1000).toFixed(4).replace(/0+$/,'').replace(/\.$/,'') + " kΩ";
    return v.toFixed(6).replace(/0+$/,'').replace(/\.$/,'') + " Ω";
  }

  function matrixToText(G, I, unknown) {
    const lines = [];
    lines.push("Ismeretlen csomópontfeszültségek (B_L = 0 V föld):");
    lines.push("  " + unknown.map(n => n.padEnd(6)).join(" "));
    lines.push("");
    lines.push("G mátrix és I vektor (G·V = I):");
    for (let r = 0; r < G.length; r++) {
      const row = G[r].map(v => v.toExponential(3).padStart(12)).join(" ");
      lines.push(row + "   |   " + I[r].toFixed(3));
    }
    return lines.join("\n");
  }

  function buildWorkText({ graph, nodeA, nodeB, unknown, G, I, Vmap, req }) {
    const lines = [];
    lines.push("Levezetés (nodális módszer, 1 A tesztáram):");
    lines.push("");
    lines.push(`Cél: R_eredő az ${nodeA} és ${nodeB} között.`);
    lines.push(`Beállítás: ${nodeB} = 0 V (föld). Befecskendezünk +1 A áramot ${nodeA}-ba, és -1 A megy a földbe.`);
    lines.push("Ekkor R_eredő = (V(nodeA) - V(nodeB)) / 1A = V(nodeA).");
    lines.push("");

    // list elements (only real resistors, not wires)
    const real = [];
    const seen = new Set();
    for (const u in graph) {
      for (const e of graph[u]) {
        const a = u, b = e.b;
        const key = a < b ? `${a}|${b}|${e.label}` : `${b}|${a}|${e.label}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (e.r > 1e-6) real.push({ a, b, r: e.r, label: e.label });
      }
    }

    lines.push("Ellenállások (a rajzon látható fogyasztók):");
    for (const e of real.sort((x,y)=>x.label.localeCompare(y.label))) {
      lines.push(`  ${e.label}: ${e.a} — ${e.b} = ${e.r} Ω`);
    }
    lines.push("");

    lines.push(matrixToText(G, I, unknown));
    lines.push("");
    lines.push("Megoldott feszültségek (V):");
    for (const n of Object.keys(Vmap).sort()) {
      lines.push(`  ${n}: ${Vmap[n].toFixed(6)} V`);
    }
    lines.push("");
    lines.push(`=> R_eredő = V(${nodeA}) = ${req.toFixed(6)} Ω`);
    return lines.join("\n");
  }

  // ====== Drawing ======
  function draw() {
    if (!state) return;

    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);

    // background grid-ish
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#6bdcff";
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();

    // wires
    const A = P.A_y, B = P.B_y;
    const L = P.L_x, M = P.M_x, R = P.R_x;

    ctx.save();
    ctx.strokeStyle = "#dff6ff";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";

    // Top rail
    line(L, A, R, A);
    // Bottom rail
    line(L, B, R, B);
    // Center vertical wire (full, resistors will overlay)
    line(M, A, M, B);
    // Right short
    line(R, A, R, B);

    ctx.restore();

    // Labels
    ctx.save();
    ctx.fillStyle = "#bfe9ff";
    ctx.font = "700 22px ui-sans-serif, system-ui";
    ctx.fillText("A", L - 55, A + 8);
    ctx.fillText("B", L - 55, B + 8);

    ctx.font = "600 13px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(191,233,255,.85)";
    ctx.fillText("Kapcsok: A_L és B_L (bal oldal)", 22, 28);
    ctx.fillText("Jobb oldali rövidzár: A_R = B_R", 22, 48);
    ctx.restore();

    // draw resistors as blocks on slots
    const slots = slotDrawList(state.present, state.R);
    for (const s of slots) drawResistor(s.x1, s.y1, s.x2, s.y2, s.label, s.value);

    // terminals dots
    ctx.save();
    ctx.fillStyle = "#35e0c6";
    dot(L, A, 8);
    dot(L, B, 8);
    ctx.fillStyle = "#45a6ff";
    dot(M, A, 7);
    dot(M, B, 7);
    ctx.restore();

    // helper funcs
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

  function slotDrawList(present, R) {
    const A = P.A_y, B = P.B_y;
    const list = [];

    // Each resistor drawn as a rectangle centered on the segment
    // TL1: between x=L..TL1_x
    if (present.TL1) list.push({ x1: P.L_x+35, y1:A, x2:P.TL1_x-35, y2:A, label:"TL1", value:R.TL1 });
    if (present.TL2) list.push({ x1: P.TL1_x+35, y1:A, x2:P.TL2_x-35, y2:A, label:"TL2", value:R.TL2 });
    if (present.TR1) list.push({ x1: P.M_x+35, y1:A, x2:P.TR1_x-35, y2:A, label:"TR1", value:R.TR1 });
    if (present.TR2) list.push({ x1: P.TR1_x+35, y1:A, x2:P.TR2_x-35, y2:A, label:"TR2", value:R.TR2 });

    if (present.BL1) list.push({ x1: P.L_x+35, y1:B, x2:P.BL1_x-35, y2:B, label:"BL1", value:R.BL1 });
    if (present.BL2) list.push({ x1: P.BL1_x+35, y1:B, x2:P.BL2_x-35, y2:B, label:"BL2", value:R.BL2 });
    if (present.BR1) list.push({ x1: P.M_x+35, y1:B, x2:P.BR1_x-35, y2:B, label:"BR1", value:R.BR1 });
    if (present.BR2) list.push({ x1: P.BR1_x+35, y1:B, x2:P.BR2_x-35, y2:B, label:"BR2", value:R.BR2 });

    // Vertical
    if (present.V1) list.push({ x1:P.M_x, y1:P.A_y+35, x2:P.M_x, y2:P.V1_y-35, label:"V1", value:R.V1 });
    if (present.V2) list.push({ x1:P.M_x, y1:P.V1_y+35, x2:P.M_x, y2:P.V2_y-35, label:"V2", value:R.V2 });

    return list;
  }

  function drawResistor(x1,y1,x2,y2,label,val){
    const midx = (x1+x2)/2, midy = (y1+y2)/2;
    const horizontal = Math.abs(y1-y2) < 2;

    ctx.save();

    // outer block
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(233,243,255,.95)";
    ctx.fillStyle = "rgba(53,224,198,.10)";
    ctx.beginPath();

    if (horizontal) {
      const w = Math.max(86, Math.abs(x2-x1));
      const h = 46;
      ctx.roundRect(midx - w/2, midy - h/2, w, h, 10);
    } else {
      const w = 54;
      const h = Math.max(86, Math.abs(y2-y1));
      ctx.roundRect(midx - w/2, midy - h/2, w, h, 10);
    }
    ctx.fill();
    ctx.stroke();

    // text
    ctx.fillStyle = "rgba(233,243,255,.95)";
    ctx.font = "800 14px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, midx, midy - 10);
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.fillStyle = "rgba(233,243,255,.88)";
    ctx.fillText(`${val} Ω`, midx, midy + 12);

    ctx.restore();
  }

  // roundRect polyfill for older canvas
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

  // ====== Check answer ======
  function setResult(text, cls) {
    resEl.className = `result ${cls || ""}`.trim();
    resEl.textContent = text;
  }

  function check() {
    if (!state) return;
    const user = Number(ansEl.value);
    if (!isFinite(user)) {
      setResult("Tesó írd be számként az értéket. 😄", "bad");
      return;
    }
    const real = state.req;

    const tol = Math.max(Math.abs(real) * 0.005, 0.02); // 0.5% or 0.02Ω
    const ok = Math.abs(user - real) <= tol;

    if (ok) {
      setResult(`Helyes ✅  (R_eredő = ${real.toFixed(6)} Ω)`, "good");
    } else {
      setResult(`Nem jó ❌  (helyes: ${real.toFixed(6)} Ω)`, "bad");
    }
    workEl.textContent = state.work;
  }

  function reveal() {
    if (!state) return;
    setResult(`Megoldás: R_eredő = ${state.req.toFixed(6)} Ω`, "muted");
    workEl.textContent = state.work;
  }

  async function copyWork() {
    const txt = workEl.textContent || "";
    if (!txt.trim()) {
      setResult("Nincs még levezetés a dobozban. Nyomj ellenőrzést vagy megoldást.", "muted");
      return;
    }
    try {
      await navigator.clipboard.writeText(txt);
      setResult("Levezetés kimásolva 📋", "good");
    } catch {
      setResult("Nem tudtam vágólapra másolni (böngésző tiltja).", "bad");
    }
  }

  // ====== Events ======
  btnNew.addEventListener("click", newProblem);
  btnCheck.addEventListener("click", check);
  btnReveal.addEventListener("click", reveal);
  btnCopy.addEventListener("click", copyWork);
  ansEl.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });

  // first load
  newProblem();
})();

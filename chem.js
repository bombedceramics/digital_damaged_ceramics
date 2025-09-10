// script.js
// Bootstrap + Chart.js UI per dati composizionali (Weight%).
// Doppio toggle: (unaltered/altered) × (Visualization/Image).

// -------------------------- CONFIG ----------------------------------------

const ELEMENT_COLORS = {
  C: "#000000", O: "#FF0D0D", N: "#3050F8", Na: "#AB5CF2", Mg: "#8AFF00",
  Al: "#BFA6A6", Si: "#F0C8A0", P: "#FF8000", S: "#FFFF30", Cl: "#1FF01F",
  K: "#8F40D4", Ca: "#3DFF00", Ti: "#BFC2C7", Cr: "#8A99C7", Mn: "#9C7AC7",
  Fe: "#E06633", Co: "#F090A0", Cu: "#C88033", Zn: "#7D80B0", As: "#BD80E3",
  Sn: "#668080", Sb: "#9E63B5", Ba: "#00C900", Cd: "#FFD98F", Au: "#FFD123",
  Pb: "#575961", Np: "#0080FF"
};

const ELEMENT_NAMES = {
  C: "Carbon", O: "Oxygen", N: "Nitrogen", Na: "Sodium", Mg: "Magnesium",
  Al: "Aluminum", Si: "Silicon", P: "Phosphorus", S: "Sulfur", Cl: "Chlorine",
  K: "Potassium", Ca: "Calcium", Ti: "Titanium", Cr: "Chromium", Mn: "Manganese",
  Fe: "Iron", Co: "Cobalt", Cu: "Copper", Zn: "Zinc", As: "Arsenic",
  Sn: "Tin", Sb: "Antimony", Ba: "Barium", Cd: "Cadmium", Au: "Gold",
  Pb: "Lead", Np: "Neptunium"
};

// -------------------------- DOM HELPERS -----------------------------------

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls = "", attrs = {}) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// -------------------------- DATA HELPERS ----------------------------------

const parseElement = (rawKey) => String(rawKey).split(" ")[0].trim();

const readWeight = (stateNode, rawKey) => {
  const v = stateNode?.[rawKey]?.["Weight%"];
  return typeof v === "number" ? v : 0;
};

function buildUnifiedLabels(nonAlt, alt) {
  const skip = new Set(["label", "picture"]);
  const elems = new Set();

  for (const k in (nonAlt || {})) if (!skip.has(k)) elems.add(parseElement(k));
  for (const k in (alt || {}))    if (!skip.has(k)) elems.add(parseElement(k));

  const labels = Array.from(elems);

  const sumFor = (stateObj, symbol) => {
    let s = 0;
    for (const k in (stateObj || {})) {
      if (skip.has(k)) continue;
      if (parseElement(k) === symbol) s += readWeight(stateObj, k);
    }
    return s;
  };

  labels.sort((a, b) => {
    const aSum = sumFor(nonAlt, a) + sumFor(alt, a);
    const bSum = sumFor(nonAlt, b) + sumFor(alt, b);
    return bSum - aSum || a.localeCompare(b);
  });
  return labels;
}

function valuesForState(stateObj, symbols) {
  const skip = new Set(["label", "picture"]);
  return symbols.map((sym) => {
    let total = 0;
    for (const k in (stateObj || {})) {
      if (skip.has(k)) continue;
      if (parseElement(k) === sym) total += readWeight(stateObj, k);
    }
    return total;
  });
}

function colorsFor(symbols) {
  return symbols.map((s) => ELEMENT_COLORS[s] || "#888888");
}

// -------------------------- IMPORT UI -------------------------------------

function renderImporter(root, onLoad) {
  const wrap = el("div", "container my-4");
  const card = el("div", "card shadow-sm");
  const body = el("div", "card-body");
  const h = el("h2", "h5 mb-3"); h.textContent = "Paste JSON data";
  const ta = el("textarea", "form-control", { rows: "10", spellcheck: "false" });
  ta.placeholder = "Paste your JSON dictionary with samples here…";
  const btn = el("button", "btn btn-primary mt-3"); btn.textContent = "Load data";
  btn.addEventListener("click", () => {
    try { onLoad(JSON.parse(ta.value)); wrap.remove(); }
    catch (e) { alert("Invalid JSON."); console.error(e); }
  });
  body.append(h, ta, btn); card.append(body); wrap.append(card); root.append(wrap);
}

// -------------------------- CHART FACTORY ---------------------------------

function makeBarChart(canvas, labels, values, title) {
  const ctx = canvas.getContext("2d");
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: title || "Weight%",
        data: values,
        backgroundColor: colorsFor(labels),
        borderColor: colorsFor(labels),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      scales: {
        x: { ticks: { autoSkip: true, maxRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.06)" }, title: { display: true, text: "Weight%" } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y}` } }
      }
    }
  });
}

// -------------------------- CARD BUILDERS ---------------------------------

function buildPartCard(sampleKey, partKey, partData, parentId) {
  const partId = `${parentId}-part-${slugify(partKey)}`;

  const card = el("div", "card mb-2");
  const hdr = el("div", "card-header p-2");
  const btn = el("button", "btn btn-sm btn-outline-secondary", {
    "data-bs-toggle": "collapse",
    "data-bs-target": `#${partId}`,
    "aria-expanded": "false",
    "aria-controls": partId
  });
  btn.textContent = partKey; hdr.append(btn);

  const collapse = el("div", "collapse", { id: partId });
  const body = el("div", "card-body");

  // Support EN + legacy IT keys
  const nonAlt = partData["unaltered"] ?? partData["non_alterato"];
  const alt    = partData["altered"]   ?? partData["alterato"];

  const labels  = buildUnifiedLabels(nonAlt, alt);
  const valsNon = nonAlt ? valuesForState(nonAlt, labels) : labels.map(() => 0);
  const valsAlt = alt    ? valuesForState(alt, labels)    : labels.map(() => 0);

  // ---------------- toolbar: state + mode ----------------
  const toolbar = el("div", "d-flex flex-wrap align-items-center gap-2 mb-2");

  // State toggle
  const stateGroup = el("div", "btn-group btn-group-sm");
  const bNon = el("button", "btn btn-outline-primary active"); bNon.textContent = "unaltered";
  const bAlt = el("button", "btn btn-outline-primary");        bAlt.textContent = "altered";
  stateGroup.append(bNon, bAlt);

  // Mode toggle (Visualization/Image)
  const modeGroup = el("div", "btn-group btn-group-sm ms-2");
  const bViz = el("button", "btn btn-outline-secondary active"); bViz.textContent = "Visualization";
  const bImg = el("button", "btn btn-outline-secondary");         bImg.textContent = "Image";
  modeGroup.append(bViz, bImg);

  toolbar.append(stateGroup, modeGroup);

  // Optional label badge (fix: niente .lastChild)
  const extraLabel = nonAlt?.label || alt?.label || "";
  if (extraLabel) {
    const badge = el("span", "badge text-bg-light", { title: "Label" });
    badge.textContent = extraLabel;
    toolbar.append(badge);
  }

  // ---------------- visualization containers --------------
  // Chart
  const chartWrap = el("div", "ratio ratio-16x9 border rounded");
  const cvs = el("canvas"); chartWrap.append(cvs);

  // Values table
  const table = el("table", "table table-sm table-striped mt-3 mb-0 align-middle");
  const thead = el("thead"); thead.innerHTML = `<tr><th>Element</th><th class="text-end">Weight%</th></tr>`;
  const tbody = el("tbody"); table.append(thead, tbody);

  // Image container
  const imageWrap = el("div", "ratio ratio-16x9 border rounded d-none");
  const fig = el("figure", "m-0 d-flex flex-column");
  const img = el("img", "img-fluid w-100 h-100", { style: "object-fit:contain;" });
  const cap = el("figcaption", "small text-muted mt-2 px-2");
  fig.append(img, cap); imageWrap.append(fig);

  // ---------------- initial render ------------------------
  let currentState = nonAlt ? "unaltered" : "altered";
  let currentMode  = "Visualization";

  const initialValues = currentState === "unaltered" ? valsNon : valsAlt;
  const title = `${sampleKey} — ${partKey} · ${currentState}`;
  let chart = makeBarChart(cvs, labels, initialValues, title);

  const renderTable = (vals) => {
    tbody.innerHTML = "";
    labels.forEach((sym, i) => {
      const tr = el("tr");
      const td1 = el("td");
      const swatch = el("span", "badge me-2", { style: `background:${ELEMENT_COLORS[sym] || "#888"};` });
      swatch.textContent = " ";
      td1.append(swatch, document.createTextNode(`${sym} — ${ELEMENT_NAMES[sym] || "Unknown"}`));
      const td2 = el("td", "text-end"); td2.textContent = String(vals[i]);
      tr.append(td1, td2); tbody.append(tr);
    });
  };
  renderTable(initialValues);

  const setImageFromState = () => {
    const stateObj = currentState === "unaltered" ? nonAlt : alt;
    const src = stateObj?.picture || "";
    img.src = src || "";
    img.alt = `${sampleKey} — ${partKey} — ${currentState}${extraLabel ? " — " + extraLabel : ""}`;
    cap.textContent = src ? `${currentState}${extraLabel ? " · " + extraLabel : ""}` : "No image available for this state.";
  };

  const renderMode = () => {
    const showImage = currentMode === "Image";
    imageWrap.classList.toggle("d-none", !showImage);
    chartWrap.classList.toggle("d-none", showImage);
    table.classList.toggle("d-none", showImage);
    if (showImage) setImageFromState();
  };

  const setState = (which) => {
    currentState = which;
    bNon.classList.toggle("active", which === "unaltered");
    bAlt.classList.toggle("active", which === "altered");

    if (currentMode === "Visualization") {
      const vals = which === "unaltered" ? valsNon : valsAlt;
      chart.data.labels = labels;
      chart.data.datasets[0].data = vals;
      chart.data.datasets[0].backgroundColor = colorsFor(labels);
      chart.data.datasets[0].borderColor = colorsFor(labels);
      chart.data.datasets[0].label = `${which} · Weight%`;
      chart.update();
      renderTable(vals);
    } else {
      setImageFromState();
    }
  };

  const setMode = (which) => {
    currentMode = which;
    bViz.classList.toggle("active", which === "Visualization");
    bImg.classList.toggle("active", which === "Image");
    renderMode();
  };

  // Button wiring + availability
  if (nonAlt && alt) {
    bNon.addEventListener("click", () => setState("unaltered"));
    bAlt.addEventListener("click", () => setState("altered"));
  } else {
    if (!nonAlt) bNon.setAttribute("disabled", "true");
    if (!alt) bAlt.setAttribute("disabled", "true");
    bNon.addEventListener("click", () => setState("unaltered"));
    bAlt.addEventListener("click", () => setState("altered"));
  }
  bViz.addEventListener("click", () => setMode("Visualization"));
  bImg.addEventListener("click", () => setMode("Image"));

  // Initial visibility
  renderMode();

  body.append(toolbar, imageWrap, chartWrap, table);
  collapse.append(body);
  card.append(hdr, collapse);
  return card;
}

function buildSampleCard(sampleKey, sampleData, container) {
  const accId = `acc-${slugify(sampleKey)}`;
  const card = el("div", "card mb-3");
  const hdr = el("div", "card-header p-2 d-flex align-items-center justify-content-between");
  const titleBtn = el("button", "btn btn-sm btn-dark", {
    "data-bs-toggle": "collapse",
    "data-bs-target": `#${accId}`,
    "aria-expanded": "false",
    "aria-controls": accId
  });
  titleBtn.textContent = sampleKey; hdr.append(titleBtn);

  const collapse = el("div", "collapse", { id: accId });
  const body = el("div", "card-body");
  const partsWrap = el("div");
  Object.keys(sampleData).forEach((ptKey) => {
    partsWrap.append(buildPartCard(sampleKey, ptKey, sampleData[ptKey], accId));
  });
  body.append(partsWrap);
  collapse.append(body);
  card.append(hdr, collapse);
  container.append(card);
}

// -------------------------- LEGEND (DROPDOWN) -----------------------------

function buildLegendDropdown() {
  const wrap = el("div", "my-3");
  const dropdown = el("div", "dropdown");
  const btn = el("button", "btn btn-outline-secondary dropdown-toggle", {
    type: "button",
    "data-bs-toggle": "dropdown",
    "aria-expanded": "false",
    "data-bs-auto-close": "outside"
  });
  btn.textContent = "Legend — Elements & Names";
  const menu = el("div", "dropdown-menu p-2 shadow", {
    style: "max-height:320px; overflow:auto; columns:2; column-gap:2rem; min-width:420px;"
  });

  Object.keys(ELEMENT_COLORS).sort().forEach((sym) => {
    const item = el("div", "dropdown-item d-flex align-items-center gap-2");
    const swatch = el("span", "", {
      style: `display:inline-block; width:14px; height:14px; border-radius:3px; background:${ELEMENT_COLORS[sym] || "#888"};`
    });
    const label = el("span", "d-inline-flex align-items-baseline");
    label.innerHTML = `<strong class="me-2">${sym}</strong><span class="text-muted">${ELEMENT_NAMES[sym] || "Unknown"}</span>`;
    item.append(swatch, label);
    menu.append(item);
  });

  dropdown.append(btn, menu);
  wrap.append(dropdown);
  return wrap;
}

// -------------------------- APP BOOTSTRAP ---------------------------------

function buildApp(DATA) {
  const root = $("#app");
  root.innerHTML = "";
  const container = el("div", "container");
  container.append(buildLegendDropdown());
  Object.keys(DATA).forEach((s) => buildSampleCard(s, DATA[s], container));
  root.append(container);
}

(function init() {
  const root = $("#app");
  if (!root) return;

  // Path corretto richiesto
  fetch("input_data_per_web/chemical_input_data_eng_pics.json")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load input_data_per_web/chemical_input_data_eng_pics.json");
      return res.json();
    })
    .then((data) => buildApp(data))
    .catch((err) => {
      console.error(err);
      const fallback = el("div", "container my-4");
      fallback.innerHTML = `<div class="alert alert-danger">Cannot load <code>input_data_per_web/chemical_input_data_eng_pics.json</code>.</div>`;
      root.append(fallback);
      // Paste-box di emergenza
      renderImporter(root, buildApp);
    });
})();

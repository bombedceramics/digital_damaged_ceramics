// script.js
// Bootstrap + Chart.js dynamic UI for compositional data (Weight% only).
// Generates collapsible cards per sample, nested collapses per part (Pt x),
// and a toggle to switch between "non_alterato" and "alterato" views.
// IMPORTANT: Elements are identified by the token BEFORE the space in keys like "Fe K"/"Fe L".
// Levels (K/L/M/…) are ignored and their Weight% are summed by element.

// -------------------------- CONFIG ----------------------------------------

// CPK/Jmol-like color map for elements (by symbol only)
const ELEMENT_COLORS = {
  C: "#000000",
  O: "#FF0D0D",
  N: "#3050F8",
  Na: "#AB5CF2",
  Mg: "#8AFF00",
  Al: "#BFA6A6",
  Si: "#F0C8A0",
  P: "#FF8000",
  S: "#FFFF30",
  Cl: "#1FF01F",
  K: "#8F40D4",
  Ca: "#3DFF00",
  Ti: "#BFC2C7",
  Cr: "#8A99C7",
  Mn: "#9C7AC7",
  Fe: "#E06633",
  Co: "#F090A0",
  Cu: "#C88033",
  Zn: "#7D80B0",
  As: "#BD80E3",
  Sn: "#668080",
  Sb: "#9E63B5",
  Ba: "#00C900",
  Cd: "#FFD98F",
  Au: "#FFD123",
  Pb: "#575961",
  Np: "#0080FF"
};

// English full names for each element symbol we use
const ELEMENT_NAMES = {
  C: "Carbon",
  O: "Oxygen",
  N: "Nitrogen",
  Na: "Sodium",
  Mg: "Magnesium",
  Al: "Aluminum",
  Si: "Silicon",
  P: "Phosphorus",
  S: "Sulfur",
  Cl: "Chlorine",
  K: "Potassium",
  Ca: "Calcium",
  Ti: "Titanium",
  Cr: "Chromium",
  Mn: "Manganese",
  Fe: "Iron",
  Co: "Cobalt",
  Cu: "Copper",
  Zn: "Zinc",
  As: "Arsenic",
  Sn: "Tin",
  Sb: "Antimony",
  Ba: "Barium",
  Cd: "Cadmium",
  Au: "Gold",
  Pb: "Lead",
  Np: "Neptunium"
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

// Return the element symbol before the whitespace-level suffix.
// e.g., "Fe K" -> "Fe", "Pb M" -> "Pb"
const parseElement = (rawKey) => String(rawKey).split(" ")[0].trim();

// Read Weight% for a specific raw key (e.g., "Fe K") in a given state node.
// Returns 0 if missing or not a number.
const readWeight = (stateNode, rawKey) => {
  const v = stateNode?.[rawKey]?.["Weight%"];
  return typeof v === "number" ? v : 0;
};

// Build unified list of element symbols found in both states (non_alterato + alterato).
// Order by descending sum of Weight% (non_alterato + alterato); tie-breaker is symbol name.
function buildUnifiedLabels(nonAlt, alt) {
  const elems = new Set();
  for (const k in (nonAlt || {})) if (k !== "label") elems.add(parseElement(k));
  for (const k in (alt || {})) if (k !== "label") elems.add(parseElement(k));

  const labels = Array.from(elems);

  const sumFor = (stateObj, symbol) => {
    let s = 0;
    for (const k in (stateObj || {})) {
      if (k === "label") continue;
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

// For a given state object and an array of element symbols,
// return summed Weight% per symbol (aggregating all levels K/L/M…).
function valuesForState(stateObj, symbols) {
  return symbols.map((sym) => {
    let total = 0;
    for (const k in (stateObj || {})) {
      if (k === "label") continue;
      if (parseElement(k) === sym) total += readWeight(stateObj, k);
    }
    return total;
  });
}

// Map symbols to colors, fallback to gray if missing.
function colorsFor(symbols) {
  return symbols.map((s) => ELEMENT_COLORS[s] || "#888888");
}

// -------------------------- IMPORT UI -------------------------------------

// If window.INPUT_DATA is not defined, show a paste box to load JSON.
function renderImporter(root, onLoad) {
  const wrap = el("div", "container my-4");
  const card = el("div", "card shadow-sm");
  const body = el("div", "card-body");

  const h = el("h2", "h5 mb-3");
  h.textContent = "Paste JSON data";

  const ta = el("textarea", "form-control", { rows: "10", spellcheck: "false" });
  ta.placeholder = "Paste your JSON dictionary with samples here…";

  const btn = el("button", "btn btn-primary mt-3");
  btn.textContent = "Load data";
  btn.addEventListener("click", () => {
    try {
      const data = JSON.parse(ta.value);
      onLoad(data);
      wrap.remove();
    } catch (e) {
      alert("Invalid JSON.");
      console.error(e);
    }
  });

  body.append(h, ta, btn);
  card.append(body);
  wrap.append(card);
  root.append(wrap);
}

// -------------------------- CHART FACTORY ---------------------------------

// Create a single bar chart for given labels/values.
// Tooltip shows exact numeric value (Weight%).
function makeBarChart(canvas, labels, values, title) {
  const ctx = canvas.getContext("2d");
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: title || "Weight%",
          data: values,
          backgroundColor: colorsFor(labels),
          borderColor: colorsFor(labels),
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      scales: {
        x: { ticks: { autoSkip: true, maxRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.06)" }, title: { display: true, text: "Weight%" } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // Show exact numeric value on hover
            label: (ctx) => ` ${ctx.parsed.y}`
          }
        }
      }
    }
  });
}

// -------------------------- CARD BUILDERS ---------------------------------

// Build the card for a single "part" (e.g., "Pt 1")
// Includes a collapse, a state toggle (non_alterato/alterato) if both exist,
// a bar chart, and a small values table.
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
  btn.textContent = partKey;
  hdr.append(btn);

  const collapse = el("div", "collapse", { id: partId });
  const body = el("div", "card-body");

  const nonAlt = partData["non_alterato"];
  const alt = partData["alterato"];

  // Unified x-axis: union of element symbols across both states (levels ignored)
  const labels = buildUnifiedLabels(nonAlt, alt);
  const valsNon = nonAlt ? valuesForState(nonAlt, labels) : labels.map(() => 0);
  const valsAlt = alt ? valuesForState(alt, labels) : labels.map(() => 0);

  // Toggle toolbar (enabled only if both states exist)
  const toolbar = el("div", "d-flex align-items-center gap-2 mb-2");
  const group = el("div", "btn-group btn-group-sm");
  const bNon = el("button", "btn btn-outline-primary active");
  bNon.textContent = "non_alterato";
  const bAlt = el("button", "btn btn-outline-primary");
  bAlt.textContent = "alterato";
  group.append(bNon, bAlt);
  toolbar.append(group);

  // Optional label badge from either state
  const labelBadge = el("span", "badge text-bg-light");
  const extraLabel = nonAlt?.label || alt?.label || "";
  if (extraLabel) {
    labelBadge.textContent = extraLabel;
    toolbar.append(labelBadge);
  }

  // Chart container
  const chartWrap = el("div", "ratio ratio-16x9 border rounded");
  const cvs = el("canvas");
  chartWrap.append(cvs);

  // Values table (Weight% only)
  const table = el("table", "table table-sm table-striped mt-3 mb-0 align-middle");
  const thead = el("thead");
  thead.innerHTML = `<tr><th>Element</th><th class="text-end">Weight%</th></tr>`;
  const tbody = el("tbody");
  table.append(thead, tbody);

  // Initial state choice: prefer non_alterato when present, else alterato
  let current = nonAlt ? "non_alterato" : "alterato";
  const initialValues = current === "non_alterato" ? valsNon : valsAlt;
  const title = `${sampleKey} — ${partKey} · ${current}`;
  let chart = makeBarChart(cvs, labels, initialValues, title);

  // Fill values table
  const renderTable = (vals) => {
    tbody.innerHTML = "";
    labels.forEach((sym, i) => {
      const tr = el("tr");
      const td1 = el("td");
      const swatch = el("span", "badge me-2", { style: `background:${ELEMENT_COLORS[sym] || "#888"};` });
      swatch.textContent = " ";
      td1.append(swatch, document.createTextNode(`${sym} — ${ELEMENT_NAMES[sym] || "Unknown"}`));
      const td2 = el("td", "text-end");
      td2.textContent = vals[i];
      tr.append(td1, td2);
      tbody.append(tr);
    });
  };
  renderTable(initialValues);

  // Switch handler
  const setActive = (which) => {
    current = which;
    bNon.classList.toggle("active", which === "non_alterato");
    bAlt.classList.toggle("active", which === "alterato");

    const vals = which === "non_alterato" ? valsNon : valsAlt;
    chart.data.labels = labels;
    chart.data.datasets[0].data = vals;
    chart.data.datasets[0].backgroundColor = colorsFor(labels);
    chart.data.datasets[0].borderColor = colorsFor(labels);
    chart.data.datasets[0].label = `${which} · Weight%`;
    chart.update();
    renderTable(vals);
  };

  // Enable/disable buttons depending on availability
  if (nonAlt && alt) {
    bNon.addEventListener("click", () => setActive("non_alterato"));
    bAlt.addEventListener("click", () => setActive("alterato"));
  } else {
    if (!nonAlt) bNon.setAttribute("disabled", "true");
    if (!alt) bAlt.setAttribute("disabled", "true");
    bNon.addEventListener("click", () => setActive("non_alterato"));
    bAlt.addEventListener("click", () => setActive("alterato"));
  }

  body.append(toolbar, chartWrap, table);
  collapse.append(body);
  card.append(hdr, collapse);
  return card;
}

// Build a top-level card for each sample, containing collapsible part cards.
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
  titleBtn.textContent = sampleKey;
  hdr.append(titleBtn);

  const collapse = el("div", "collapse", { id: accId });
  const body = el("div", "card-body");

  const partsWrap = el("div");
  const partKeys = Object.keys(sampleData);
  partKeys.forEach((ptKey) => {
    partsWrap.append(buildPartCard(sampleKey, ptKey, sampleData[ptKey], accId));
  });

  body.append(partsWrap);
  collapse.append(body);
  card.append(hdr, collapse);
  container.append(card);
}

// -------------------------- LEGEND (DROPDOWN) -----------------------------

// Build a dropdown legend showing swatch + symbol + English name
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
    style:
      "max-height: 320px; overflow:auto; columns: 2; column-gap: 2rem; min-width: 420px;"
  });

  // Sort symbols alphabetically for the legend
  const symbols = Object.keys(ELEMENT_COLORS).sort((a, b) => a.localeCompare(b));
  symbols.forEach((sym) => {
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

  // Dropdown legend with English names
  container.append(buildLegendDropdown());

  // One card per sample (top-level key)
  const samples = Object.keys(DATA);
  samples.forEach((s) => buildSampleCard(s, DATA[s], container));

  root.append(container);
}

// Entry point: load JSON and build the app.
(function init() {
  const root = $("#app");
  if (!root) return;

  fetch("input_data_per_web/chemical_input_data.json")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load input_data_per_web/chemical_input_data.json");
      return res.json();
    })
    .then((data) => buildApp(data))
    .catch((err) => {
      console.error(err);
      const fallback = el("div", "container my-4");
      fallback.innerHTML = `<div class="alert alert-danger">Cannot load <code>input_data_per_web/chemical_input_data.json</code>.</div>`;
      root.append(fallback);
    });
})();

// ==== Globals ====
let normalizedData = [];
const groupCountsRaw = {};
const groupCountsApprox = {};
const materialSums = {};
const materialCounts = {};
const allMaterials = new Set();


// Array x Sankey **
let sankeyFlows = [];

// Leaflet vars, verranno inizializzati solo quando serve
let map, markersCluster;

// --- Config CSV/Colors/Translations/Coordinates ---
const csvFilePath = 'input_data_per_web/unified_dataset_ceramics_ver10.csv';
const palette = ["#4793AF","#FFC470","#DD5746","#8B322C","#B36A5E","#A64942","#D99152"];
const materialTranslations = {
  "terre cuite":"Terracotta","terraglia":"Creamware","porcelaine":"Porcellain",
  "faïence":"Earthenware","grés":"Stonewear","quartz":"Quartz","mixte":"Mix",
  "métal":"Metal","mixte(terre cuite+quartz)":"Mix (Terracotta + Quartz)",
  "mixte (grés + métal)":"Mix (Stonewear + Metal)"
};

// Normalizza sia la chiave originale sia la stringa in ingresso
const normalizedMaterialTranslations = Object.fromEntries(
  Object.entries(materialTranslations).map(([rawKey, value]) => {
    // 1) lowercase, strip diacritics e spazi
    const normKey = rawKey
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,'');
    return [normKey, value];
  })
);


const countryCoordinates = {
  "250":[46.2276,2.2137],"380":[41.8719,12.5674],"276":[51.1657,10.4515],
  "724":[40.4637,-3.7492],"56":[50.5039,4.4699],"528":[52.1326,5.2913],
  "246":[61.9241,25.7482],"756":[46.8182,8.2275],"156":[35.8617,104.1954],
  "364":[32.4279,53.6880],"356":[20.5937,78.9629],"368":[33.2232,43.6793],
  "616":[51.9194,19.1451],"620":[39.3999,-8.2245],"818":[26.8206,30.8025],
  "826":[55.3781,-3.4360],"642":[45.9432,24.9668],"392":[36.2048,138.2529],
  "MAG":[32.0,-5.0],"604":[-12.0464,-77.0428],"MED":[41.0082,28.9784],
  "788":[33.8869,9.5375]
};

// ====== Breakpoints per charts ======
const valoriApproximati = {
  "0":["0"],"5":["<5","0-5"],"10":["<10","10"],"15":["15","10-20","10-15"],
  "20":["15-20","20"],"25":["<25","20-25"],"30":["30","<30","25-30"],
  "35":["30-40",">30","35"],"40":["40","<40"],"45":[],
  "50":["50"],">50":[">50",">70","60"],"unknown":["(?)"]
};
const mappaturaValori = {
  "<10":8,"40":40,"15":15,"15-20":17,"10-15":12,"30":30,
  "10":10,"30-40":35,"50":50,"<40":38,"(?)":"unknown","0":0,
  "<5":3,"<30":28,"0-5":2,"20":20,"10-20":15,">50":52,
  "<25":23,">70":72,">30":32,"20-25":22,"35":35,"25-30":27,"60":60
};

// ===== Utility Functions =====
function normalizeCsvHeaders(data) {
  return data.map(row => {
    const newRow = {};
    for (const key in row) {
      const newKey = key.replace(/[\r\n]/g,' ').trim();
      newRow[newKey] = row[key];
    }
    return newRow;
  });
}
function normalizeString(str) {
  return str.toLowerCase().replace(/\s+/g,'');
}
function getColumnValue(row, columnName) {
  const target = normalizeString(columnName);
  for (const key in row) {
    if (normalizeString(key)===target) return row[key];
  }
  return "";
}

// ==== Pre-process data for charts ====
function preprocessData() {
  normalizedData.forEach(row => {
    const rawL = (row["% lacunaire"]||"").trim();
    const rawM = (row["matériau simplifié"]||"").trim();
    if (!rawL||!rawM) return;
    const matKey = rawM.toLowerCase();
    const mat = materialTranslations[matKey]||rawM;
    allMaterials.add(mat);
    // Chart1: raw
    groupCountsRaw[rawL] = groupCountsRaw[rawL]||{};
    groupCountsRaw[rawL][mat] = (groupCountsRaw[rawL][mat]||0)+1;
    // Chart2: approx
    for (const key in valoriApproximati) {
      if (valoriApproximati[key].includes(rawL)) {
        groupCountsApprox[key]=groupCountsApprox[key]||{};
        groupCountsApprox[key][mat]=(groupCountsApprox[key][mat]||0)+1;
        break;
      }
    }
    // Chart3: average
    const num = mappaturaValori[rawL];
    if (num!==undefined && num!=="unknown") {
      materialSums[mat]= (materialSums[mat]||0)+num;
      materialCounts[mat]=(materialCounts[mat]||0)+1;
    }
  });
}

// ====== Leaflet + Markers ======
function initMap() {
  if (map) return;
  map = L.map('map').setView([50,10],4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19, attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);
  markersCluster = L.markerClusterGroup();
  map.addLayer(markersCluster);

  normalizedData.forEach(row=>{
    const inv = row["inventaire clean"];
    let cc = row["provenance (country code)"]||"";
    const prov = row["provenance@en"];
    const ente = getColumnValue(row,"Ente conservatore").trim();
    let base = "assets/placeholder-directory";
    if (ente.includes("Sèvres")) base="assets/catalogue/sevres_visualizazzioni_cmpr";
    else if (ente.includes("Faenza")) base="assets/catalogue/faenza_visualizazzioni_cmpr";
    const fn = ((row["pictures filenames"]||"").split(/\r?\n/)[0]||"").trim();
    const img = fn?`${base}/${fn}`:null;
    if (cc) cc = cc.split(';')[0].replace(/\(\?\)/g,'').trim();
    const coords = countryCoordinates[cc];
    if (!coords) return;
    let popup = `<strong>Inventory:</strong> ${inv}<br>
                 <strong>Provenance:</strong> ${prov}<br>`;
    if (img && !fn.toLowerCase().includes("placeholder")) {
      popup += `<div style="text-align:center">
                  <img src="${encodeURI(img)}"
                       style="max-width:90%;height:auto;"
                       onerror="this.style.display='none'"
                       alt="Preview">
                </div>`;
    }
    L.marker(coords).bindPopup(popup).addTo(markersCluster);
  });
}

// --- Chart Rendering Functions ---

// Chart 1: Stacked bar chart con gruppi per ogni valore "raw" di "% lacunaire"
function renderChartAllData() {
  function parseLabel(label) {
    label = label.trim();
    if (label.startsWith("<")) {
      const num = parseFloat(label.slice(1));
      return num - 0.1;
    }
    if (label.startsWith(">")) {
      const num = parseFloat(label.slice(1));
      return num + 0.1;
    }
    if (label.includes("-")) {
      const parts = label.split("-");
      if (parts.length === 2) {
        const a = parseFloat(parts[0]);
        const b = parseFloat(parts[1]);
        if (!isNaN(a) && !isNaN(b)) {
          return (a + b) / 2;
        }
      }
    }
    const num = parseFloat(label);
    if (!isNaN(num)) return num;
    return Infinity;
  }

  const labels = Array.from(Object.keys(groupCountsRaw)).sort((a, b) => parseLabel(a) - parseLabel(b));
  const sortedMaterials = Array.from(allMaterials).sort();

  const datasets = sortedMaterials.map((material, idx) => ({
    label: material,
    data: labels.map(lacuna => (groupCountsRaw[lacuna]?.[material] || 0)),
    backgroundColor: palette[idx % palette.length]
  }));

  new Chart(document.getElementById('chartAllData'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: '% Lacuna (Raw Values) per Material' }
      },
      scales: {
        x: { stacked: true, title: { display: true, text: 'Raw % Lacuna Values' } },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Number of Artifacts' } }
      }
    }
  });
}

// Chart 2: Stacked bar chart raggruppato con i valori approssimati
function renderChartApprox() {
  const approxOrder = ["0", "5", "10", "15", "20", "25", "30", "35", "40", "45", "50", ">50", "unknown"];
  const labels = approxOrder.filter(key => groupCountsApprox[key] !== undefined);
  const sortedMaterials = Array.from(allMaterials).sort();

  const datasets = sortedMaterials.map((material, idx) => ({
    label: material,
    data: labels.map(key => (groupCountsApprox[key]?.[material] || 0)),
    backgroundColor: palette[idx % palette.length]
  }));

  new Chart(document.getElementById('chartApprox'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: '% Lacuna (Approximated) per Material' }
      },
      scales: {
        x: { stacked: true, title: { display: true, text: 'Approximated % Lacuna Groups' } },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Number of Artifacts' } }
      }
    }
  });
}

// Chart 3: Bar chart per la media numerica di % lacuna per materiale
function renderChartMaterialAverage() {
  const sortedMaterials = Array.from(allMaterials).sort();
  const labels = sortedMaterials;
  const averages = sortedMaterials.map(material => {
    if (materialCounts[material]) {
      return (materialSums[material] / materialCounts[material]).toFixed(2);
    }
    return 0;
  });

  new Chart(document.getElementById('chartMaterialAverage'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Average % Lacuna Value',
        data: averages,
        backgroundColor: sortedMaterials.map((_, idx) => palette[idx % palette.length])
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Average Numeric % Lacuna per Material' },
        tooltip: {
          callbacks: {
            label: function(context) {
              const material = context.label;
              const avg = context.raw;
              const count = materialCounts[material] || 0;
              return `Avg: ${avg} - Total Objects: ${count}`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Material' } },
        y: { beginAtZero: true, title: { display: true, text: 'Average Value' } }
      }
    }
  });
}

// Function to render material cards (modal with material distribution charts)
const cardBackgroundImages = {
  "Earthenware": "assets/materials/fa-ence.jpg",
  "Stonewear": "assets/materials/gr-s.jpg",
  "Mix (Stonewear + Metal)": "assets/materials/mixte--gr-s---m-tal-.jpg",
  "Mix (Terracotta + Quartz)": "assets/materials/mixte-terre-cuite-quartz-.jpg",
  "Porcellain": "assets/materials/porceclaine.jpg",
  "Creamware": "assets/materials/terraglia.jpg",
  "Terracotta": "assets/materials/terre-cuite.jpg"
};

function renderMaterialCards() {
  const container = document.getElementById("materialCardContainer");
  container.innerHTML = "";
  const approxOrder = ["0","5","10","15","20","25","30","35","40","45","50",">50","unknown"];
  const groupColors = {
    "0": "#4793AF","5": "#FFC470","10": "#DD5746","15": "#8B322C",
    "20": "#B36A5E","25": "#A64942","30": "#D99152","35": "#0F3057",
    "40": "#1B6CA8","45": "#008ECC","50": "#00A8E8",">50": "#00B8D4","unknown": "#7FC8F8"
  };

  Array.from(allMaterials).sort().forEach(material => {
    const materialId = material.toLowerCase().replace(/[^a-z0-9]/g, "-");

    // 1) Doughnut distribution
    const distribution = approxOrder.map(group => ({ category: group, count: groupCountsApprox[group]?.[material] || 0 }));

    // 2) Bar-chart data: average fragments per lacuna bucket
    const fragStats = {};
    normalizedData.forEach(row => {
      const rawM = (row["matériau simplifié"]||"").trim();
      const mat   = materialTranslations[rawM.toLowerCase()] || rawM;
      if (mat !== material) return;
      let rawL = (row["% lacunaire"]||"").trim().replace(/%$/, "");
      const bucket = approxOrder.find(k => valoriApproximati[k].includes(rawL));
      if (!bucket) return;
      let rawF = (row["number of fragments clean"]||"").trim();
      let numF = rawF === "" ? 1
        : ((rawF[0] === "<" || rawF[0] === ">") && !isNaN(+rawF.slice(1)))
           ? Math.ceil(parseFloat(rawF.slice(1)) * 1.05)
           : parseFloat(rawF);
      if (isNaN(numF)) return;
      fragStats[bucket] = fragStats[bucket] || { sum: 0, count: 0 };
      fragStats[bucket].sum   += numF;
      fragStats[bucket].count += 1;
    });
    const barData = approxOrder.map(k => ({ key: k, avgFrag: fragStats[k]?.count ? fragStats[k].sum/fragStats[k].count : 0 }));

    // 3) Card + Modal HTML
    const cardHTML = `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card h-100 shadow-sm" role="button" data-bs-toggle="modal" data-bs-target="#modal-${materialId}">
          <img src="${cardBackgroundImages[material]||`assets/materials/${materialId}.jpg`}" class="card-img-top" onerror="this.onerror=null;this.src='assets/placeholder.jpeg';" alt="${material}">
          <div class="card-body text-center">
            <h5 class="card-title">${material}</h5>
            <p class="text-muted small">Click to see the distribution</p>
          </div>
        </div>
      </div>`;

    const modalHTML = `
      <div class="modal fade" id="modal-${materialId}" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">% Lacuna – ${material}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" style="max-height:450px; overflow-y:auto;">
              <canvas id="donut-${materialId}" style="display:block; width:100%; height:auto; margin-bottom:1rem;"></canvas>
              <canvas id="line-${materialId}" style="display:block; width:100%; height:auto; margin-bottom:1rem;"></canvas>
              <canvas id="bar-${materialId}" style="display:block; width:100%; height:auto;"></canvas>
            </div>
          </div>
        </div>
      </div>`;

    container.insertAdjacentHTML("beforeend", cardHTML);
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // 4) Draw charts on modal show
    document.getElementById(`modal-${materialId}`).addEventListener('shown.bs.modal', () => {
      // 4a) Doughnut
      new Chart(document.getElementById(`donut-${materialId}`).getContext('2d'), {
        type: 'doughnut',
        data: { labels: distribution.map(d => d.category==='unknown'?d.category:d.category+'%'), datasets: [{ data: distribution.map(d => d.count), backgroundColor: distribution.map(d => groupColors[d.category]), borderColor: '#fff', borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { title: { display: true, text: `% Lacuna – ${material}`, padding: { bottom: 8 } }, legend: { display: true, position: 'bottom', labels: { boxBorderWidth: 0 } } } }
      });

      // 4b) Line chart
      const freqMap = {};
      normalizedData.forEach(row => {
        const rawM = (row['matériau simplifié']||'').trim();
        const mat   = materialTranslations[rawM.toLowerCase()]||rawM;
        if(mat!==material)return;
        let rawF = (row['number of fragments clean']||'').trim();
        let val = rawF===''?1:(([ '<','>' ].includes(rawF[0])&&!isNaN(+rawF.slice(1)))?Math.ceil(parseFloat(rawF.slice(1))*1.05):parseFloat(rawF));
        if(isNaN(val))return;
        freqMap[val]=(freqMap[val]||0)+1;
      });
      const fragValues=Object.keys(freqMap).map(n=>+n).sort((a,b)=>a-b);
      const occurrences=fragValues.map(n=>freqMap[n]);
      new Chart(document.getElementById(`line-${materialId}`).getContext('2d'),{ type:'line', data:{ labels:fragValues, datasets:[{ label:'Occurrences', data:occurrences, fill:false, borderColor:palette[1], backgroundColor:palette[1], tension:0.3, pointRadius:3 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ title:{ display:true, text:'Number of Fragments Distribution', padding:{ bottom:8 } }, legend:{ display:true, position:'bottom', labels:{ boxBorderWidth:0 } } }, scales:{ x:{ title:{ display:true, text:'Number of Fragments' } }, y:{ beginAtZero:true, title:{ display:true, text:'Occurrences' } } } } });

      // 4c) Bar chart with interactive legend per bar
      const labelsBar = barData.map(d => d.key==='unknown'?d.key:d.key+'%');
      new Chart(document.getElementById(`bar-${materialId}`).getContext('2d'), {
        type: 'bar',
        data: {
          labels: labelsBar,
          datasets: [{
            label: 'Avg Number of Fragments',
            data: barData.map(d => +d.avgFrag.toFixed(1)),
            backgroundColor: barData.map(d => groupColors[d.key]),
            borderColor:     barData.map(d => groupColors[d.key]),
            borderWidth: 1,
            barThickness: 20
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: 'Lacunary percentage by number of fragments', align: 'start', padding: { bottom: 8 } },
            legend: {
              display: true,
              position: 'bottom',
              labels: { boxBorderWidth: 0, generateLabels: chart => {
                const ds = chart.data.datasets[0];
                return chart.data.labels.map((lbl, idx) => ({
                  text: lbl,
                  fillStyle: Array.isArray(ds.backgroundColor) ? ds.backgroundColor[idx] : ds.backgroundColor,
                  hidden: !chart.getDataVisibility(idx),
                  index: idx
                }));
              }},
              onClick: (e, legendItem, legend) => {
                const chart = legend.chart;
                chart.toggleDataVisibility(legendItem.index);
                chart.update();
              }
            }
          },
          scales: {
            x: { beginAtZero: true, title: { display: true, text: 'Average Fragments' } },
            y: { title: { display: true, text: '% Lacuna (mappato)' }, ticks: { autoSkip: false } }
          }
        }
      });

    }, { once: true });
  });
}


// ===== Heatmap Function =====
function renderHeatmap() {
  const degCol = "degradation state";
  const matCol = "matériau simplifié";
  const matrix = {};
  normalizedData.forEach(row => {
    const rawM = (row[matCol]||"").trim();
    if (!rawM) return;
    const mat = materialTranslations[rawM.toLowerCase()]||rawM;
    const degs = (row[degCol]||"").split(',').map(s=>s.trim()).filter(Boolean);
    degs.forEach(deg => {
      matrix[deg] = matrix[deg]||{};
      matrix[deg][mat] = (matrix[deg][mat]||0) + 1;
    });
  });
  const materials = Array.from(allMaterials).sort();
  const degradations = Object.keys(matrix).sort();
  let maxCount = 0;
  degradations.forEach(deg => materials.forEach(mat => {
    const c = matrix[deg][mat]||0;
    if (c>maxCount) maxCount = c;
  }));
  const container = document.getElementById("heatmapContainer");
  let html = '<table class="heatmap-table"><thead><tr><th>Degradation / Material</th>';
  materials.forEach(mat => html += `<th>${mat}</th>`);
  html += '</tr></thead><tbody>';
  degradations.forEach(deg => {
    html += `<tr><td>${deg}</td>`;
    materials.forEach(mat => {
      const c = matrix[deg][mat]||0;
      const alpha = maxCount ? (c / maxCount) : 0;
      html += `<td style="background:rgba(71,147,175,${alpha})">${c}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ====== Snakey Function ======
// 1) Carica il package sankey
google.charts.load('current', { packages: ['sankey'] });

// Variabili di scope esterno per conservare chart, dati e opzioni
let sankeyChart, sankeyData, sankeyOptions;

// 2) Prepara i dati aggregati per il Sankey
function prepareSankeyData() {
  const dataTable = new google.visualization.DataTable();
  dataTable.addColumn('string', 'From');
  dataTable.addColumn('string', 'To');
  dataTable.addColumn('number', 'Weight');

  // Aggrega i flussi identici
  const agg = {};
  sankeyFlows.forEach(({ from, to, weight }) => {
    const key = from + '→' + to;
    agg[key] = (agg[key] || 0) + weight;
  });

  Object.entries(agg).forEach(([key, w]) => {
    const [from, to] = key.split('→');
    dataTable.addRow([from, to, w]);
  });

  return dataTable;
}

// 3) Disegna il Sankey con Google Charts e rendilo responsive
function drawGoogleSankey() {
  // 3.1 prepara i dati
  sankeyData = prepareSankeyData();

  // 3.2 crea l’istanza del chart
  sankeyChart = new google.visualization.Sankey(
    document.getElementById('sankeyChart')
  );

  // 3.3 definisci le opzioni base (senza width/height)
  sankeyOptions = {
    sankey: {
      node: { width: 15, nodePadding: 10 },
      link: { colorMode: 'gradient' }
    },
    legend: 'none'
    // non mettiamo qui width/height
  };

  // 3.4 disegna la prima volta, calcolando width/height sul container
  redrawSankey();

  // 3.5 ridisegna al resize (con un debounce se vuoi)
  window.addEventListener('resize', () => {
    redrawSankey();
  });
}

// Funzione che ricalcola la dimensione e ridisegna
function redrawSankey() {
  const container = document.getElementById('sankeyChart');
  const w = container.offsetWidth;            // tutta la larghezza disponibile
  const h = Math.round(w * 0.5);              // altezza proporzionale (qui 50%, cambia come preferisci)

  sankeyOptions.width  = w;
  sankeyOptions.height = h;

  sankeyChart.draw(sankeyData, sankeyOptions);
}

// ===== Weapon - Condition (Radar) Function =====
function renderWeaponRadar() {
  const degCol    = "condition state";
  const weaponCol = "weapon";
  const weapons   = ["explosive bomb", "incendiary grenade"];

  // 1) raccogli tutti gli stati di degrado unici
  const statesSet = new Set();
  normalizedData.forEach(row => {
    (row[degCol] || "")
      .split(',')
      .map(s=>s.trim())
      .filter(Boolean)
      .forEach(s => statesSet.add(s));
  });
  const states = Array.from(statesSet).sort();

  // 2) conta per ciascuna arma quante righe contengono ogni stato
  const dataByWeapon = {
    "explosive bomb": [],
    "incendiary grenade": []
  };
  states.forEach(state => {
    weapons.forEach(w => {
      const cnt = normalizedData.reduce((sum, row) => {
        const hasWeapon = (row[weaponCol]||"").trim() === w;
        const hasState  = (row[degCol]||"")
                           .split(',').map(s=>s.trim())
                           .includes(state);
        return sum + (hasWeapon && hasState ? 1 : 0);
      }, 0);
      dataByWeapon[w].push(cnt);
    });
  });

  // 3) disegna il radar
  const ctx = document.getElementById("radarWeapon").getContext("2d");
  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: states,
      datasets: weapons.map((w, i) => ({
        label: w.charAt(0).toUpperCase() + w.slice(1),
        data: dataByWeapon[w],
        fill: true,
        backgroundColor: palette[i] + "55",  // semitrasparente
        borderColor:    palette[i],
        pointBackgroundColor: palette[i]
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      },
      plugins: {
        legend: { position: 'bottom' },
        title: { display: false }
      }
    }
  });
}

// ===== Weapon - Condition (Stacked bar) function ====
function renderConditionByWeapon() {
  const condCol = "condition state";
  const weapCol = "weapon";
  const weapons = ["explosive bomb", "incendiary grenade"];

  // Costruiamo la matrice: condState → { weapon1: count, weapon2: count }
  const matrix = {};
  normalizedData.forEach(row => {
    const rawW = (row[weapCol] || "").trim().toLowerCase();
    if (!weapons.includes(rawW)) return;

    const conds = (row[condCol] || "")
      .split(/\s*,\s*/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    conds.forEach(c => {
      if (!matrix[c]) matrix[c] = {};
      matrix[c][rawW] = (matrix[c][rawW] || 0) + 1;
    });
  });

  // Ordine “da peggiore a migliore”
  const desiredOrder = ["bad","poor","fair","good","very good"];
  // Otteniamo solo quelle presenti
  const conditions = desiredOrder.filter(c => matrix[c] !== undefined);

  const datasets = weapons.map((w, idx) => ({
    label: w.charAt(0).toUpperCase() + w.slice(1),
    data: conditions.map(c => matrix[c][w] || 0),
    backgroundColor: palette[idx % palette.length]
  }));

  new Chart(document.getElementById("conditionBarChart"), {
    type: "bar",
    data: {
      labels: conditions.map(c => c.charAt(0).toUpperCase() + c.slice(1)), // capitalizziamo la label
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        title: { display: false }
      },
      scales: {
        x: {
          stacked: true,
          title: { display: true, text: "Condition State" }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: { display: true, text: "Count" }
        }
      }
    }
  });
}

// ====== Degradation by weapon (grouped + 100%)

// 1) D/W Count bar chart: Degradation State by Weapon
function renderDegradationByWeaponCounts() {
  const counts = {};
  normalizedData.forEach(r => {
    const w = (r.weapon||'').trim();
    const degs = (r['degradation state']||'')
      .split(',')
      .map(s=>s.trim())
      .filter(Boolean);
    degs.forEach(d => {
      if (!counts[d]) counts[d] = { bomb: 0, grenade: 0 };
      if (w === 'explosive bomb')          counts[d].bomb++;
      else if (w === 'incendiary grenade') counts[d].grenade++;
    });
  });

  const states      = Object.keys(counts).sort();
  const bombData    = states.map(s => counts[s].bomb);
  const grenadeData = states.map(s => counts[s].grenade);

  new Chart(document.getElementById('degradationBarChart'), {
    type: 'bar',
    data: {
      labels: states,
      datasets: [
        { label: 'Explosive Bomb',      data: bombData,    backgroundColor: palette[0] },
        { label: 'Incendiary Grenade',  data: grenadeData, backgroundColor: palette[1] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
      },
      scales: {
        x: { title: { display: true, text: 'Degradation State' } },
        y: { title: { display: true, text: 'Count' }, beginAtZero: true }
      }
    }
  });
}

// 2) D/W 100% stacked bar chart: % Degradation State by Weapon
function renderDegradationByWeaponPercent() {
  const counts = {};
  normalizedData.forEach(r => {
    const w = (r.weapon||'').trim();
    const degs = (r['degradation state']||'')
      .split(',')
      .map(s=>s.trim())
      .filter(Boolean);
    degs.forEach(d => {
      if (!counts[d]) counts[d] = { bomb: 0, grenade: 0, total: 0 };
      counts[d].total++;
      if (w === 'explosive bomb')          counts[d].bomb++;
      else if (w === 'incendiary grenade') counts[d].grenade++;
    });
  });

  const states        = Object.keys(counts).sort();
  const bombPercent    = states.map(s => Math.round(100 * counts[s].bomb    / counts[s].total));
  const grenadePercent = states.map(s => Math.round(100 * counts[s].grenade / counts[s].total));

  new Chart(document.getElementById('degradationBarPercentChart'), {
    type: 'bar',
    data: {
      labels: states,
      datasets: [
        { label: 'Explosive Bomb',      data: bombPercent,    backgroundColor: palette[0] },
        { label: 'Incendiary Grenade',  data: grenadePercent, backgroundColor: palette[1] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.raw}%`
          }
        }
      },
      scales: {
        x: { stacked: true, title: { display: true, text: 'Degradation State' } },
        y: { stacked: true, title: { display: true, text: '%' }, beginAtZero: true, max: 100 }
      }
    }
  });
}


// Utility: dal raw label al valore numerico del bucket
function getApproxLacunaValue(raw) {
  raw = raw.trim();
  for (const bucket in valoriApproximati) {
    if (valoriApproximati[bucket].includes(raw)) {
      return parseFloat(bucket);
    }
  }
  return NaN;
}

// Chart 4: Bubble chart – Medie per Materiale (con “unknown” = media)
function renderBubbleChart() {
  // ——— Calcolo media di tutti i valori numerici in mappaturaValori ———
  const numericLacunaValues = Object.values(mappaturaValori)
    .filter(v => typeof v === 'number');
  const avgLacunaValue = numericLacunaValues.reduce((a,b) => a + b, 0)
                        / numericLacunaValues.length;
  // ————————————————————————————————————————————————————————————————

  // ——— Debug per Porcellain ———
  const porcelainRows = normalizedData.filter(row => {
    const rawM = (row["matériau simplifié"] || "").trim().toLowerCase();
    const matTranslated = materialTranslations[rawM] || rawM;
    return matTranslated === "Porcellain";
  });
  console.log("✅ Totale Porcellain:", porcelainRows.length);
  porcelainRows.forEach((row, i) => {
    const rawF = (row["number of fragments clean"] || "").trim();
    const rawL = (row["% lacunaire"]               || "").trim();
    console.log(`Porcellain #${i + 1}: fragments='${rawF}', %lacunaire='${rawL}'`);
  });
  // ——————————————————————————

  const stats = {};

  normalizedData.forEach(row => {
    // 1) estraggo e pulisco i raw
    const rawM = (row["matériau simplifié"]          || "").trim();
    const rawL = (row["% lacunaire"]                || "").trim();
    let   rawF = (row["number of fragments clean"] || "").trim();
    if (!rawM || !rawL) return;

    // 2) traduco il materiale usando la mappa normalizzata
    const normM = rawM
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,'');
    const mat = normalizedMaterialTranslations[normM] || rawM;

    // 3) mappa % lacunaire (rimuovo “%” se presente)
    const cleanL = rawL.replace(/%$/, "").trim();
    let   lacunaNum = mappaturaValori[cleanL];
    if (lacunaNum === undefined) return;
    if (lacunaNum === "unknown") {
      lacunaNum = avgLacunaValue;
    }

    // 4) logica per fragments clean
    let fragNum;
    if (rawF === "") {
      fragNum = 1;
    } else {
      const op  = rawF[0];
      const num = parseFloat(rawF.replace(/[<>]/g, ""));
      if ((op === "<" || op === ">") && !isNaN(num)) {
        fragNum = Math.ceil(num * 1.05);
      } else {
        fragNum = parseFloat(rawF);
      }
    }
    if (isNaN(fragNum)) return;

    // 5) accumulo in stats
    if (!stats[mat]) {
      stats[mat] = { sumL: 0, sumF: 0, count: 0 };
    }
    stats[mat].sumL  += lacunaNum;
    stats[mat].sumF  += fragNum;
    stats[mat].count += 1;
  });

  // 6) preparo datasets – un punto per materiale
  const materials = Object.keys(stats).sort();
  const datasets = materials.map((mat, i) => {
    const { sumL, sumF, count } = stats[mat];
    const avgL   = sumL / count;
    const avgF   = sumF / count;
    const radius = Math.sqrt(count) * 3;
    return {
      label: mat,
      data: [{ x: avgF, y: avgL, r: radius }],
      backgroundColor: palette[i % palette.length] + "80",
      borderColor:     palette[i % palette.length],
      borderWidth:     1,
      hoverBackgroundColor: palette[i % palette.length]
    };
  });

  // 7) disegno il bubble chart
  const ctx = document.getElementById('chartBubble').getContext('2d');
  new Chart(ctx, {
    type: 'bubble',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: {
          display: true,
          text: 'Media Fragments Clean vs Media % Lacuna per Material'
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const { x, y } = ctx.raw;
              const cnt = stats[ctx.dataset.label].count;
              return `${ctx.dataset.label}: Frag≈${x.toFixed(1)}, Lac≈${y.toFixed(1)}% (n=${cnt})`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: 'Avg Number of Fragments Clean' }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Avg % Lacuna' }
        }
      }
    }
  });
}



// ===== MAIN =====
document.addEventListener('DOMContentLoaded', () => {
    // 0) registra il plugin Sankey (UMD export)
    if (typeof Sankey === 'function') {
      Chart.register(Sankey);
    } else if (typeof ChartSankey === 'function') {
      Chart.register(ChartSankey);
    }

  // 1) parse CSV e preprocess
  Papa.parse(csvFilePath, {
    header: true,
    download: true,
    complete: res => {
      normalizedData = normalizeCsvHeaders(res.data);
    // Raccogli tutti i raw lacuna che non sono in mappaturaValori
    const unknownLacuna = new Set();
    normalizedData.forEach(row => {
      const raw = (row["% lacunaire"] || "").trim();
      // se non è una key nota nella mappatura
      if (raw && mappaturaValori[raw] === undefined) {
        unknownLacuna.add(raw);
      }
    });

    // Stampa in console
    console.log("Unknown % lacunaire values:", Array.from(unknownLacuna));



      preprocessData();

      // ====== costruiamo i flussi material → degradation ======
      sankeyFlows = [];
      normalizedData.forEach(row => {
        const rawM = (row["matériau simplifié"]||"").trim();
        if (!rawM) return;
        const mat = materialTranslations[rawM.toLowerCase()] || rawM;
        const degr = (row["degradation state"]||"")
                      .split(/\s*,\s*/)
                      .map(s => s.trim())
                      .filter(Boolean);
        degr.forEach(d => sankeyFlows.push({ from: mat, to: d, weight: 1 }));
      });
      // =========================================================

        // collapseCondition: heatmap + sankey con Google Charts + radar Chart.js
        const cCond = document.getElementById('collapseCondition');
        if (cCond) {
          cCond.addEventListener('shown.bs.collapse', () => {
            if (cCond.dataset.condInit) return;
            cCond.dataset.condInit = '1';

            // 1) disegna la heatmap
            renderHeatmap(); // Heatmap

            // 2) quando Google Charts è pronto, disegna Sankey e poi radar
            google.charts.setOnLoadCallback(() => {
              drawGoogleSankey(); // Google sankey
              renderWeaponRadar();   // Radar Chart.js
              renderConditionByWeapon(); // Stacked Chart.js
              renderDegradationByWeaponCounts(); // 3) i due grafici “Degradation by Weapon”
              renderDegradationByWeaponPercent();
            });
          });
        }
    },
    error: e => console.error(e)
  });


  // 2) collapseMap: init map+markers alla prima apertura
  const cMap = document.getElementById('collapseMap');
  if (cMap) {
    cMap.addEventListener('shown.bs.collapse',()=>{
      initMap();
      setTimeout(()=>map.invalidateSize(),200);
    });
  }

  // 3) collapseLacunarity: render charts alla prima apertura
  const cLac = document.getElementById('collapseLacunarity');
  if (cLac) {
    cLac.addEventListener('shown.bs.collapse',()=>{
      if (cLac.dataset.chartInit) return;
      cLac.dataset.chartInit = '1';
      renderChartAllData();
      renderChartApprox();
      renderChartMaterialAverage();
      renderMaterialCards();
      renderBubbleChart();
    });
  }

  // 4) Vase animation & typewriter
  document.querySelectorAll('.vase-container').forEach(container=>{
    const entry = container.getAttribute('data-entry');
    const parts = Array.from(container.querySelectorAll('image'));
    parts.forEach((part,idx)=>{
      const off = part.id==='base8'
        ? (entry==='left'?'offscreen-left':entry==='right'?'offscreen-right':'offscreen-up')
        : (entry==='left'?'offscreen-left':entry==='right'?'offscreen-right':(idx%2===0?'offscreen-right':'offscreen-left'));
      part.classList.add(off);
      setTimeout(()=>{
        part.classList.remove('offscreen-left','offscreen-right','offscreen-up');
        part.classList.add('onscreen');
      }, idx*300);
    });
  });
  const heading = document.querySelector('#home h1');
  if (heading) heading.classList.add('typewriter');
});


document.addEventListener('DOMContentLoaded', () => {
  Papa.parse('assets/datasets/object/object.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      const cols = results.meta.fields;
      const container = document.getElementById('table-container');

      // Crea l'elemento <table>
      const table = document.createElement('table');
      table.classList.add('table', 'table-striped', 'table-hover');

      // Thead
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      cols.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Tbody
      const tbody = document.createElement('tbody');
      results.data.forEach(row => {
        const tr = document.createElement('tr');
        cols.forEach(col => {
          const td = document.createElement('td');
          td.textContent = row[col] || '';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      // Inserisci la tabella nel container
      container.appendChild(table);
    },
    error: function(err) {
      console.error('Errore nel caricamento CSV:', err);
    }
  });
});


// rdf viewer

document.addEventListener('DOMContentLoaded', () => {
  const viewer = document.getElementById('rdf-viewer');

  if (viewer) {
    fetch('assets/datasets/rdf/knowledge-graph_obj_corretto.ttl')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.text();
      })
      .then(data => {
        viewer.textContent = data;
      })
      .catch(error => {
        viewer.textContent = 'Error loading RDF content: ' + error;
        console.error('Error fetching RDF:', error);
      });
  }
});


/**
 * Fetches JSON file and displays it pretty-printed and syntax-highlighted using Highlight.js
 * @param {string} url - Path to the JSON file
 * @param {string} codeElementId - ID of the <code> element
 */
async function renderJsonHighlighted(url, codeElementId) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    const jsonData = await response.json();
    const pretty = JSON.stringify(jsonData, null, 2);
    const codeEl = document.getElementById(codeElementId);
    codeEl.textContent = pretty;
    // Trigger Highlight.js on the newly inserted content
    if (window.hljs) {
      hljs.highlightElement(codeEl);
    }
  } catch (err) {
    console.error('Error loading JSON:', err);
    document.getElementById(codeElementId).textContent = 'Failed to load JSON data.';
  }
}

// Initialize highlighted JSON viewers on page load
window.addEventListener('DOMContentLoaded', () => {
  renderJsonHighlighted('assets/datasets/documentation/obj_ita_eng_conv.json', 'obj-json-mapping');
  renderJsonHighlighted('assets/datasets/documentation/pro_ita_eng_conv.json', 'pro-json-mapping');
});


// quando il DOM è pronto, carica e visualizza entrambi i CSV
document.addEventListener('DOMContentLoaded', () => {
  // helper generico identico a quello di Museum Objects
  function renderCsvSection(csvPath, containerId) {
    Papa.parse(csvPath, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: results => {
        const cols = results.meta.fields;
        const data = results.data;
        const container = document.getElementById(containerId);

        // crea la table
        const table = document.createElement('table');
        table.classList.add('table', 'table-striped', 'table-hover');

        // thead
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        cols.forEach(c => {
          const th = document.createElement('th');
          th.textContent = c;
          headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        // tbody
        const tbody = document.createElement('tbody');
        data.forEach(row => {
          const tr = document.createElement('tr');
          cols.forEach(c => {
            const td = document.createElement('td');
            td.textContent = row[c] || '';
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        // inserisci la table nel container
        container.appendChild(table);
      },
      error: err => {
        console.error('Errore caricamento CSV', err);
        document.getElementById(containerId)
                .innerHTML = '<p class="text-danger">Impossibile caricare i dati.</p>';
      }
    });
  }

  // chiama per entrambi i template
  renderCsvSection(
    'assets/datasets/documentation/template_obj.csv',
    'table-container-obj'
  );
  renderCsvSection(
    'assets/datasets/documentation/template_pro.csv',
    'table-container-pro'
  );
});
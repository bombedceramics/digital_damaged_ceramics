// Maximum number of fallback attempts for image filenames
const MAX_ATTEMPTS = 5;

// Path to the CSV file
const csvFilePath = 'input_data_per_web/unified_dataset_ceramics_ver10.csv';

function simplifyId(str) {
  let id = str.replace(/\s*[\(\[].*?[\)\]]\s*/g,'');
  id = id.trim().toLowerCase();
  id = id.normalize('NFKD').replace(/[^\x00-\x7F]/g,'');
  id = id.replace(/\s+/g,' ');
  id = id.replace(/ /g,'_')
         .replace(/"/g,'')
         .replace(/\./g,'_')
         .replace(/^_+|_+$/g,'')
         .replace(/_+/g,'_');
  return id;
}

// Dictionary to translate French material names to English
const materialTranslations = {
  "terre cuite": "Terracotta",
  "terraglia": "Creamware",
  "porcelaine": "Porcellain",
  "faïence": "Earthenware",
  "grés": "Stonewear",
  "quartz": "Quartz",
  "mixte": "Mix",
  "métal": "Metal",
  "mixte(terre cuite+quartz)": "Mix (Terracotta + Quartz)",
  "mixte (grés + métal)": "Mix (Stonewear + Metal)"
};

// Dictionary for background images per material (keys are the translated names)
const backgroundImages = {
  "Earthenware": "assets/materials/fa-ence.jpg",
  "Stonewear": "assets/materials/gr-s.jpg",
  "Mix (Stonewear + Metal)": "assets/materials/mixte--gr-s---m-tal-.jpg",
  "Mix (Terracotta + Quartz)": "assets/materials/mixte-terre-cuite-quartz-.jpg",
  "Porcellain": "assets/materials/porceclaine.jpg",
  "Creamware": "assets/materials/terraglia.jpg",
  "Terracotta": "assets/materials/terre-cuite.jpg"
};

// Funzione di sanitizzazione per creare ID validi
function makeSafeId(str) {
  return 'carousel-' + str
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')   // tutto non alphanumerico → trattino
    .replace(/^-+|-+$/g, '');       // rimuovi trattini in testa/coda
}

// Use Papa Parse to load the CSV file
Papa.parse(csvFilePath, {
  header: true,
  download: true,
  complete: function(results) {
    const data = results.data;
    // Filter rows for Sèvres collection: provenance_file starting with "sevres_"
    const sevresData = data.filter(row =>
      row["provenance_file"] &&
      row["provenance_file"].startsWith("sevres_")
    );
    // Group rows by translated "matériau simplifié"
    const groups = groupByMaterial(sevresData);
    // Render the catalogue grouped by material
    renderCatalogue(groups);
  },
  error: function(err) {
    console.error("Error loading CSV: ", err);
  }
});

// Function to group rows by "matériau simplifié" using the translation dictionary
function groupByMaterial(data) {
  return data.reduce((groups, row) => {
    const originalMaterial = row["matériau simplifié"] || "Unknown";
    const key = originalMaterial.trim().toLowerCase();
    const translated = materialTranslations[key] || originalMaterial;
    if (!groups[translated]) groups[translated] = [];
    groups[translated].push(row);
    return groups;
  }, {});
}

// Function to render the catalogue using Bootstrap collapse sections and cards
function renderCatalogue(groups) {
  const container = document.getElementById("catalogue-container");
  let html = '';

  for (const material in groups) {
    const safeId = material
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
    const bgStyle = backgroundImages[material]
      ? `background: url('${backgroundImages[material]}') no-repeat center center;
         background-size: cover; padding: 20px; border-radius: 5px;`
      : '';
    const overlayStyle = backgroundImages[material]
      ? `background-color: rgba(0,0,0,0.5); padding: 10px; border-radius: 5px;`
      : '';

    html += `
      <div class="material-group mb-5" style="${bgStyle}">
        <!-- solo header con overlay -->
        <div style="${overlayStyle}">
          <h3 class="text-white">${material}</h3>
          <button class="btn btn-primary mb-3"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#group-${safeId}"
                  aria-expanded="false"
                  aria-controls="group-${safeId}">
            Show/Hide ${material} Items
          </button>
        </div>

        <!-- collapse vero -->
        <div class="collapse" id="group-${safeId}">
          <div class="row">
    `;

    groups[material].forEach(row => {
      const inventaire     = row["inventaire clean"] || "";
      const simpleId       = simplifyId(inventaire);
      const anchorId       = `itm-${simpleId}`;
      const typologie_en   = row["typologie@en"] || "";
      const datation       = row["Data"] || "";
      const provenance     = row["provenance@en"] || "";
      const nbFragments    = row["number of fragments clean"] || "";
      const missingPercent = row["% lacunaire"] || "";

      // Pulizia e dedup filenames
      const rawFilenames = row["pictures filenames"] || "";
      const images = Array.from(new Set(
        rawFilenames
          .split(/\r?\n|\s*;\s*/)
          .map(f => f.trim())
          .filter(f => f)
      ));

      const basePath = "assets/catalogue/sevres_visualizazzioni_cmpr";
      let imageHtml = '';

      if (images.length > 1) {
        const carouselId = makeSafeId(inventaire + '-' + Math.random().toString(36).substr(2,5));
        imageHtml += `<div id="${carouselId}" class="carousel slide mb-3" data-bs-ride="carousel">
          <div class="carousel-indicators">
            ${images.map((_, i) => `
              <button type="button"
                      data-bs-target="#${carouselId}"
                      data-bs-slide-to="${i}"
                      class="${i===0?'active':''}"
                      ${i===0?'aria-current="true"':''}
                      aria-label="Slide ${i+1}"></button>
            `).join('')}
          </div>
          <div class="carousel-inner">
            ${images.map((img, i) => `
              <div class="carousel-item ${i===0?'active':''}">
                <img src="${basePath}/${img}"
                     class="d-block w-100"
                     style="height:300px; object-fit:cover;"
                     alt="Catalogue ${inventaire}"
                     data-filename="${img}"
                     onerror="tryNextImage(this,'${basePath}','${img}');">
              </div>
            `).join('')}
          </div>
          <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
            <span class="carousel-control-prev-icon"></span>
          </button>
          <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
            <span class="carousel-control-next-icon"></span>
          </button>
        </div>`;
      } else {
        const first = images[0] || "";
        imageHtml = `
          <img src="${basePath}/${first}"
               class="card-img-top mb-3"
               style="height:300px; object-fit:cover;"
               alt="Catalogue ${inventaire}"
               data-filename="${first}"
               onerror="tryNextImage(this,'${basePath}','${first}');">`;
      }

      html += `
        <div id="${anchorId}" class="col-md-4 mb-3">
          <div class="card h-100">
            ${imageHtml}
            <div class="card-body">
              <h5 class="card-title">
                <a href="#${anchorId}" class="text-decoration-none">${inventaire}</a>
              </h5>
              <p class="card-text"><strong>Type:</strong> ${typologie_en}</p>
              <p class="card-text"><strong>Date:</strong> ${datation}</p>
              <p class="card-text"><strong>Provenance:</strong> ${provenance}</p>
              <p class="card-text"><strong>Fragments:</strong> ${nbFragments}</p>
              <p class="card-text"><strong>Missing %:</strong> ${missingPercent}</p>
            </div>
          </div>
        </div>`;
    });

    html += `
          </div>
        </div>
      </div>`;
  }

  container.innerHTML = html;

  // rimuovo controlli se meno di 2 slide
  document.querySelectorAll('.carousel').forEach(car => {
    const slides = car.querySelectorAll('.carousel-item').length;
    if (slides < 2) {
      car.querySelectorAll('.carousel-control-prev, .carousel-control-next, .carousel-indicators')
         .forEach(el => el.remove());
    }
  });
}

// Helper function to try loading alternate image filenames for missing images
function tryNextImage(img, basePath, filename) {
  let attempt = parseInt(img.getAttribute('data-attempt')) || 0;
  attempt++;
  img.setAttribute('data-attempt', attempt);

  if (attempt > MAX_ATTEMPTS) {
    img.onerror = null;
    img.src = `${basePath}/alt_sevres.png`;
    console.log(`⚠️ Fallback finale: immagine non trovata per "${filename}", uso alt_sevres.png`);
    return;
  }

  img.src = `${basePath}/${filename} (${attempt}).JPG`;
}
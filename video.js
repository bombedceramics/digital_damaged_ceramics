// video.js

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("videos-container");
  if (!container) return;

  const JSON_PATH = "assets/videos/video_links.json";

  // Converte una URL YouTube (anche Shorts) in URL embed
  function getYouTubeEmbedUrl(url) {
    try {
      const u = new URL(url);

      // Caso standard: https://www.youtube.com/watch?v=VIDEO_ID
      if (u.searchParams.has("v")) {
        const id = u.searchParams.get("v");
        return `https://www.youtube.com/embed/${id}`;
      }

      // Caso Shorts: https://www.youtube.com/shorts/VIDEO_ID?...
      if (u.pathname.startsWith("/shorts/")) {
        const parts = u.pathname.split("/shorts/");
        if (parts.length > 1) {
          const idWithParams = parts[1];
          const id = idWithParams.split("?")[0];
          return `https://www.youtube.com/embed/${id}`;
        }
      }

      // Fallback: uso direttamente la URL, potrebbe non incorporarsi perfettamente
      return url;
    } catch (e) {
      // Se la URL è malformata, ritorno così com'è
      return url;
    }
  }

  fetch(JSON_PATH)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      const entries = Object.entries(data); // [ [ "14,2", "https://..." ], ... ]

      if (!entries.length) {
        container.innerHTML = `<p class="text-center">No videos available.</p>`;
        return;
      }

      let html = "";

      entries.forEach(([inventoryNumber, url]) => {
        const embedUrl = getYouTubeEmbedUrl(url);

        html += `
          <div class="col-12 col-md-6">
            <div class="card shadow-sm h-100">
              <div class="ratio ratio-16x9">
                <iframe
                  src="${embedUrl}"
                  title="Aging video ${inventoryNumber}"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                  loading="lazy">
                </iframe>
              </div>
              <div class="card-body text-center">
                <p class="card-text mb-1">Inventory: ${inventoryNumber}</p>
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-secondary mt-2">
                  Open on YouTube
                </a>
              </div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    })
    .catch((error) => {
      console.error("Error loading video links:", error);
      container.innerHTML = `
        <div class="col-12">
          <p class="text-center text-danger">Error loading videos.</p>
        </div>
      `;
    });
});

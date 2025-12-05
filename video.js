// video.js

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("videos-container");
  if (!container) return;

  const JSON_PATH = "assets/videos/video_links.json";

  // Estrae l’ID del video da una URL YouTube
  function extractYouTubeID(url) {
    try {
      const u = new URL(url);

      // Caso standard
      if (u.searchParams.has("v")) {
        return u.searchParams.get("v");
      }

      // Caso Shorts
      if (u.pathname.startsWith("/shorts/")) {
        return u.pathname.split("/shorts/")[1].split("?")[0];
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  // Crea URL embed con autoplay + loop + mute
  function getYouTubeEmbedUrl(url) {
    const videoId = extractYouTubeID(url);
    if (!videoId) return url;

    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`;
  }

  fetch(JSON_PATH)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const entries = Object.entries(data);

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
                  allow="autoplay"
                  loading="lazy"
                  mute
                ></iframe>
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

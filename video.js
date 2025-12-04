// video.js

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("videos-container");
  if (!container) return;

  const VIDEO_FOLDER = "assets/videos";

  // Elenco dei video presenti in assets/videos
  const videos = [
    {
      file: "dream_15.mp4",
      title: "Dream 15 – Aging Simulation"
    },
    {
      file: "unknown.mp4",
      title: "Unknown – Aging Simulation"
    }
  ];

  let html = "";

  videos.forEach((video) => {
    html += `
      <div class="col-12 col-md-6">
        <div class="card shadow-sm">
          <div class="ratio ratio-16x9">
            <video
              class="w-100 h-100"
              controls
              preload="metadata">
              <source src="${VIDEO_FOLDER}/${video.file}" type="video/mp4">
              Your browser does not support HTML5 video.
            </video>
          </div>
          <div class="card-body text-center">
            <p class="card-text">${video.title}</p>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
});

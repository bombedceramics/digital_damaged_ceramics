import os
import subprocess
from tqdm import tqdm

def comprimi_video(input_folder, output_folder, crf=23):
    # Crea la directory di output se assente
    os.makedirs(output_folder, exist_ok=True)

    # Filtra solo file MP4
    file_list = [f for f in os.listdir(input_folder) if f.lower().endswith('.mp4')]

    for file_name in tqdm(file_list, desc=f"Compressione video in {os.path.basename(input_folder)}"):
        input_path = os.path.join(input_folder, file_name)
        output_path = os.path.join(output_folder, file_name)

        # Salta il file se esiste già
        if os.path.exists(output_path):
            continue

        # Comando FFmpeg per compressione web
        comando = [
            "ffmpeg",
            "-i", input_path,
            "-vcodec", "libx264",
            "-crf", str(crf),
            "-preset", "medium",
            "-acodec", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            output_path
        ]

        # Esegui FFmpeg senza output verboso
        subprocess.run(comando, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


# Configurazione directory input/output
input_videos = "/Users/ariannamorettj/Desktop/3D_CULTURAL_HERITAGE_SUMMER_24/INVECCHIAMENTI_COCCI/COMPLETATI"
output_videos = "assets/videos"

# CRF 23 = qualità alta e file leggeri per il web
crf = 23

# Esecuzione script
comprimi_video(input_videos, output_videos, crf)

print("Compressione video completata.")

import os
from PIL import Image
from tqdm import tqdm

def comprimi_immagini(input_folder, output_folder, qualita=75):
    # Crea la directory di output se assente
    os.makedirs(output_folder, exist_ok=True)

    # Filtra i file supportati (JPG, JPEG, PNG)
    file_list = [f for f in os.listdir(input_folder) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

    for file_name in tqdm(file_list, desc=f"Compressione immagini in {os.path.basename(input_folder)}"):
        input_path = os.path.join(input_folder, file_name)
        output_path = os.path.join(output_folder, file_name)

        # Salta il file se presente nella directory di output
        if os.path.exists(output_path):
            continue

        # Apertura file immagine
        with Image.open(input_path) as img:
            ext = file_name.lower().split('.')[-1]
            img_format = 'PNG' if ext == 'png' else 'JPEG'

            # Conversione per JPEG e salvataggio con compressione
            if img_format == 'JPEG':
                img = img.convert('RGB')
                img.save(output_path, img_format, quality=qualita, optimize=True)
            else:
                img.save(output_path, img_format, optimize=True)


# Configurazione directory di input/output
input_folder_s = '/Users/ariannamorettj/Desktop/3D_CULTURAL_HERITAGE_SUMMER_24/DH_25_Workshop/nuove_foto_catalogo/MNC_SEVRES'
output_folder_s = 'assets/catalogue/sevres_visualizazzioni_cmpr'
input_folder_f = '/Users/ariannamorettj/Desktop/3D_CULTURAL_HERITAGE_SUMMER_24/DH_25_Workshop/nuove_foto_catalogo/MIC_FAENZA'
output_folder_f = 'assets/catalogue/faenza_visualizazzioni_cmpr'

qualita = 75

# Esecuzione
comprimi_immagini(input_folder_s, output_folder_s, qualita)
comprimi_immagini(input_folder_f, output_folder_f, qualita)

print("Compressione completata.")

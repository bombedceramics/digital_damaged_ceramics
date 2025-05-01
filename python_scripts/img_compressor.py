import os
from PIL import Image
from tqdm import tqdm

def comprimi_immagini(input_folder, output_folder, qualita=75):
    # Crea la cartella di output se non esiste
    os.makedirs(output_folder, exist_ok=True)

    # Elenco file JPG e PNG
    file_list = [f for f in os.listdir(input_folder) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

    for file_name in tqdm(file_list, desc=f"Compressione immagini in {os.path.basename(input_folder)}"):
        input_path = os.path.join(input_folder, file_name)
        output_path = os.path.join(output_folder, file_name)

        # Apri e salva con compressione mantenendo il formato
        with Image.open(input_path) as img:
            ext = file_name.lower().split('.')[-1]
            img_format = 'PNG' if ext == 'png' else 'JPEG'
            if img_format == 'JPEG':
                img = img.convert('RGB')
                img.save(output_path, img_format, quality=qualita, optimize=True)
            else:
                img.save(output_path, img_format, optimize=True)

# CONFIGURA QUI:
input_folder_s = 'assets/catalogue/Sèvres visualizazzioni'
output_folder_s = 'assets/catalogue/sevres_visualizazzioni_cmpr'
input_folder_f = 'assets/catalogue/Faenza visualizazzioni'
output_folder_f = 'assets/catalogue/faenza_visualizazzioni_cmpr'

qualita = 75

# esecuzione della funzione per entrambi i set di immagini
comprimi_immagini(input_folder_s, output_folder_s, qualita)
comprimi_immagini(input_folder_f, output_folder_f, qualita)

print("Compressione completata!")

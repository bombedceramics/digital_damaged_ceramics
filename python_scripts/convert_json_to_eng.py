import json
from copy import deepcopy
from pathlib import Path

# === carica il dizionario da file ===
INPUT_PATH = Path("input_data_per_web/chemical_input_data.json")
with open(INPUT_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

# === mapping traduzioni ===
mapping = {
    "ui": {
        "non_alterato": "unaltered",
        "alterato": "altered",
        "Pt": "spot / point (Pt)"
    },
    "sample_titles": {
        "194,2 (Grès salato Chini) XXe secolo": "194.2 (Chini salt-glazed stoneware) 20th century",
        "1539,2 (terracotta invetriata), Giappone XXe secolo": "1539.2 (glazed terracotta), Japan, 20th century",
        "1604,2 (porcellana giapponese) XIXe secolo": "1604.2 (Japanese porcelain) 19th century",
        "5723,1 (faenza silicea) 1550-1286 a.C": "5723.1 (siliceous faience) 1550–1286 BC",
        "SN Alberghi (terraglia) XIXe secolo": "SN Alberghi (creamware) 19th century",
        "382,1 (faenza engobbiata) XVIIe secolo": "382.1 (engobed faience) 17th century",
        "382,1 decorato (faenza engobbiata) XVIIe secolo": "382.1 decorated (engobed faience) 17th century",
        "669,1 (faenza engobbiata e graffita) XV secolo": "669.1 (engobed and sgraffito faience) 15th century",
        "3460,1-3500,1 (maiolica) XVIIIe secolo": "3460.1–3500.1 (maiolica) 18th century",
        "1185,2 (maiolica Ginori) XXe secolo": "1185.2 (Ginori maiolica) 20th century",
        "2857,2 (grès bianco) XXe secolo": "2857.2 (white stoneware) 20th century",
        "4611,1 (maiolica) XVIIIe secolo": "4611.1 (maiolica) 18th century",
        "4651,1 (maiolica) XVIIIe secolo": "4651.1 (maiolica) 18th century",
        "343,1 (maiolica) XVII secolo": "343.1 (maiolica) 17th century",
        "1938,2 (biscuit) XXe secolo": "1938.2 (biscuit/unglazed porcelain) 20th century"
    },
    "labels": {
        "punta nera": "black tip",
        "foglia nera": "black leaf",
        "bianco annerito": "blackened white",
        "bianco": "white",
        "giallo marrone": "yellow-brown",
        "giallo grigio": "yellow-grey",
        "linea marrone": "brown line",
        "parte dorata": "gilded area",
        "rosso marrone": "red-brown",
        "rosso nero": "red-black",
        "fiore": "flower",
        "fiore giallo": "yellow flower",
        "incisione marrone": "brown engraving",
        "bolla bianca": "white bubble",
        "angolo blu": "blue corner",
        "bianco diventato nero": "white turned black",
        "blu": "blue",
        "blu sotto la rottura": "blue under the break",
        "angolo bianco": "white corner",
        "banda azzurra": "light-blue band",
        "nero": "black",
        "verde foglia": "leaf green",
        "punta verde": "green tip",
        "bordo nero": "black edge",
        "giallo": "yellow",
        "rosso": "red",
        "giallo diventato nero": "yellow turned black"
    }
}

UI_MAP = mapping["ui"]
TITLE_MAP = mapping["sample_titles"]
LABEL_MAP = mapping["labels"]

def translate_pt_key(key: str) -> str:
    if key.startswith("Pt"):
        rest = key[2:]
        return f"{UI_MAP['Pt']}{rest}"
    return key

def translate_dict(d):
    if isinstance(d, dict):
        new_d = {}
        for k, v in d.items():
            if k in ("non_alterato", "alterato"):
                new_key = UI_MAP[k]
            elif k.startswith("Pt"):
                new_key = translate_pt_key(k)
            else:
                new_key = k
            new_v = translate_dict(v)
            if isinstance(new_v, dict) and "label" in new_v:
                lbl = new_v["label"]
                if isinstance(lbl, str) and lbl in LABEL_MAP:
                    new_v = deepcopy(new_v)
                    new_v["label"] = LABEL_MAP[lbl]
            new_d[new_key] = new_v
        return new_d
    elif isinstance(d, list):
        return [translate_dict(x) for x in d]
    else:
        return d

def translate_top_level_titles(data_dict):
    out = {}
    for top_k, top_v in data_dict.items():
        new_top_k = TITLE_MAP.get(top_k, top_k)
        out[new_top_k] = translate_dict(top_v)
    return out

translated = translate_top_level_titles(data)

# stampa JSON e salva anche su file (opzionale)
print(json.dumps(translated, ensure_ascii=False, indent=2))

OUTPUT_PATH = INPUT_PATH.with_name("chemical_input_data.en.json")
with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    json.dump(translated, f, ensure_ascii=False, indent=2)

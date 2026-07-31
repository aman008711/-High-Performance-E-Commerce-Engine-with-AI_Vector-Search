import os
import urllib.request

FILES = [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "onnx/model_quantized.onnx"
]

# Use high-speed mirror for rapid download
BASE_URL = "https://hf-mirror.com/Xenova/all-MiniLM-L6-v2/resolve/main/"
DEST_DIR = "server/src/model/Xenova/all-MiniLM-L6-v2/"

os.makedirs(os.path.join(DEST_DIR, "onnx"), exist_ok=True)

print("Starting model download...")
for file in FILES:
    url = BASE_URL + file
    dest = os.path.join(DEST_DIR, file)
    print(f"Downloading {file}...")
    try:
        urllib.request.urlretrieve(url, dest)
        print(f"Successfully downloaded {file}")
    except Exception as e:
        print(f"Failed to download {file}: {e}")
print("Finished download process.")

from PIL import Image

PATHS = [f"./{i}.jpg" for i in range(16)]
H = 4
W = 4

SIZE = (1000, 1000)

images = [Image.open(i).resize(SIZE, Image.Resampling.LANCZOS) for i in PATHS]

result = Image.new("RGB", (W * SIZE[0], H * SIZE[1]))

for i in range(H):
    for j in range(W):
        result.paste(images[i * W + j], (j * SIZE[0], i * SIZE[1]))

result.save("merged_image.jpg")

# IMAGE-PROMPTS — промпты для генерации медиа по слотам

Единый визуальный стиль (вставлять в каждый промпт как «STYLE»):

```
STYLE: premium medical interior, calm and quiet, matte non-glossy surfaces, palette of deep burgundy (#6B1730, #350A16) and warm porcelain white (#F6F1EE), subtle cool aqua accents only in water, soft diffused window light, shallow depth of field, photographic realism, editorial composition with generous negative space, no people’s faces, no text, no logos, no watermarks, no clinical blue, no neon
```

Негативный промпт (общий):

```
NEGATIVE: text, watermark, logo, signature, stock-photo smile, recognizable face, blue medical lighting, neon glow, oversaturated, plastic look, cartoon, illustration, 3d render look, cluttered, dirty, blood, syringes, red cross symbol, pills
```

Технические требования ко всем изображениям: минимум по большей стороне 1920 px (для 16:9) / 1600 px (4:3) / 1200 px (4:5); экспорт AVIF + WebP + JPEG в размерах из `media-manifest.json`; имена файлов строго `<slot>-<width>.<ext>` в `public/media/`.

---

## hero-water-loop — видео 16:9, критичный

**Кадр:** макросъёмка одной капли, падающей в тёмную воду, крупным планом; всплеск минимальный, вода почти чёрная с бургунди-подсветкой сбоку; медленное движение (замедление 4–8×), бесшовный луп 8–12 с. Камера статична.

```
Prompt: extreme macro of a single water droplet falling into still dark water, dark burgundy side lighting, slow motion, tiny ripples, deep shadows, cinematic, seamless loop, STYLE
Aspect: 16:9 · Duration: 8–12 s loop · Export: webm (VP9) + mp4 (H.264), poster = первый кадр (webp)
NEGATIVE + "splash droplets flying, bright highlights, blue tint"
```

## water-macro-loop — видео 16:9

**Кадр:** кристально чистая вода в лабораторной стеклянной колбе/цилиндре, медленно поднимающиеся редкие пузырьки, холодный aqua-свет, фарфоровый фон. Луп 8–10 с.

```
Prompt: crystal clear water inside a glass laboratory beaker on a porcelain white surface, a few slow rising bubbles, soft cool aqua rim light, minimal composition, seamless loop, STYLE
Aspect: 16:9 · 8–10 s · webm + mp4 + poster
NEGATIVE + "colored liquid, foam, condensation drips"
```

## procedure-seq-001…090 — image sequence 16:9, 90 кадров

**Идея:** одно непрерывное движение камеры по пустому кабинету (для scroll-scrub): 
кадры 1–25 — общий план кабинета: кушетка с одноразовой простынёй, аппарат гидроколонотерапии, тёплый рассеянный свет из окна; 
кадры 26–50 — медленный наезд на панель аппарата и колбу с водой; 
кадры 51–70 — деталь: одноразовый комплект в запечатанной упаковке на подносе; 
кадры 71–90 — отъезд к окну с мягким светом и фарфоровыми стенами.
Без людей. Генерируется как видео (10–12 с, 1280×720), затем нарезается на 90 равномерных кадров WebP (q≈70). Первый и последний кадры должны быть спокойными (без движения).

```
Prompt: slow dolly through an empty premium colon hydrotherapy treatment room: treatment couch with disposable white sheet, modern hydrotherapy device with a clear water reservoir, warm diffused daylight from a window, porcelain white walls with deep burgundy accents, then macro of a sealed disposable kit on a tray, then drift toward the window, no people, STYLE
Aspect: 16:9 · 1280×720 · 90 frames · files procedure-seq-001.webp … procedure-seq-090.webp → public/media/sequence/ ; те же кадры в 640×360 → public/media/sequence/640/ (мобильные)
NEGATIVE + "people, hands, moving objects other than camera"
```

## procedure-poster — 16:9

Первый кадр последовательности как самостоятельное изображение (общий план кабинета).

```
Prompt: empty premium colon hydrotherapy treatment room, treatment couch with disposable white sheet, hydrotherapy device on the side, warm diffused window light, porcelain and burgundy palette, wide shot, STYLE
Aspect: 16:9 · 1920 / 1280 / 768
```

## room-interior-01 — 4:3

```
Prompt: treatment room detail: couch with fresh disposable sheet, hydrotherapy device slightly out of focus, soft shadow from the window, calm and orderly, STYLE
Aspect: 4:3 · 1600 / 1200 / 800
```

## room-interior-02 — 4:5

```
Prompt: water preparation corner: glass beaker, water ionizer panel out of focus, glass surface with a few condensation droplets, cool aqua reflections on porcelain, vertical composition, STYLE
Aspect: 4:5 · 1200 / 900 / 600
```

## disposable-kit-macro — 4:3

```
Prompt: macro photo of a sealed single-use medical kit in clear factory packaging placed on a porcelain white surface, side light, tactile texture of the packaging, small burgundy accent, STYLE
Aspect: 4:3 · 1600 / 1200 / 800
NEGATIVE + "opened package, syringes, needles"
```

## water-system-voko — 4:5 (предпочтительно реальное фото оборудования)

```
Prompt: a modern water purification unit in a clinic corner, white cabinet with a glass beaker of clear water next to it, soft cool light, no readable branding, vertical composition, STYLE
Aspect: 4:5 · 1200 / 900 / 600
```

## water-system-tyent — 4:5 (предпочтительно реальное фото оборудования)

```
Prompt: a countertop water ionizer with a small display glowing softly, a thin stream of clear water pouring into a glass, aqua highlight on the water, porcelain background, no readable branding, STYLE
Aspect: 4:5 · 1200 / 900 / 600
```

## device-hydrocolon — 4:5

```
Prompt: close-up of a colon hydrotherapy device control panel with temperature and pressure indicators, clean tubing, matte white and burgundy details, porcelain background, no text on the display, STYLE
Aspect: 4:5 · 1200 / 900 / 600
```

## specialist-portrait — 4:5 — ТОЛЬКО РЕАЛЬНАЯ ФОТОСЪЁМКА

Не генерировать. Бриф для фотографа: специалист в медицинской форме, спокойное лицо, полуоборот, мягкий рассеянный свет от окна, фон — кабинет вне фокуса, палитра фарфор/бургунди (например, бургунди-деталь формы или фона). Без скрещённых рук, без стоковой улыбки. Кадрирование под 4:5, запас сверху.

## consultation-scene — 3:2

```
Prompt: consultation desk seen from above at an angle: a specialist’s hands holding a pen over a medical form, a patient’s hands resting on the table, a glass of water, warm light, faces out of frame, STYLE
Aspect: 3:2 · 1800 / 1200 / 800
NEGATIVE + "faces, watches with readable dials, brand logos"
```

## center-entrance — 3:2 — реальная фотосъёмка

Фасад и вход в центр на ул. Карасай батыра, 152/1, дневной свет, вывеска читаемая. Без прохожих в кадре (или размытые).

## og-image-ru / og-image-kk — 1200×630

Сейчас сгенерированы программно (`node scripts/gen-icons.mjs`). Для финальной версии — композиция: тёмный бургунди-фон, капля воды справа (кадр из hero-water-loop), слева текст «Hydromed / Гидроколонотерапия в Алматы» (KZ: «Алматыдағы гидроколонотерапия»), внизу тонкая строка лицензии. Текст накладывается в макете, не в генерации.

# مصادر القوام والمؤثرات والأصوات (المسرح)

| الملف | الأصل | المؤلف | الرخصة | الرابط |
|---|---|---|---|---|
| textures/sand.webp, sand_nor.webp | gravelly_sand | Poly Haven | CC0 | https://polyhaven.com/a/gravelly_sand |
| textures/macro.webp | dirt_aerial_02 | Poly Haven | CC0 | https://polyhaven.com/a/dirt_aerial_02 |
| textures/farm.webp | farm_soil | Poly Haven | CC0 | https://polyhaven.com/a/farm_soil |
| textures/rock.webp | cliff_side | Poly Haven | CC0 | https://polyhaven.com/a/cliff_side |
| textures/pebble.webp | dry_river_pebbles | Poly Haven | CC0 | https://polyhaven.com/a/dry_river_pebbles |
| textures/road.webp (طرق + جدران البيوت) | brown_mud_dry | Poly Haven | CC0 | https://polyhaven.com/a/brown_mud_dry |
| textures/land_h.png, land_a.webp, land_b.webp | مولّدة بـ `tools/genterrain.mjs` (ارتفاع، اتجاه السطح، ظل، تعتيم) | المشروع | — | — |
| textures/fx_explo1.webp, fx_explo2.webp | Explosion01, Explosion02 (5×5) | Unity Labs Paris | CC0 | https://unity.com/blog/engine-platform/free-vfx-image-sequences-flipbooks |
| textures/fx_fire.webp | FireBall02 (8×8) | Unity Labs Paris | CC0 | نفس الرابط |
| textures/fx_cloud.webp | Cloud02 (8×8) | Unity Labs Paris | CC0 | نفس الرابط |
| textures/fx_flame.webp | Flame02 (16×4) | Unity Labs Paris | CC0 | نفس الرابط |
| sounds/tank.mp3 | Tank Firing | snottyboy | CC BY 3.0 | https://soundbible.com/1326-Tank-Firing.html |
| sounds/eject.mp3 | Mortar Round (مقصوص) | snottyboy | CC BY 3.0 | https://soundbible.com/1327-Mortar-Round.html |
| sounds/dshk.mp3 | M 82 Barrett 50 Cal (طلقة وحدة) | JKirsch | CC BY 3.0 | https://soundbible.com/1388-M-82-Barrett-50-Cal.html |
| sounds/boom_big.mp3 | Bomb Exploding | Sound Explorer | CC BY 3.0 | https://soundbible.com/1986-Bomb-Exploding.html |
| sounds/boom_mid.mp3 | Grenade Explosion | Mike Koenig | CC BY 3.0 | https://soundbible.com/1467-Grenade-Explosion.html |
| sounds/rocket.mp3 | RPG Plus Shrapnel (أول 1.6 ث) | Mike Koenig | CC BY 3.0 | https://soundbible.com/2075-RPG-Plus-Shrapnel.html |
| sounds/launch.mp3 | Bunker Buster Missile (5.2–11.2 ث) | Mike Koenig | CC BY 3.0 | https://soundbible.com/1847-Bunker-Buster-Missile.html |
| sounds/boom_far.mp3 | Explosion far Away #1 | Joseph SARDIN, BigSoundBank.com | CC0 | https://bigsoundbank.com/explosion-far-away-s1023.html |

التحويل: القوام بـ PIL إلى WebP، الأصوات بـ ffmpeg (قص + تلاشي + loudnorm، أحادي 80kbps).

## مجسمات أشياء الأرض (TH5.3)

نخل، شجر بساتين، أكاسيا، أكياس رمل، حواجز كونكريت، 3 سيارات مهجورة — كلها من Sketchfab (CC BY 4.0). المؤلفين والروابط بـ `models/CREDITS.md`.
اختيرت بالعين: `tools/propview.html` + `tools/propsheet.mjs` يصوّرون المرشحين، و`tools/propshots.mjs` يصوّر أماكنهم باللعبة.

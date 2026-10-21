# From materials to a graphics language

The client rarely sends lower thirds. You get a logo, a key visual, a poster, a slide master, a website, sometimes a few lower thirds found online "in this style". Other tools may be generating the rest of the event (stage screens, slides, social posts) from the same materials. The graphics must look like **the same event**, so derive them from the shared source, not from your own taste.

## 1. Inventory
List what you have and what each piece tells you:

| Material | Take from it | Ignore |
|---|---|---|
| Brand book / style guide | official colours (HEX/RGB), fonts, logo clear space, do's and don'ts | print-only rules (CMYK, paper) |
| Key visual / poster / banner | dominant and accent colours, shapes (angles, curves, stripes, gradients, glow), texture, mood | the photo itself, long copy |
| Slide master / website | type hierarchy (sizes, weights, caps, letter-spacing), UI details (pills, tags, outlines) | layouts meant for 16:9 full screen |
| Logo (SVG/PNG) | colours, geometry (an angle or curve to reuse), placement in a bug | stretching or recolouring it |
| Example lower thirds (client or stock) | structure: label above / beside, plate shapes, where the accent sits, how many lines | exact copy, watermarks, the stock "Breaking news" wording |
| Stage photo / venue | background brightness the graphic sits on (LED wall, dark stage), screen positions | |

If materials conflict (old and new logo, two palettes), ask once which is current.

## 2. Tokens
Write the result as tokens in `theme.css` (see the starter): colours with roles, fonts, radius, shadow, timing. Roles matter more than hues:
- `--plate` (background of text boxes) - usually dark and slightly transparent (0.88-0.95) so it reads over any picture;
- `--accent` - the brand colour, used in small areas (bar, label, separator, timer box);
- `--accent-ink` - text on the accent (check contrast);
- `--ink`, `--ink-2` - main and secondary text on the plate;
- `--warn`, `--danger` - for timers (not brand colours if the brand is red/orange; pick distinguishable ones).

Sample colours from the real file: `python3 scripts/palette.py keyvisual.png` (dominant colours with their share; small accents such as a red dot or a thin line merge into bigger areas - raise `-k 12` or crop the image to the detail). A bright brand colour on a large plate looks cheap and hurts readability; put it on 5-15 % of the graphic.

Contrast: text on plate at least 4.5:1, large titles 3:1 (`python3 scripts/palette.py --contrast "#ffffff" "#c8ff67"`). Broadcast is viewed small and compressed; thin weights and small labels under ~20 px (at 1080p) disappear.

## 3. Shapes and motifs
Translate the visual idea into something a 1-2 line text box can carry:
- angular key visual → skewed plates (`transform: skewX(-12deg)` on a wrapper, text counter-skewed), diagonal cut corners (`clip-path: polygon(...)`), stripes as `repeating-linear-gradient`;
- soft / organic → large radius, pill labels, gradient plates, slow ease;
- tech / data → thin outlines, grid or dot pattern at low opacity, monospaced numbers (`font-variant-numeric: tabular-nums` for timers in any font);
- premium / gala → lots of space, thin rules, letter-spaced caps, elegant fades instead of slides;
- logo geometry → reuse its angle or curve as the accent bar or the label shape.
Build shapes in CSS or inline SVG so colours follow the tokens. Use bitmaps only for the client's logos and photos.

## 4. Motion
The motion should match the brand character and stay out of the way: entrance 0.5-0.8 s with a soft landing (`cubic-bezier(.16,1,.3,1)`), exit faster (0.3-0.45 s, accelerating). Staggering (plate, then label, then text 80-150 ms apart) looks produced; more than three stages looks busy. One graphic family = one motion language (all lower thirds slide from the same side, the timer rises from below, etc.).

## 5. Adapting example lower thirds
When the client sends examples (screenshots like news templates or stock packs):
- describe the structure in words first ("label tab above-left, two-line plate, accent bar on the left, logo circle overlapping the left end") and rebuild that structure with the event's tokens;
- keep the client's idea of hierarchy (what's big, what's in caps), not their placeholder texts;
- stock packs show many variants; pick 1-2 structures and apply them consistently across the whole set instead of mixing.

## 6. Working with other generators
If another skill or tool is producing the event's key visual, slides or screens:
- take the tokens from its output (or its source materials) and write them once in `theme.css`; mention in the README which material they came from, so the next change can be propagated;
- deliver the graphics package as a folder that can be copied as is (fonts and images inside, relative paths) - no dependency on the other tool at runtime;
- if you make preview images for the client, render the templates in a browser with `?preview=1&data={...}` over a representative background (a stage photo or a frame of the stream) rather than over black.

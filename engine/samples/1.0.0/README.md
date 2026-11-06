# Sample plans, format 1.0.0

Hand-made plans used by the tests. All values in cm; room areas worked out by hand.

**A — one room** (`a-one-room.plan.json`). Walls on a 400 × 300 centreline rectangle, 23 cm thick, inside a compound wall on the plot boundary (which must not change the room). The window has a chajja. Clear floor 11.5…388.5 × 11.5…288.5 = 377 × 277 cm = **10.44 m²**.

**B — 1BHK with T-junctions** (`b-1bhk-t-junctions.plan.json`). 600 × 400 shell, 23 cm. Internal 11.5 cm walls: W5 at x = 300 (full depth), W6 at y = 250 from W5 to the east wall. Corner columns, a kitchen loft on W2, a chajja on the bedroom window.
- Bedroom: 11.5…294.25 × 11.5…388.5 = 282.75 × 377 = **10.66 m²**
- Kitchen: 305.75…588.5 × 11.5…244.25 = 282.75 × 232.75 = **6.58 m²**
- Toilet: 305.75…588.5 × 255.75…388.5 = 282.75 × 132.75 = **3.75 m²**

**C — L hall, duct, mixed walls** (`c-l-hall-duct.plan.json`). L-shaped outline (800 × 300 plus 400 × 300 upper arm), 23 cm except the bottom wall from x = 500 to 800, which is 15 cm. A free-standing duct (10 cm walls, centreline 100…160 square) and a stub wall with a free end at y = 150.
- Hall: 777 × 277 + 288.5 × 4 (thinner wall strip) + 377 × 300 = 329,483 cm², minus the duct's outer outline 70 × 70 = 4,900 → **32.46 m²**. The stub is ignored.
- Duct: 50 × 50 = **0.25 m²**

import sys
f = sys.argv[1] if len(sys.argv) > 1 else "public/sprites.js"
s = open(f).read()
def rep(old, new):
    global s
    assert s.count(old) == 1, ("match", old[:60]); s = s.replace(old, new)
if 'id: "skort"' in s:
    print("Already updated", f); sys.exit()

# Colors used by the new gear
rep('''  const SPARK = "#FFF6C2",''', '''  const PUMPKIN = "#FF8A1F", PUMPKIN_D = "#D9661A", BONE = "#F2F0E6", BONE_D = "#C9C4B2", CANDLE = "#FFE45C", FLOWER = "#FF8FA3";
  const SPARK = "#FFF6C2",''')

# Shirts
rep('''    // Pro Shop
    { id: "rugby"''', '''    // Pro Shop
    { id: "sleevepolo", name: "Sleeveless polo", rarity: "par", draw: p => [R(4, 10, 8, 6, "t"), R(11, 10, 1, 6, "T"),
        R(4, 10, 1, 2, "W"), R(11, 10, 1, 2, "W"), R(5, 10, 2, 1, "a"), R(9, 10, 2, 1, "a"), R(7, 10, 2, 2, "T"), R(7, 10, 2, 1, "S"), R(9, 12, 1, 1, "y")] },
    // Full-length: covers the pants, shoes still show at the hem. Neckline and bow take the shirt color.
    { id: "gown", name: "Gold sequin gown", rarity: "albatross", draw: p => [R(4, 10, 8, 6, "g"), R(11, 10, 1, 6, "G"),
        R(4, 16, 8, 2, "g"), R(3, 18, 10, 2, "g"), R(2, 20, 12, 2, "g"), R(11, 16, 1, 2, "G"), R(12, 18, 1, 2, "G"), R(13, 20, 1, 2, "G"),
        R(6, 10, 4, 1, "t"), R(7, 11, 2, 1, "t"), R(7, 16, 2, 1, "t"),
        ...DOTS([[5, 12], [10, 14], [4, 19], [9, 18], [6, 21]], SPARK, "px-twinkle"), ...DOTS([[9, 11], [6, 15], [11, 20], [3, 21]], SPARK, "px-twinkle2")] },
    { id: "rugby"''')

# Pants
rep('''    // Pro Shop
    { id: "cargo"''', '''    { id: "skort", name: "Pleated skort", rarity: "bogey", draw: () => [R(4, 16, 8, 1, "k"), R(7, 16, 2, 1, "x"),
        R(4, 17, 8, 2, "p"), R(3, 19, 10, 1, "p"), ...DOTS([[5, 17], [7, 18], [9, 17], [11, 18], [4, 19], [6, 19], [8, 19], [10, 19], [12, 19]], "P")] },
    // Pro Shop
    { id: "holoskirt", name: "Neon holo skirt", rarity: "eagle", draw: () => {
        const out = [R(4, 16, 8, 1, "k"), R(7, 16, 2, 1, "x")];
        for (let x = 3; x <= 12; x++) {
          const top = x < 4 || x > 11 ? 18 : 17;
          out.push(R(x, top, 1, 19 - top, x % 2 ? NEON_PINK : NEON_MINT));
        }
        return out.concat(DOTS([[5, 17], [10, 18]], SPARK, "px-twinkle"), DOTS([[8, 18], [3, 18]], SPARK, "px-twinkle2"));
      } },
    { id: "cargo"''')

# Hats
rep('''    // Pro Shop
    { id: "trucker"''', '''    // Pro Shop
    { id: "witchhat", name: "Witch hat", rarity: "par", draw: () => [R(2, 2, 12, 1, "k"), R(4, 0, 8, 2, "k"), R(5, -2, 6, 2, "k"), R(6, -4, 4, 2, "k"),
        R(8, -5, 2, 1, "k"), R(10, -6, 1, 1, "k"), R(4, 1, 8, 1, "c"), R(7, 1, 2, 1, "y")] },
    { id: "sunhat", name: "Sun hat", rarity: "birdie", draw: () => [R(4, -1, 8, 3, "c"), R(4, -1, 1, 1, "_"), R(11, -1, 1, 1, "_"), R(4, 1, 8, 1, "d"),
        R(1, 2, 14, 1, "c"), R(1, 3, 2, 1, "C"), R(13, 3, 2, 1, "C"),
        ...DOTS([[11, -1], [10, 0], [12, 0], [11, 1]], FLOWER), R(11, 0, 1, 1, "y")] },
    // Covers the whole head
    { id: "skullmask", name: "Skeleton mask", rarity: "birdie", draw: () => [R(4, 1, 8, 8, BONE), R(4, 1, 1, 1, "_"), R(11, 1, 1, 1, "_"),
        R(11, 2, 1, 6, BONE_D), R(5, 4, 2, 2, "k"), R(9, 4, 2, 2, "k"), R(7, 6, 2, 1, "k"), R(5, 8, 6, 1, "k"), ...DOTS([[6, 8], [8, 8], [10, 8]], BONE)] },
    { id: "pumpkin", name: "Pumpkin head", rarity: "eagle", draw: () => [R(4, 0, 8, 1, PUMPKIN), R(3, 1, 10, 7, PUMPKIN), R(4, 8, 8, 1, PUMPKIN),
        R(6, 0, 1, 9, PUMPKIN_D), R(9, 0, 1, 9, PUMPKIN_D), R(7, -1, 2, 1, "#3CCB6A"), R(8, -2, 1, 1, "#2E9E52"),
        ...DOTS([[5, 4], [6, 4], [6, 3], [9, 3], [9, 4], [10, 4]], CANDLE, "px-flame"),
        R(5, 6, 6, 1, CANDLE, "px-flame"), ...DOTS([[6, 7], [8, 7], [10, 7]], CANDLE, "px-flame2"), ...DOTS([[6, 6], [9, 6]], PUMPKIN)] },
    { id: "trucker"''')

# Items
rep('''    // Pro Shop
    { id: "umbrella"''', '''    // Pro Shop
    // Jack-o'-lantern candy pail: hangs from the hand, or held up overhead
    { id: "candypail", name: "Candy pail", rarity: "birdie", draw: (p, h) => p.up
        ? [R(h.x, h.y - 1, 3, 1, "k"), R(h.x - 1, h.y - 2, 1, 1, "k"), R(h.x + 3, h.y - 2, 1, 1, "k"), R(h.x - 1, h.y - 6, 5, 4, PUMPKIN),
           ...DOTS([[h.x, h.y - 5], [h.x + 2, h.y - 5]], "k"), R(h.x, h.y - 3, 3, 1, "k"), ...DOTS([[h.x, h.y - 7], [h.x + 2, h.y - 7]], "#FF5CA8"), R(h.x + 1, h.y - 7, 1, 1, "#3CCB6A")]
        : [R(h.x + 1, h.y, 3, 1, "k"), R(h.x, h.y + 1, 1, 1, "k"), R(h.x + 4, h.y + 1, 1, 1, "k"), R(h.x, h.y + 2, 5, 4, PUMPKIN),
           ...DOTS([[h.x + 1, h.y + 3], [h.x + 3, h.y + 3]], "k"), R(h.x + 1, h.y + 4, 3, 1, "k"), ...DOTS([[h.x + 1, h.y + 1], [h.x + 3, h.y + 1]], "#FF5CA8"), R(h.x + 2, h.y + 1, 1, 1, "#3CCB6A")] },
    { id: "umbrella"''')

open(f, "w").write(s); print("Updated", f)

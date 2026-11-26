"""Correções pós-geração em src/data/elements.json (executado após build-elements.py).

1. Pontos de fusão/ebulição ausentes no mendeleev para alótropos de referência
   (CRC Handbook of Chemistry and Physics, 95. ed., "Melting, Boiling... of the Elements"):
   P (branco) fus. 44,15 °C, eb. 280,5 °C; S (rômbico) fus. 115,21 °C;
   Se (cinza) fus. 221 °C; Sn (branco) fus. 231,93 °C.
2. Fase a 25 °C/1 atm recalculada; He (sem fusão a 1 atm) = gasoso; C (sublima) = sólido.
3. Elementos Z >= 100: densidade e ponto de fusão são previsões teóricas, não medidas
   -> marcados em "predicted".
4. densityNote: para gases a densidade do mendeleev/CRC é a 25 °C e 1 atm (g/L = g/cm³ × 1000).
"""
import json, pathlib
P = pathlib.Path(__file__).resolve().parent.parent / "src/data/elements.json"
d = json.loads(P.read_text())
C = lambda c: round(c + 273.15, 2)
FIX_MP = {"P": C(44.15), "S": C(115.21), "Se": C(221), "Sn": C(231.93)}
FIX_BP = {"P": C(280.5)}
for e in d:
    s = e["symbol"]
    if e["meltingK"] is None and s in FIX_MP: e["meltingK"] = FIX_MP[s]
    if e["boilingK"] is None and s in FIX_BP: e["boilingK"] = FIX_BP[s]
    mp, bp = e["meltingK"], e["boilingK"]
    if s == "He": e["phase"] = "gasoso"
    elif s == "C": e["phase"] = "sólido"
    elif mp is not None:
        e["phase"] = "sólido" if mp > 298.15 else ("gasoso" if bp is not None and bp < 298.15 else "líquido")
    e["predicted"] = ["densityGcm3", "meltingK"] if e["z"] >= 100 else []
P.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")))
print("ok", sum(1 for e in d if e["predicted"]), "elementos com valores previstos")

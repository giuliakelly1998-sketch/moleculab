"""
Gera src/data/elements.json a partir de duas bases abertas e citáveis:

  * mendeleev (L. M. Mentel, https://github.com/lmmentel/mendeleev, MIT):
    massas atômicas (IUPAC), raios, densidade, PF/PE, calores, eletronegatividade,
    afinidade eletrônica, estrutura cristalina, abundância, descoberta, isótopos.
    Cada propriedade tem a referência primária registrada nos metadados do pacote
    (ex.: CRC Handbook 95ª ed.; Slater 1964; Pyykkö 2009).
  * pymatgen periodic_table.json (Ong et al., Comput. Mater. Sci. 68, 314, 2013; MIT),
    dados compilados principalmente do WebElements: dureza, módulos elásticos,
    resistividade, expansão térmica, velocidade do som, índice de refração etc.

Uso:
    pip install mendeleev
    curl -o /tmp/pmg_periodic_table.json \
      https://raw.githubusercontent.com/materialsproject/pymatgen/v2024.8.9/src/pymatgen/core/periodic_table.json
    python scripts/build-elements.py /tmp/pmg_periodic_table.json

Nenhum valor é estimado aqui: campos sem dado nas fontes ficam null.
"""
import json
import math
import re
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
from mendeleev import element  # noqa: E402

PMG_PATH = sys.argv[1] if len(sys.argv) > 1 else "/tmp/pmg_periodic_table.json"
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "elements.json"
pmg = json.load(open(PMG_PATH))

HALF_LIFE_S = {
    "ysec": 1e-24, "zsec": 1e-21, "asec": 1e-18, "fsec": 1e-15, "psec": 1e-12, "nsec": 1e-9,
    "usec": 1e-6, "msec": 1e-3, "sec": 1, "minute": 60, "hour": 3600, "day": 86400,
    "year": 3.15576e7, "kyear": 3.15576e10, "Myear": 3.15576e13, "Gyear": 3.15576e16,
    "Tyear": 3.15576e19, "Pyear": 3.15576e22, "Eyear": 3.15576e25, "Zyear": 3.15576e28, "Yyear": 3.15576e31,
}


def num(v):
    """Extrai o número inicial de strings do pymatgen ('245 MN m<sup>-2</sup>' → 245)."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return None if (isinstance(v, float) and math.isnan(v)) else v
    s = str(v).strip()
    if not s or s.startswith("no data") or s.startswith("(no data"):
        return None
    m = re.match(r"^[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", s)
    if not m:
        return None
    x = float(m.group(0))
    # Formato "2.7 10<sup>-8</sup> &Omega; m" ou "23.1 x10<sup>-6</sup>K<sup>-1</sup>"
    exp = re.search(r"10<sup>([-+]?\d+)</sup>", s)
    if exp:
        x *= 10 ** int(exp.group(1))
    return x


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    return v


def shells(el):
    try:
        conf = el.ec.conf
    except Exception:
        return None
    out = {}
    for (n, _l), c in conf.items():
        out[n] = out.get(n, 0) + c
    return [out.get(n, 0) for n in range(1, max(out) + 1)] if out else None


def isotopes(el):
    natural, most_stable = [], None
    for iso in el.isotopes:
        if iso.abundance:
            natural.append({"A": iso.mass_number, "abundance": round(iso.abundance, 6)})
        if iso.half_life and iso.half_life_unit in HALF_LIFE_S:
            secs = iso.half_life * HALF_LIFE_S[iso.half_life_unit]
            if most_stable is None or secs > most_stable["seconds"]:
                most_stable = {"A": iso.mass_number, "halfLife": iso.half_life, "unit": iso.half_life_unit, "seconds": secs}
    natural.sort(key=lambda x: -x["abundance"])
    return natural, most_stable


def phase_at_stp(mp, bp):
    if mp is None:
        return None
    if mp > 298.15:
        return "sólido"
    if bp is not None and bp < 298.15:
        return "gasoso"
    return "líquido"


rows = []
for z in range(1, 119):
    el = element(z)
    p = pmg.get(el.symbol, {})
    natural, stable = isotopes(el)
    mp = clean(el.melting_point)
    bp = clean(el.boiling_point)
    ie = p.get("Ionization energies") or []
    rows.append({
        "z": z,
        "symbol": el.symbol,
        "nameEn": el.name,
        "nameOrigin": clean(el.name_origin),
        "period": el.period,
        "group": el.group_id,
        "groupCas": el.group.symbol if el.group else None,
        "block": el.block,
        "series": clean(el.series),
        "atomicWeight": clean(el.atomic_weight),
        "atomicWeightUnc": clean(el.atomic_weight_uncertainty),
        "massNumber": clean(el.mass_number),
        "neutrons": clean(el.neutrons),
        "econf": el.econf,
        "econfFull": str(el.ec.conf and " ".join(f"{n}{l}{c}" for (n, l), c in el.ec.conf.items())),
        "shells": shells(el),
        "oxidationStates": p.get("Oxidation states") or [],
        "commonOxidationStates": p.get("Common oxidation states") or [],
        "enPauling": clean(el.en_pauling),
        "enAllen": clean(el.en_allen),
        "electronAffinityEv": clean(el.electron_affinity),
        "ionizationEv": [round(x, 6) for x in ie if x is not None][:30],
        "radiusEmpiricalPm": clean(el.atomic_radius),
        "radiusCalculatedPm": round(num(p.get("Atomic radius calculated")) * 100) if num(p.get("Atomic radius calculated")) else None,
        "radiusCovalentPm": clean(el.covalent_radius_pyykko),
        "radiusVdwPm": clean(el.vdw_radius),
        "radiusMetallicPm": round(num(p.get("Metallic radius")) * 100) if num(p.get("Metallic radius")) else None,
        "densityGcm3": clean(el.density),
        "meltingK": mp,
        "boilingK": bp,
        "phase": phase_at_stp(mp, bp),
        "fusionHeatKJmol": clean(el.fusion_heat),
        "evaporationHeatKJmol": clean(el.evaporation_heat),
        "specificHeatJgK": clean(el.specific_heat_capacity),
        "molarHeatCapacityJmolK": clean(el.molar_heat_capacity),
        "thermalConductivityWmK": clean(el.thermal_conductivity),
        "thermalExpansionPerK": num(p.get("Coefficient of linear thermal expansion")),
        "resistivityOhmM": num(p.get("Electrical resistivity")),
        "superconductionK": num(p.get("Superconduction temperature")),
        "brinellMPa": num(p.get("Brinell hardness")),
        "vickersMPa": num(p.get("Vickers hardness")),
        "mohs": num(p.get("Mineral hardness")),
        "bulkModulusGPa": num(p.get("Bulk modulus")),
        "youngModulusGPa": num(p.get("Youngs modulus")),
        "shearModulusGPa": num(p.get("Rigidity modulus")),
        "poisson": num(p.get("Poissons ratio")),
        "soundSpeedMs": num(p.get("Velocity of sound")),
        "molarVolumeCm3": num(p.get("Molar volume")),
        "refractiveIndex": num(p.get("Refractive index")),
        "reflectivityPct": num(p.get("Reflectivity")),
        "latticeStructure": clean(el.lattice_structure),
        "latticeConstantA": clean(el.lattice_constant),
        "abundanceCrustMgKg": clean(el.abundance_crust),
        "abundanceSeaMgL": clean(el.abundance_sea),
        "discoveryYear": clean(el.discovery_year),
        "discoverers": clean(el.discoverers),
        "discoveryLocation": clean(el.discovery_location),
        "cas": clean(el.cas),
        "radioactive": bool(el.is_radioactive),
        "naturalIsotopes": natural,
        "mostStableIsotope": {k: v for k, v in stable.items() if k != "seconds"} if (stable and el.is_radioactive) else None,
        "cpkColor": clean(el.jmol_color) or clean(el.cpk_color),
    })

def tidy(v):
    """Remove ruído de ponto flutuante (2.7000000000000004e-08 → 2.7e-08)."""
    if isinstance(v, float):
        return float(f"{v:.8g}")
    if isinstance(v, list):
        return [tidy(x) for x in v]
    if isinstance(v, dict):
        return {k: tidy(x) for k, x in v.items()}
    return v


rows = [tidy(r) for r in rows]
OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
import subprocess; from pathlib import Path as _P; subprocess.run([sys.executable, str(_P(__file__).with_name("fix-elements.py"))], check=True)
print(f"{len(rows)} elementos → {OUT} ({OUT.stat().st_size // 1024} KB)")

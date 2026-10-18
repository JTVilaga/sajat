# KIADOK – az S_KIADOK.xlsm webes, telepíthető változata

Office nélkül működik Windowson és Androidon (Chrome / Edge). Telepíthető alkalmazás (PWA), internet nélkül is fut.

## Mi hova került az Excelből

| Excel                                        | Webes app                                                      |
|----------------------------------------------|----------------------------------------------------------------|
| Auto_Open → naptár                           | **Naptár** – induláskor ez nyílik meg                          |
| FrmNaptar (sárga / narancs / piros napok)    | Naptár: ugyanazok a színek és a szabály                        |
| Kattintás egy napra → H_napló sora           | Kattintás → a nap tartalma a jobb oldali panelen               |
| Jobb klikk → frmEvent (tól–ig)               | Jobb klikk / dupla klikk / hosszú nyomás → Új esemény          |
| s_kiadok lap                                 | **Kiadások** (szűrés, keresés, rendezés, összesítés)           |
| I_VILL, I_GÁZ, … Anna gombok (Module1)       | Sablongombok – az összegük az Adatok oldalon szerkeszthető     |
| Dupla klikk a „fizetve” oszlopon = ma        | „Fizetve ma” gomb                                              |
| H_napló + HNaplo_Feltoltes                   | **Napló** – magától frissül                                    |
| H_napló D oszlop (kézi megjegyzés)           | „+ Megjegyzés” egy naphoz                                      |
| HNaplo_ExportICS + LinkMegnyitasa            | Adatok → ICS export (ugyanazok az UID-k!) + Google link        |
| Gáz, Vill lapok                              | **Mérőórák** (fogyasztás, havi átlag automatikusan)            |
| ASX lap                                      | **Autó**                                                       |
| Restancia                                    | **Restancia** (kipipálható lista)                              |
| HF lap                                       | **Széf** – rejtett, opcionálisan jelszóval titkosítva          |
| HELP lap                                     | **Súgó**                                                       |
| Feltoltes_PS_Inline (rclone → Drive)         | Adatok → automatikus mentés fájlba / mentés megosztással       |

## Fájlok

```
index.html            az oldal váza (fejléc, menü, felugró ablak)
manifest.json         a telepítéshez (név, ikonok, szín)
sw.js                 service worker – offline működés (verziót emelni módosításkor!)
css/app.css           minden stílus (világos + sötét mód)
js/util.js            dátum, formázás, felugró ablak, űrlap, toast
js/store.js           adattárolás (IndexedDB), mentés fájlba, széf titkosítás
js/naplo-adat.js      a H_napló logikája + új esemény / esemény szerkesztés
js/nezet-naptar.js    Naptár nézet
js/nezet-kiadasok.js  Kiadások nézet, sablonok, összesítés
js/nezet-naplo.js     Napló nézet
js/nezet-egyeb.js     Mérőórák, Autó, Restancia, Súgó, „Több” menü
js/nezet-szef.js      Széf
js/nezet-adatok.js    Mentés, betöltés, Excel, ICS, sablonok, telepítés, üdvözlő képernyő
js/ics.js             ICS (Google Naptár) export
js/xlsx-io.js         Excel beolvasás (.xlsm) és export (.xlsx)
js/app.js             indítás, menü/nézetváltás, telepítés gomb
vendor/xlsx.full.min.js  SheetJS 0.18.5 (Excel-kezelő könyvtár)
ikon/                 alkalmazás ikonok
```

## Közzététel (egyszer kell)

A telepítéshez HTTPS-es címen kell lennie, ugyanúgy, mint a JTKviz-nek (pl. GitHub Pages).
Ebből a mappából **csak a program kerül fel, adat nem**. A `kiadok-adatok.json` fájlt
SOHA ne töltsd fel a webre, mert jelszavak is vannak benne.

Helyi kipróbáláshoz (Pythonnal): ebben a mappában `python -m http.server 8000`,
majd a böngészőben: http://localhost:8000

## Első indítás

1. Nyisd meg az oldalt → „Mentési fájl (kiadok-adatok.json)” → válaszd a KIADOK mappában lévő
   `kiadok-adatok.json`-t (ez az S_KIADOK.xlsm 2026.10.18-i állapota). Az „Excel: S_KIADOK.xlsm”
   gombbal közvetlenül az xlsm is beolvasható.
2. Telepítés: Windowson a címsor telepítés ikonja, Androidon ⋮ → „Alkalmazás telepítése”.
3. Széf → „Jelszavas védelem” – javasolt bekapcsolni.

## Szinkron Windows ↔ Android

Az adatok mindegyik eszközön helyben vannak. A közös pont egy Google Drive mappa (pl. `KIADOK`).

- **Windows (Chrome/Edge):** telepítsd a *Google Drive for desktop* programot (így lesz `G:\Saját meghajtó`).
  Adatok → „Mentési mappa kiválasztása…” → `G:\Saját meghajtó\KIADOK`. Ezután az app minden módosítás után
  ide írja a `kiadok-adatok.json` fájlt, és induláskor (meg amikor visszatérsz az ablakba) megnézi, van-e a
  mappában újabb mentés – pl. a telefonról érkezett `kiadok-adatok_ÉÉÉÉ-HH-NN.txt` –, és felajánlja a betöltését.
- **Android:** Adatok → „Mentés megosztással” → Drive → a `KIADOK` mappa (`.txt` néven, mert az Android .json-t
  nem enged megosztani – a tartalom ugyanaz). A másik irány: „Betöltés fájlból…” → Drive → `KIADOK` → `kiadok-adatok.json`.

A betöltés mindig megmutatja, melyik adat az újabb, és szól, ha régebbit töltenél be.

## Módosításkor

Ha bármelyik fájlt módosítod, az `sw.js`-ben emeld a `CACHE_NAME` verzióját
(pl. `kiadok-cache-v2` → `v3`), különben a telepített app a régi fájlokat használja.

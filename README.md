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

## Szinkron Windows ↔ Android – Quick Share (ajánlott)

Szerver és felhő nélkül (`js/kuldes.js`). A fejléc **⇄ Szinkron** gombja:

- **Küldés** – azon az eszközön, ahol utoljára szerkesztettél.
  - Telefon: megosztás menü → Quick Share → a laptop.
  - Windows: a fájl a Letöltésekbe kerül (`KIADOK_PC_ÉÉÉÉ-HH-NN_ÓÓPP.json`) → húzd rá a megnyitott Quick Share ablakára → a telefon.
    (A jobb klikk menü „Küldés Quick Share-rel” pontja Windows 11-en gyakran csak a „További lehetőségek megjelenítése” alatt van, vagy hiányzik.)
- **Fogadás** – a másikon: kiválasztod a kapott fájlt; az app megmutatja, melyik adat az újabb, és szól, ha régebbit töltenél be.
- A narancs pötty a ⇄ gombon: ezen az eszközön van el nem küldött módosítás. Ha a Google Drive szinkron is be van
  kapcsolva, és a módosítás már felkerült a felhőbe, nincs pötty (a másik eszköz onnan letölti).

Windowsra a Google ingyenes **Quick Share** programja kell (Bluetooth + WiFi), Androidon beépített.

## Tartalék: Google Drive szinkron (nem kötelező)

Az app közvetlenül a Google Drive API-val szinkronizál (`js/drive-sync.js`), fájlkezelő és
Google Drive for desktop nélkül. Egyetlen fájl van: `kiadok-adatok.json` a Drive rejtett
**appDataFolder** helyén – csak ez az app látja, a Drive felületén nem jelenik meg.

- Bekapcsolás: Adatok → „Bejelentkezés Google-lel és szinkron bekapcsolása” (mindkét eszközön).
  Új, üres eszközön az üdvözlő képernyőn: „☁ Google Drive-ról (szinkron)”.
- Módosítás után ~2,5 mp-cel feltölt; indításkor és amikor visszatérsz az apphoz, letölti az újabbat.
- Ha mindkét eszközön változott valami szinkron előtt, megkérdezi, melyik maradjon.
- A fejléc ☁ gombja: zöld = szinkronban (utolsó idő), narancs = bejelentkezés kell
  (a Google hozzáférés kb. 1 óráig érvényes), piros = hiba.
- Google Cloud projekt: KIADOK, OAuth Web client, engedélyezett origin: `https://jtvilaga.github.io`,
  jogosultság: `drive.appdata`. A Client ID a `js/drive-sync.js` elején van (nem titkos).

A kézi mentés (.json letöltés / megosztás / betöltés) biztonsági pillanatképnek megmaradt.

## Módosításkor

Ha bármelyik fájlt módosítod, az `sw.js`-ben emeld a `CACHE_NAME` verzióját
(pl. `kiadok-cache-v8` → `v9`), különben a telepített app a régi fájlokat használja.

# ARCHITECTURE.md — SkipFlow

Beschrijvend overzicht van de applicatie-architectuur. Dit bestand documenteert
hoe de app gebouwd is en waarom bepaalde keuzes gemaakt zijn.
Zie CLAUDE.md voor de imperatieve regels die altijd gevolgd moeten worden.

---

## Wat is SkipFlow?

SkipFlow is een wedstrijdbeheersysteem voor competitief touwspringen.
Het beheert wedstrijden, deelnemers, clubs en onderdelen. Na het inloggen komt
elke gebruiker op de landingspagina (`/`, `HubView`) terecht — een tegeloverzicht
dat enkel de schermen toont waar het account recht op heeft. Elk scherm heeft
daarna zijn eigen route en een eigen recht (zie "Authenticatie & rechten"):

| Scherm       | Route            | Recht          | Doel |
|--------------|-------------------|----------------|------|
| *(landingspagina)* | `/`         | ingelogd       | tegeloverzicht — enige plek waarvandaan tussen schermen genavigeerd wordt |
| Beheer       | `/beheer`         | beheerder-only | wedstrijden en deelnemers aanmaken, CSV-import, clubs, blokken, gebruikers |
| Aanwezigheid | `/aanwezigheid`   | `aanwezigheid` | aanwezigheidsregistratie aan de inkomtafel — wedstrijdkeuze, zoeken, clubfilter, aanmelden/afwezig melden |
| Speaker      | `/speaker`        | `speaker`      | operatorscherm tijdens een actieve wedstrijd (tabs: Reeksen, Podium, Boodschap) |
| Display      | `/scherm`         | `backstage`    | groot scherm voor in de opwarmruimte (huidige/volgende reeks + boodschap-vak) |
| Podium       | `/scherm/podium`  | `podium`       | groot scherm — podium-onthulling voor de prijsuitreiking (zie "Podium & prijsuitreiking") |

De Speaker- en Display-tegels op de landingspagina tonen altijd of, en welke,
wedstrijd er live staat (`activeCompetition` uit `AppContext`) — zo is meteen
duidelijk vanaf elk toestel of er iets bezig is, zonder het scherm te openen.

Primaire gebruiker: Antwerp Ropes. De app is gebouwd voor gebruik op meerdere
toestellen tegelijk (inkomtafel, speakertafel, groot scherm), elk met een eigen
login en enkel toegang tot de schermen waar dat account recht op heeft.

---

## Stack

| Laag        | Technologie                          |
|-------------|--------------------------------------|
| Frontend    | React 18, Vite, `react-router-dom` (hash-routing — geen server-rewrites nodig op Vercel) |
| PDF-import  | `pdfjs-dist`, client-side (zie "PDF-import" hieronder) — geen backend nodig |
| Styling     | Inline CSS via stijlobjecten, opgebouwd uit `theme.js`-tokens — geen Tailwind, geen CSS modules |
| Database    | Firebase Firestore (NoSQL, realtime) |
| Auth        | Firebase Auth, e-mail/wachtwoord — rollen + rechten in `users/{uid}` |
| Storage     | Firebase Storage — clublogo's (`clubs/{clubId}/logo.*`) via `clubFactory.uploadLogo()` |
| Hosting     | Vercel                               |
| Taal        | Nederlands (alle UI-strings)         |

---

## Mappenstructuur

```
src/
  App.jsx                          # Router-shell: auth-gate, routes + permissie-guards, klok, home-link
  AppContext.jsx                   # Centrale React context: data + actions
  dbSchema.js                      # ENIGE toegangspunt voor Firestore
  constants.js                     # APP_ID, getFirebaseConfig, emailForUsername
  seedData.js                      # Éénmalige seed voor events + competitionTypes
  theme.js                         # Design tokens: color, radius, shadow, font, space, statusColor
  timeUtils.js                     # timeToMinutes("HH:MM") — gedeeld door pdfSchedule.js en LiveView.jsx
  pdfSchedule.js                   # Pure grammatica-parser voor een PDF-wedstrijdschema
  pdfExtract.js                    # pdfjs-dist-laag: tekst + doorstreping uit een PDF trekken
  pdfImport.js                     # Browserlaag (pdfjs-worker) — enige toegangspunt voor componenten
  eventSlots.js                    # Slot-picker-logica: leeg veld / nieuwe reeks berekenen (reskip, onderdeel toevoegen)
  index.css                        # Fontinstelling + minimale resets (geen Tailwind)
  main.jsx                         # React entry point

  components/
    LoginView.jsx                  # Inlogscherm — vóór elk ander scherm
    HubView.jsx                    # Landingspagina ("/") — tegels naar elk scherm met toegang
    ManagementView.jsx              # Beheerscherm orchestrator (wedstrijden + clubs + gebruikers)
    LiveView.jsx                    # Speaker — operatorscherm live wedstrijd (tabs: Reeksen / Podium / Boodschap)
    DisplayView.jsx                 # Groot scherm (backstage) live wedstrijd
    AttendanceView.jsx              # Aanwezigheidsregistratie — kiosk voor de inkomtafel
    PodiumView.jsx                  # Groot scherm — podium-onthulling (zie "Podium & prijsuitreiking")
    PodiumStage.jsx                 # Gedeelde podium-visual (full/mini) — puur presentationeel
    PodiumManager.jsx               # Gedeeld podiumbeheer (CompetitionDetail + LiveView)
    PodiumCeremonyPanel.jsx         # Speaker-onthullingsbediening (enkel LiveView)
    MessageManager.jsx              # Gedeeld boodschapbeheer (CompetitionDetail + LiveView)

    ui/
      Button.jsx                   # Gedeelde knop (variant/size/icon), gebouwd uit theme.js
      Card.jsx                     # Gedeelde kaartcontainer
      Badge.jsx                    # Statuslabel/pill (tone + optioneel icoon)

    management/
      CompetitionsOverview.jsx      # Startpagina van Beheer — lijst van alle wedstrijden
      CompetitionDetail.jsx         # Twee interne tabs: Wedstrijd (onderdelen+programma) en Deelnemers (volle hoogte)
      ClubManagement.jsx            # Clubbeheer — stamdata + logo-upload (Storage)
      UserManagement.jsx            # Gebruikersbeheer — rollen + rechten toekennen

      modals/
        modalStyles.js              # Gedeelde stijlen voor alle modals, gebouwd uit theme.js
        AddCompetitionModal.jsx
        EditCompetitionModal.jsx
        EditParticipantModal.jsx    # Ook: onderdeel toevoegen + reskip (zie "Deelnemersbeheer")
        AddParticipantModal.jsx     # Handmatig een deelnemer aanmaken
        ImportModal.jsx             # CSV-import met club-matching flow (per onderdeel)
        PdfImportModal.jsx          # Volledig wedstrijdschema (PDF) importeren, zie "PDF-import" hieronder

  admin/
    seed-main.jsx                   # Standalone Firebase init voor seed-pagina
    SeedPage.jsx                    # Seed van events/competitionTypes + bootstrap eerste beheerder

seed.html                          # Standalone HTML entry point voor seed-pagina
firestore.rules                    # Referentie-security-rules — niet auto-gedeployed (zie bestand)
```

---

## Datamodel (Firestore)

Alle collecties leven onder `artifacts/{appId}/public/data/`.

### Collecties

```
settings/competition          singleton — activeCompetitionId
users/{uid}                   gebruikers + rechten (doc-id = Firebase Auth uid)
competitionTypes/{id}         wedstrijdtypes met standaard event-volgorde
events/{id}                   globale lijst van beschikbare onderdelen
clubs/{id}                    clubs met logo-referentie
competitions/{id}             wedstrijden — incl. finishedEvents/finishedSeries/podiumState/activeMessageId
competitions/{id}/
  participants/{id}           deelnemers per wedstrijd (subcollectie)
  blocks/{id}                 dagtijdlijn: blok → onderdeel (optioneel) → reeks (subcollectie)
  podiums/{id}                podia per onderdeel + laureaten (subcollectie, Fase 3)
  messages/{id}                voorbereide boodschap(pen) voor het grote scherm (subcollectie)
```

### Sleuteldocumenten

**`competition/{id}`**
```
name, date, location, typeId → competitionTypes, status, eventOrder{},
finishedEvents[], finishedSeries{}, podiumState{activePodiumId, revealStage},
activeMessageId, createdAt
```
`finishedEvents`/`finishedSeries` leven bewust hier en niet in een los
singleton — zie "Live voortgang" hieronder. `podiumState` volgt hetzelfde
patroon voor de podiumceremonie — zie "Podium & prijsuitreiking" onderaan.
`activeMessageId` (string of null) volgt datzelfde patroon voor de
boodschap op het grote scherm — zie "Boodschap groot scherm" onderaan.

**`participant/{id}`**
```
name, clubId → clubs, externalId ("{name}_{clubId}"), isPresent, entries[], createdAt
```

**`entry` (embedded object in participant.entries[])**
```
eventId → events, seriesNr, fieldNr, scheduledTime "HH:MM", isScratched,
categoryLabel ("13-15j M (ANT)", enkel bij freestyle — podium-groepering,
Fase 3; leeg bij CSV-import, gevuld door PDF-import)
```

**`block/{id}`** (subcollectie van competition — zie "Dagtijdlijn (blocks)")
```
type ("heats" | "pauze" | "lunchpauze" | "deuren" | "briefing" | "proefjury" | "prijsuitreiking"),
eventId → events (enkel bij type "heats"), label (bij niet-heats types),
scheduledTime "HH:MM", order, status ("gepland" | "actief" | "afgewerkt")
```

**`user/{uid}`**
```
username, role ("beheerder" | "medewerker"),
permissions { speaker, backstage, podium, aanwezigheid } (enkel relevant voor medewerker),
createdAt
```

**`podium/{id}`** (subcollectie van competition — zie "Podium & prijsuitreiking")
```
eventId → events, name (vrije tekst, door de gebruiker bepaald), order (globaal,
niet per onderdeel), places[3] ({place: 1|2|3, participantIds[]}),
isBelgianChampionship (boolean), createdAt
```

**`message/{id}`** (subcollectie van competition — zie "Boodschap groot scherm")
```
text, icon ('' | 'megaphone' | 'alert' | 'question' | 'thumbsup'), createdAt
```
Geen `isActive`-veld op het document zelf — welke boodschap actief is, staat
apart op `competition.activeMessageId` (één bron van waarheid).

### Afgeleide properties (nooit opgeslagen)

```js
isScratchedFromEvent(participant, eventId) → boolean
isFullyScratched(participant)              → boolean  // alle entries isScratched
sortedEntries(participant)                 → Entry[]
hasPermission(user, key)                   → boolean  // beheerder = altijd true
```

---

## Datalaag

De datalaag bestaat uit drie lagen in `dbSchema.js`:

```
Path helpers   → Firestore-paden als functies (intern)
Converters     → fromFirestore() en toFirestore() per entiteit
Factories      → benoemde lees/schrijf-operaties (geëxporteerd)
```

Geëxporteerde factories:
- `settingsFactory` — activeCompetitionId
- `userFactory` — CRUD + subscribe (lijst) + subscribeOne (eigen profiel) + getAll
- `competitionTypeFactory` — CRUD + subscribe
- `eventFactory` — CRUD + subscribe
- `clubFactory` — CRUD + subscribe + findByName (fuzzy matching) + uploadLogo (Storage)
- `competitionFactory` — CRUD + setStatus + saveEventOrder + saveProgress
- `participantFactory` — subscribe + setPresence + setScratchedForEvent/All +
  create (handmatig) + importBatch (1 event) + importMultiEventBatch (PDF, meerdere events atomair)
- `blockFactory` — CRUD + subscribe + setStatus + importBatch (PDF-import)

`dbSchema.js` raakt Firestore én Firebase Storage aan (`clubFactory.uploadLogo`)
maar nooit Firebase Auth — het aanmaken en inloggen van gebruikers gebeurt in
`AppContext.jsx` (zie hieronder), want dat vereist Auth-SDK-calls
(`signInWithEmailAndPassword`, een tijdelijke secundaire app-instantie om
nieuwe accounts aan te maken) die niets met Firestore/Storage te maken hebben.
`initDb(db, appId, storage)` krijgt de Storage-instantie mee vanuit
`AppContext.jsx`, dezelfde plek waar ook Firestore en Auth geïnitialiseerd
worden — één Firebase-app-instantie voor alles.

---

## Authenticatie & rechten

Firebase Auth met e-mail/wachtwoord (geen anonieme auth meer in de hoofd-app —
`/seed.html` blijft wel anoniem inloggen voor zijn eigen, losstaande seed-taak).
Een `username` wordt intern vertaald naar een synthetisch e-mailadres
(`{username}@ropescore.pro.local`), zodat het inlogscherm gewoon een
gebruikersnaam + wachtwoord toont.

- **`beheerder`** — heeft altijd overal recht op, kan gebruikers aanmaken en
  rechten toekennen (via Gebruikersbeheer in Beheer), en is de enige rol die
  `/beheer` mag openen.
- **`medewerker`** — heeft enkel recht op de schermen die expliciet aangevinkt
  staan in `permissions` (`speaker`, `backstage`, `podium`, `aanwezigheid`).

Een nieuwe gebruiker aanmaken gebeurt via een **tijdelijke, secundaire
Firebase-app-instantie** in de browser (`AppContext.createUser`):
`createUserWithEmailAndPassword` logt anders automatisch in als het nieuwe
account, wat de sessie van de beheerder die de aanmaak doet zou verstoren.
Geen Cloud Function nodig — blijft dus binnen de "geen backend"-architectuur.

**Bootstrap van de allereerste beheerder**: er is bewust géén uitzondering in
de security rules die een gloednieuw account zichzelf beheerder laat maken
(dat zou elk Firebase Auth-account, ook eentje buiten de app aangemaakt, een
achterpoortje geven). De eerste beheerder wordt daarom éénmalig aangemaakt via
`/seed.html`, en het bijhorende Firestore-profiel wordt — als de security
rules al strikt staan — handmatig toegevoegd via de Firebase Console (de
seed-pagina toont de juiste uid en velden). Zie `firestore.rules` voor de
volledige uitleg en de eigenlijke rules (niet automatisch gedeployed door dit
repo — er is geen `firebase.json`/`.firebaserc`).

Routing (`App.jsx`) hangt elke route achter een guard:
- `/beheer` → `RequireAdmin` (enkel `role === 'beheerder'`)
- `/aanwezigheid`, `/speaker`, `/scherm`, `/scherm/podium` → `RequirePermission`
  op de bijhorende key uit de tabel bovenaan dit document

Zonder het recht toont de route een "Geen toegang"-scherm i.p.v. de inhoud.
De landingspagina (`HubView`) toont enkel tegels voor de schermen waar de
ingelogde gebruiker effectief recht op heeft — de guards in `App.jsx` blijven
de eigenlijke bewaking (rechtstreeks naar een URL navigeren zonder recht
toont alsnog "Geen toegang").

---

## State management

`AppContext.jsx` is de enige bron van waarheid voor app-state.

```
authReady                       Firebase geïnitialiseerd + auth-status gecontroleerd
authError                       Firebase-initialisatiefout
currentUser                     Firebase Auth user object, of null
userProfile                     users/{uid}-document van de ingelogde gebruiker
users                           Volledige gebruikerslijst — enkel geladen door
                                 het gebruikersbeheer-scherm via loadUsers()

competitions, events,           Realtime Firestore listeners
clubs, competitionTypes         (starten zodra currentUser bekend is)
participants                    Per wedstrijd geladen via loadParticipants()
blocks                          Per wedstrijd geladen via loadBlocks()
activeCompetitionId             Uit settings/competition
finishedEvents, finishedSeries  Afgeleid van activeCompetition (zie "Live voortgang")
```

Afgeleide waarden worden berekend in de context via `useMemo` en `useCallback`:
- `getSortedEvents(competition)` — events gesorteerd op eventOrder
- `getClub(clubId)` — club opzoeken op id
- `getEvent(eventId)` — event opzoeken op id
- `activeCompetition` — afgeleid van competitions + activeCompetitionId
- `hasPermission(key)` — afgeleid van userProfile

Actions (schrijfoperaties) worden als functies uit de context geëxporteerd.
Componenten roepen nooit rechtstreeks factories, Firestore of Firebase Auth aan.

**Belangrijk voor nieuwe schermen**: `LiveView` en `DisplayView` roepen zelf
`loadParticipants(activeCompetition?.id)` en `loadBlocks(activeCompetition?.id)`
aan zodra ze mounten — ze vertrouwen daarvoor niet op `CompetitionDetail` in
Beheer. Elk scherm heeft nu immers zijn eigen route en kan rechtstreeks
geopend worden zonder eerst via Beheer te zijn gepasseerd; zonder deze eigen
listener zou zo'n scherm leeg blijven.

---

## Routing

`react-router-dom` met `HashRouter` (geen server-side rewrites nodig op
Vercel). `/`, `/beheer`, `/aanwezigheid` en `/speaker` delen een `ShellLayout`
(header met logo/home-link + klok + gebruiker/logout, `<Outlet/>` voor de
inhoud). De header bevat bewust géén kruis-scherm navigatieknoppen meer —
navigeren tussen schermen gebeurt uitsluitend via de tegels op de
landingspagina (`/`, `HubView`); de home-link in de header brengt je daar
altijd naar terug. `/scherm` en `/scherm/podium` zijn fullscreen, zonder
header, met een eigen "terug naar overzicht"-knop die naar `/` navigeert.
Een onbekend pad valt terug op `/`.

Binnen Beheer (`ManagementView`) geldt dezelfde regel: de knoppen om naar
Aanwezigheid, Speaker, Display of Podium te gaan staan daar niet — dat kan
vanaf de landingspagina. De sectie-tabs (Wedstrijden/Clubs/Gebruikers)
zijn geen "andere schermen" maar subsecties van Beheer zelf en blijven dus
gewoon zichtbaar.

---

## Design systeem (`theme.js` + UI-kit)

Alle styling blijft inline stijlobjecten per CLAUDE.md — geen Tailwind, geen
CSS modules — maar bouwt voortaan op gedeelde tokens in `theme.js` in plaats
van losse hexcodes te herhalen in elk bestand:

```
color        merkkleuren (primary/success/danger/warning/info) + neutralen
             (ink/body/muted/faint/border/surface/bg) + donkere "stage"-tokens
             voor Display/Podium/Login (stage/stageAlt/stageInk/stageMuted)
radius       sm/md/lg/xl/pill
shadow       sm/md/lg + focus(kleur) voor een gekleurde focus-ring
font         body (Inter) en mono (IBM Plex Mono) — daadwerkelijk geladen
             via Google Fonts in index.html
space        herbruikbare spacing-stappen
statusColor  kleur per wedstrijdstatus (open/bezig/beëindigd)
```

Drie gedeelde componenten in `components/ui/` bouwen op deze tokens:
`Button` (variant/size/icon), `Card` en `Badge` (tone + optioneel icoon).
Beheer-schermen en de landingspagina gebruiken deze consequent; Display/
Podium/Login gebruiken vooral de kleur- en fonttokens rechtstreeks (eigen,
donkere layout — geen kandidaat voor de lichte Button/Badge-stijl).

---

## CSV-import flow

De `ImportModal` doorloopt vier stappen:

1. **Paste** — gebruiker plakt CSV-tekst
2. **Review** — geparseerde rijen getoond, onbekende clubs gemarkeerd
3. **Resolve** — per onbekende club: koppel aan bestaande of maak nieuwe aan
   - Fuzzy matching (Levenshtein ≤ 2) suggereert mogelijke duplicaten
   - Nieuwe clubs worden aangemaakt vóór de batch-import
4. **Import** — `participantFactory.importBatch()` schrijft alle rijen in één batch

Matching van bestaande deelnemers verloopt via `externalId = "{name}_{clubId}"`
— exact dezelfde naam bij exact dezelfde club wordt dus altijd als **1**
deelnemer beschouwd, ook als die persoon aan meerdere onderdelen meedoet:
een tweede import voor een ander onderdeel voegt gewoon een extra entry toe
aan hetzelfde participant-document i.p.v. een dubbel aan te maken.

CSV-formaat speed:
```
reeks,uur,skipper_veld1,club_veld1,skipper_veld2,club_veld2,...
```

CSV-formaat freestyle:
```
reeks,uur,veld,skipper,club
```

---

## PDF-import (volledig wedstrijdschema)

Naast CSV per onderdeel kan binnen Beheer ook het volledige, door Gymfed
aangeleverde wedstrijdschema (PDF) in één keer geïmporteerd worden — inclusief
de dagtijdlijn (`blocks`: pauzes, briefing, proefjury, prijsuitreiking) en
alle reeksen/deelnemers per onderdeel. Knop: "Wedstrijdschema (PDF)" in de
header van `CompetitionDetail` (enkel zichtbaar zolang de wedstrijd nog niet
live of afgewerkt is) → opent `PdfImportModal.jsx`.

### Bestandenlaag

```
pdfSchedule.js   pure grammatica-parser — geen pdfjs-dist, werkt op gewone
                 rij/kolom-objecten, dus ook buiten de browser testbaar
pdfExtract.js    pdfjs-dist-laag: tekst + doorstreping uit een PDF trekken,
                 gegroepeerd in rijen/kolommen op (x, y)-positie
pdfImport.js     browserlaag: stelt de pdfjs-worker in (Vite `?url`-import)
                 en koppelt pdfExtract.js aan pdfSchedule.js — enige
                 toegangspunt dat een component mag gebruiken
```

Dezelfde scheiding als dbSchema.js/AppContext.jsx: componenten gebruiken enkel
`pdfImport.js`'s `parseCompetitionPdf(file, events)`, nooit pdfjs-dist
rechtstreeks.

### Grammatica

Elke pagina begint met "Individuele wedstrijd" gevolgd door een dagdeel-titel
(bv. "B-niveau 13-15 jaar (...)") — een wissel van die titel opent een nieuwe
**sectie**. Eén PDF kan dus meerdere dagdelen/wedstrijden bevatten;
`PdfImportModal` laat de gebruiker kiezen welke sectie bij de geopende
wedstrijd hoort zodra er meer dan één is.

Binnen een sectie:
- Een onderdeelnaam-regel (bv. "Speed Sprint (30 seconden)") opent een nieuw
  blok van type `"heats"` en zet het "huidige onderdeel" — matching tegen de
  `events`-collectie gebeurt via een tolerante bevat-check (niet exact: Gymfed
  gebruikt vaak een uitgebreidere naam dan wat in de app geregistreerd staat).
  Geen match → het blok komt in de nakijkstap met een lege "koppel aan"-keuze
  te staan, importeren is geblokkeerd tot dat opgelost is.
- Een `"Veld N"`-kopregel (speed, 5 kolommen per kopregel) of
  `"Veld A/B - categorie"`-kopregel (freestyle, 2 parallelle kolommen) opent
  een **kolomblok** — kan meermaals terugkeren onder hetzelfde onderdeel
  (bv. Veld 1-5 gevolgd door een aparte Veld 6-10-kopregel voor dezelfde
  reeksen, wanneer een reeks te veel velden heeft om naast elkaar op de
  pagina te passen). Zo'n herhaling opent bewust **geen** nieuw fysiek blok
  in de dagtijdlijn — enkel een onderdeelnaam-regel of een pauze/label-regel
  doet dat. Zonder die uitzondering zou eenzelfde heat (bv. 10 velden om
  8:45) als twee losse, overlappende dagtijdlijn-blokken eindigen i.p.v. één.
- Een losse `tijd + tekst`-regel zonder geldig kolomblok erna (geen volledig
  club+naam-paar) is een pauze/briefing/deuren/proefjury/prijsuitreiking-blok
  — het bloktype wordt gegokt op trefwoorden in het label, altijd corrigeerbaar
  in de nakijkstap.

Reeksen worden **nooit** per kolomblok genummerd:
- **Speed** — alle rijen van hetzelfde onderdeel (over meerdere kolomblokken
  én meerdere fysieke blokken heen, bv. onderbroken door een pauze) worden
  eerst verzameld en dan gegroepeerd op exact tijdstip; elke tijdgroep wordt
  chronologisch één `seriesNr`. Twee kolomblokken die hetzelfde beginuur delen
  (Veld 1-5 en Veld 6-10) vormen zo automatisch één reeks van 10 velden i.p.v.
  twee reeksen van 5.
- **Freestyle** — elke deelnemer is zijn eigen reeks (solo-optreden).
  `seriesNr` loopt globaal door over alle categorieën/kolommen (A/B) heen,
  chronologisch op tijdstip — nooit per categorie herstart, anders zouden twee
  gelijktijdig lopende categorieën dezelfde `seriesNr` delen en zou de
  reeks-afleiding (`eventId` + `seriesNr`) ze foutief samenvoegen tot één
  reeks. `categoryLabel` blijft wel per entry bewaard (zie `entries[]`
  hierboven) voor latere podium-groepering.

Voettekst (zaalnaam + adres, telkens onderaan elke pagina) wordt structureel
herkend: de adresregel bevat altijd een `dd/mm/jjjj`-datumstempel die verder
nergens in het schema voorkomt — die regel én de regel erboven (de zaalnaam)
worden genegeerd, ongeacht hun tekst.

### Doorstreping = al geschrapt

Sommige namen in het schema staan doorstreept (de organisatie kende de
afwezigheid al voor de wedstrijddag). Doorstreping wordt gedetecteerd via de
PDF-tekeninstructies zelf: een doorstreping is een losse horizontale lijn
(moveTo+lineTo, geen rechthoek) direct gevolgd door een stroke-instructie,
overlappend met de tekst-bounding-box. Betrouwbaar gebleken tegen een echt
Gymfed-schema, maar niet 100% gegarandeerd — daarom altijd zichtbaar en
aanpasbaar (checkbox per rij) in de nakijkstap, nooit stilzwijgend toegepast.

### PdfImportModal — stappen

Hergebruikt zoveel mogelijk van het bestaande CSV-stramien (`ImportModal`):

0. **Upload** — PDF kiezen, meteen client-side geparseerd (geen backend nodig)
1. **Dagdeel kiezen** — enkel getoond bij meerdere secties in de PDF
2. **Nakijken** — elk blok tonen in schema-volgorde; onderdeel-blokken koppelen
   aan een bestaand `events`-document (verplicht), bloktype van pauze/label-
   blokken corrigeren, geschrapt-checkbox per deelnemer bevestigen/aanpassen,
   een blok desnoods volledig uitsluiten van import
3. **Clubs koppelen** — exact dezelfde flow als CSV-import: fuzzy matching
   (`clubFactory.findByName`) + keuze bestaande club of nieuwe aanmaken
4. **Importeren** — nieuwe clubs eerst aanmaken, dan `participantFactory.
   importMultiEventBatch()` **één keer voor alle gekozen onderdelen samen**
   (niet één aanroep per onderdeel), dan `blockFactory.importBatch()` voor
   de volledige dagtijdlijn in één Firestore-batch.

   Die ene gecombineerde aanroep is bewust: een deelnemer doet in zo'n
   wedstrijdschema vaak mee aan meerdere onderdelen tegelijk (bv. Speed
   Sprint én Speed Endurance én Freestyles). `importMultiEventBatch()` houdt
   zelf een groeiende kaart van externalId → participant bij terwijl het de
   onderdelen doorloopt, zodat een deelnemer die tijdens hetzelfde import-
   moment voor het EERSTE onderdeel wordt aangemaakt, ook al herkend wordt
   bij een volgend onderdeel in diezelfde import — anders zou een simpele
   los-per-event aanroep (met telkens de verouderde participants-snapshot
   van vóór de import) een dubbel document aanmaken per extra onderdeel.

---

## Deelnemersbeheer en correcties

`CompetitionDetail` heeft twee interne tabs, geen lange verticale stapel meer:
- **Wedstrijd** — Onderdelen en Programma (dagtijdlijn), compact naast elkaar
  in twee smalle kolommen (elk met eigen `max-height` + interne scroll). Dit
  is configuratie-informatie, niet iets waar continu in gewerkt wordt.
- **Deelnemers** — de volledige deelnemerstabel, op een lege tab dus met de
  volle beschikbare hoogte. Dit is het scherm waar tijdens en rond een
  wedstrijd het meest in gewerkt wordt (aanmelden, corrigeren, reskips) en
  kreeg voorheen, als een derde paneel onderaan een lange verticale stapel,
  vrijwel geen ruimte meer zodra Programma na een PDF-import tientallen
  blokken bevatte.

De deelnemerstabel in `CompetitionDetail` (Beheer) is het overzicht waar
correcties gebeuren — dit is de **enige** plek waar per-onderdeel forfait
(schrappen) mogelijk is; Aanwezigheidsregistratie (`AttendanceView`) toont
onderdelen enkel read-only als pilletjes onder naam/club, zonder een actie
erop (haar eigen "Afwezig melden" schrapt bewust altijd van ALLE onderdelen
tegelijk — dat is algemene aanwezigheid, geen per-onderdeel forfait).

**`EditParticipantModal`** (open via "Bewerken" in de deelnemerstabel) biedt:
- naam/club bewerken;
- per onderdeel waar de deelnemer al aan meedoet: schrappen/herstellen
  (forfait), en — zolang niet geschrapt — **Reskip**: verplaats deze
  deelnemer naar een ander tijdslot binnen hetzelfde onderdeel (een
  herkansing);
- **"+ Onderdeel toevoegen"**: voor elk onderdeel waar de deelnemer nog
  niet aan meedoet, meteen een entry aanmaken.

Reskip en "onderdeel toevoegen" delen dezelfde **slot-picker**
(`eventSlots.js#computeEventSlots`, pure logica op de al-geladen
`participants`-array — geen Firestore-toegang): kies een **bestaand leeg
tijdslot** (een veldnummer binnen een bestaande reeks dat door niemand
niet-geschrapt bezet is — een geschrapte deelnemer maakt zijn veld dus
herbruikbaar) óf **een nieuwe reeks achteraan het onderdeel** (seriesNr =
hoogste bestaande + 1). Bij freestyle bestaat "een leeg veld in een
bestaande reeks" niet (elke reeks is er precies 1 deelnemer) — daar is enkel
een nieuwe reeks mogelijk.

**`AddParticipantModal`** ("Nieuwe deelnemer") maakt een kale deelnemer aan
(`participantFactory.create` — naam + club, `entries: []`) en opent meteen
`EditParticipantModal` erop, zodat onderdelen via dezelfde "+ Onderdeel
toevoegen"-stap toegekend worden — geen aparte, tweede manier om iemand aan
een onderdeel te koppelen.

---

## Dagtijdlijn (`blocks`)

Vervangt de vroegere `PAUZE_`-naamhack (een nep-deelnemer om een pauze te
markeren — bestond enkel nog in de intussen verwijderde `App_old.jsx`) door
een eerste-klas schema-item: `competitions/{id}/blocks/{id}`.

- **`type: "heats"`** — het blok verwijst naar een `eventId`; de reeksen zelf
  blijven volledig afgeleid uit `participant.entries[]` (gegroepeerd op
  `eventId` + `seriesNr`) — er is geen apart heat-document.
- **elk ander type** (`pauze`, `lunchpauze`, `deuren`, `briefing`,
  `proefjury`, `prijsuitreiking`) — geen `eventId`, wel een `label`.

Eén onderdeel kan best meerdere blokken hebben (bv. Freestyles onderbroken
door twee pauzes): elk blok heeft dan hetzelfde `eventId`, met een pauze-blok
ertussenin — de reeksnummering loopt gewoon door.

`LiveView` en `DisplayView` bepalen het "huidige blok" als het eerste blok
(gesorteerd op `order`) met `status !== 'afgewerkt'`. Is dat een niet-heats
blok, dan tonen beide schermen een generiek pauzescherm (label uit
`BLOCK_TYPE_LABELS` of het blok se eigen `label`) i.p.v. de reeksen-UI; de
speaker kan het blok afsluiten via `setBlockStatus(..., 'afgewerkt')`, wat
automatisch het volgende blok in de tijdlijn actief maakt. Het pauzescherm
toont een icoon per bloktype (`BREAK_ICONS` in beide componenten) — enkel
`proefjury` wijkt af van de standaard `Coffee`: lucide-react heeft geen
letterlijk touwtje-icoon, `Activity` (golvende lijn) is het dichtste
alternatief.

In `LiveView` blijft het linkerpaneel (de dagtijdlijn zelf) ook zichtbaar
tijdens zo'n pauzescherm — enkel het rechterpaneel wisselt tussen de
pauzeboodschap en de reeksen-UI. Dat linkerpaneel toont voortaan de volledige
dagtijdlijn (heats- én niet-heats-blokken, met hun `scheduledTime`) i.p.v.
enkel de kale onderdelenlijst van vroeger — enkel heats-blokken zijn
klikbaar (manuele `activeEventId`-overschrijving, zie hieronder).

`CompetitionDetail` (Beheer) heeft een minimale "Programma"-sectie om blokken
manueel te beheren (nodig zolang PDF-import — dat blokken automatisch zal
aanmaken — er nog niet is).

---

## Live voortgang

De voortgang van een wedstrijd (`finishedEvents`, `finishedSeries`) leeft op
het `competition`-document zelf, niet in een los `settings/progress`-singleton
zoals voorheen. Reden: dat singleton werd bij elke `startCompetition()`
onvoorwaardelijk gereset — inclusief bij het **hervatten** van een wedstrijd
die met `stopCompetitionLive()` gepauzeerd was, wat toen alle voortgang wiste.
Nu heeft elke wedstrijd gewoon haar eigen, permanente voortgangsvelden
(`[]`/`{}` bij aanmaak), en hervatten verliest niets meer.

`LiveView` gebruikt deze data om de operator-cursor te initialiseren.
`DisplayView` volgt dezelfde data volledig autonoom om het officiële scherm te tonen.

### Blok-gedreven navigatie in LiveView

`LiveView` volgt de dagtijdlijn actief, niet enkel bij het tonen van een
pauzescherm: zodra de laatste reeks van het huidige blok voltooid is, wordt
dát blok zelf op `'afgewerkt'` gezet (`setBlockStatus`) i.p.v. rechtstreeks
naar het volgende onderdeel te springen. Zo schuift `currentBlock` vanzelf
door naar wat ook in de dagtijdlijn volgt — een pauze/briefing/prijsuitreiking
(pauzescherm) of een volgend/hervat onderdeel (reeksen). `activeEventId`
synchroniseert automatisch met `currentBlock.eventId` via een effect; klikken
op een heats-blok in de linkerkolom (dagtijdlijn) blijft een handmatige
"overschrijf-optie" om naar eender welk onderdeel te springen, los van de
dagtijdlijn.

### Een reeks heropenen (vergissingen rechtzetten)

`unfinishSeries(eventId, seriesNr)` (AppContext) markeert een reeks terug als
niet-afgelopen. Reeksen zijn sequentieel, dus elke latere reeks van hetzelfde
onderdeel die al "klaar" was, wordt automatisch mee heropend — je kan nooit
reeks 5 voltooid hebben terwijl reeks 3 heropend staat. Het onderdeel
verliest ook zijn `finishedEvents`-vlag. `LiveView` roept dit aan via de
"Heropenen"-knop naast de VOLTOOID-indicator (met een `window.confirm`), en
zet meteen ook de bijhorende afgewerkte heats-blokken van dat onderdeel terug
op `'gepland'` — dat laatste gebeurt bewust in `LiveView` zelf (niet in
`unfinishSeries`), omdat het de bestaande block-tijdvenster-logica van dat
scherm nodig heeft (zie hierboven), die niet in AppContext gedupliceerd wordt.

Eén onderdeel kan over **meerdere fysieke blokken** lopen — Freestyles
onderbroken door pauzes, of Speed/Endurance met een reeks die over twee
kolomblokken verdeeld staat maar tot exact hetzelfde fysieke blok behoort
(zie "PDF-import" hierboven). Omdat `entries[]` geen `blockId` bijhoudt, wordt
in dat geval de deelnemerslijst afgebakend tot het **tijdvenster** van het
huidige blok (`[currentBlock.scheduledTime, volgendBlok.scheduledTime)`,
via `timeUtils.js#timeToMinutes` om "8:45" correct te vergelijken met "13:05").
Deze afbakening gebeurt bewust **enkel** wanneer een onderdeel écht meerdere
blokken heeft — bij het gangbare geval (één blok per onderdeel, ook na een
CSV-import zonder dagtijdlijn) blijft de volledige, ongescopede deelnemers-
lijst zichtbaar zoals voorheen. `finishedEvents` (het complete-onderdeel-vlag)
blijft wel gebaseerd op de ECHTE laatste reeks over alle blokken van het
onderdeel heen, niet enkel de laatste van het huidige tijdvenster.

---

## Podium & prijsuitreiking (Fase 3)

Per onderdeel kunnen **meerdere podia** aangemaakt worden (bv. Meisjes/Jongens,
per leeftijdscategorie, per provincie…). Er is bewust **geen** gestructureerd
veld voor leeftijdscategorie/geslacht/provincie — dat verschilt te veel per
wedstrijd. Een podium heeft enkel een vrije-tekst `name`; de gebruiker zorgt
zelf voor een correcte, herkenbare benaming.

### Datamodel

`podiums` is een subcollectie van `competitions/{id}`, met exact hetzelfde
laadpatroon als `blocks` (`podiumFactory.subscribe`, `loadPodiums()` in
AppContext). `places` bevat altijd precies 3 entries (plaats 1/2/3) —
gegarandeerd door `normalizePlaces()` in `dbSchema.js`, dezelfde aanpak als
`normalizeEntry()` voor participant-entries. Elke plaats is een
`participantIds[]` (géén los veld) zodat een gedeelde plaats (ex aequo)
gewoon meerdere deelnemers kan bevatten.

`order` is één **globaal** geheel getal over de hele wedstrijd heen, niet
gescopeerd per onderdeel — zo kan de wedstrijdbeheerder/speaker de podia van
verschillende onderdelen vrij door elkaar ordenen tot de exacte
ceremonie-volgorde waarin ze afgeroepen worden.

### Componenten

- **`PodiumStage.jsx`** — pure presentatiecomponent (geen AppContext/Firestore-
  toegang). Toont podiumnaam, onderdeel en de 3 plaatsen met laureaten, en
  bepaalt zelf niets over databronnen — alles komt resolved binnen via props.
  Herbruikt met `size="full"` (groot scherm) en `size="mini"` (kleine
  voorvertoning bij de speaker) — letterlijk hetzelfde onderdeel, geen twee
  aparte implementaties, zodat de speaker exact ziet wat het grote scherm
  toont.
- **`PodiumManager.jsx`** — gedeeld CRUD-beheer: podia aanmaken per onderdeel,
  hernoemen, verwijderen, laureaten per plaats toewijzen (dropdown, gescoped
  tot de deelnemers van dát onderdeel), en de globale volgorde bepalen
  (op/neer-knoppen, wisselt `order` met de buur). Gebruikt zowel in
  `CompetitionDetail` (tab "Podium", wedstrijdbeheerder) als in `LiveView`
  (tab "Podium" → subtab "Beheer", speaker).
- **`PodiumCeremonyPanel.jsx`** — enkel op het Speaker-scherm (`LiveView`, tab
  "Podium" → subtab "Ceremonie"). Laat de speaker door de podia navigeren
  (vorige/volgende, of rechtstreeks kiezen uit de volgordelijst) en de
  onthulling per plaats sturen. Toont de kleine `PodiumStage`-voorvertoning
  zodat de speaker ziet wat het grote scherm op dat moment toont.
- **`PodiumView.jsx`** — het grote scherm (`/scherm/podium`), donker thema
  net als `DisplayView`. Puur weergavegedreven: leest `podiumState` en het
  actieve podium, toont `PodiumStage` met `size="full"`. Geen eigen
  navigatie.

### Synchronisatie speaker → groot scherm

Net als `finishedEvents`/`finishedSeries` loopt de synchronisatie
uitsluitend via een veld op het `competition`-document zelf, nooit via een
rechtstreeks kanaal tussen de twee schermen:

```
competition.podiumState = { activePodiumId: string|null, revealStage: 0-3 }
```

`PodiumCeremonyPanel` schrijft (`savePodiumState`), `PodiumView` leest
diezelfde data via een Firestore-listener en volgt automatisch mee.
`revealStage` stuurt de gefaseerde onthulling per podium: `0` = nog niets
zichtbaar, `1` = 3de plaats onthuld, `2` = 3de + 2de plaats, `3` = volledig
podium (incl. 1ste plaats). Bij het wisselen van podium (vorige/volgende of
rechtstreekse keuze) reset `revealStage` automatisch naar `0`.

De podiumceremonie gebeurt terwijl de wedstrijd nog `status: "bezig"` is
(net als de reeksen) — pas nadien roept de beheerder `endCompetition()` aan.

### Belgisch kampioenschap — vlag als achtergrond

`podium.isBelgianChampionship` (toggle in `PodiumManager`) laat `PodiumView`
de standaard donkere achtergrond vervangen door een "wapperende" Belgische
vlag. Dit gebeurt bewust zonder CSS-`@keyframes` of een los stijlbestand
(CLAUDE.md — enkel inline stijlobjecten): `belgianFlagBackground(offsetPx)`
in `PodiumView.jsx` bouwt een `backgroundImage` op uit twee lagen (een
diagonale, herhalende glans-strook over drie effen zwart/geel/rode banden),
en een `setInterval` schuift `offsetPx` op zolang het actieve podium een
BK-podium is — dat rimpelende glans-effect suggereert de wapperende
beweging. Om de podiumtekst leesbaar te houden ongeacht welke vlagband
erachter zit, komt `PodiumStage` in dat geval op een halfdoorzichtig donker
kaartje (`color.stageCard`) te staan i.p.v. rechtstreeks op de vlag.

Clublogo's staan onderaan in de zuil van elke plaats (niet meer boven de
naam) — de zuil is een flex-kolom met `justify-content: space-between`
(plaatsnummer bovenaan, logo('s) onderaan), zodat ze bij elke plaatshoogte
gegarandeerd los blijven van het nummer. In de kleine speaker-voorvertoning
(`size="mini"`) worden logo's bewust niet getoond — de zuil is daar te laag
om ze zonder overlap kwijt te kunnen.

---

## Boodschap groot scherm

`DisplayView` toont een boodschap prominent in een apart vak direct onder de
header (niet langer een vaste voettekst-tekst) — de reden en het scherm
waarop dit gebeurt zijn dus dezelfde als bij Podium hierboven, maar het
datamodel is bewust eenvoudiger: geen volgorde of onthullingsstadia, gewoon
"wat staat er nu op het scherm".

### Datamodel

`messages` is een subcollectie van `competitions/{id}`, met hetzelfde
laadpatroon als `blocks`/`podiums` (`messageFactory.subscribe`,
`loadMessages()` in AppContext). Er is bewust **geen** standaardboodschap als
Firestore-document: `competition.activeMessageId === null` betekent altijd de
vaste standaardtekst "Veel succes aan alle deelnemers" (`DEFAULT_DISPLAY_MESSAGE`
in AppContext.jsx), zodat er nooit twee bronnen van waarheid kunnen bestaan
voor "wat is de standaardboodschap". Er is ook bewust geen `isActive`-veld per
boodschap-document — welke boodschap actief is, staat uitsluitend op
`competition.activeMessageId`.

Elke boodschap heeft een optioneel `icon` (`''` | `'megaphone'` | `'alert'` |
`'question'` | `'thumbsup'`) — de map van icoonsleutel naar het bijhorende
lucide-react-component (`MESSAGE_ICON_MAP`) leeft in `MessageManager.jsx` en
wordt van daaruit ook door `DisplayView` geïmporteerd, zodat beheer en
weergave nooit uit de pas kunnen lopen.

### Componenten

- **`MessageManager.jsx`** — gedeeld beheer: boodschappen aanmaken (als
  draft), bewerken, verwijderen en activeren, plus een altijd-aanwezige
  "Standaardboodschap"-kaart om terug te schakelen naar `activeMessageId:
  null`. Gebruikt in zowel `CompetitionDetail` (tab "Boodschap",
  wedstrijdbeheerder) als `LiveView` (tab "Boodschap", speaker) — exact
  dezelfde component, geen aparte "ceremonie"-variant nodig omdat activeren
  geen live opeenvolging vergt zoals bij podia.
- **`DisplayView.jsx`** — leest `activeMessage` (de afgeleide combinatie van
  `messages` + `activeMessageId`, met de standaardboodschap als fallback) en
  toont die in een eigen vak vlak onder de topbar, met het icoon (indien
  ingesteld) links van de tekst.

### Synchronisatie speaker/beheer → groot scherm

Zelfde patroon als `finishedEvents`/`finishedSeries` en `podiumState`: enkel
via een veld op het `competition`-document (`activeMessageId`), nooit via een
rechtstreeks kanaal. `setActiveMessage(competitionId, messageId)` schrijft;
`DisplayView` leest via zijn eigen Firestore-listener en volgt automatisch mee.

---

## Seed

De `events` en `competitionTypes` collecties worden éénmalig gevuld via `seedData.js`.
De seed is idempotent — bestaande documenten worden niet aangeraakt.
Na de seed is `constants.js` enkel nog nodig voor `APP_ID` en `getFirebaseConfig`.
De seed-pagina is bereikbaar via `/seed.html` (Vite multi-entry) en bevat ook
de eenmalige bootstrap van de eerste beheerder (zie "Authenticatie & rechten").

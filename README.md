# Geregeldwerk

Geregeldwerk is een administratie-assistent voor Nederlandse zzp'ers, eerst voor installateurs en klusbedrijven. Slogan: *Jij doet het werk, wij het geregel.* Je plakt een WhatsApp of e-mail, of je spreekt hem in. De assistent leest er klant, plaats, werkzaamheden en ontbrekende gegevens uit en maakt een **conceptofferte**. Prijzen verzin of kopieert hij niet: die vul je zelf in.

Dit is een lokale prototype van CodedByDefault. Er is geen productie-deploy en geen koppeling met Supabase, Vercel, WhatsApp of sociale netwerken.

## Starten

```bash
npm install
npm run dev
```

Open daarna [http://127.0.0.1:4317](http://127.0.0.1:4317).

Zonder omgevingsvariabelen draait de app in **mock-modus**. Er is geen API-sleutel nodig. Tests:

```bash
npm test
```

## Mock-modus

`GEREGELDWERK_LLM_PROVIDER` staat standaard op `mock` (zie `.env.example`). Het bericht wordt lokaal gelezen met vaste Nederlandse regels, niet door een extern model. Zet je `openai` zonder `GEREGELDWERK_LLM_API_KEY`, dan valt de app terug op mock en zegt hij dat.

De optionele OpenAI-adapter praat met een OpenAI-compatibel `/chat/completions`-endpoint. Antwoorden worden geschoond: verzonnen namen, plaatsen en **alle bedragen** gaan eraf. In deze prototype wordt die adapter niet aangeroepen.

## Permissies

De eigenaar geeft **eenmalig** per actie toestemming. Daarna handelt Geregeldwerk binnen die regel zelf.

| Actie | Standaard |
| --- | --- |
| Offerte versturen | Automatisch tot € 500, alleen bestaande klanten, alleen op werkdagen 08:00–17:00 (Amsterdam) |
| Factuur maken | Altijd vragen |
| Afspraak inplannen | Automatisch, alleen tijdens werktijd |
| Bonnetje boeken | Automatisch tot € 75 |
| Social-media-post publiceren | Altijd vragen |

- **Automatisch binnen grenzen:** de actie gebeurt meteen (gesimuleerd) en komt in het auditlog.
- **Buiten de grenzen**, of als de stand **altijd vragen** is: de actie gaat naar de wachtrij in Toezicht. Niks wordt uitgevoerd tot je goedkeurt of afwijst, met een optionele opmerking.
- **Uit:** de actie wordt geweigerd en gelogd.
- **Permissies wijzigen** maakt alleen een voorstel. De oude regels blijven gelden tot je dat voorstel expliciet goedkeurt.
- **Noodstop** op Toezicht pauzert alle automatische regels in één keer. De regels zelf blijven staan; acties die anders direct liepen, gaan naar de wachtrij.

Een conceptofferte opslaan is nog geen versturen. Dat is een kladversie op je eigen computer.

## Toezicht en export

`/toezicht` toont de wachtrij, recente AI-acties, fouten en het volledige auditlog, met filters. Het log is append-only: regels worden toegevoegd, niet aangepast of gewist.

Een latere toezichthoudende assistent kan lokaal lezen:

```bash
curl http://127.0.0.1:4317/api/toezicht/export
```

Die JSON bevat permissies, open goedkeuringen, open permissievoorstellen en het auditlog (wie, wat, wanneer, invoer, uitvoer, voor/na, besluit). Er wordt niets naar buiten gestuurd.

## Marketing

`/marketing` heeft posts in de statussen concept, ingepland en gepubliceerd, plus een groeilogboek voor leads. Publiceren loopt via de permissie en blijft een simulatie.

## Privacy

De voorbeelden (Jansen, Pieter de Vries, Mevrouw De Test, Familie Vermeer, Installatiebedrijf Voorbeeld) zijn fictief. Zet geen echte klantgegevens in deze prototype. Gegevens staan in `data/store.json` op deze computer. Verwijder dat bestand om de voorbeelden terug te zetten.

## Later aansluiten

De opslag loopt via `Repository` in `src/lib/storage`. Een Supabase-implementatie kan hetzelfde contract invullen. De LLM zit achter `resolveProvider()`. Hosting op Vercel kan daarna, zonder de domeinlogica te verplaatsen. Auth en een database zitten er nu niet in.

## Wat deze prototype wel en niet doet

Wel:

- Bericht plakken of inspreken (spraakherkenning van de browser, Nederlands; in Firefox meestal niet beschikbaar).
- Conceptofferte controleren, prijzen invullen, bewaren, als PDF downloaden of afdrukken.
- Status concept, verstuurd en geaccepteerd.
- Permissies, wachtrij, noodstop, auditlog en JSON-export.
- Gesimuleerde factuur, bon, afspraak en social post.
- Herinneringen.

Niet:

- Echt mailen, WhatsApp, boekhouden of posten op sociale netwerken.
- Echte betalingen, kvk-controle of btw-aangifte.
- Een tweede persoon als verplichte fiatteur. Jij bent in deze demo de eigenaar én de fiatteur; het verschil is de expliciete goedkeuring, niet een apart account.
- Productie-deploy.

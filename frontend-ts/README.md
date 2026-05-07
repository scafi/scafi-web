# frontend-ts

Bootstrap iniziale della migrazione TypeScript descritta in `DESING.md`.

Questa prima tranche non sostituisce ancora il frontend Scala.js corrente. Congela invece i contratti piu' delicati e li rende testabili in isolamento:

- runtime public API (`scafiStandalone`)
- serializer della runtime config
- adattatore da standalone state a graph snapshot
- client-side session lifecycle minimale
- trasformazione easy Scala -> full Scala
- persistence/config repository
- example loading con fallback cache
- composition root e facade applicativa non-UI

## Comandi

```bash
npm install
npm run test
npm run build
```

Dalla root del repository puoi anche lanciare il frontend con:

```bash
./run-frontend-ts.sh
```

Puoi cambiare host e porta tramite variabili ambiente, per esempio:

```bash
HOST=0.0.0.0 PORT=4174 ./run-frontend-ts.sh
```

## Stato

- `src/services/serialization/runtime-config-serializer.ts`: parity con `StandaloneRuntimeConfig.scala`
- `src/services/standalone/standalone-runtime-loader.ts`: parity con `evaluateStandaloneRuntime`
- `src/services/standalone/standalone-state-adapter.ts`: parity con `StandaloneGraphSnapshot.scala`
- `src/services/scastie/scastie-service.ts`: payload builder e parser SSE tipizzati
- `src/services/standalone/session-manager.ts`: gestione sessione/generation iniziale
- `src/services/config/config-repository.ts`: persistenza di configurazione e editor document
- `src/services/examples/example-service.ts`: remote load + cache fallback degli esempi
- `src/state/event-bus.ts`: event bus tipizzato per orchestration e futura UI
- `src/app/composition-root.ts`: wiring completo delle dipendenze non-UI
- `src/app/scafi-web-app.ts`: facade applicativa consumabile dalla UI

Il perimetro non-UI ora comprende store, servizi, repository e composition root. Il passo successivo naturale e' sostituire progressivamente le sezioni UI sopra questa facade applicativa.
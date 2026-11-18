export const EXAMPLES = {
  badge: {
    name: '🪪 Reprise d’activité (badge)',
    code: String.raw`@startuml
skinparam BoxPadding 0
skinparam shadowing false
skinparam responseMessageBelowArrow true
skinparam sequenceMessageAlign left
skinparam maxMessageSize 1000
skinparam ParticipantBorderColor #78909C
skinparam DatabaseBorderColor #78909C
skinparam ActorBorderColor #78909C
skinparam ArrowColor #455A64
skinparam SequenceGroupBackgroundColor #F5F5F5
skinparam SequenceGroupBorderColor #90A4AE
skinparam SequenceGroupHeaderFontColor #37474F
skinparam NoteBackgroundColor #FFFDE7
skinparam NoteBorderColor #F9A825

actor "Personnel badgeant" as USR

box "Frontend Screens" #E3F2FD
    participant "Home\nScreen" as SCR_HOME
end box

box "Backend" #FFF8E1
    participant "JWT check" as JWTC
    participant "Custom Action" as CA
end box

box "Backend STD SedApata" #FFF3E0
    participant "Standard API" as API
end box

box "Data Bases" #F3E5F5
    database "DB Standard" as DBS
    database "DB Spécifique" as DBX
end box

USR -> SCR_HOME: Resume last activity with OBJ
SCR_HOME -> JWTC: **POST** {Object 01}

alt #FDE3E1

JWTC --> SCR_HOME: **HTTP 401 Unauthorized** - {Object error}
SCR_HOME -> USR: JWT Error message

end
JWTC -> CA: True

CA -> CA: IsInProgressAcitvity  (FA01)

alt #FDE3E1

CA --> SCR_HOME: **HTTP 403 Forbidden** - {Object error}
SCR_HOME -> USR: Error message A01

end

CA -> CA: ChangeSedaptaStatus (F01) {Object 02}
CA -> API: **POST** {Object 02}

alt #FDE3E1
API --> CA: **HTTP 500 Internal Server Error** {Object error}
CA -> CA: STD Error handler (F02)
CA --> SCR_HOME: **HTTP 500 Internal Server Error** {Object error}
SCR_HOME -> USR : Error message 01
else #DFF5E3
API --> CA: **HTTP 200 OK**

end

CA -> CA: CreateNewSpecificActivity (F03) {Object 03}
CA -> DBX: Write Object 03
return

alt #FDE3E1
CA --> SCR_HOME: **HTTP 500 Internal Server Error** {Object error}
SCR_HOME -> USR : Error message 02
end

CA -> CA: CreateNewSpecificPresence (F04) {Object 04}
CA -> DBX: Write Object 04
return

alt #FDE3E1
CA --> SCR_HOME: **HTTP 500 Internal Server Error** {Object error}
SCR_HOME -> USR : Error message 03
end

CA -> CA: GetFabObjectHMSStatus (F05 or F06 or F07) {Object 05}
CA -> API: **POST** {Object 05}

alt #FDE3E1
API --> CA: **HTTP 500 Internal Server Error** {Object error}
CA -> CA: STD Error handler (F02)
CA --> SCR_HOME: **HTTP 500 Internal Server Error** {Object error}
SCR_HOME -> USR : Error message 04
else #DFF5E3
API --> CA: **HTTP 200 OK**
& CA --> SCR_HOME: **HTTP 200 OK**
SCR_HOME --> JWTC: **GET** query invalidation (last activity)
return

SCR_HOME -> USR: Success message 01

end
@enduml
`,
  },
  coffee: {
    name: '☕ Commande de café',
    code: String.raw`@startuml
title La machine à café
actor "Dev fatigué" as DEV
participant "Machine\nà café" as M
database "Réserve\nde grains" as R

DEV -> M: Appuie sur **Espresso**
note right of M: Elle réfléchit...
M -> R: Il reste des grains ?
return Oui, 42 g
loop 3 fois
  M -> M: Mouds //vigoureusement//
end
alt #DFF5E3 eau OK
  M --> DEV: ☕ Espresso servi
else #FDE3E1 bac vide
  M --> DEV: Remplis le bac !
  DEV -> DEV: Soupir
end
== Plus tard ==
... 5 minutes ...
DEV -> M: Encore un ?
@enduml
`,
  },
  blank: {
    name: '✨ Page blanche',
    code: `@startuml
actor Alice
participant Bob

Alice -> Bob: Bonjour !
Bob --> Alice: Salut 👋
@enduml
`,
  },
};

export const SNIPPETS = [
  { label: '🧍 Acteur', code: 'actor "Nouvel acteur" as A1' },
  { label: '🟦 Participant', code: 'participant "Service" as S1' },
  { label: '🛢️ Base', code: 'database "Base" as DB1' },
  { label: '➡️ Message', code: 'A1 -> S1: **POST** /api' },
  { label: '⤶ Réponse', code: 'S1 --> A1: **HTTP 200 OK**' },
  { label: '🔁 Self', code: 'S1 -> S1: Traitement interne' },
  { label: '🔀 alt/else', code: 'alt #FDE3E1 erreur\n    S1 --> A1: **HTTP 500**\nelse #DFF5E3 succès\n    S1 --> A1: **HTTP 200**\nend' },
  { label: '🔄 loop', code: 'loop pour chaque élément\n    S1 -> DB1: Lire\nend' },
  { label: '📝 Note', code: 'note right of S1: Une note utile' },
  { label: '📦 Box', code: 'box "Nouveau groupe" #E8F5E9\n    participant "Nouveau" as N1\nend box' },
  { label: '➖ Séparateur', code: '== Étape suivante ==' },
];

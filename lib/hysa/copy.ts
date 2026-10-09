import type { CategoryId, HysaLang } from './event'

// Copy for the Team Hysa page (phase 44). Albanian is the primary language;
// German and English are written for their readers, not word-for-word.
// Nothing here may promise what the official seller doesn't guarantee.

export type HysaCopy = {
  meta: { title: string; description: string; ogAlt: string }
  langName: string
  nav: { back: string }
  hero: {
    kicker: string
    vs: string
    title: string
    dateLine: string
    cta: string
    ctaSecondary: string
    countdownLabel: string
    units: { d: string; h: string; m: string; s: string }
    fightDay: string
  }
  trust: string[]
  support: {
    heading: string
    body: string
    chips: { flag: string; title: string; date: string; place: string }
  }
  tickets: {
    eyebrow: string
    heading: string
    intro: string
    availabilityChecking: string
    availabilityOfficial: string
    availabilityFailed: string
    checkOfficial: string
    liveLabel: string
    updated: string
    stale: string
    price: string
    priceOfficial: string
    priceCheckedAt: string
    area: string
    bestFor: string
    cta: string
    purchaseNote: string
    status: { available: string; limited: string; sold_out: string; unknown: string }
    categories: Record<CategoryId, { badge: string; position: string; bestFor: string }>
  }
  map: {
    eyebrow: string
    heading: string
    body: string
    cta: string
    legendLower: string
    legendUpper: string
    legendFloor: string
    caption: string
    standNote: string
  }
  why: {
    heading: string
    body: string
    record: string
    ko: string
    countries: { albania: string; germany: string }
    roles: { challenger: string; champion: string }
    vs: string
    sourcesNote: string
  }
  fans: {
    heading: string
    body: string
    bring: string[]
    share: string
    shareText: string
    whatsapp: string
    facebook: string
    copy: string
    copied: string
  }
  group: {
    heading: string
    body: string
    sizes: string[]
    note: string
    cta: string
  }
  travel: {
    heading: string
    dateLabel: string
    date: string
    addressLabel: string
    transportLabel: string
    transport: string
    directions: string
    transit: string
    timeNote: string
  }
  faq: { heading: string; items: Array<{ q: string; a: string }> }
  disclaimer: string
  sticky: string
  switchLabel: string
}

const sq: HysaCopy = {
  meta: {
    title: 'Nelson Hysa vs Agit Kabayel — Bileta Team Hysa · 28 Nëntor, Düsseldorf',
    description:
      'Nelson Hysa sfidon Agit Kabayel për titullin botëror WBC më 28 Nëntor 2026 në Merkur Spiel-Arena, Düsseldorf. Gjej sektorët e Team Hysa dhe hyr në sistemin zyrtar të biletave.',
    ogAlt: 'Nelson Hysa vs Agit Kabayel — 28 Nëntor 2026, Düsseldorf',
  },
  langName: 'Shqip',
  nav: { back: 'AlbaGo' },
  hero: {
    kicker: 'SHQIPËRIA NË SKENËN E MADHE 🇦🇱',
    vs: 'VS',
    title: 'Kampionati Botëror WBC i Peshave të Rënda',
    dateLine: '28 Nëntor 2026',
    cta: 'ZGJIDH BILETËN',
    ctaSecondary: 'SHIKO SEKTORËT E TEAM HYSA',
    countdownLabel: 'Deri në natën e madhe',
    units: { d: 'ditë', h: 'orë', m: 'min', s: 'sek' },
    fightDay: 'Sot është nata e madhe 🇦🇱',
  },
  trust: [
    'Blerja në sistemin zyrtar të biletave',
    'Kanali i biletave i Nelson Hysës',
    'AlbaGo nuk merr dhe nuk sheh pagesën tënde',
  ],
  support: {
    heading: 'Düsseldorfi vishet kuqezi 🇦🇱',
    body: 'Më 28 Nëntor, Nelson Hysa sfidon Agit Kabayel për titullin botëror WBC. Zgjidh vendin tënd në sektorët e Team Hysa dhe bëhu pjesë e natës.',
    chips: {
      flag: '🇦🇱 Tifozët shqiptarë',
      title: '🥊 Titulli botëror i peshave të rënda',
      date: '📅 28 Nëntor',
      place: '📍 Düsseldorf',
    },
  },
  tickets: {
    eyebrow: 'BILETAT',
    heading: 'Gjej biletën tënde',
    intro: 'Kategoritë e kanalit të Team Hysa. Çmimet dhe vendet e lira shihen në kohë reale në sistemin zyrtar.',
    availabilityChecking: 'Po kontrollohet disponueshmëria…',
    availabilityOfficial: 'Disponueshmëria kontrollohet në sistemin zyrtar',
    availabilityFailed: 'Disponueshmëria live nuk mund të ngarkohet për momentin.',
    checkOfficial: 'KONTROLLO NË SISTEMIN ZYRTAR',
    liveLabel: 'LIVE',
    updated: 'Përditësuar',
    stale: 'jo e fundit',
    price: 'Çmimi',
    priceOfficial: 'Në sistemin zyrtar',
    priceCheckedAt: 'kontrolluar më',
    area: 'Vendndodhja',
    bestFor: 'Për kë',
    cta: 'ZGJIDH VENDET',
    purchaseNote: 'Biletat përfundimtare blihen përmes sistemit zyrtar të eventit.',
    status: { available: 'Ka vende', limited: 'Pak vende', sold_out: 'Shitur', unknown: 'Kontrollo zyrtarisht' },
    categories: {
      cat8: {
        badge: 'OPSIONI EKONOMIK',
        position: 'Tribuna e veriut, kati i sipërm',
        bestFor: 'Për tifozët që duan të jenë pjesë e atmosferës me një çmim më të ulët.',
      },
      cat6: {
        badge: 'ZGJEDHJA E REKOMANDUAR',
        position: 'Tribuna e veriut, kati i poshtëm',
        bestFor: 'Ekuilibër i mirë midis afërsisë me ringun dhe çmimit.',
      },
      cat4: {
        badge: 'MË AFËR RINGUT',
        position: 'Parteri, në fushë rreth ringut',
        bestFor: 'Për ata që duan të jenë sa më pranë aksionit.',
      },
    },
  },
  map: {
    eyebrow: 'HARTA',
    heading: 'Sektorët e Team Hysa 🇦🇱',
    body: 'Biletat e kanalit të Hysës që kemi verifikuar janë në Nord-Tribüne dhe në parter. Vendet e sakta të lira i sheh në hartën zyrtare live.',
    cta: 'HAP HARTËN LIVE TË VENDEVE',
    legendLower: 'Nord-Tribüne · kati i poshtëm',
    legendUpper: 'Nord-Tribüne · kati i sipërm',
    legendFloor: 'Parteri (Innenraum) · rreth ringut',
    caption: 'Hartë orientuese e AlbaGo — jo harta zyrtare.',
    standNote: 'Harta live, vendet dhe çmimet përfundimtare: sistemi zyrtar.',
  },
  why: {
    heading: 'NJË NATË. NJË TITULL. NJË SHQIPËRI PAS TIJ.',
    body: 'Nelson Hysa hyn në ndeshjen më të madhe të karrierës së tij profesionale — i pamposhtur, kundër kampionit të pamposhtur, në ditën e Flamurit.',
    record: 'Rekordi',
    ko: 'nokaute',
    countries: { albania: 'Shqipëri', germany: 'Gjermani' },
    roles: { challenger: 'Sfiduesi · peshat e rënda', champion: 'Kampion WBC i peshave të rënda' },
    vs: 'VS',
    sourcesNote: 'Rekordet sipas burimeve publike, kontrolluar më 10.10.2026.',
  },
  fans: {
    heading: 'Sille flamurin 🇦🇱',
    body: 'Kuq e zi nga tribuna deri në ring. Le ta dëgjojë gjithë Düsseldorfi.',
    bring: ['🇦🇱 Flamurin kuqezi', '🔴⚫ Të kuqe e të zeza', '📣 Zërin tënd për Nelsonin'],
    share: 'SHARE ME SHOKËT',
    shareText: '🇦🇱 Nelson Hysa lufton për titullin botëror WBC më 28 Nëntor në Düsseldorf. Biletat e Team Hysa këtu:',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    copy: 'Kopjo linkun',
    copied: 'U kopjua ✓',
  },
  group: {
    heading: 'Vini në grup?',
    body: 'Në hartën zyrtare mund të zgjedhësh disa vende pranë njëri-tjetrit.',
    sizes: ['2 bileta', '4 bileta', '6+ bileta'],
    note: 'Sa vende ka bashkë e përcakton sistemi zyrtar në atë moment.',
    cta: 'GJEJ VENDE BASHKË',
  },
  travel: {
    heading: 'Si të shkosh',
    dateLabel: 'Data',
    date: 'E shtunë, 28 Nëntor 2026',
    addressLabel: 'Adresa',
    transportLabel: 'Transporti publik',
    transport: 'Me U78 nga Hauptbahnhof deri te stacioni «Merkur Spiel-Arena/Messe Nord» (rreth 15–20 min), pastaj rreth 8 minuta në këmbë.',
    directions: 'Udhëzime në Google Maps',
    transit: 'Oraret e Rheinbahn',
    timeNote: 'Ora e saktë e fillimit: sipas biletës dhe njoftimit zyrtar.',
  },
  faq: {
    heading: 'Pyetje të shpeshta',
    items: [
      {
        q: 'A janë këto bileta për anën e Nelson Hysës?',
        a: 'Butonat në këtë faqe të çojnë te kanali zyrtar i biletave i Nelson Hysës, në sistemin e biletave të eventit. Sektorin dhe vendin e saktë i sheh në hartën zyrtare para se të paguash.',
      },
      {
        q: 'Ku realizohet pagesa?',
        a: 'Vetëm në sistemin zyrtar të biletave të eventit. AlbaGo nuk merr pagesa dhe nuk sheh të dhënat e kartës tënde.',
      },
      {
        q: 'A është AlbaGo organizatori i ndeshjes?',
        a: 'Jo. AlbaGo është platformë për evente shqiptare dhe ndihmon tifozët e Team Hysës të gjejnë biletat. Ndeshjen e organizojnë promotorët, dhe biletat i lëshon sistemi zyrtar i eventit.',
      },
      {
        q: 'A mund të blej disa vende bashkë?',
        a: 'Po, nëse ka vende të lira pranë njëri-tjetrit. I zgjedh direkt në hartën zyrtare; disponueshmërinë e përcakton sistemi zyrtar.',
      },
      {
        q: 'Kur do t’i marr biletat elektronike?',
        a: 'Kohën dhe mënyrën e dërgimit i përcakton shitësi zyrtar. I gjen në konfirmimin e porosisë dhe në kushtet e shitësit.',
      },
      {
        q: 'A mund të blej nga Shqipëria, Kosova apo Zvicra?',
        a: 'Blerja bëhet online. Mënyrat e pagesës dhe kushtet për blerësit jashtë Gjermanisë i përcakton shitësi zyrtar — kontrolloji para pagesës.',
      },
      {
        q: 'Çfarë ndodh nëse një kategori shitet?',
        a: 'Sistemi zyrtar nuk e shfaq më si të lirë. Provo një kategori tjetër në hartën zyrtare ose kontrollo përsëri më vonë.',
      },
    ],
  },
  disclaimer:
    'AlbaGo nuk është organizatori i ndeshjes. Blerja dhe lëshimi përfundimtar i biletës kryhet përmes sistemit zyrtar të biletave të eventit.',
  sticky: '🎟️ SHIKO BILETAT',
  switchLabel: 'Gjuha',
}

const de: HysaCopy = {
  meta: {
    title: 'Nelson Hysa vs Agit Kabayel — Team-Hysa-Tickets · 28. November, Düsseldorf',
    description:
      'Nelson Hysa fordert Agit Kabayel um den WBC-Weltmeistertitel im Schwergewicht — am 28. November 2026 in der Merkur Spiel-Arena Düsseldorf. Finde die Team-Hysa-Blöcke und geh direkt in den offiziellen Ticketshop.',
    ogAlt: 'Nelson Hysa vs Agit Kabayel — 28. November 2026, Düsseldorf',
  },
  langName: 'Deutsch',
  nav: { back: 'AlbaGo' },
  hero: {
    kicker: 'ALBANIEN AUF DER GROSSEN BÜHNE 🇦🇱',
    vs: 'VS',
    title: 'WBC-Weltmeisterschaft im Schwergewicht',
    dateLine: '28. November 2026',
    cta: 'TICKET WÄHLEN',
    ctaSecondary: 'TEAM-HYSA-BLÖCKE ANSEHEN',
    countdownLabel: 'Bis zur großen Nacht',
    units: { d: 'Tage', h: 'Std', m: 'Min', s: 'Sek' },
    fightDay: 'Heute ist Kampfnacht 🇦🇱',
  },
  trust: [
    'Kauf im offiziellen Ticketshop',
    'Ticketkanal von Nelson Hysa',
    'AlbaGo sieht und verarbeitet keine Zahlungen',
  ],
  support: {
    heading: 'Düsseldorf in Rot-Schwarz 🇦🇱',
    body: 'Am 28. November fordert Nelson Hysa Agit Kabayel um den WBC-Weltmeistertitel. Sichere dir deinen Platz in den Team-Hysa-Blöcken und sei Teil dieser Nacht.',
    chips: {
      flag: '🇦🇱 Albanische Fans',
      title: '🥊 WM-Titel im Schwergewicht',
      date: '📅 28. November',
      place: '📍 Düsseldorf',
    },
  },
  tickets: {
    eyebrow: 'TICKETS',
    heading: 'Finde dein Ticket',
    intro: 'Die Kategorien des Team-Hysa-Ticketkanals. Preise und freie Plätze siehst du live im offiziellen Ticketshop.',
    availabilityChecking: 'Verfügbarkeit wird geprüft…',
    availabilityOfficial: 'Die Verfügbarkeit wird im offiziellen Ticketshop geprüft',
    availabilityFailed: 'Die Live-Verfügbarkeit kann gerade nicht geladen werden.',
    checkOfficial: 'IM OFFIZIELLEN SHOP PRÜFEN',
    liveLabel: 'LIVE',
    updated: 'Aktualisiert',
    stale: 'nicht aktuell',
    price: 'Preis',
    priceOfficial: 'Im offiziellen Shop',
    priceCheckedAt: 'geprüft am',
    area: 'Bereich',
    bestFor: 'Ideal für',
    cta: 'PLÄTZE WÄHLEN',
    purchaseNote: 'Die Tickets werden ausschließlich über das offizielle Ticketsystem der Veranstaltung gekauft.',
    status: { available: 'Verfügbar', limited: 'Wenige Plätze', sold_out: 'Ausverkauft', unknown: 'Offiziell prüfen' },
    categories: {
      cat8: {
        badge: 'GÜNSTIGER EINSTIEG',
        position: 'Nord-Tribüne, Oberrang',
        bestFor: 'Für Fans, die mitten in der Stimmung sein wollen — zum kleineren Preis.',
      },
      cat6: {
        badge: 'UNSERE EMPFEHLUNG',
        position: 'Nord-Tribüne, Unterrang',
        bestFor: 'Gute Balance zwischen Nähe zum Ring und Preis.',
      },
      cat4: {
        badge: 'NÄHER AM RING',
        position: 'Innenraum, rund um den Ring',
        bestFor: 'Für alle, die so nah wie möglich an der Action sein wollen.',
      },
    },
  },
  map: {
    eyebrow: 'SAALPLAN',
    heading: 'Die Team-Hysa-Blöcke 🇦🇱',
    body: 'Die von uns geprüften Tickets des Hysa-Kanals liegen auf der Nord-Tribüne und im Innenraum. Die genauen freien Plätze zeigt der offizielle Live-Saalplan.',
    cta: 'LIVE-SAALPLAN ÖFFNEN',
    legendLower: 'Nord-Tribüne · Unterrang',
    legendUpper: 'Nord-Tribüne · Oberrang',
    legendFloor: 'Innenraum · rund um den Ring',
    caption: 'Orientierungsplan von AlbaGo — nicht der offizielle Saalplan.',
    standNote: 'Live-Saalplan, Plätze und Endpreise: offizieller Ticketshop.',
  },
  why: {
    heading: 'EINE NACHT. EIN TITEL. EIN GANZES LAND DAHINTER.',
    body: 'Nelson Hysa steigt zum größten Kampf seiner Profikarriere in den Ring — ungeschlagen gegen den ungeschlagenen Champion, am albanischen Unabhängigkeitstag.',
    record: 'Bilanz',
    ko: 'K.-o.-Siege',
    countries: { albania: 'Albanien', germany: 'Deutschland' },
    roles: { challenger: 'Herausforderer · Schwergewicht', champion: 'WBC-Weltmeister im Schwergewicht' },
    vs: 'VS',
    sourcesNote: 'Bilanzen laut öffentlichen Quellen, Stand 10.10.2026.',
  },
  fans: {
    heading: 'Bring die Flagge mit 🇦🇱',
    body: 'Rot-Schwarz von der Tribüne bis zum Ring. Ganz Düsseldorf soll es hören.',
    bring: ['🇦🇱 Die rot-schwarze Flagge', '🔴⚫ Rot und Schwarz', '📣 Deine Stimme für Nelson'],
    share: 'MIT FREUNDEN TEILEN',
    shareText: '🇦🇱 Nelson Hysa kämpft am 28. November in Düsseldorf um den WBC-WM-Titel. Team-Hysa-Tickets hier:',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    copy: 'Link kopieren',
    copied: 'Kopiert ✓',
  },
  group: {
    heading: 'Ihr kommt als Gruppe?',
    body: 'Im offiziellen Saalplan kannst du mehrere Plätze nebeneinander auswählen.',
    sizes: ['2 Tickets', '4 Tickets', '6+ Tickets'],
    note: 'Wie viele Plätze nebeneinander frei sind, entscheidet das offizielle System im jeweiligen Moment.',
    cta: 'PLÄTZE ZUSAMMEN FINDEN',
  },
  travel: {
    heading: 'Anreise',
    dateLabel: 'Datum',
    date: 'Samstag, 28. November 2026',
    addressLabel: 'Adresse',
    transportLabel: 'Öffentlicher Nahverkehr',
    transport: 'Mit der U78 ab Hauptbahnhof bis „Merkur Spiel-Arena/Messe Nord“ (ca. 15–20 Min.), danach rund 8 Minuten zu Fuß.',
    directions: 'Route in Google Maps',
    transit: 'Fahrplan der Rheinbahn',
    timeNote: 'Genaue Beginnzeit: laut Ticket und offizieller Ankündigung.',
  },
  faq: {
    heading: 'Häufige Fragen',
    items: [
      {
        q: 'Sind das Tickets für die Seite von Nelson Hysa?',
        a: 'Die Buttons auf dieser Seite führen in den offiziellen Ticketkanal von Nelson Hysa im Ticketsystem der Veranstaltung. Block und Platz siehst du im offiziellen Saalplan, bevor du bezahlst.',
      },
      {
        q: 'Wo bezahle ich?',
        a: 'Ausschließlich im offiziellen Ticketsystem der Veranstaltung. AlbaGo nimmt keine Zahlungen an und sieht keine Kartendaten.',
      },
      {
        q: 'Ist AlbaGo der Veranstalter?',
        a: 'Nein. AlbaGo ist eine Plattform für albanische Events und hilft Team-Hysa-Fans, ihre Tickets zu finden. Veranstalter sind die Promoter; die Tickets stellt das offizielle Ticketsystem aus.',
      },
      {
        q: 'Kann ich mehrere Plätze zusammen kaufen?',
        a: 'Ja, wenn nebeneinander noch Plätze frei sind. Du wählst sie direkt im offiziellen Saalplan; die Verfügbarkeit bestimmt das offizielle System.',
      },
      {
        q: 'Wann bekomme ich meine E-Tickets?',
        a: 'Zeitpunkt und Art der Zustellung legt der offizielle Verkäufer fest. Du findest sie in der Bestellbestätigung und in den Bedingungen des Verkäufers.',
      },
      {
        q: 'Kann ich aus Albanien, dem Kosovo oder der Schweiz kaufen?',
        a: 'Der Kauf läuft online. Zahlungsarten und Bedingungen für Käufer außerhalb Deutschlands legt der offizielle Verkäufer fest — bitte vor dem Bezahlen prüfen.',
      },
      {
        q: 'Was passiert, wenn eine Kategorie ausverkauft ist?',
        a: 'Das offizielle System zeigt sie dann nicht mehr als verfügbar an. Probier eine andere Kategorie im offiziellen Saalplan oder schau später noch einmal.',
      },
    ],
  },
  disclaimer:
    'AlbaGo ist nicht der Veranstalter des Kampfes. Kauf und Ausstellung der Tickets erfolgen über das offizielle Ticketsystem der Veranstaltung.',
  sticky: '🎟️ TICKETS ANSEHEN',
  switchLabel: 'Sprache',
}

const en: HysaCopy = {
  meta: {
    title: 'Nelson Hysa vs Agit Kabayel — Team Hysa tickets · 28 November, Düsseldorf',
    description:
      'Nelson Hysa challenges Agit Kabayel for the WBC heavyweight world title on 28 November 2026 at the Merkur Spiel-Arena, Düsseldorf. Find the Team Hysa sections and go straight to the official ticket shop.',
    ogAlt: 'Nelson Hysa vs Agit Kabayel — 28 November 2026, Düsseldorf',
  },
  langName: 'English',
  nav: { back: 'AlbaGo' },
  hero: {
    kicker: 'ALBANIA ON THE BIG STAGE 🇦🇱',
    vs: 'VS',
    title: 'WBC Heavyweight World Championship',
    dateLine: '28 November 2026',
    cta: 'CHOOSE YOUR TICKET',
    ctaSecondary: 'SEE THE TEAM HYSA SECTIONS',
    countdownLabel: 'Until fight night',
    units: { d: 'days', h: 'hrs', m: 'min', s: 'sec' },
    fightDay: 'Tonight is fight night 🇦🇱',
  },
  trust: [
    'Purchase in the official ticket shop',
    'Nelson Hysa ticket channel',
    'AlbaGo never sees or takes your payment',
  ],
  support: {
    heading: 'Düsseldorf turns red and black 🇦🇱',
    body: 'On 28 November, Nelson Hysa challenges Agit Kabayel for the WBC world title. Pick your seat in the Team Hysa sections and be part of the night.',
    chips: {
      flag: '🇦🇱 Albanian supporters',
      title: '🥊 World heavyweight title',
      date: '📅 28 November',
      place: '📍 Düsseldorf',
    },
  },
  tickets: {
    eyebrow: 'TICKETS',
    heading: 'Find your ticket',
    intro: 'The categories of the Team Hysa ticket channel. Prices and free seats are shown live in the official shop.',
    availabilityChecking: 'Checking availability…',
    availabilityOfficial: 'Availability is checked in the official ticket shop',
    availabilityFailed: 'Live availability can’t be loaded right now.',
    checkOfficial: 'CHECK THE OFFICIAL SHOP',
    liveLabel: 'LIVE',
    updated: 'Updated',
    stale: 'not current',
    price: 'Price',
    priceOfficial: 'In the official shop',
    priceCheckedAt: 'checked on',
    area: 'Location',
    bestFor: 'Best for',
    cta: 'CHOOSE SEATS',
    purchaseNote: 'Final tickets are bought through the event’s official ticketing system.',
    status: { available: 'Available', limited: 'Limited', sold_out: 'Sold out', unknown: 'Check officially' },
    categories: {
      cat8: {
        badge: 'BUDGET OPTION',
        position: 'North stand, upper tier',
        bestFor: 'For fans who want to be part of the atmosphere at a lower price.',
      },
      cat6: {
        badge: 'RECOMMENDED',
        position: 'North stand, lower tier',
        bestFor: 'A good balance between closeness to the ring and price.',
      },
      cat4: {
        badge: 'CLOSEST TO THE RING',
        position: 'Floor, around the ring',
        bestFor: 'For those who want to be as close to the action as possible.',
      },
    },
  },
  map: {
    eyebrow: 'SEATING',
    heading: 'The Team Hysa sections 🇦🇱',
    body: 'The Hysa-channel tickets we verified are in the Nord-Tribüne (north stand) and on the floor. The exact free seats are on the official live seat map.',
    cta: 'OPEN THE LIVE SEAT MAP',
    legendLower: 'North stand · lower tier',
    legendUpper: 'North stand · upper tier',
    legendFloor: 'Floor (Innenraum) · around the ring',
    caption: 'AlbaGo orientation map — not the official seating plan.',
    standNote: 'Live map, seats and final prices: the official ticket shop.',
  },
  why: {
    heading: 'ONE NIGHT. ONE TITLE. ONE NATION BEHIND HIM.',
    body: 'Nelson Hysa enters the biggest fight of his professional career — unbeaten, against the unbeaten champion, on Albanian Independence Day.',
    record: 'Record',
    ko: 'knockouts',
    countries: { albania: 'Albania', germany: 'Germany' },
    roles: { challenger: 'Challenger · heavyweight', champion: 'WBC heavyweight champion' },
    vs: 'VS',
    sourcesNote: 'Records from public sources, checked 10 Oct 2026.',
  },
  fans: {
    heading: 'Bring the flag 🇦🇱',
    body: 'Red and black from the stands to the ring. Let all of Düsseldorf hear it.',
    bring: ['🇦🇱 The red-and-black flag', '🔴⚫ Red and black', '📣 Your voice for Nelson'],
    share: 'SHARE WITH FRIENDS',
    shareText: '🇦🇱 Nelson Hysa fights for the WBC world title on 28 November in Düsseldorf. Team Hysa tickets here:',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    copy: 'Copy link',
    copied: 'Copied ✓',
  },
  group: {
    heading: 'Coming as a group?',
    body: 'On the official seat map you can pick several seats next to each other.',
    sizes: ['2 tickets', '4 tickets', '6+ tickets'],
    note: 'How many seats are free together is decided by the official system at that moment.',
    cta: 'FIND SEATS TOGETHER',
  },
  travel: {
    heading: 'Getting there',
    dateLabel: 'Date',
    date: 'Saturday, 28 November 2026',
    addressLabel: 'Address',
    transportLabel: 'Public transport',
    transport: 'Take the U78 from Düsseldorf Hauptbahnhof to “Merkur Spiel-Arena/Messe Nord” (about 15–20 min), then walk about 8 minutes.',
    directions: 'Directions in Google Maps',
    transit: 'Rheinbahn timetable',
    timeNote: 'Exact start time: as on your ticket and the official announcement.',
  },
  faq: {
    heading: 'FAQ',
    items: [
      {
        q: 'Are these tickets for Nelson Hysa’s side?',
        a: 'The buttons on this page take you to Nelson Hysa’s official ticket channel in the event’s ticketing system. You see the exact section and seat on the official seat map before paying.',
      },
      {
        q: 'Where do I pay?',
        a: 'Only in the event’s official ticketing system. AlbaGo doesn’t take payments and never sees your card details.',
      },
      {
        q: 'Is AlbaGo the organiser of the fight?',
        a: 'No. AlbaGo is a platform for Albanian events and helps Team Hysa supporters find tickets. The fight is organised by the promoters; tickets are issued by the official ticketing system.',
      },
      {
        q: 'Can I buy several seats together?',
        a: 'Yes, if seats next to each other are still free. You pick them directly on the official seat map; availability is decided by the official system.',
      },
      {
        q: 'When will I get my e-tickets?',
        a: 'Timing and delivery are set by the official seller. You’ll find them in your order confirmation and the seller’s terms.',
      },
      {
        q: 'Can I buy from Albania, Kosovo or Switzerland?',
        a: 'Buying happens online. Payment methods and conditions for buyers outside Germany are set by the official seller — please check them before paying.',
      },
      {
        q: 'What happens if a category sells out?',
        a: 'The official system no longer shows it as available. Try another category on the official seat map, or check again later.',
      },
    ],
  },
  disclaimer:
    'AlbaGo is not the organiser of the fight. Ticket purchase and issuing are handled by the event’s official ticketing system.',
  sticky: '🎟️ SEE TICKETS',
  switchLabel: 'Language',
}

export const HYSA_COPY: Record<HysaLang, HysaCopy> = { sq, de, en }

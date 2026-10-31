export interface ExampleMessage {
  id: string;
  title: string;
  text: string;
}

/** Fictional messages for the demo. Not real customers. */
export const EXAMPLE_MESSAGES: ExampleMessage[] = [
  {
    id: "cv",
    title: "CV-ketel",
    text: "Klant Jansen in Hulst wil een nieuwe cv-ketel, ophangen en oude afvoeren, graag offerte",
  },
  {
    id: "whatsapp",
    title: "WhatsApp lekkage",
    text: [
      "Hoi, met Pieter de Vries uit Goes.",
      "Kunnen jullie volgende week dinsdag langskomen?",
      "De keukenkraan lekt en de afvoer onder de spoelbak is verstopt.",
      "Groet, Pieter",
      "06-00000000",
    ].join("\n"),
  },
  {
    id: "stopcontact",
    title: "Stopcontacten",
    text: "Mevrouw De Test in Terneuzen wil 3 stopcontacten bijplaatsen in de woonkamer, graag prijsopgave voor vrijdag 12 juni.",
  },
  {
    id: "prijs",
    title: "Bedrag in het bericht",
    text: "Klant Jansen in Hulst wil een kraan vervangen. Reken maar op ongeveer 150 euro.",
  },
];

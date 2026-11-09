import type { HandKey, IconKey, InkKey, Item, PaperKey, Project, Row, TemplateKey } from '../types';

let counter = 0;
export const newId = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** An item without its id (Omit that works on each kind of item separately). */
type ItemSpec = Item extends infer T ? (T extends Item ? Omit<T, 'id'> : never) : never;

export interface Template {
  label: string;
  blurb: string;
  icon: IconKey;
  paper: PaperKey;
  hand: HandKey;
  ink: InkKey;
  items: ItemSpec[];
  /** Example list, so the template can be tried right away. */
  rows: Record<string, string>[];
  copies: number;
}

const WEDDING_GUESTS: [string, string][] = [
  ['Anna Keller', '1'],
  ['Luca Brunner', '1'],
  ['Marianne Keller', '1'],
  ['Peter Keller', '1'],
  ['Sofia Brunner', '1'],
  ['Elias Brunner', '1'],
  ['Lea Fischer', '2'],
  ['Noah Weber', '2'],
  ['Mia Schmid', '2'],
  ['Jonas Meier', '2'],
  ['Laura Huber', '2'],
  ['David Frei', '2'],
  ['Nina Graf', '3'],
  ['Simon Baumann', '3'],
  ['Sara Wyss', '3'],
  ['Tim Zimmermann', '3'],
  ['Julia Steiner', '3'],
  ['Marco Bösch', '3'],
  ['Elena Moser', '4'],
  ['Fabian Kunz', '4'],
  ['Chiara Rossi', '4'],
  ['Reto Ammann', '4'],
  ['Selina Egli', '4'],
  ['Urs Lehmann', '4'],
];

const BOOTH_VISITORS: [string, string][] = [
  ['Martina', 'Rheintal Bau AG'],
  ['Jan', 'Appenzeller Druck'],
  ['Céline', 'Bodensee Logistik'],
  ['Thomas', 'Säntis Software'],
  ['Aylin', 'GBS St.Gallen'],
  ['Kevin', 'Thurgauer Kantonalbank'],
];

const GRADUATES: [string, string, string, string][] = [
  ['Lina', 'Lina Hofer', 'Rorschacherstrasse 12', '9000 St. Gallen'],
  ['Matteo', 'Matteo Bernasconi', 'Bahnhofstrasse 4', '9240 Uzwil'],
  ['Alina', 'Alina Gerber', 'Dorfstrasse 21', '9500 Wil'],
  ['Luis', 'Luis Oertle', 'Kirchgasse 7', '9200 Gossau'],
  ['Emma', 'Emma Signer', 'Seestrasse 33', '8590 Romanshorn'],
  ['Nico', 'Nico Kälin', 'Hauptstrasse 2', '9100 Herisau'],
  ['Lara', 'Lara Wüst', 'Feldweg 9', '9300 Wittenbach'],
  ['Yannick', 'Yannick Ruch', 'Lindenstrasse 15', '9400 Rorschach'],
  ['Jana', 'Jana Koller', 'Gartenweg 3', '9230 Flawil'],
  ['Robin', 'Robin Dörig', 'Schulstrasse 18', '9050 Appenzell'],
  ['Zoe', 'Zoe Hasler', 'Rosenweg 6', '9443 Widnau'],
  ['Ben', 'Ben Lutz', 'Bergstrasse 27', '9630 Wattwil'],
];

export const TEMPLATES: Record<TemplateKey, Template> = {
  place: {
    label: 'Place cards',
    blurb: 'A name and a table number for every guest.',
    icon: 'leaf',
    paper: 'place',
    hand: 'jamie',
    ink: 'charcoal',
    items: [
      { kind: 'icon', icon: 'leaf', x: 45, y: 4, w: 10, h: 10 },
      { kind: 'text', text: '{name}', size: 10, align: 'center', x: 6, y: 15, w: 88, h: 16 },
      { kind: 'text', text: 'Table {table}', size: 5, align: 'center', x: 6, y: 35, w: 88, h: 9 },
    ],
    rows: WEDDING_GUESTS.map(([name, table]) => ({ name, table })),
    copies: 1,
  },
  badge: {
    label: 'Name badges',
    blurb: 'Write badges live at your booth while people wait.',
    icon: 'smile',
    paper: 'badge',
    hand: 'noah',
    ink: 'blue',
    items: [
      { kind: 'text', text: 'Hello, my name is', size: 4.6, align: 'left', x: 6, y: 5, w: 74, h: 8 },
      { kind: 'text', text: '{name}', size: 12, align: 'left', x: 6, y: 15, w: 74, h: 18 },
      { kind: 'text', text: '{company}', size: 4.8, align: 'left', x: 6, y: 38, w: 74, h: 9 },
    ],
    rows: BOOTH_VISITORS.map(([name, company]) => ({ name, company })),
    copies: 1,
  },
  thanks: {
    label: 'Thank-you cards',
    blurb: 'A personal greeting with the first name, the rest stays the same.',
    icon: 'flower',
    paper: 'a6',
    hand: 'jamie',
    ink: 'blue',
    items: [
      { kind: 'icon', icon: 'flower', x: 42.5, y: 12, w: 20, h: 20 },
      { kind: 'text', text: 'Dear {first_name},', size: 7, align: 'left', x: 12, y: 40, w: 81, h: 11 },
      {
        kind: 'text',
        text: 'Congratulations on your final exams! Thank you for three great years with us. We wish you all the best for what comes next.',
        size: 6.4,
        align: 'left',
        x: 12,
        y: 53,
        w: 81,
        h: 54,
      },
      { kind: 'text', text: 'Warm regards,\nyour training team', size: 6.4, align: 'left', x: 12, y: 110, w: 81, h: 22 },
    ],
    rows: GRADUATES.map(([first_name]) => ({ first_name })),
    copies: 1,
  },
  envelope: {
    label: 'Envelopes',
    blurb: 'Addresses written by hand, ready for the post.',
    icon: 'star',
    paper: 'c6',
    hand: 'jamie',
    ink: 'charcoal',
    items: [{ kind: 'text', text: '{name}\n{street}\n{city}', size: 7, align: 'left', x: 72, y: 56, w: 82, h: 40 }],
    rows: GRADUATES.map(([, name, street, city]) => ({ name, street, city })),
    copies: 1,
  },
  menu: {
    label: 'Menu card',
    blurb: 'The same card for every table, no list needed.',
    icon: 'sparkle',
    paper: 'dl',
    hand: 'lea',
    ink: 'sepia',
    items: [
      { kind: 'icon', icon: 'sparkle', x: 42, y: 14, w: 15, h: 15 },
      { kind: 'text', text: 'Menu', size: 12, align: 'center', x: 10, y: 34, w: 79, h: 16 },
      {
        kind: 'text',
        text: 'Pumpkin soup with roasted seeds\n\nBraised beef, polenta and autumn vegetables\n\nApple tart with vanilla cream',
        size: 6.2,
        align: 'center',
        x: 10,
        y: 60,
        w: 79,
        h: 100,
      },
      { kind: 'text', text: 'Enjoy your meal!', size: 6.2, align: 'center', x: 10, y: 178, w: 79, h: 12 },
    ],
    rows: [],
    copies: 30,
  },
  blank: {
    label: 'Blank card',
    blurb: 'Start with an empty A6 card.',
    icon: 'heart',
    paper: 'a6',
    hand: 'jamie',
    ink: 'charcoal',
    items: [{ kind: 'text', text: 'Your text here', size: 7, align: 'left', x: 12, y: 14, w: 81, h: 20 }],
    rows: [],
    copies: 1,
  },
};

export const TEMPLATE_ORDER: TemplateKey[] = ['place', 'badge', 'thanks', 'envelope', 'menu', 'blank'];

export function rowsFrom(list: Record<string, string>[]): Row[] {
  return list.map((cells) => ({ id: newId('row'), cells: { ...cells }, status: 'todo' }));
}

export function projectFrom(template: TemplateKey, name: string, withExamples = true): Project {
  const t = TEMPLATES[template];
  return {
    id: newId('p'),
    name,
    template,
    paper: t.paper,
    items: t.items.map((it) => ({ ...it, id: newId('item') }) as Item),
    hand: t.hand,
    ink: t.ink,
    rows: withExamples ? rowsFrom(t.rows) : [],
    copies: t.copies,
    copiesDone: 0,
    updated: Date.now(),
  };
}

const HOUR = 60 * 60 * 1000;

/** The projects the app starts with. */
export function sampleProjects(): Project[] {
  const wedding = projectFrom('place', 'Wedding Anna & Luca');
  wedding.updated = Date.now() - 0.5 * HOUR;

  const booth = projectFrom('badge', 'Swiss Skills booth');
  booth.rows.forEach((r) => (r.status = 'done'));
  booth.updated = Date.now() - 26 * HOUR;

  const thanks = projectFrom('thanks', 'Graduation thank-you cards');
  thanks.rows.slice(0, 5).forEach((r) => (r.status = 'done'));
  thanks.updated = Date.now() - 3 * 24 * HOUR;

  return [wedding, thanks, booth];
}

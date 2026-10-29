/**
 * Editorial interpretations, not assertions about the author.
 * Slots are stable: atmosphere and detail-crop CSS use data-piece/data-detail-piece.
 * Append new artworks; do not reorder this registry when publication order changes.
 */
export const artworks = [
  {
    slug: 'meditations',
    passages: [
      'Another layer, another issue, another knot.',
      'We often live at the level of abstractions, of flattering ideas about ourselves, and not at the level of direct observation. Meditation starts breaking that illusion.',
    ],
    title: 'What remains unsettled',
    note: 'One ribbon gathers into a dense crossing and an open loop. The second passage draws light toward the opening, without undoing the knot. A reading of repeated observation and what remains unresolved.',
    imageTitle: 'A crossing remains',
    imageDescription: 'An ivory paper ribbon gathers into a dense indigo crossing and opens into a quiet loop. The loose ends remain part of the knot.',
    light: [[220, 290, 180], [448, 180, 200]],
  },
  {
    slug: 'war',
    passages: [
      'The protagonist and the antagonist swap masks.',
      'I still hope that someday a protagonist will arise to end the civil war by gathering what is fractured into something whole.',
    ],
    title: 'One mind, two masks',
    note: 'Two incomplete masks emerge from the same folded material. The second passage brings their shared seam into light. A reading of shifting roles and the hope of gathering what is fractured; neither face is assigned innocence.',
    imageTitle: 'Two roles, one material',
    imageDescription: 'Two incomplete ivory masks emerge from one buckled sheet, facing away from each other. One face breaks into unpressed paper; an unresolved seam joins their material.',
    light: [[236, 220, 175], [344, 260, 125]],
  },
  {
    slug: 'abstractions-of-illusion',
    passages: [
      'Even the thought “I see the layers” can become another layer of illusion if I hold on to it.',
      'we experience ourselves as the chooser, yet the chooser is shaped by the very pattern it thinks it is choosing from.',
    ],
    title: 'Inside the seeing',
    note: 'The observer is suggested by the cut edge of the nearest veil. Light passes through unequal openings toward further layers, without offering a position outside them. A reading of the essay’s caution that seeing can itself become another layer.',
    imageTitle: 'The observer within the veil',
    imageDescription: 'Unequal translucent sheets turn through space. Openings expose further layers; a faint human profile is formed by the cut edge of the nearest veil.',
    light: [[170, 280, 175], [434, 176, 200]],
  },
  {
    slug: 'i-am',
    passages: [
      'I am boundless and yet I belong',
      'I am a magnificent moth of devotion to the absolute',
    ],
    title: 'Beyond the outline',
    note: 'The moth, lily and snow come from the poem; their arrangement is imagined. Light moves from the rooted flower toward the fragile wings. A reading of devotion, and belonging without enclosure.',
    imageTitle: 'A moth above the snow',
    imageDescription: 'An asymmetrical moth lifts above a bowed lily and a small patch of snow. Fine veins and translucent paper membranes catch the light.',
    light: [[255, 345, 180], [390, 175, 230]],
  },
] as const;

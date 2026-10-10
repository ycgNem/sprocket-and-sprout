// Sable's archive (ROADMAP.md 7.6, Phase 5): the old works' records. Sable files each discovery you
// tell them about (Trust, once each) and lends the record of a works chamber you saw before its
// keystone's quest asked (DECISIONS #94/#98 made you go back down for the look). src/sim/people.ts
// runs both.
import type { ChamberKind } from './deepworks';

export interface DiscoveryDef {
  /** `filed:<id>` once Sable has it */
  id: string;
  /** any of these flags makes it a discovery to tell (a look, a chamber's card, a keystone done) */
  flags: string[];
  /** Sable, filing it */
  line: string;
}

/** in the order Sable files them, one a talk */
export const DISCOVERIES: DiscoveryDef[] = [
  { id: 'belt_1', flags: ['observed:belt_1'], line: "You've looked over the keeper's belt run? I'll file it with the keeper's notes. They drew that run eleven times, you know." },
  { id: 'waterwheel', flags: ['observed:waterwheel'], line: "The keeper's water wheel by the farm gate. Filed, beside its drawings. 'Forty sparks on a good day,' the keeper wrote. Underlined." },
  { id: 'town_mill', flags: ['observed:town_mill'], line: "You've had a proper look at the Town Mill. Elsbeth Oakroot's wheel. I've filed your look beside her drawings." },
  { id: 'lift', flags: ['card:lift', 'observed:lift'], line: 'The old lift on level five! The archive has its counterweight sums. I\'ve filed that you found it, with the date.' },
  { id: 'boiler', flags: ['card:boiler', 'observed:boiler'], line: "The seized boiler on level ten. Thorne's boiler. I've filed it next to the last entry in the daybook." },
  { id: 'pump', flags: ['card:pump', 'observed:pump'], line: 'The old pump on level fifteen. A beam engine, the records say. Filed, with a note in the margin: it could run again.' },
  { id: 'lampworks', flags: ['card:lampworks', 'observed:lampworks'], line: "The lamp works on level twenty. Sparks sealed in glass. I've filed it under 'Lamplighting, the hard part.'" },
  { id: 'lockers', flags: ['card:lockers', 'observed:lockers'], line: "The engineers' lockers on level twenty-five, still legible? I've filed that you found them. Thorne's was the third locker, I think." },
  { id: 'cart', flags: ['card:cart', 'observed:cart'], line: "The rail cart on level twenty-five. The Tram's own cart. Filed. Thorne will want to hear it's still there." },
  { id: 'airship', flags: ['observed:airship'], line: "Roxy's airship, looked over properly? A machine that flies. The archive had nothing like it. It has now. Filed." },
  { id: 'star', flags: ['card:star', 'observed:star'], line: "The fallen star on level thirty. The archive's oldest record mentions it in one line, with a question mark. I've rubbed out the question mark." },
  { id: 'k_mill', flags: ['town_mill'], line: "The Town Mill turns! I've opened a new daybook for it. The first entry in thirty years: 'Wheel turning, stones grinding.'" },
  { id: 'k_waterworks', flags: ['waterworks'], line: "The Waterworks run. Filed: 'Pumps restarted, fountain playing.' I wrote it twice. Once for the archive and once for me." },
  { id: 'k_lamps', flags: ['lamps_hung'], line: "The square lit on your power! I've filed it with the old works' drawing of the same square. They match. I checked twice." },
  { id: 'k_tram', flags: ['tram'], line: "The Tram runs. I've filed the timetable. It's the old one. Six sharp, every morning." },
  { id: 'k_clock', flags: ['clock_fixed'], line: 'The clock! I\'ve filed the moment it started under the last entry in the old daybook. Thirty years of blank pages, and then your name.' },
];

export interface RecordDef {
  /** the works chamber it describes (its keystone is the chamber's `teaches`) */
  kind: ChamberKind;
  /** Sable, offering it */
  offer: string;
}

/** the records Sable lends: one per chamber whose look a keystone's main quest asks for */
export const RECORDS: RecordDef[] = [
  { kind: 'boiler', offer: "You've stood in front of the seized boiler on level ten, haven't you? Before Steam Power asked. The archive has the old works' record of it: Thorne's own readings, every shift it ran. Borrow it, and you needn't climb back down." },
  { kind: 'lampworks', offer: "The lamp works on level twenty. You saw it before Spark Coils asked. I have its record: the glassblowers' notes and the dynamo's sums. Borrow it, and you needn't go back through the firedamp." },
  { kind: 'lockers', offer: "The engineers' lockers on level twenty-five. You've been. I have the copies they filed up here: every blueprint, every escapement. Borrow them, and you needn't go down in the dark again." },
  { kind: 'star', offer: "The fallen star on level thirty. You've stood before it. The archive's oldest record describes it in one careful line. Borrow it, and you needn't go all the way down again." },
];

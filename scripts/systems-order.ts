// Prints the sim systems in tick order (the order they register: first import wins).
import '../src/sim';
import { SYSTEMS } from '../src/sim/Game';
console.log(SYSTEMS.map((s) => s.name).join(' '));

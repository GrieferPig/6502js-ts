import { Emu6502 } from "./Emu6502";
import { Memory } from "./memory";

import fs from "fs";

let memory = new Memory(0xffff, 0x0);
let cpu = new Emu6502(memory);

// read rom file and load into 0x600 and up
let rom = fs.readFileSync("rom.bin");
for (let i = 0; i < rom.length; i++) {
    memory.memArray[0x600 + i] = rom[i];
}

cpu.reset();
printMemRegion(0x600, 0x60f);

while (true) {
    cpu.execute();
    console.log(`PC: 0x${cpu.regPC.toString(16)} A: 0x${cpu.regA.toString(16)} X: 0x${cpu.regX.toString(16)} Y: 0x${cpu.regY.toString(16)} SP: 0x${cpu.regSP.toString(16)}`);
}

function printMemRegion(start: number, end: number) {
    for (let i = start; i < end; i++) {
        console.log(`0x${i.toString(16)}: ${memory.get(i).toString(16).padStart(2, '0')}`);
    }
}
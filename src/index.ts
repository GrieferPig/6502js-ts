import { Emu6502 } from "./emu6502";
import { Memory } from "./memory";

import fs from "fs";
import { code2asm, message } from "./utils";
import { Assembler } from "./asm";

let memory = new Memory(0xffff, 0x0);
let cpu = new Emu6502(memory, 0xfffc); // start at reset vector

let assembler = new Assembler(memory);
let code = fs.readFileSync("rom.asm").toString();
assembler.assembleCode(code, 0x600);
// console.log(assembler.assembledCode);

memory.memArray[0xfffc] = 0x00; // reset vector
memory.memArray[0xfffd] = 0x06; // reset vector

cpu.reset();
printMemRegion(0x600, 0x60f);

let cycleCount = 0;

function execCycle() {
    let asm = assembler.assembledCode[cpu.regPC];
    message(`PC: ${cpu.regPC.toString(16).padStart(4, "0")} A: ${cpu.regA.toString(16).padStart(2, "0")} X: ${cpu.regX.toString(16).padStart(2, "0")} Y: ${cpu.regY.toString(16).padStart(2, "0")} SP: ${cpu.regSP.toString(16).padStart(2, "0")} ${asm.lineno.toString().padStart(4)} @ ${asm.code}`, `Cycle ${cycleCount.toString().padStart(4, "0")}`);
    cycleCount++;
    cpu.execute();
}

try {
    while (true) {
        execCycle();
    }
} catch (e) {
    message(`Program stopped (${e})`, "Main");
    printMemRegion(0x200, 0x2ff);
}

function printMemRegion(start: number, end: number) {
    message(`Memory dump from ${start.toString(16).padStart(4, "0")} to ${end.toString(16).padStart(4, "0")}`, "printMemRegion()");
    message("ADDR  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f");
    message("-----------------------------------------------------");
    for (let i = 0; i < Math.ceil((end - start) / 16); i++) {
        let lineAddr = (start + i * 16).toString(16).padStart(4, "0");
        let catStr = lineAddr + "| ";
        for (let j = 0; j < 16; j++) {
            catStr += memory.memArray[start + i * 16 + j].toString(16).padStart(2, "0") + " ";
        }
        message(catStr);
    }
    message("-----------------------------------------------------");
}
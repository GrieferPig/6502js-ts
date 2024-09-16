import { Emu6502 } from "./emu6502";
import { Memory } from "./memory";

function addr2hex(addr: number) {
    return num2hex((addr >> 8) & 0xff) + num2hex(addr & 0xff);
}

function num2hex(nr: number) {
    var str = "0123456789abcdef";
    var hi = ((nr & 0xf0) >> 4);
    var lo = (nr & 15);
    return str.substring(hi, hi + 1) + str.substring(lo, lo + 1);
}

function message(text: string, label?: string) {
    if (label) {
        console.log(label + ": " + text);
    } else {
        console.log(text);
    }
}

let trimAsm: string[] = [];
function trimAsm2Array(code: string) {
    let lines = code.split("\n");
    trimAsm = [];
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].includes(":")) {
            trimAsm.push(lines[i]);
        }
    }
}

function code2asm(code: string, cpu: Emu6502, mem: Memory): string {
    let relativePC = cpu.regPC - mem.getWord(0xfffc);
    if (trimAsm.length === 0) {
        trimAsm2Array(code);
    }
    return trimAsm[relativePC];
}

export { addr2hex, num2hex, message, code2asm };
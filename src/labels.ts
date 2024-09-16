import { message } from "./utils";
import { Assembler } from "./asm";

export class Labels {
    private assembler: Assembler;
    private labelIndex: string[] = [];

    constructor(assembler: Assembler) {
        this.assembler = assembler;
    }

    public indexLines(lines: string | any[]) {
        for (var i = 0; i < lines.length; i++) {
            if (!this.indexLine(lines[i])) {
                message("**Label already defined at line " + (i + 1) + ":** " + lines[i]);
                return false;
            }
        }
        return true;
    }

    // indexLine(line) - extract label if line contains one and calculate position in memory.
    // Return false if label alread exists.
    private indexLine(input: string) {
        // remove comments
        input = input.replace(/^(.*?);.*/, "$1");

        // trim line
        input = input.replace(/^\s+/, "");
        input = input.replace(/\s+$/, "");

        // Figure out how many bytes this instruction takes
        var currentPC = this.assembler.getCurrentPC();
        this.assembler.assembleLine(input); //TODO: find a better way for Labels to have access to assembler

        // Find command or label
        if (input.match(/^\w+:/)) {
            var label = input.replace(/(^\w+):.*$/, "$1");
            return this.push(label + "|" + currentPC);
        }
        return true;
    }

    // push() - Push label to array. Return false if label already exists.
    private push(name: string) {
        if (this.find(name)) {
            return false;
        }
        this.labelIndex.push(name + "|");
        return true;
    }

    // find() - Returns true if label exists.
    public find(name: any) {
        var nameAndAddr;
        for (var i = 0; i < this.labelIndex.length; i++) {
            nameAndAddr = this.labelIndex[i].split("|");
            if (name === nameAndAddr[0]) {
                return true;
            }
        }
        return false;
    }

    // setPC() - Associates label with address
    private setPC(name: string, addr: string) {
        var nameAndAddr;
        for (var i = 0; i < this.labelIndex.length; i++) {
            nameAndAddr = this.labelIndex[i].split("|");
            if (name === nameAndAddr[0]) {
                this.labelIndex[i] = name + "|" + addr;
                return true;
            }
        }
        return false;
    }

    // getPC() - Get address associated with label
    public getPC(name: any): number {
        var nameAndAddr;
        for (var i = 0; i < this.labelIndex.length; i++) {
            nameAndAddr = this.labelIndex[i].split("|");
            if (name === nameAndAddr[0]) {
                return (parseInt(nameAndAddr[1]));
            }
        }
        return -1;
    }

    public displayMessage() {
        var str = "Found " + this.labelIndex.length + " label";
        if (this.labelIndex.length !== 1) {
            str += "s";
        }
        message(str + ".");
    }

    public reset() {
        this.labelIndex = [];
    }

}
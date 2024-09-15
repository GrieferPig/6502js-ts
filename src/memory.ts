export class Memory {
    public memArray: number[];
    private startAddr: number;

    constructor(size: number, startAddr: number) {
        this.memArray = new Array(size);
        this.startAddr = startAddr;
        this.memArray.fill(0);
    }

    // check and return adjusted addr
    private checkAddr(addr: number): number {
        if (addr < this.startAddr && (addr - this.startAddr) >= this.memArray.length) {
            throw new Error("Memory address out of range: " + addr);
        }
        return addr - this.startAddr;
    }

    public set(addr: number, val: number) {
        addr = this.checkAddr(addr);
        return this.memArray[addr] = val;
    }

    public get(addr: number) {
        addr = this.checkAddr(addr);
        return this.memArray[addr];
    }

    public getWord(addr: number) {
        addr = this.checkAddr(addr);
        return this.get(addr) + (this.get(addr + 1) << 8);
    }

    // storeByte() - Poke a byte, don't touch any registers

    public storeByte(addr: number, value: number) {
        addr = this.checkAddr(addr);
        this.set(addr, value & 0xff);
        if ((addr >= 0x200) && (addr <= 0x5ff)) {
            // TODO: Update screen
        }
    }

    // storeKeypress() - Store keycode in ZP $ff
    // TODO: link to keyboard callback, impl using circular buf
    // public keyDown(e: KeyboardEvent) {
    //     // convert key to ascii
    //     var key = e.key.charCodeAt(0);
    //     console.log("Key down: " + key);
    //     this.storeByte(0xff, key);
    // }
}
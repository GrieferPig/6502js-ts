import { Memory } from "./memory";
import { message, addr2hex, num2hex } from "./utils";

interface Instructions { [index: string]: () => void; }


export class Emu6502 {
    public regA = 0;
    public regX = 0;
    public regY = 0;
    public regP = 0;
    public regPC = 0x600;
    public regSP = 0xff;

    private memory: Memory;
    private resetVec: number;

    constructor(memory: Memory, resetVec: number) {
        this.memory = memory;
        this.resetVec = resetVec;
    }

    //set zero and negative processor flags based on result
    private setNVflags(value: number) {
        if (value) {
            this.regP &= 0xfd;
        } else {
            this.regP |= 0x02;
        }
        if (value & 0x80) {
            this.regP |= 0x80;
        } else {
            this.regP &= 0x7f;
        }
    }

    private setCarryFlagFromBit0(value: number) {
        this.regP = (this.regP & 0xfe) | (value & 1);
    }

    private setCarryFlagFromBit7(value: number) {
        this.regP = (this.regP & 0xfe) | ((value >> 7) & 1);
    }

    private setNVflagsForRegA() {
        this.setNVflags(this.regA);
    }

    private setNVflagsForRegX() {
        this.setNVflags(this.regX);
    }

    private setNVflagsForRegY() {
        this.setNVflags(this.regY);
    }

    private ORA = this.setNVflagsForRegA;
    private AND = this.setNVflagsForRegA;
    private EOR = this.setNVflagsForRegA;
    private ASL = this.setNVflags;
    private LSR = this.setNVflags;
    private ROL = this.setNVflags;
    private ROR = this.setNVflags;
    private LDA = this.setNVflagsForRegA;
    private LDX = this.setNVflagsForRegX;
    private LDY = this.setNVflagsForRegY;

    private BIT(value: number) {
        if (value & 0x80) {
            this.regP |= 0x80;
        } else {
            this.regP &= 0x7f;
        }
        if (value & 0x40) {
            this.regP |= 0x40;
        } else {
            this.regP &= ~0x40;
        }
        if (this.regA & value) {
            this.regP &= 0xfd;
        } else {
            this.regP |= 0x02;
        }
    }

    private CLC() {
        this.regP &= 0xfe;
    }

    private SEC() {
        this.regP |= 1;
    }


    private CLV() {
        this.regP &= 0xbf;
    }

    private setOverflow() {
        this.regP |= 0x40;
    }

    private DEC(addr: any) {
        var value = this.memory.get(addr);
        value--;
        value &= 0xff;
        this.memory.storeByte(addr, value);
        this.setNVflags(value);
    }

    private INC(addr: any) {
        var value = this.memory.get(addr);
        value++;
        value &= 0xff;
        this.memory.storeByte(addr, value);
        this.setNVflags(value);
    }

    private jumpBranch(offset: number) {
        if (offset > 0x7f) {
            this.regPC = (this.regPC - (0x100 - offset));
        } else {
            this.regPC = (this.regPC + offset);
        }
    }

    private overflowSet() {
        return this.regP & 0x40;
    }

    private decimalMode() {
        return this.regP & 8;
    }

    private carrySet() {
        return this.regP & 1;
    }

    private negativeSet() {
        return this.regP & 0x80;
    }

    private zeroSet() {
        return this.regP & 0x02;
    }

    private doCompare(reg: number, val: number) {
        if (reg >= val) {
            this.SEC();
        } else {
            this.CLC();
        }
        val = (reg - val);
        this.setNVflags(val);
    }

    private testSBC(value: number) {
        var tmp, w;
        if ((this.regA ^ value) & 0x80) {
            this.setOverflow();
        } else {
            this.CLV();
        }

        if (this.decimalMode()) {
            tmp = 0xf + (this.regA & 0xf) - (value & 0xf) + this.carrySet();
            if (tmp < 0x10) {
                w = 0;
                tmp -= 6;
            } else {
                w = 0x10;
                tmp -= 0x10;
            }
            w += 0xf0 + (this.regA & 0xf0) - (value & 0xf0);
            if (w < 0x100) {
                this.CLC();
                if (this.overflowSet() && w < 0x80) { this.CLV(); }
                w -= 0x60;
            } else {
                this.SEC();
                if (this.overflowSet() && w >= 0x180) { this.CLV(); }
            }
            w += tmp;
        } else {
            w = 0xff + this.regA - value + this.carrySet();
            if (w < 0x100) {
                this.CLC();
                if (this.overflowSet() && w < 0x80) { this.CLV(); }
            } else {
                this.SEC();
                if (this.overflowSet() && w >= 0x180) { this.CLV(); }
            }
        }
        this.regA = w & 0xff;
        this.setNVflagsForRegA();
    }

    private testADC(value: number) {
        var tmp;
        if ((this.regA ^ value) & 0x80) {
            this.CLV();
        } else {
            this.setOverflow();
        }

        if (this.decimalMode()) {
            tmp = (this.regA & 0xf) + (value & 0xf) + this.carrySet();
            if (tmp >= 10) {
                tmp = 0x10 | ((tmp + 6) & 0xf);
            }
            tmp += (this.regA & 0xf0) + (value & 0xf0);
            if (tmp >= 160) {
                this.SEC();
                if (this.overflowSet() && tmp >= 0x180) { this.CLV(); }
                tmp += 0x60;
            } else {
                this.CLC();
                if (this.overflowSet() && tmp < 0x80) { this.CLV(); }
            }
        } else {
            tmp = this.regA + value + this.carrySet();
            if (tmp >= 0x100) {
                this.SEC();
                if (this.overflowSet() && tmp >= 0x180) { this.CLV(); }
            } else {
                this.CLC();
                if (this.overflowSet() && tmp < 0x80) { this.CLV(); }
            }
        }
        this.regA = tmp & 0xff;
        this.setNVflagsForRegA();
    }

    private stackPush(value: number) {
        this.memory.set((this.regSP & 0xff) + 0x100, value & 0xff);
        this.regSP--;
        if (this.regSP < 0) {
            this.regSP &= 0xff;
            message("6502 Stack filled! Wrapping...");
        }
    }

    private stackPop() {
        var value;
        this.regSP++;
        if (this.regSP >= 0x100) {
            this.regSP &= 0xff;
            message("6502 Stack emptied! Wrapping...");
        }
        value = this.memory.get(this.regSP + 0x100);
        return value;
    }

    // popByte() - Pops a byte
    private popByte() {
        return (this.memory.get(this.regPC++) & 0xff);
    }

    // popWord() - Pops a word using popByte() twice
    private popWord() {
        return this.popByte() + (this.popByte() << 8);
    }

    private i00() {
        throw new Error("BRK");
        //BRK
    }

    private i01() {
        var zp = (this.popByte() + this.regX) & 0xff;
        var addr = this.memory.getWord(zp);
        var value = this.memory.get(addr);
        this.regA |= value;
        this.ORA();
    }

    private i05() {
        var zp = this.popByte();
        this.regA |= this.memory.get(zp);
        this.ORA();
    }

    private i06() {
        var zp = this.popByte();
        var value = this.memory.get(zp);
        this.setCarryFlagFromBit7(value);
        value = value << 1;
        this.memory.storeByte(zp, value);
        this.ASL(value);
    }

    private i08() {
        this.stackPush(this.regP | 0x30);
        //PHP
    }

    private i09() {
        this.regA |= this.popByte();
        this.ORA();
    }

    private i0a() {
        this.setCarryFlagFromBit7(this.regA);
        this.regA = (this.regA << 1) & 0xff;
        this.ASL(this.regA);
    }

    private i0d() {
        this.regA |= this.memory.get(this.popWord());
        this.ORA();
    }

    private i0e() {
        var addr = this.popWord();
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit7(value);
        value = value << 1;
        this.memory.storeByte(addr, value);
        this.ASL(value);
    }

    private i10() {
        var offset = this.popByte();
        if (!this.negativeSet()) { this.jumpBranch(offset); }
        //BPL
    }

    private i11() {
        var zp = this.popByte();
        var value = this.memory.getWord(zp) + this.regY;
        this.regA |= this.memory.get(value);
        this.ORA();
    }

    private i15() {
        var addr = (this.popByte() + this.regX) & 0xff;
        this.regA |= this.memory.get(addr);
        this.ORA();
    }

    private i16() {
        var addr = (this.popByte() + this.regX) & 0xff;
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit7(value);
        value = value << 1;
        this.memory.storeByte(addr, value);
        this.ASL(value);
    }

    private i18() {
        this.CLC();
    }

    private i19() {
        var addr = this.popWord() + this.regY;
        this.regA |= this.memory.get(addr);
        this.ORA();
    }

    private i1d() {
        var addr = this.popWord() + this.regX;
        this.regA |= this.memory.get(addr);
        this.ORA();
    }

    private i1e() {
        var addr = this.popWord() + this.regX;
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit7(value);
        value = value << 1;
        this.memory.storeByte(addr, value);
        this.ASL(value);
    }

    private i20() {
        var addr = this.popWord();
        var currAddr = this.regPC - 1;
        this.stackPush(((currAddr >> 8) & 0xff));
        this.stackPush((currAddr & 0xff));
        this.regPC = addr;
        //JSR
    }

    private i21() {
        var zp = (this.popByte() + this.regX) & 0xff;
        var addr = this.memory.getWord(zp);
        var value = this.memory.get(addr);
        this.regA &= value;
        this.AND();
    }

    private i24() {
        var zp = this.popByte();
        var value = this.memory.get(zp);
        this.BIT(value);
    }

    private i25() {
        var zp = this.popByte();
        this.regA &= this.memory.get(zp);
        this.AND();
    }

    private i26() {
        var sf = this.carrySet();
        var addr = this.popByte();
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit7(value);
        value = value << 1;
        value |= sf;
        this.memory.storeByte(addr, value);
        this.ROL(value);
    }

    private i28() {
        this.regP = this.stackPop() | 0x30; // There is no B bit!
        //PLP
    }

    private i29() {
        this.regA &= this.popByte();
        this.AND();
    }

    private i2a() {
        var sf = this.carrySet();
        this.setCarryFlagFromBit7(this.regA);
        this.regA = (this.regA << 1) & 0xff;
        this.regA |= sf;
        this.ROL(this.regA);
    }

    private i2c() {
        var value = this.memory.get(this.popWord());
        this.BIT(value);
    }

    private i2d() {
        var value = this.memory.get(this.popWord());
        this.regA &= value;
        this.AND();
    }

    private i2e() {
        var sf = this.carrySet();
        var addr = this.popWord();
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit7(value);
        value = value << 1;
        value |= sf;
        this.memory.storeByte(addr, value);
        this.ROL(value);
    }

    private i30() {
        var offset = this.popByte();
        if (this.negativeSet()) { this.jumpBranch(offset); }
        //BMI
    }

    private i31() {
        var zp = this.popByte();
        var value = this.memory.getWord(zp) + this.regY;
        this.regA &= this.memory.get(value);
        this.AND();
    }

    private i35() {
        var addr = (this.popByte() + this.regX) & 0xff;
        this.regA &= this.memory.get(addr);
        this.AND();
    }

    private i36() {
        var sf = this.carrySet();
        var addr = (this.popByte() + this.regX) & 0xff;
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit7(value);
        value = value << 1;
        value |= sf;
        this.memory.storeByte(addr, value);
        this.ROL(value);
    }

    private i38() {
        this.SEC();
    }

    private i39() {
        var addr = this.popWord() + this.regY;
        var value = this.memory.get(addr);
        this.regA &= value;
        this.AND();
    }

    private i3d() {
        var addr = this.popWord() + this.regX;
        var value = this.memory.get(addr);
        this.regA &= value;
        this.AND();
    }

    private i3e() {
        var sf = this.carrySet();
        var addr = this.popWord() + this.regX;
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit7(value);
        value = value << 1;
        value |= sf;
        this.memory.storeByte(addr, value);
        this.ROL(value);
    }

    private i40() {
        this.regP = this.stackPop() | 0x30; // There is no B bit!
        this.regPC = this.stackPop() | (this.stackPop() << 8);
        //RTI
    }

    private i41() {
        var zp = (this.popByte() + this.regX) & 0xff;
        var value = this.memory.getWord(zp);
        this.regA ^= this.memory.get(value);
        this.EOR();
    }

    private i45() {
        var addr = this.popByte() & 0xff;
        var value = this.memory.get(addr);
        this.regA ^= value;
        this.EOR();
    }

    private i46() {
        var addr = this.popByte() & 0xff;
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit0(value);
        value = value >> 1;
        this.memory.storeByte(addr, value);
        this.LSR(value);
    }

    private i48() {
        this.stackPush(this.regA);
        //PHA
    }

    private i49() {
        this.regA ^= this.popByte();
        this.EOR();
    }

    private i4a() {
        this.setCarryFlagFromBit0(this.regA);
        this.regA = this.regA >> 1;
        this.LSR(this.regA);
    }

    private i4c() {
        this.regPC = this.popWord();
        //JMP
    }

    private i4d() {
        var addr = this.popWord();
        var value = this.memory.get(addr);
        this.regA ^= value;
        this.EOR();
    }

    private i4e() {
        var addr = this.popWord();
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit0(value);
        value = value >> 1;
        this.memory.storeByte(addr, value);
        this.LSR(value);
    }

    private i50() {
        var offset = this.popByte();
        if (!this.overflowSet()) { this.jumpBranch(offset); }
        //BVC
    }

    private i51() {
        var zp = this.popByte();
        var value = this.memory.getWord(zp) + this.regY;
        this.regA ^= this.memory.get(value);
        this.EOR();
    }

    private i55() {
        var addr = (this.popByte() + this.regX) & 0xff;
        this.regA ^= this.memory.get(addr);
        this.EOR();
    }

    private i56() {
        var addr = (this.popByte() + this.regX) & 0xff;
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit0(value);
        value = value >> 1;
        this.memory.storeByte(addr, value);
        this.LSR(value);
    }

    private i58() {
        this.regP &= ~0x04;
        throw new Error("Interrupts not implemented");
        //CLI
    }

    private i59() {
        var addr = this.popWord() + this.regY;
        var value = this.memory.get(addr);
        this.regA ^= value;
        this.EOR();
    }

    private i5d() {
        var addr = this.popWord() + this.regX;
        var value = this.memory.get(addr);
        this.regA ^= value;
        this.EOR();
    }

    private i5e() {
        var addr = this.popWord() + this.regX;
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit0(value);
        value = value >> 1;
        this.memory.storeByte(addr, value);
        this.LSR(value);
    }

    private i60() {
        this.regPC = (this.stackPop() | (this.stackPop() << 8)) + 1;
        //RTS
    }

    private i61() {
        var zp = (this.popByte() + this.regX) & 0xff;
        var addr = this.memory.getWord(zp);
        var value = this.memory.get(addr);
        this.testADC(value);
        //ADC
    }

    private i65() {
        var addr = this.popByte();
        var value = this.memory.get(addr);
        this.testADC(value);
        //ADC
    }

    private i66() {
        var sf = this.carrySet();
        var addr = this.popByte();
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit0(value);
        value = value >> 1;
        if (sf) { value |= 0x80; }
        this.memory.storeByte(addr, value);
        this.ROR(value);
    }

    private i68() {
        this.regA = this.stackPop();
        this.setNVflagsForRegA();
        //PLA
    }

    private i69() {
        var value = this.popByte();
        this.testADC(value);
        //ADC
    }

    private i6a() {
        var sf = this.carrySet();
        this.setCarryFlagFromBit0(this.regA);
        this.regA = this.regA >> 1;
        if (sf) { this.regA |= 0x80; }
        this.ROR(this.regA);
    }

    private i6c() {
        this.regPC = this.memory.getWord(this.popWord());
        //JMP
    }

    private i6d() {
        var addr = this.popWord();
        var value = this.memory.get(addr);
        this.testADC(value);
        //ADC
    }

    private i6e() {
        var sf = this.carrySet();
        var addr = this.popWord();
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit0(value);
        value = value >> 1;
        if (sf) { value |= 0x80; }
        this.memory.storeByte(addr, value);
        this.ROR(value);
    }

    private i70() {
        var offset = this.popByte();
        if (this.overflowSet()) { this.jumpBranch(offset); }
        //BVS
    }

    private i71() {
        var zp = this.popByte();
        var addr = this.memory.getWord(zp);
        var value = this.memory.get(addr + this.regY);
        this.testADC(value);
        //ADC
    }

    private i75() {
        var addr = (this.popByte() + this.regX) & 0xff;
        var value = this.memory.get(addr);
        this.testADC(value);
        //ADC
    }

    private i76() {
        var sf = this.carrySet();
        var addr = (this.popByte() + this.regX) & 0xff;
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit0(value);
        value = value >> 1;
        if (sf) { value |= 0x80; }
        this.memory.storeByte(addr, value);
        this.ROR(value);
    }

    private i78() {
        this.regP |= 0x04;
        throw new Error("Interrupts not implemented");
        //SEI
    }

    private i79() {
        var addr = this.popWord();
        var value = this.memory.get(addr + this.regY);
        this.testADC(value);
        //ADC
    }

    private i7d() {
        var addr = this.popWord();
        var value = this.memory.get(addr + this.regX);
        this.testADC(value);
        //ADC
    }

    private i7e() {
        var sf = this.carrySet();
        var addr = this.popWord() + this.regX;
        var value = this.memory.get(addr);
        this.setCarryFlagFromBit0(value);
        value = value >> 1;
        if (sf) { value |= 0x80; }
        this.memory.storeByte(addr, value);
        this.ROR(value);
    }

    private i81() {
        var zp = (this.popByte() + this.regX) & 0xff;
        var addr = this.memory.getWord(zp);
        this.memory.storeByte(addr, this.regA);
        //STA
    }

    private i84() {
        this.memory.storeByte(this.popByte(), this.regY);
        //STY
    }

    private i85() {
        this.memory.storeByte(this.popByte(), this.regA);
        //STA
    }

    private i86() {
        this.memory.storeByte(this.popByte(), this.regX);
        //STX
    }

    private i88() {
        this.regY = (this.regY - 1) & 0xff;
        this.setNVflagsForRegY();
        //DEY
    }

    private i8a() {
        this.regA = this.regX & 0xff;
        this.setNVflagsForRegA();
        //TXA
    }

    private i8c() {
        this.memory.storeByte(this.popWord(), this.regY);
        //STY
    }

    private i8d() {
        this.memory.storeByte(this.popWord(), this.regA);
        //STA
    }

    private i8e() {
        this.memory.storeByte(this.popWord(), this.regX);
        //STX
    }

    private i90() {
        var offset = this.popByte();
        if (!this.carrySet()) { this.jumpBranch(offset); }
        //BCC
    }

    private i91() {
        var zp = this.popByte();
        var addr = this.memory.getWord(zp) + this.regY;
        this.memory.storeByte(addr, this.regA);
        //STA
    }

    private i94() {
        this.memory.storeByte((this.popByte() + this.regX) & 0xff, this.regY);
        //STY
    }

    private i95() {
        this.memory.storeByte((this.popByte() + this.regX) & 0xff, this.regA);
        //STA
    }

    private i96() {
        this.memory.storeByte((this.popByte() + this.regY) & 0xff, this.regX);
        //STX
    }

    private i98() {
        this.regA = this.regY & 0xff;
        this.setNVflagsForRegA();
        //TYA
    }

    private i99() {
        this.memory.storeByte(this.popWord() + this.regY, this.regA);
        //STA
    }

    private i9a() {
        this.regSP = this.regX & 0xff;
        //TXS
    }

    private i9d() {
        var addr = this.popWord();
        this.memory.storeByte(addr + this.regX, this.regA);
        //STA
    }

    private ia0() {
        this.regY = this.popByte();
        this.LDY();
    }

    private ia1() {
        var zp = (this.popByte() + this.regX) & 0xff;
        var addr = this.memory.getWord(zp);
        this.regA = this.memory.get(addr);
        this.LDA();
    }

    private ia2() {
        this.regX = this.popByte();
        this.LDX();
    }

    private ia4() {
        this.regY = this.memory.get(this.popByte());
        this.LDY();
    }

    private ia5() {
        this.regA = this.memory.get(this.popByte());
        this.LDA();
    }

    private ia6() {
        this.regX = this.memory.get(this.popByte());
        this.LDX();
    }

    private ia8() {
        this.regY = this.regA & 0xff;
        this.setNVflagsForRegY();
        //TAY
    }

    private ia9() {
        this.regA = this.popByte();
        this.LDA();
    }

    private iaa() {
        this.regX = this.regA & 0xff;
        this.setNVflagsForRegX();
        //TAX
    }

    private iac() {
        this.regY = this.memory.get(this.popWord());
        this.LDY();
    }

    private iad() {
        this.regA = this.memory.get(this.popWord());
        this.LDA();
    }

    private iae() {
        this.regX = this.memory.get(this.popWord());
        this.LDX();
    }

    private ib0() {
        var offset = this.popByte();
        if (this.carrySet()) { this.jumpBranch(offset); }
        //BCS
    }

    private ib1() {
        var zp = this.popByte();
        var addr = this.memory.getWord(zp) + this.regY;
        this.regA = this.memory.get(addr);
        this.LDA();
    }

    private ib4() {
        this.regY = this.memory.get((this.popByte() + this.regX) & 0xff);
        this.LDY();
    }

    private ib5() {
        this.regA = this.memory.get((this.popByte() + this.regX) & 0xff);
        this.LDA();
    }

    private ib6() {
        this.regX = this.memory.get((this.popByte() + this.regY) & 0xff);
        this.LDX();
    }

    private ib8() {
        this.CLV();
    }

    private ib9() {
        var addr = this.popWord() + this.regY;
        this.regA = this.memory.get(addr);
        this.LDA();
    }

    private iba() {
        this.regX = this.regSP & 0xff;
        this.LDX();
        //TSX
    }

    private ibc() {
        var addr = this.popWord() + this.regX;
        this.regY = this.memory.get(addr);
        this.LDY();
    }

    private ibd() {
        var addr = this.popWord() + this.regX;
        this.regA = this.memory.get(addr);
        this.LDA();
    }

    private ibe() {
        var addr = this.popWord() + this.regY;
        this.regX = this.memory.get(addr);
        this.LDX();
    }

    private ic0() {
        var value = this.popByte();
        this.doCompare(this.regY, value);
        //CPY
    }

    private ic1() {
        var zp = (this.popByte() + this.regX) & 0xff;
        var addr = this.memory.getWord(zp);
        var value = this.memory.get(addr);
        this.doCompare(this.regA, value);
        //CPA
    }

    private ic4() {
        var value = this.memory.get(this.popByte());
        this.doCompare(this.regY, value);
        //CPY
    }

    private ic5() {
        var value = this.memory.get(this.popByte());
        this.doCompare(this.regA, value);
        //CPA
    }

    private ic6() {
        var zp = this.popByte();
        this.DEC(zp);
    }

    private ic8() {
        this.regY = (this.regY + 1) & 0xff;
        this.setNVflagsForRegY();
        //INY
    }

    private ic9() {
        var value = this.popByte();
        this.doCompare(this.regA, value);
        //CMP
    }

    private ica() {
        this.regX = (this.regX - 1) & 0xff;
        this.setNVflagsForRegX();
        //DEX
    }

    private icc() {
        var value = this.memory.get(this.popWord());
        this.doCompare(this.regY, value);
        //CPY
    }

    private icd() {
        var value = this.memory.get(this.popWord());
        this.doCompare(this.regA, value);
        //CPA
    }

    private ice() {
        var addr = this.popWord();
        this.DEC(addr);
    }

    private id0() {
        var offset = this.popByte();
        if (!this.zeroSet()) { this.jumpBranch(offset); }
        //BNE
    }

    private id1() {
        var zp = this.popByte();
        var addr = this.memory.getWord(zp) + this.regY;
        var value = this.memory.get(addr);
        this.doCompare(this.regA, value);
        //CMP
    }

    private id5() {
        var value = this.memory.get((this.popByte() + this.regX) & 0xff);
        this.doCompare(this.regA, value);
        //CMP
    }

    private id6() {
        var addr = (this.popByte() + this.regX) & 0xff;
        this.DEC(addr);
    }

    private id8() {
        this.regP &= 0xf7;
        //CLD
    }

    private id9() {
        var addr = this.popWord() + this.regY;
        var value = this.memory.get(addr);
        this.doCompare(this.regA, value);
        //CMP
    }

    private idd() {
        var addr = this.popWord() + this.regX;
        var value = this.memory.get(addr);
        this.doCompare(this.regA, value);
        //CMP
    }

    private ide() {
        var addr = this.popWord() + this.regX;
        this.DEC(addr);
    }

    private ie0() {
        var value = this.popByte();
        this.doCompare(this.regX, value);
        //CPX
    }

    private ie1() {
        var zp = (this.popByte() + this.regX) & 0xff;
        var addr = this.memory.getWord(zp);
        var value = this.memory.get(addr);
        this.testSBC(value);
        //SBC
    }

    private ie4() {
        var value = this.memory.get(this.popByte());
        this.doCompare(this.regX, value);
        //CPX
    }

    private ie5() {
        var addr = this.popByte();
        var value = this.memory.get(addr);
        this.testSBC(value);
        //SBC
    }

    private ie6() {
        var zp = this.popByte();
        this.INC(zp);
    }

    private ie8() {
        this.regX = (this.regX + 1) & 0xff;
        this.setNVflagsForRegX();
        //INX
    }

    private ie9() {
        var value = this.popByte();
        this.testSBC(value);
        //SBC
    }

    private iea() {
        //NOP
    }

    private iec() {
        var value = this.memory.get(this.popWord());
        this.doCompare(this.regX, value);
        //CPX
    }

    private ied() {
        var addr = this.popWord();
        var value = this.memory.get(addr);
        this.testSBC(value);
        //SBC
    }

    private iee() {
        var addr = this.popWord();
        this.INC(addr);
    }

    private if0() {
        var offset = this.popByte();
        if (this.zeroSet()) { this.jumpBranch(offset); }
        //BEQ
    }

    private if1() {
        var zp = this.popByte();
        var addr = this.memory.getWord(zp);
        var value = this.memory.get(addr + this.regY);
        this.testSBC(value);
        //SBC
    }

    private if5() {
        var addr = (this.popByte() + this.regX) & 0xff;
        var value = this.memory.get(addr);
        this.testSBC(value);
        //SBC
    }

    private if6() {
        var addr = (this.popByte() + this.regX) & 0xff;
        this.INC(addr);
    }

    private if8() {
        this.regP |= 8;
        //SED
    }

    private if9() {
        var addr = this.popWord();
        var value = this.memory.get(addr + this.regY);
        this.testSBC(value);
        //SBC
    }

    private ifd() {
        var addr = this.popWord();
        var value = this.memory.get(addr + this.regX);
        this.testSBC(value);
        //SBC
    }

    private ife() {
        var addr = this.popWord() + this.regX;
        this.INC(addr);
    }

    private ierr() {
        message("Address $" + addr2hex(this.regPC) + " - unknown opcode");
        throw new Error("Unknown opcode");
    }

    private instructions: Instructions = {
        '00': this.i00.bind(this), '01': this.i01.bind(this), '05': this.i05.bind(this), '06': this.i06.bind(this), '08': this.i08.bind(this), '09': this.i09.bind(this), '0a': this.i0a.bind(this), '0d': this.i0d.bind(this), '0e': this.i0e.bind(this), '10': this.i10.bind(this), '11': this.i11.bind(this), '15': this.i15.bind(this), '16': this.i16.bind(this), '18': this.i18.bind(this), '19': this.i19.bind(this), '1d': this.i1d.bind(this), '1e': this.i1e.bind(this), '20': this.i20.bind(this), '21': this.i21.bind(this), '24': this.i24.bind(this), '25': this.i25.bind(this), '26': this.i26.bind(this), '28': this.i28.bind(this), '29': this.i29.bind(this), '2a': this.i2a.bind(this), '2c': this.i2c.bind(this), '2d': this.i2d.bind(this), '2e': this.i2e.bind(this), '30': this.i30.bind(this), '31': this.i31.bind(this), '35': this.i35.bind(this), '36': this.i36.bind(this), '38': this.i38.bind(this), '39': this.i39.bind(this), '3d': this.i3d.bind(this), '3e': this.i3e.bind(this), '40': this.i40.bind(this), '41': this.i41.bind(this), '45': this.i45.bind(this), '46': this.i46.bind(this), '48': this.i48.bind(this), '49': this.i49.bind(this), '4a': this.i4a.bind(this), '4c': this.i4c.bind(this), '4d': this.i4d.bind(this), '4e': this.i4e.bind(this), '50': this.i50.bind(this), '51': this.i51.bind(this), '55': this.i55.bind(this), '56': this.i56.bind(this), '58': this.i58.bind(this), '59': this.i59.bind(this), '5d': this.i5d.bind(this), '5e': this.i5e.bind(this), '60': this.i60.bind(this), '61': this.i61.bind(this), '65': this.i65.bind(this), '66': this.i66.bind(this), '68': this.i68.bind(this), '69': this.i69.bind(this), '6a': this.i6a.bind(this), '6c': this.i6c.bind(this), '6d': this.i6d.bind(this), '6e': this.i6e.bind(this), '70': this.i70.bind(this), '71': this.i71.bind(this), '75': this.i75.bind(this), '76': this.i76.bind(this), '78': this.i78.bind(this), '79': this.i79.bind(this), '7d': this.i7d.bind(this), '7e': this.i7e.bind(this), '81': this.i81.bind(this), '84': this.i84.bind(this), '85': this.i85.bind(this), '86': this.i86.bind(this), '88': this.i88.bind(this), '8a': this.i8a.bind(this), '8c': this.i8c.bind(this), '8d': this.i8d.bind(this), '8e': this.i8e.bind(this), '90': this.i90.bind(this), '91': this.i91.bind(this), '94': this.i94.bind(this), '95': this.i95.bind(this), '96': this.i96.bind(this), '98': this.i98.bind(this), '99': this.i99.bind(this), '9a': this.i9a.bind(this), '9d': this.i9d.bind(this), 'a0': this.ia0.bind(this), 'a1': this.ia1.bind(this), 'a2': this.ia2.bind(this), 'a4': this.ia4.bind(this), 'a5': this.ia5.bind(this), 'a6': this.ia6.bind(this), 'a8': this.ia8.bind(this), 'a9': this.ia9.bind(this), 'aa': this.iaa.bind(this), 'ac': this.iac.bind(this), 'ad': this.iad.bind(this), 'ae': this.iae.bind(this), 'b0': this.ib0.bind(this), 'b1': this.ib1.bind(this), 'b4': this.ib4.bind(this), 'b5': this.ib5.bind(this), 'b6': this.ib6.bind(this), 'b8': this.ib8.bind(this), 'b9': this.ib9.bind(this), 'ba': this.iba.bind(this), 'bc': this.ibc.bind(this), 'bd': this.ibd.bind(this), 'be': this.ibe.bind(this), 'c0': this.ic0.bind(this), 'c1': this.ic1.bind(this), 'c4': this.ic4.bind(this), 'c5': this.ic5.bind(this), 'c6': this.ic6.bind(this), 'c8': this.ic8.bind(this), 'c9': this.ic9.bind(this), 'ca': this.ica.bind(this), 'cc': this.icc.bind(this), 'cd': this.icd.bind(this), 'ce': this.ice.bind(this), 'd0': this.id0.bind(this), 'd1': this.id1.bind(this), 'd5': this.id5.bind(this), 'd6': this.id6.bind(this), 'd8': this.id8.bind(this), 'd9': this.id9.bind(this), 'dd': this.idd.bind(this), 'de': this.ide.bind(this), 'e0': this.ie0.bind(this), 'e1': this.ie1.bind(this), 'e4': this.ie4.bind(this), 'e5': this.ie5.bind(this), 'e6': this.ie6.bind(this), 'e8': this.ie8.bind(this), 'e9': this.ie9.bind(this), 'ea': this.iea.bind(this), 'ec': this.iec.bind(this), 'ed': this.ied.bind(this), 'ee': this.iee.bind(this), 'f0': this.if0.bind(this), 'f1': this.if1.bind(this), 'f5': this.if5.bind(this), 'f6': this.if6.bind(this), 'f8': this.if8.bind(this), 'f9': this.if9.bind(this), 'fd': this.ifd.bind(this), 'fe': this.ife.bind(this)
    }

    public executeNextInstruction() {
        var instructionName = this.popByte().toString(16).toLowerCase();
        if (instructionName.length === 1) {
            instructionName = '0' + instructionName;
        }
        var instruction = this.instructions[instructionName];

        if (instruction) {
            instruction();
        } else {
            this.ierr();
        }
        if (this.regPC === 0xffff) {
            throw new Error("End of memory reached");
        }
    }

    // execute() - Executes one instruction.
    //             This is the main part of the CPU simulator.
    public execute() {
        this.setRandomByte();
        this.executeNextInstruction();
    }

    public setRandomByte() {
        this.memory.set(0xfe, Math.floor(Math.random() * 256));
    }

    // reset() - Reset CPU and memory.
    // remember to reset peripherals if needed
    public reset() {
        this.regA = this.regX = this.regY = 0;
        this.regPC = this.memory.getWord(0xfffc);
        this.regSP = 0xff;
        this.regP = 0x30;
        message("CPU reset @ " + addr2hex(this.regPC), "reset()");
    }
}
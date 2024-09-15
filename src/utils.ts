function addr2hex(addr: number) {
    return num2hex((addr >> 8) & 0xff) + num2hex(addr & 0xff);
}

function num2hex(nr: number) {
    var str = "0123456789abcdef";
    var hi = ((nr & 0xf0) >> 4);
    var lo = (nr & 15);
    return str.substring(hi, hi + 1) + str.substring(lo, lo + 1);
}

function message(text: string) {
    console.log(text);
}

export { addr2hex, num2hex, message };
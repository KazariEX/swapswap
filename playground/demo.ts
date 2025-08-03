export function swap(a: number, b: string, c: boolean, d: symbol) {
   void [a, b, c, d];
}

swap(2, "3", true, Symbol(5));

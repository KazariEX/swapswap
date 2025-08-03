export function swap(foo: number, bar: string, baz: boolean, qux: symbol) {
   void [foo, bar, baz, qux];
}

swap(2, "3", true, Symbol(5));

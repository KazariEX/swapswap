function swap(foo: number, bar: string, baz: boolean, qux: symbol) {
   return [foo, bar, baz, qux];
}

swap(2, "3", true, Symbol(5));

function rest(foo: number, bar: string, ...args: any[]) {
    return [foo, bar, ...args];
}

rest(2, "3", true, Symbol(5));

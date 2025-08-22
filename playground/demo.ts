function swap(foo: number, bar: string, baz: boolean, qux: symbol) {}

swap(2, "3", true, Symbol(5));

const o1 = { swap: swap };
o1.swap(2, "3", true, Symbol(5));

const o2 = { swap };
o2.swap(2, "3", true, Symbol(5));

const o3 = {} as { swap: typeof swap };
o3.swap(2, "3", true, Symbol(5));

function rest(foo: number, bar: string, ...args: any[]) {}

rest(2, "3", true, Symbol(5));

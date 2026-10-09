/**
 * 随手写的式子 → 能算的东西
 *
 * 只做一件事：把用户敲的字符串（可能带 × ÷ ² √ π − 这些符号）变成一个函数。
 * 规矩尽量少，符合直觉就行：
 *
 *   · x、y 是变量；式子里的其它字母（a、b、k、m …）自动当成**可调参数**
 *     —— 所以「几元」不受限：x、y 画图，其余字母拖滑块定。
 *   · 次数不受限：^ 就是乘方，x^2、x^5、(x−1)^3 都行。
 *   · 隐式相乘照写：2x、3(x+1)、(x−1)(x−3)、x sin(x) 都认。
 *   · 带等号：y = … 是显式的 y = f(x)；x = … 是 x = f(y)；
 *     其余情况（x²+y²=25）当成 F(x,y) = 0。
 */

export type Vars = Record<string, number>;

const FUNCS: Record<string, { arity: number | number[]; fn: (...a: number[]) => number }> = {
  sin: { arity: 1, fn: Math.sin },
  cos: { arity: 1, fn: Math.cos },
  tan: { arity: 1, fn: Math.tan },
  cot: { arity: 1, fn: (x) => 1 / Math.tan(x) },
  asin: { arity: 1, fn: Math.asin },
  acos: { arity: 1, fn: Math.acos },
  atan: { arity: 1, fn: Math.atan },
  sinh: { arity: 1, fn: Math.sinh },
  cosh: { arity: 1, fn: Math.cosh },
  tanh: { arity: 1, fn: Math.tanh },
  ln: { arity: 1, fn: Math.log },
  lg: { arity: 1, fn: Math.log10 },
  log2: { arity: 1, fn: Math.log2 },
  /** log(x) = 以 10 为底；log(x, b) = 以 b 为底（真数在前） */
  log: { arity: [1, 2], fn: (x, b) => (b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b)) },
  exp: { arity: 1, fn: Math.exp },
  sqrt: { arity: 1, fn: Math.sqrt },
  abs: { arity: 1, fn: Math.abs },
  floor: { arity: 1, fn: Math.floor },
  ceil: { arity: 1, fn: Math.ceil },
  round: { arity: 1, fn: Math.round },
  sign: { arity: 1, fn: Math.sign },
  pow: { arity: 2, fn: (a, b) => Math.pow(a, b) },
  max: { arity: [2, 4], fn: (...a) => Math.max(...a) },
  min: { arity: [2, 4], fn: (...a) => Math.min(...a) },
};

const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

/** 把中文 / 排版符号换成 ASCII，用户怎么顺手怎么来 */
export function normalize(src: string): string {
  let s = src;
  s = s.replace(/[×✕✖⋅·]/g, '*');
  s = s.replace(/÷/g, '/');
  s = s.replace(/[−–—‐]/g, '-');
  s = s.replace(/[（〔]/g, '(');
  s = s.replace(/[）〕]/g, ')');
  s = s.replace(/，/g, ',');
  s = s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  s = s.replace(/π/g, 'pi');
  s = s.replace(/√\s*([0-9.]+|[A-Za-z][A-Za-z0-9_]*)/g, 'sqrt($1)'); // √x → sqrt(x)
  s = s.replace(/√/g, 'sqrt');
  s = s.replace(/°/g, '');
  s = s.replace(/²/g, '^2');
  s = s.replace(/³/g, '^3');
  s = s.replace(/\s+/g, '');
  return s;
}

type Tok = { t: 'num' | 'id' | 'op'; v: string };

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < s.length && s[j] >= '0' && s[j] <= '9') j += 1;
      if (s[j] === '.') {
        j += 1;
        while (j < s.length && s[j] >= '0' && s[j] <= '9') j += 1;
      }
      out.push({ t: 'num', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '.') {
      let j = i + 1;
      while (j < s.length && s[j] >= '0' && s[j] <= '9') j += 1;
      if (j === i + 1) throw new Error('小数点后面要有数字');
      out.push({ t: 'num', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j += 1;
      out.push({ t: 'id', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/^(),'.includes(c)) {
      out.push({ t: 'op', v: c });
      i += 1;
      continue;
    }
    throw new Error(`看不懂的字符「${c}」`);
  }
  return out;
}

type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'call'; name: string; args: Node[] }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'neg'; a: Node };

class ParseError extends Error {}

function parse(tokens: Tok[]): Node {
  let p = 0;
  const peek = (): Tok | undefined => tokens[p];
  const eat = (v: string): boolean => {
    if (tokens[p] && tokens[p].t === 'op' && tokens[p].v === v) {
      p += 1;
      return true;
    }
    return false;
  };

  const primary = (): Node => {
    const t = peek();
    if (!t) throw new ParseError('式子没写完');
    if (t.t === 'num') {
      p += 1;
      return { k: 'num', v: Number(t.v) };
    }
    if (t.t === 'id') {
      p += 1;
      if (eat('(')) {
        const args: Node[] = [];
        const next = peek();
        if (!(next && next.t === 'op' && next.v === ')')) {
          args.push(expr());
          while (eat(',')) args.push(expr());
        }
        if (!eat(')')) throw new ParseError(`${t.v} 后面少了右括号`);
        const f = FUNCS[t.v];
        if (f) {
          const okArity = Array.isArray(f.arity)
            ? args.length >= (f.arity as number[])[0] && args.length <= (f.arity as number[])[1]
            : args.length === f.arity;
          if (!okArity) throw new ParseError(`${t.v} 要 ${f.arity} 个参数，这里给了 ${args.length} 个`);
          return { k: 'call', name: t.v, args };
        }
        if (args.length !== 1) throw new ParseError(`${t.v}(…) 括号里只能放一个数`);
        // 没见过的名字带括号：当成「变量 × (…)」，比如 a(x+1)
        return { k: 'bin', op: '*', a: { k: 'var', name: t.v }, b: args[0] };
      }
      if (CONSTS[t.v] !== undefined) return { k: 'num', v: CONSTS[t.v] };
      return { k: 'var', name: t.v };
    }
    if (eat('(')) {
      const e = expr();
      if (!eat(')')) throw new ParseError('少了右括号');
      return e;
    }
    throw new ParseError(`这里不该出现「${t.v}」`);
  };

  const power = (): Node => {
    const base = primary();
    if (eat('^')) {
      const ex = unary(); // 右结合：2^3^2 = 2^(3^2)
      return { k: 'call', name: 'pow', args: [base, ex] };
    }
    return base;
  };

  const unary = (): Node => {
    if (eat('-')) return { k: 'neg', a: unary() };
    if (eat('+')) return unary();
    return power();
  };

  const term = (): Node => {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) {
        p += 1;
        left = { k: 'bin', op: t.v, a: left, b: unary() };
        continue;
      }
      // 隐式相乘：2x、3(x+1)、xy、(x−1)(x−3)
      if (t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '('))) {
        left = { k: 'bin', op: '*', a: left, b: unary() };
        continue;
      }
      return left;
    }
  };

  const expr = (): Node => {
    let left = term();
    for (;;) {
      const t = peek();
      if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) {
        p += 1;
        left = { k: 'bin', op: t.v, a: left, b: term() };
        continue;
      }
      return left;
    }
  };

  const root = expr();
  if (p < tokens.length) throw new ParseError(`多出来的「${tokens[p].v}」`);
  return root;
}

const evalNode = (n: Node, v: Vars): number => {
  switch (n.k) {
    case 'num':
      return n.v;
    case 'var': {
      const x = v[n.name];
      return Number.isFinite(x) ? (x as number) : Number.NaN;
    }
    case 'call': {
      const f = FUNCS[n.name];
      return f.fn(...n.args.map((a) => evalNode(a, v)));
    }
    case 'bin': {
      const a = evalNode(n.a, v);
      const b = evalNode(n.b, v);
      if (n.op === '+') return a + b;
      if (n.op === '-') return a - b;
      if (n.op === '*') return a * b;
      return a / b;
    }
    case 'neg':
      return -evalNode(n.a, v);
    default:
      return Number.NaN;
  }
};

function collect(n: Node, vars: Set<string>, params: Set<string>) {
  switch (n.k) {
    case 'var':
      if (n.name === 'x' || n.name === 'y') vars.add(n.name);
      else params.add(n.name);
      break;
    case 'call':
      n.args.forEach((a) => collect(a, vars, params));
      break;
    case 'bin':
      collect(n.a, vars, params);
      collect(n.b, vars, params);
      break;
    case 'neg':
      collect(n.a, vars, params);
      break;
    default:
      break;
  }
}

/** 编译一个（不带等号的）表达式 */
export function compileExpr(src: string): { fn: (v: Vars) => number; vars: string[]; params: string[] } {
  const toks = tokenize(normalize(src));
  const node = parse(toks);
  const vars = new Set<string>();
  const params = new Set<string>();
  collect(node, vars, params);
  return { fn: (v: Vars) => evalNode(node, v), vars: [...vars].sort(), params: [...params].sort() };
}

export type Compiled = {
  /** 原始输入（存档 / 图例用） */
  source: string;
  /** y = f(x) / x = f(y) / F(x,y) = 0 */
  kind: 'y' | 'x' | 'implicit';
  /** 残差：显式时是 y − f(x)（或 x − f(y)），隐式时是原式 —— 等于 0 就说明点在曲线上 */
  F: (v: Vars) => number;
  /** 显式时的右端：kind 'y' 给 x 求 y；kind 'x' 给 y 求 x */
  g?: (v: Vars) => number;
  vars: string[];
  params: string[];
};

/** 编译用户的一整条输入（可以带一个等号） */
export function compile(input: string): { ok: true; c: Compiled } | { ok: false; err: string } {
  const raw = input.trim();
  if (!raw) return { ok: false, err: '先写点东西' };
  try {
    const s = normalize(raw);
    const eq = s.indexOf('=');
    const vars = new Set<string>();
    const params = new Set<string>();

    if (eq >= 0) {
      const lhs = s.slice(0, eq);
      const rhs = s.slice(eq + 1);
      if (!lhs || !rhs) return { ok: false, err: '等号两边都要有东西' };
      const L = compileExpr(lhs);
      const R = compileExpr(rhs);
      L.vars.forEach((x) => vars.add(x));
      R.vars.forEach((x) => vars.add(x));
      L.params.forEach((x) => params.add(x));
      R.params.forEach((x) => params.add(x));

      // 左边就是一个 y（右边不含 y）→ 显式的 y = f(...)
      if (lhs === 'y' && !R.vars.includes('y')) {
        return {
          ok: true,
          c: {
            source: raw,
            kind: 'y',
            F: (v) => (v.y ?? 0) - R.fn(v),
            g: R.fn,
            vars: [...vars].sort(),
            params: [...params].sort(),
          },
        };
      }
      if (lhs === 'x' && !R.vars.includes('x')) {
        return {
          ok: true,
          c: {
            source: raw,
            kind: 'x',
            F: (v) => (v.x ?? 0) - R.fn(v),
            g: R.fn,
            vars: [...vars].sort(),
            params: [...params].sort(),
          },
        };
      }
      return {
        ok: true,
        c: {
          source: raw,
          kind: 'implicit',
          F: (v) => L.fn(v) - R.fn(v),
          vars: [...vars].sort(),
          params: [...params].sort(),
        },
      };
    }

    const E = compileExpr(s);
    if (!E.vars.includes('y')) {
      // 没写 y 也没写等号：当成 y = …（最顺手的写法）
      return {
        ok: true,
        c: {
          source: raw,
          kind: 'y',
          F: (v) => (v.y ?? 0) - E.fn(v),
          g: E.fn,
          vars: E.vars,
          params: E.params,
        },
      };
    }
    return {
      ok: true,
      c: {
        source: raw,
        kind: 'implicit',
        F: E.fn,
        vars: E.vars,
        params: E.params,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '这个式子读不出来';
    return { ok: false, err: msg };
  }
}

export const EXPR_HELP =
  'x、y 是变量（其它字母 a、b、k… 会自动变成滑块）；^ 是乘方；× ÷ ² √ π − 都认；' +
  'sin cos tan ln lg log exp sqrt abs 都能用（log(8,2)=3）；2x、(x−1)(x−3) 这种隐式相乘随便写。';

import re, sys, pathlib

BP = ('xs','sm','md','lg','xl')
# match a full <Grid ...> opening tag containing the `item` prop
TAG = re.compile(r'<Grid(?=[\s>])([^>]*?)(/?)>', re.S)

def split_props(s):
    """Split a JSX prop string into tokens, respecting {...} nesting and quotes."""
    out, buf, depth, quote = [], '', 0, None
    for ch in s:
        if quote:
            buf += ch
            if ch == quote: quote = None
            continue
        if ch in '"\'':
            quote = ch; buf += ch; continue
        if ch == '{': depth += 1
        elif ch == '}': depth -= 1
        if ch.isspace() and depth == 0:
            if buf.strip(): out.append(buf.strip())
            buf = ''
        else:
            buf += ch
    if buf.strip(): out.append(buf.strip())
    return out

def convert(m):
    props, selfclose = m.group(1), m.group(2)
    toks = split_props(props)
    if 'item' not in toks:
        return m.group(0)                      # containers & already-migrated tags untouched
    sizes, rest = {}, []
    for t in toks:
        if t == 'item':
            continue
        mm = re.match(r'^(' + '|'.join(BP) + r')=(\{.*\}|"[^"]*")$', t, re.S)
        if mm:
            v = mm.group(2)
            sizes[mm.group(1)] = v[1:-1].strip() if v.startswith('{') else v
        else:
            rest.append(t)
    if sizes:
        inner = ', '.join(f'{k}: {sizes[k]}' for k in BP if k in sizes)
        rest.insert(0, 'size={{ %s }}' % inner)
    joined = (' ' + ' '.join(rest)) if rest else ''
    return f'<Grid{joined}{" " if selfclose else ""}{selfclose}>'

changed = []
for p in sys.argv[1:]:
    path = pathlib.Path(p)
    src = path.read_text(encoding='utf-8')
    new = TAG.sub(convert, src)
    if new != src:
        path.write_text(new, encoding='utf-8')
        changed.append((p, src.count('<Grid item')))
for p, n in changed:
    print(f'{n:3d}  {p}')
print(f'--- {len(changed)} files changed')

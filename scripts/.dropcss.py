
import io, re

def drop_rules(src, names):
    """Remove CSS rules owned by any class in `names`.

    Ownership is the FIRST class of the first compound selector, so a
    descendant rule like `.spec-act span` goes with `.spec-act`. Rules that
    contain a nested block (media queries) are never matched.
    """
    out, i, removed = [], 0, []
    for m in re.finditer(r'(?m)^([ 	]*)([^
{}]*?)\s*\{([^{}]*)\}
', src):
        sel = m.group(2).strip()
        if not sel or sel.startswith('@'):
            continue
        hit = False
        for part in sel.split(','):
            toks = part.strip().split()
            if not toks:
                continue
            first = re.match(r'\.([\w-]+)', toks[0])
            if first and first.group(1) in names:
                hit = True
        if not hit:
            continue
        out.append(src[i:m.start()]); i = m.end(); removed.append(sel)
    out.append(src[i:])
    return ''.join(out), removed

#!/usr/bin/env python3
"""Report fields a JSX page reads that no backing Java DTO/entity declares.

The most common defect in this codebase is a component binding to a field name
that does not exist on the DTO. Nothing errors -- the cell just renders "-", 0,
or blank -- so it survives code review and compilation and is only caught by
looking at real data. This makes that check mechanical.

Usage:
    check_dto_binding.py --jsx PAGE.jsx [PAGE2.jsx ...] --java DTO.java [ENTITY.java ...]

Exit status is 1 when suspicious reads are found, so it can gate a workflow.
"""
import argparse, re, sys, pathlib

# `private String fooBar;` / `private List<X> fooBar = ...;` / `private Map<A,B> x;`
JAVA_FIELD = re.compile(r'\bprivate\s+[\w<>,\[\]\.\s]+?\s+(\w+)\s*(?:=|;)')
# `record Foo(String a, int b)` component names
JAVA_RECORD = re.compile(r'\brecord\s+\w+\s*\(([^)]*)\)', re.S)
# obj.field -- the receiver is captured so single-letter map vars (o, s, c) work
JS_ACCESS = re.compile(r'\b([A-Za-z_$][\w$]*)\s*\??\.\s*([A-Za-z_$][\w$]*)')

# Reads that are JS/DOM/library surface, not DTO fields. Keeping this list tight
# matters: every false positive trains the reader to ignore real hits.
NOISE = {
    # JS/string/array/promise surface
    'length','map','filter','forEach','slice','split','join','push','pop','reduce','find','findIndex',
    'includes','indexOf','some','every','sort','concat','flat','flatMap','keys','values','entries',
    'toFixed','toString','toLocaleDateString','toLocaleString','toLocaleTimeString','toISOString',
    'charAt','trim','replace','padStart','padEnd','substring','substr','toUpperCase','toLowerCase',
    'startsWith','endsWith','match','repeat','at','then','catch','finally','has','get','set',
    'call','apply','bind','constructor','prototype','stack','message',
    # Spring Page envelope -- wraps the DTO, is not the DTO
    'content','totalElements','totalPages','numberOfElements','pageable','first','last','empty','number',
    # fetch/Response
    'json','text','blob','ok','headers','body','status','statusText','signal',
    # DOM / File / URL
    'href','download','click','remove','createObjectURL','revokeObjectURL','style','classList',
    'files','checked','currentTarget','target','preventDefault','stopPropagation','scrollIntoView',
    # MUI theme + palette
    'palette','primary','secondary','main','dark','light','contrastText','mode','spacing',
    'breakpoints','typography','shadows','shape',
    # local column/config descriptors used by every table page here
    'label','minWidth','maxWidth','sortField','align','icon','color','bg','chip',
    # React/query surface
    'data','current','props','state','isPending','isError','isLoading','error','refetch',
    'key','value','mutate','mutateAsync','isFetching','isSuccess',
}
# Receivers that are never a DTO row (React/JS objects), so their reads are skipped.
NON_DTO_RECEIVERS = {
    'e','event','err','error','res','response','req','theme','navigate','console','window','document',
    'Math','Object','Array','JSON','String','Number','Boolean','Date','Intl','React','api','process','import',
    'URL','a','el','node','ref','localStorage','sessionStorage','queryClient','params','searchParams',
}

def java_fields(paths):
    out = set()
    for p in paths:
        src = pathlib.Path(p).read_text(encoding='utf-8')
        out |= set(JAVA_FIELD.findall(src))
        for params in JAVA_RECORD.findall(src):
            for part in params.split(','):
                bits = part.strip().split()
                if len(bits) >= 2:
                    out.add(bits[-1])
    return out

def jsx_reads(paths):
    hits = {}
    for p in paths:
        for i, line in enumerate(pathlib.Path(p).read_text(encoding='utf-8').splitlines(), 1):
            if line.lstrip().startswith(('//', '*', '/*')):
                continue
            for recv, field in JS_ACCESS.findall(line):
                if not field[:1].isalpha() or field[:1].isupper():
                    continue  # $-artifacts from template literals, and Components
                if recv in NON_DTO_RECEIVERS or field in NOISE:
                    continue
                hits.setdefault(field, []).append(f'{p}:{i}')
    return hits

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--jsx', nargs='+', required=True)
    ap.add_argument('--java', nargs='+', required=True)
    ap.add_argument('--quiet', action='store_true', help='print only suspicious reads')
    a = ap.parse_args()

    declared, reads = java_fields(a.java), jsx_reads(a.jsx)
    unknown = {f: locs for f, locs in reads.items() if f not in declared}

    if not a.quiet:
        print(f'{len(declared)} fields declared across {len(a.java)} Java file(s)')
        print(f'{len(reads)} distinct fields read across {len(a.jsx)} JSX file(s)\n')
    if not unknown:
        print('OK - every field read is declared on a backing Java type.')
        return 0
    print(f'{len(unknown)} read(s) NOT declared on any supplied Java type:\n')
    for f in sorted(unknown):
        locs = unknown[f]
        print(f'  {f}')
        for loc in locs[:3]:
            print(f'      {loc}')
        if len(locs) > 3:
            print(f'      ... +{len(locs)-3} more')
    print('\nEach is either a genuine typo, a field resolved in the service layer')
    print('(legitimate -- confirm it is populated), or local UI state (harmless).')
    return 1

if __name__ == '__main__':
    sys.exit(main())

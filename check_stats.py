import httpx

s = httpx.get('http://127.0.0.1:8000/api/sections').json()
tr = httpx.get('http://127.0.0.1:8000/api/corridor/trains/all').json()
w = httpx.get('http://127.0.0.1:8000/api/corridor/windows/all').json()
tk = httpx.get('http://127.0.0.1:8000/api/tasks').json()

print(f"Total: {len(s)} sections, {len(tr)} trains, {len(w)} windows, {len(tk)} tasks")
for x in s:
    sec_tr = [t for t in tr if t.get('section_id') == x['id'] or t.get('section_name') == x['name']]
    sec_w = [win for win in w if win.get('section_id') == x['id'] or win.get('section_name') == x['name']]
    sec_tk = [tsk for tsk in tk if tsk.get('section_id') == x['id'] or tsk.get('section_name') == x['name']]
    print(f"Section {x['name']}: {len(sec_tr)} trains, {len(sec_w)} windows, {len(sec_tk)} tasks")

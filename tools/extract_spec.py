import pathlib,re,zlib
b=next(pathlib.Path('..').glob('*.pdf')).read_bytes()
objs={int(n):v for n,v in re.findall(rb'(\d+) 0 obj\s*(.*?)endobj',b,re.S)}
def stream(o):
 m=re.search(rb'stream\r?\n(.*?)\r?\nendstream',o,re.S)
 if not m:return ''
 try:return zlib.decompress(m[1]).decode('latin1')
 except:return ''
maps={}
for f in range(4,9):
 ref=int(re.search(rb'/ToUnicode (\d+) 0 R',objs[f])[1]);s=stream(objs[ref]);mp={}
 for section in re.findall(r'beginbfchar(.*?)endbfchar',s,re.S):
  for a,c in re.findall(r'<(\w+)>\s*<(\w+)>',section):mp[int(a,16)]=bytes.fromhex(c).decode('utf-16-be')
 for section in re.findall(r'beginbfrange(.*?)endbfrange',s,re.S):
  for a,c,d in re.findall(r'<(\w+)>\s*<(\w+)>\s*<(\w+)>',section):
   for x in range(int(a,16),int(c,16)+1):mp[x]=chr(int(d,16)+x-int(a,16))
 maps[f]=mp
out=[]
for o in objs.values():
 s=stream(o)
 if ' Tj' not in s:continue
 font=5;line=''
 for m in re.finditer(r'/F(\d+) [\d.]+ Tf|<([A-Fa-f0-9]+)> Tj|\bET\b',s):
  if m[1]:font=int(m[1])
  elif m[2]:line+=''.join(maps.get(font,{}).get(int(m[2][i:i+4],16),'?') for i in range(0,len(m[2]),4))
  else:
   if line:out.append(line)
   line=''
pathlib.Path('BUILD_SPEC.txt').write_text('\n'.join(out),encoding='utf8')

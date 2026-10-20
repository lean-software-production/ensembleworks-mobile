"""Data-driven inline SVGs for the standalone E008 sketchbook results page."""
import html

def svg(title,desc,body,viewbox):
 return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" aria-label="{html.escape(title,quote=True)}"><title>{html.escape(title)}</title><desc>{html.escape(desc)}</desc>{body}</svg>'
def label(x,y,text,cls='',anchor='start'):
 return f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{html.escape(str(text))}</text>'
def box(x,y,w,h,text,fill='var(--sk-bubble)',cls='node'):
 return f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}"/>'+label(x+w/2,y+h/2+6,text,'node-label','middle')
def edge(path,extra=''):
 return f'<path class="edge {extra}" d="{path}"/>'
def review():
 body=box(8,49,140,52,'Author / planner','var(--sk-ribbon)')
 for y,text,fill in [(7,'Opus 5.5','#fce2d5'),(60,'Gemini 4 Argon','#d5e9df'),(113,'GPT-6 Astra','#dceaf1')]:
  body+=box(229,y,184,38,text,fill)+edge(f'M148 75 H188 V{y+19} H225')+edge(f'M413 {y+19} H455 V75 H491')
 body+=box(495,49,166,52,'Synthesis','var(--sk-ribbon)')+edge('M661 75 H736')+box(740,49,190,52,'Approved units','#d5e9df')
 body+=edge('M578 104 V169 H78 V105','dashed')+label(500,160,'revise plan','small','middle')+label(320,192,'all three reviewers · high','small','middle')+label(836,126,'then execute below','small','middle')
 return svg('Every line uses the same three-brain review','The author/planner proposes contracts and grouping. Opus 5.5, Gemini 4 Argon and GPT-6 Astra review in parallel at high reasoning. Synthesis either sends revisions to the author or approves execution units.',body,'0 0 940 200')
def unit_strip(groups):
 body='';x=12;cell=17;gap=3;groupgap=8
 for group in groups:
  width=group*cell+(group-1)*gap
  body+=f'<rect x="{x-3}" y="5" width="{width+6}" height="30" rx="5" fill="var(--unit-tint)" stroke="var(--unit-color)" stroke-width="1.5"/>'
  for _ in range(group):
   body+=f'<rect x="{x}" y="11" width="{cell}" height="18" rx="2" fill="var(--unit-color)" opacity=".75"/>';x+=cell+gap
  x+=groupgap-gap
 return svg('Reviewed task grouping','Each small block represents one of the same thirteen tasks. Enclosing outlines mark units implemented and validated together.',body,'0 0 342 42')
def line_diagram(mode):
 unit={'ralph':'Dispatch 1 task','one-shot':'Dispatch all 13 tasks','implement-in-batches':'Dispatch 1 batch'}[mode]
 body=box(60,9,180,35,unit,'var(--unit-tint)')+edge('M150 46 V66')
 body+=box(85,70,130,35,'Doer · low','#fff')+edge('M150 107 V126')
 body+=box(85,130,130,35,'Validator · high','#fff')
 body+=edge('M216 147 H263 V87 H220')+label(270,122,'retry','small','middle')
 body+=edge('M150 168 V187')+label(186,182,'pass','small','middle')+box(85,191,130,35,'Commit','#d5e9df')
 if mode=='one-shot':body+=edge('M150 229 V247')+label(150,267,'Finish','node-label','middle')
 else:
  body+=edge('M83 209 H27 V26 H55')+label(17,120,'next','small','middle')+label(150,262,'all units done → finish','small','middle')
 return svg('Doer-validator execution loop for '+mode,'Dispatch a fixed reviewed unit, implement it, validate it independently, retry product defects within the same unit, and commit accepted work. Continue to the next unit, or finish when all units are done. Plan defects return to shared author/review.',body,'0 0 300 280')
def card(mode,r):
 names={'ralph':('01','Ralph',[1]*13),'one-shot':('02','One-shot',[13]),'implement-in-batches':('03','Logical batches',[5,4,4])}
 n,title,groups=names[mode];commits=r.get('commits',0)
 return f'<article class="line-card {mode}"><div class="card-top"><span>{n}</span><h3>{title}</h3><span class="unit-count">{commits} {'unit' if commits==1 else 'units'}</span></div><a class="line-name" href="../tetris/{r["id"]}/.assembly-lines/{r["line"]}.dot">{r["line"]}</a>{unit_strip(groups)}{line_diagram(mode)}<p class="group-caption">'+({'ralph':'1 + 1 + 1 + … + 1','one-shot':'13 tasks together','implement-in-batches':'5 + 4 + 4 tasks'}[mode])+'</p></article>'
def io_chart(runs):
 colors={'plan_review':'#EEA306','implementation':'#039695','validation':'#1F78A8'};body='';maximum=max(r['metrics']['io'] for r in runs);scale=520/maximum
 for i,r in enumerate(runs):
  y=25+i*53;name={'ralph':'Ralph*','one-shot':'One-shot','implement-in-batches':'Batches'}[r['mode']];body+=label(2,y+21,name,'chart-label');x=103
  for phase,color in colors.items():
   p=r['metrics']['phases'][phase];value=p['input']+p['output'];width=value*scale
   body+=f'<rect x="{x:.2f}" y="{y}" width="{width:.2f}" height="30" fill="{color}" stroke="#fff" stroke-width="1"><title>{phase}: {value:,} tokens</title></rect>';x+=width
  prefix='≥ ' if r.get('last_call_usage_unknown') else '';body+=label(x+9,y+22,prefix+f"{r['metrics']['io']/1000:.1f}k",'chart-value')
 for x,text,color in [(105,'Plan + review','#EEA306'),(295,'Doer','#039695'),(423,'Validator','#1F78A8')]:
  body+=f'<rect x="{x}" y="190" width="15" height="15" rx="2" fill="{color}"/>'+label(x+23,203,text,'small')
 return svg('Reported input plus output tokens by phase','Ralph: at least 985,760 tokens; one-shot: 337,984; logical batches: 506,045. All bars share a zero baseline and a common scale. Phase costs include correction attempts. Ralph has an interrupted call with unknown usage.',body,'0 0 750 220')
def cache_chart(runs):
 body='';maximum=max(r['metrics']['cache_read'] for r in runs)
 for i,r in enumerate(runs):
  y=25+i*53;name={'ralph':'Ralph*','one-shot':'One-shot','implement-in-batches':'Batches'}[r['mode']];width=205*r['metrics']['cache_read']/maximum
  body+=label(0,y+20,name,'chart-label')+f'<rect x="97" y="{y}" width="{width:.2f}" height="30" rx="3" fill="#4A7D4B" opacity=".85"/>'
  prefix='≥ ' if r.get('last_call_usage_unknown') else '';body+=label(97+width+8,y+21,prefix+f"{r['metrics']['cache_read']/1000000:.2f}m",'chart-value')
 body+=label(98,204,'Reported separately from I/O.','small')
 return svg('Reported cache-read tokens','Ralph at least 3,877,392; one-shot 1,170,146; logical batches 1,665,509. These counters are not cache-hit rates, context size or dollar costs. Missing counters remain unknown.',body,'0 0 405 220')
def gates_chart(runs):
 body=''
 for i,r in enumerate(runs):
  accepted=r['commits'];rejected=r['metrics']['validator_calls']-accepted;y=15+i*34
  body+=label(0,y+16,{'ralph':'Ralph*','one-shot':'One-shot','implement-in-batches':'Batches'}[r['mode']],'chart-label')
  for j in range(accepted+rejected):
   color='#4A7D4B' if j<accepted else '#F76C37';body+=f'<rect x="{115+j*26}" y="{y}" width="19" height="20" rx="3" fill="{color}"/>'
  body+=label(525,y+16,f'{accepted} accepted + {rejected} corrections','small')
 body+=f'<rect x="748" y="26" width="14" height="14" rx="2" fill="#4A7D4B"/>'+label(770,38,'accepted unit','small')+f'<rect x="748" y="57" width="14" height="14" rx="2" fill="#F76C37"/>'+label(770,69,'rejected attempt','small')
 return svg('Validation gates: accepted units versus correction attempts','Each square is a validator call, grouped by outcome, not chronological order. Ralph: 13 accepted and 2 rejected; one-shot: 1 accepted and 2 rejected; logical batches: 3 accepted and 3 rejected. Ralph also had one interrupted doer call, not shown here.',body,'0 0 940 110')
def render(template,data):
 runs=data['runs'];by_mode={r['mode']:r for r in runs};one=by_mode['one-shot']['metrics'];batch=by_mode['implement-in-batches']['metrics']
 values={'REVIEW_DIAGRAM':review(),'LINE_DIAGRAMS':''.join(card(mode,by_mode[mode]) for mode in ['ralph','one-shot','implement-in-batches']),'IO_CHART':io_chart(runs),'CACHE_CHART':cache_chart(runs),'GATES_CHART':gates_chart(runs),'IO_SAVING':f"{(1-one['io']/batch['io'])*100:.0f}",'CACHE_SAVING':f"{(1-one['cache_read']/batch['cache_read'])*100:.0f}",'UPDATED':html.escape(data['updated']),'COMPLETED_DATE':'20 October 2026'}
 for key,value in values.items():template=template.replace('{{'+key+'}}',value)
 return template

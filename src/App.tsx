import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import './App.css'

type Tab = 'vault' | 'ledger'
type SortOption = 'newest' | 'oldest' | 'title'
type RiskScore = 'Low' | 'Medium' | 'High' | 'Critical'
type ActionSurface = 'read-only' | 'write' | 'send' | 'delete' | 'spend' | 'deploy' | 'modify' | 'other'
type StatusTone = 'success' | 'error'

interface PromptItem { id:string; title:string; category:string; tags:string[]; useCase:string; body:string; notes:string; createdAt:string; updatedAt:string }
interface RiskAssessment { id:string; name:string; actionDescription:string; actionSurface:ActionSurface; requiredContext:string; missingContextRisks:string; blastRadius:string; liveConditionGates:string; humanApprovalRequired:boolean; rollbackPath:string; riskScore:RiskScore; recommendation:string; createdAt:string; updatedAt:string }

interface StatusMessage { tone: StatusTone; text: string }

const nowISO = () => new Date().toISOString()
const uid = () => Math.random().toString(36).slice(2, 10)

const starterPrompts: PromptItem[] = [
  { id: uid(), title: 'Codex Focused Build Prompt', category: 'Build', tags: ['codex', 'implementation'], useCase: 'Ship feature MVP quickly', body: 'You are a senior AI operator. Build [feature] as an MVP. Prioritize working code, simple architecture, and verifiable checks. Return changed files, commands run, and known risks.', notes: 'Use before coding sessions.', createdAt: nowISO(), updatedAt: nowISO() },
  { id: uid(), title: 'ChatGPT Research Prompt', category: 'Research', tags: ['research', 'summary'], useCase: 'Analyze fast-moving topic', body: 'Research the latest credible sources about [topic]. Compare at least 3 sources, call out disagreements, and provide a concise recommendation with confidence level.', notes: 'Good for time-sensitive exploration.', createdAt: nowISO(), updatedAt: nowISO() },
  { id: uid(), title: 'AI Agent Risk Assessment Prompt', category: 'Risk', tags: ['safety', 'audit'], useCase: 'Pre-action risk review', body: 'Assess this agent action for context sufficiency, blast radius, reversibility, and approval needs. Return risk level, blockers, and go/no-go recommendation.', notes: 'Use before write/delete/deploy actions.', createdAt: nowISO(), updatedAt: nowISO() },
  { id: uid(), title: 'LinkedIn Operator Post Prompt', category: 'Content', tags: ['linkedin', 'writing'], useCase: 'Operator thought leadership posts', body: 'Draft a clear LinkedIn post about [topic] in operator voice. Include hook, 3 practical insights, and a short CTA. Keep it specific and non-hype.', notes: 'Works well with concrete examples.', createdAt: nowISO(), updatedAt: nowISO() },
  { id: uid(), title: 'Bosnian Language QA Prompt', category: 'Localization', tags: ['bosnian', 'qa'], useCase: 'Language quality check', body: 'Review this Bosnian text for grammar, clarity, and natural tone. Provide corrected version and explain key fixes briefly.', notes: 'Useful for bilingual review workflows.', createdAt: nowISO(), updatedAt: nowISO() },
]

const starterAssessment: RiskAssessment = {
  id: uid(),
  name: 'Repository-wide auto-format task',
  actionDescription: 'Agent runs formatting on all source files and commits changes.',
  actionSurface: 'write',
  requiredContext: 'Formatting rules, excluded paths, branch protection rules.',
  missingContextRisks: 'Can alter generated/vendor files; may create noisy diffs and accidental behavior changes.',
  blastRadius: 'Medium: touches many files but usually reversible.',
  liveConditionGates: 'Run in feature branch, preview diff before commit, block if file count exceeds threshold.',
  humanApprovalRequired: true,
  rollbackPath: 'Reset branch to previous commit and re-run with narrowed scope.',
  riskScore: 'Medium',
  recommendation: 'Proceed with approval and scoped file list only.',
  createdAt: nowISO(),
  updatedAt: nowISO(),
}

const emptyPromptForm = { title: '', category: '', tags: '', useCase: '', body: '', notes: '' }
const emptyRiskForm = { name: '', actionDescription: '', actionSurface: 'read-only' as ActionSurface, requiredContext: '', missingContextRisks: '', blastRadius: '', liveConditionGates: '', humanApprovalRequired: false, rollbackPath: '', riskScore: 'Low' as RiskScore, recommendation: '' }

export default function App() {
  const [tab, setTab] = useState<Tab>('vault')
  const [status, setStatus] = useState<StatusMessage | null>(null)

  const [prompts, setPrompts] = useState<PromptItem[]>(() => loadData('okl_prompts', starterPrompts))
  const [assessments, setAssessments] = useState<RiskAssessment[]>(() => loadData('okl_assessments', [starterAssessment]))

  const persistPrompts = (next: PromptItem[]) => { setPrompts(next); localStorage.setItem('okl_prompts', JSON.stringify(next)) }
  const persistAssessments = (next: RiskAssessment[]) => { setAssessments(next); localStorage.setItem('okl_assessments', JSON.stringify(next)) }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Operator Kit Lite</h1>
          <p className="subtitle">Local-first toolkit for prompt operations and pre-action agent risk checks.</p>
        </div>
        <div className="tabs">
          <button className={tab === 'vault' ? 'active' : ''} onClick={() => setTab('vault')}>Prompt Vault</button>
          <button className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}>Agent Risk Ledger</button>
        </div>
      </header>
      {status && <p className={`status ${status.tone}`}>{status.text}</p>}
      {tab === 'vault' ? (
        <PromptVault prompts={prompts} persistPrompts={persistPrompts} onStatus={setStatus} />
      ) : (
        <RiskLedger assessments={assessments} persistAssessments={persistAssessments} onStatus={setStatus} />
      )}
    </div>
  )
}

function PromptVault({ prompts, persistPrompts, onStatus }: { prompts: PromptItem[]; persistPrompts: (items: PromptItem[]) => void; onStatus: (s: StatusMessage) => void }) {
  const [form, setForm] = useState(emptyPromptForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<SortOption>('newest')
  const categories = Array.from(new Set(prompts.map((p) => p.category))).filter(Boolean)

  const visible = useMemo(() => {
    const q = search.toLowerCase()
    return prompts.filter((p) => category === 'all' || p.category === category).filter((p) => [p.title,p.body,p.useCase,p.notes,p.tags.join(' ')].join(' ').toLowerCase().includes(q)).sort((a,b)=> sort==='title' ? a.title.localeCompare(b.title) : sort==='oldest' ? +new Date(a.createdAt)- +new Date(b.createdAt) : +new Date(b.createdAt)- +new Date(a.createdAt))
  }, [prompts, category, search, sort])

  const submit = (e: FormEvent) => {
    e.preventDefault(); const ts = nowISO(); const tags = form.tags.split(',').map((t)=>t.trim()).filter(Boolean)
    if (editingId) {
      persistPrompts(prompts.map((p)=>p.id===editingId ? { ...p, ...form, tags, updatedAt: ts } : p));
      onStatus({ tone: 'success', text: 'Prompt updated.' })
    } else {
      persistPrompts([{ id: uid(), ...form, tags, createdAt: ts, updatedAt: ts }, ...prompts])
      onStatus({ tone: 'success', text: 'Prompt added.' })
    }
    setForm(emptyPromptForm); setEditingId(null); setIsOpen(false)
  }

  return <section>
    <h2>Prompt Vault</h2>
    <div className="section-actions"><button onClick={()=>setIsOpen((v)=>!v)}>{isOpen ? 'Close Form' : 'Add New Prompt'}</button></div>
    {isOpen && <form className="card form" onSubmit={submit}>{field('Title', <input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} required/>)}{field('Category', <input value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}/>)}{field('Tags (comma separated)', <input value={form.tags} onChange={(e)=>setForm({...form,tags:e.target.value})}/>)}{field('Use Case', <input value={form.useCase} onChange={(e)=>setForm({...form,useCase:e.target.value})} required/>)}{field('Prompt Body', <textarea value={form.body} onChange={(e)=>setForm({...form,body:e.target.value})} required/>)}{field('Notes', <textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/>)}<div className="actions"><button type="submit">{editingId?'Update Prompt':'Save Prompt'}</button>{editingId && <button type="button" onClick={()=>{setEditingId(null);setForm(emptyPromptForm);setIsOpen(false)}}>Cancel edit</button>}</div></form>}
    <div className="toolbar card">{field('Search',<input value={search} onChange={(e)=>setSearch(e.target.value)}/>)}{field('Category',<select value={category} onChange={(e)=>setCategory(e.target.value)}><option value="all">All</option>{categories.map((c)=><option key={c}>{c}</option>)}</select>)}{field('Sort',<select value={sort} onChange={(e)=>setSort(e.target.value as SortOption)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title</option></select>)}<div className="actions"><button onClick={()=>{downloadJson('prompts.json',prompts);onStatus({tone:'success',text:'Prompts exported to JSON.'})}}>Export JSON</button><label className="btn">Import JSON<input type="file" accept="application/json" onChange={(e)=>importPrompts(e,persistPrompts,onStatus)}/></label></div></div>
    <div className="list">{visible.length===0 ? <p className="empty">No prompts found.</p> : visible.map((p)=><article className="card" key={p.id}><h3>{p.title}</h3><p>{p.body}</p><small>{p.category} · {p.tags.join(', ')}</small><div className="actions"><button onClick={()=>copyText(p.body,onStatus,'Prompt copied.')}>Copy</button><button onClick={()=>{setEditingId(p.id);setForm({...p,tags:p.tags.join(', ')});setIsOpen(true)}}>Edit</button><button onClick={()=>{if(confirm('Delete this prompt?')) {persistPrompts(prompts.filter((x)=>x.id!==p.id));onStatus({tone:'success',text:'Prompt deleted.'})}}}>Delete</button></div></article>)}</div>
  </section>
}

function RiskLedger({ assessments, persistAssessments, onStatus }: { assessments: RiskAssessment[]; persistAssessments: (items: RiskAssessment[]) => void; onStatus: (s: StatusMessage) => void }) {
  const [form, setForm] = useState(emptyRiskForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all'|RiskScore>('all')
  const visible = useMemo(()=> assessments.filter((a)=> (filter==='all' || a.riskScore===filter) && [a.name,a.actionDescription,a.requiredContext,a.recommendation].join(' ').toLowerCase().includes(search.toLowerCase())), [assessments,filter,search])

  const submit = (e: FormEvent) => {
    e.preventDefault(); const ts = nowISO()
    if (editingId) { persistAssessments(assessments.map((a)=>a.id===editingId?{...a,...form,updatedAt:ts}:a)); onStatus({tone:'success',text:'Assessment updated.'}) }
    else { persistAssessments([{id:uid(),...form,createdAt:ts,updatedAt:ts},...assessments]); onStatus({tone:'success',text:'Assessment added.'}) }
    setForm(emptyRiskForm); setEditingId(null); setIsOpen(false)
  }

  return <section>
    <h2>Agent Risk Ledger</h2>
    <div className="section-actions"><button onClick={()=>setIsOpen((v)=>!v)}>{isOpen ? 'Close Form' : 'Add New Assessment'}</button></div>
    {isOpen && <form className="card form" onSubmit={submit}>{field('Name', <input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required/>)}{field('Action Description',<textarea value={form.actionDescription} onChange={(e)=>setForm({...form,actionDescription:e.target.value})} required/>)}{field('Action Surface',<select value={form.actionSurface} onChange={(e)=>setForm({...form,actionSurface:e.target.value as ActionSurface})}>{['read-only','write','send','delete','spend','deploy','modify','other'].map((v)=><option key={v}>{v}</option>)}</select>)}{field('Required Context',<textarea value={form.requiredContext} onChange={(e)=>setForm({...form,requiredContext:e.target.value})}/>)}{field('Missing Context Risks',<textarea value={form.missingContextRisks} onChange={(e)=>setForm({...form,missingContextRisks:e.target.value})}/>)}{field('Blast Radius',<textarea value={form.blastRadius} onChange={(e)=>setForm({...form,blastRadius:e.target.value})}/>)}{field('Live Condition Gates',<textarea value={form.liveConditionGates} onChange={(e)=>setForm({...form,liveConditionGates:e.target.value})}/>)}{field('Rollback Path',<textarea value={form.rollbackPath} onChange={(e)=>setForm({...form,rollbackPath:e.target.value})}/>)}{field('Risk Score',<select value={form.riskScore} onChange={(e)=>setForm({...form,riskScore:e.target.value as RiskScore})}>{['Low','Medium','High','Critical'].map((v)=><option key={v}>{v}</option>)}</select>)}{field('Recommendation',<textarea value={form.recommendation} onChange={(e)=>setForm({...form,recommendation:e.target.value})}/>)}<label className="check"><input type="checkbox" checked={form.humanApprovalRequired} onChange={(e)=>setForm({...form,humanApprovalRequired:e.target.checked})}/>Human Approval Required</label><div className="actions"><button type="submit">{editingId?'Update Assessment':'Save Assessment'}</button>{editingId && <button type="button" onClick={()=>{setEditingId(null);setForm(emptyRiskForm);setIsOpen(false)}}>Cancel edit</button>}</div></form>}
    <div className="toolbar card">{field('Search',<input value={search} onChange={(e)=>setSearch(e.target.value)}/>)}{field('Risk Score',<select value={filter} onChange={(e)=>setFilter(e.target.value as 'all'|RiskScore)}><option value="all">All</option>{['Low','Medium','High','Critical'].map((v)=><option key={v}>{v}</option>)}</select>)}<div className="actions"><button onClick={()=>{downloadJson('assessments.json',assessments);onStatus({tone:'success',text:'Assessments exported to JSON.'})}}>Export JSON</button><label className="btn">Import JSON<input type="file" accept="application/json" onChange={(e)=>importAssessments(e,persistAssessments,onStatus)}/></label></div></div>
    <div className="list">{visible.length===0 ? <p className="empty">No assessments found.</p> : visible.map((r)=><article className="card" key={r.id}><h3>{r.name}</h3><p>{r.actionDescription}</p><small>{r.riskScore} · {r.actionSurface}</small><div className="actions"><button onClick={()=>copyText(toMarkdown(r),onStatus,'Assessment copied as markdown.')}>Copy Markdown</button><button onClick={()=>{setEditingId(r.id);setForm({...r});setIsOpen(true)}}>Edit</button><button onClick={()=>{if(confirm('Delete this assessment?')) {persistAssessments(assessments.filter((x)=>x.id!==r.id));onStatus({tone:'success',text:'Assessment deleted.'})}}}>Delete</button></div></article>)}</div>
  </section>
}

function field(label: string, input: ReactNode) { return <label className="field"><span>{label}</span>{input}</label> }
function loadData<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback } }
function downloadJson(name: string, data: unknown) { const b = new Blob([JSON.stringify(data,null,2)], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; a.click(); URL.revokeObjectURL(a.href) }
async function copyText(text: string, onStatus: (s: StatusMessage)=>void, message: string) { try { await navigator.clipboard.writeText(text); onStatus({tone:'success',text:message}) } catch { onStatus({tone:'error',text:'Clipboard copy failed.'}) } }

function importPrompts(e: ChangeEvent<HTMLInputElement>, persist: (items: PromptItem[])=>void, onStatus: (s: StatusMessage)=>void) {
  const file = e.target.files?.[0]; if (!file) return
  file.text().then((txt)=>{ try { const data=JSON.parse(txt); if (!Array.isArray(data)) throw new Error('File must be an array.'); const valid=data.filter(isPrompt); if (!valid.length) throw new Error('No valid prompt items found.'); persist(valid); onStatus({tone:'success',text:`Imported ${valid.length} prompt(s).`}) } catch (err) { onStatus({tone:'error',text:`Prompt import failed: ${(err as Error).message}`}) } })
}
function importAssessments(e: ChangeEvent<HTMLInputElement>, persist: (items: RiskAssessment[])=>void, onStatus: (s: StatusMessage)=>void) {
  const file = e.target.files?.[0]; if (!file) return
  file.text().then((txt)=>{ try { const data=JSON.parse(txt); if (!Array.isArray(data)) throw new Error('File must be an array.'); const valid=data.filter(isAssessment); if (!valid.length) throw new Error('No valid assessment items found.'); persist(valid); onStatus({tone:'success',text:`Imported ${valid.length} assessment(s).`}) } catch (err) { onStatus({tone:'error',text:`Assessment import failed: ${(err as Error).message}`}) } })
}

const isPrompt = (i: unknown): i is PromptItem => { const x=i as PromptItem; return Boolean(x?.title && x?.useCase && x?.body) }
const isAssessment = (i: unknown): i is RiskAssessment => { const x=i as RiskAssessment; return Boolean(x?.name && x?.actionDescription && x?.actionSurface && x?.riskScore) }
const toMarkdown = (r: RiskAssessment) => `# Agent Risk Assessment: ${r.name}\n\n## Action\n${r.actionDescription}\n\n## Action Surface\n${r.actionSurface}\n\n## Required Context\n${r.requiredContext}\n\n## Missing Context Risks\n${r.missingContextRisks}\n\n## Blast Radius\n${r.blastRadius}\n\n## Live Condition Gates\n${r.liveConditionGates}\n\n## Human Approval Required\n${r.humanApprovalRequired ? 'Yes' : 'No'}\n\n## Rollback Path\n${r.rollbackPath}\n\n## Risk Score\n${r.riskScore}\n\n## Recommendation\n${r.recommendation}`

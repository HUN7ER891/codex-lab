import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type SortOption = 'newest' | 'oldest' | 'title'
type Tab = 'vault' | 'ledger'
type RiskScore = 'Low' | 'Medium' | 'High' | 'Critical'
type ActionSurface =
  | 'read-only'
  | 'write'
  | 'send'
  | 'delete'
  | 'spend'
  | 'deploy'
  | 'modify'
  | 'other'

interface PromptItem {
  id: string
  title: string
  category: string
  tags: string[]
  useCase: string
  body: string
  notes: string
  createdAt: string
  updatedAt: string
}

interface RiskAssessment {
  id: string
  name: string
  actionDescription: string
  actionSurface: ActionSurface
  requiredContext: string
  missingContextRisks: string
  blastRadius: string
  liveConditionGates: string
  humanApprovalRequired: boolean
  rollbackPath: string
  riskScore: RiskScore
  recommendation: string
  createdAt: string
  updatedAt: string
}

const nowISO = () => new Date().toISOString()
const uid = () => Math.random().toString(36).slice(2, 10)

const starterPrompts: PromptItem[] = [
  { id: uid(), title: 'Codex Focused Build Prompt', category: 'Build', tags: ['codex', 'implementation'], useCase: 'Ship feature MVP quickly', body: 'You are a senior AI operator. Build [feature] as an MVP. Prioritize working code, simple architecture, and verifiable checks. Return changed files, commands run, and known risks.', notes: 'Use before coding sessions.', createdAt: nowISO(), updatedAt: nowISO() },
  { id: uid(), title: 'ChatGPT Research Prompt', category: 'Research', tags: ['research', 'summary'], useCase: 'Analyze fast-moving topic', body: 'Research the latest credible sources about [topic]. Compare at least 3 sources, call out disagreements, and provide a concise recommendation with confidence level.', notes: 'Good for time-sensitive exploration.', createdAt: nowISO(), updatedAt: nowISO() },
  { id: uid(), title: 'AI Agent Risk Assessment Prompt', category: 'Risk', tags: ['safety', 'audit'], useCase: 'Pre-action risk review', body: 'Assess this agent action for context sufficiency, blast radius, reversibility, and approval needs. Return risk level, blockers, and go/no-go recommendation.', notes: 'Use before write/delete/deploy actions.', createdAt: nowISO(), updatedAt: nowISO() },
  { id: uid(), title: 'LinkedIn Operator Post Prompt', category: 'Content', tags: ['linkedin', 'writing'], useCase: 'Operator thought leadership posts', body: 'Draft a clear LinkedIn post about [topic] in operator voice. Include hook, 3 practical insights, and a short CTA. Keep it specific and non-hype.', notes: 'Works well with concrete examples.', createdAt: nowISO(), updatedAt: nowISO() },
  { id: uid(), title: 'Bosnian Language QA Prompt', category: 'Localization', tags: ['bosnian', 'qa'], useCase: 'Language quality check', body: 'Review this Bosnian text for grammar, clarity, and natural tone. Provide corrected version and explain key fixes briefly.', notes: 'Useful for bilingual review workflows.', createdAt: nowISO(), updatedAt: nowISO() },
]

const emptyPrompt = { title: '', category: '', tags: '', useCase: '', body: '', notes: '' }
const emptyRisk = { name: '', actionDescription: '', actionSurface: 'read-only' as ActionSurface, requiredContext: '', missingContextRisks: '', blastRadius: '', liveConditionGates: '', humanApprovalRequired: false, rollbackPath: '', riskScore: 'Low' as RiskScore, recommendation: '' }

function App() {
  const [tab, setTab] = useState<Tab>('vault')
  const [promptForm, setPromptForm] = useState(emptyPrompt)
  const [riskForm, setRiskForm] = useState(emptyRisk)
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null)
  const [promptSearch, setPromptSearch] = useState('')
  const [promptCategory, setPromptCategory] = useState('all')
  const [promptSort, setPromptSort] = useState<SortOption>('newest')
  const [riskSearch, setRiskSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<'all' | RiskScore>('all')
  const [promptError, setPromptError] = useState('')
  const [riskError, setRiskError] = useState('')

  const [prompts, setPrompts] = useState<PromptItem[]>(() => {
    const raw = localStorage.getItem('okl_prompts')
    if (!raw) return starterPrompts
    try { return JSON.parse(raw) as PromptItem[] } catch { return starterPrompts }
  })
  const [assessments, setAssessments] = useState<RiskAssessment[]>(() => {
    const raw = localStorage.getItem('okl_assessments')
    if (!raw) return []
    try { return JSON.parse(raw) as RiskAssessment[] } catch { return [] }
  })

  const persistPrompts = (next: PromptItem[]) => { setPrompts(next); localStorage.setItem('okl_prompts', JSON.stringify(next)) }
  const persistAssessments = (next: RiskAssessment[]) => { setAssessments(next); localStorage.setItem('okl_assessments', JSON.stringify(next)) }

  const filteredPrompts = useMemo(() => {
    const q = promptSearch.toLowerCase()
    return prompts
      .filter((p) => promptCategory === 'all' || p.category === promptCategory)
      .filter((p) => [p.title, p.body, p.useCase, p.notes, p.tags.join(' ')].join(' ').toLowerCase().includes(q))
      .sort((a, b) => promptSort === 'title' ? a.title.localeCompare(b.title) : promptSort === 'oldest' ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [prompts, promptCategory, promptSearch, promptSort])

  const filteredRisks = useMemo(() => {
    const q = riskSearch.toLowerCase()
    return assessments.filter((r) => (riskFilter === 'all' || r.riskScore === riskFilter) && [r.name, r.actionDescription, r.requiredContext, r.recommendation].join(' ').toLowerCase().includes(q))
  }, [assessments, riskFilter, riskSearch])

  const categories = Array.from(new Set(prompts.map((p) => p.category))).filter(Boolean)

  const savePrompt = (e: FormEvent) => {
    e.preventDefault()
    const ts = nowISO()
    if (editingPromptId) {
      persistPrompts(prompts.map((p) => p.id === editingPromptId ? { ...p, ...promptForm, tags: promptForm.tags.split(',').map((t) => t.trim()).filter(Boolean), updatedAt: ts } : p))
    } else {
      const item: PromptItem = { id: uid(), ...promptForm, tags: promptForm.tags.split(',').map((t) => t.trim()).filter(Boolean), createdAt: ts, updatedAt: ts }
      persistPrompts([item, ...prompts])
    }
    setPromptForm(emptyPrompt); setEditingPromptId(null)
  }

  const saveRisk = (e: FormEvent) => {
    e.preventDefault()
    const ts = nowISO()
    if (editingRiskId) {
      persistAssessments(assessments.map((r) => r.id === editingRiskId ? { ...r, ...riskForm, updatedAt: ts } : r))
    } else {
      persistAssessments([{ id: uid(), ...riskForm, createdAt: ts, updatedAt: ts }, ...assessments])
    }
    setRiskForm(emptyRisk); setEditingRiskId(null)
  }

  const copyText = async (text: string) => navigator.clipboard.writeText(text)
  const exportJson = (name: string, data: unknown) => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href) }

  const importPrompts = (file?: File) => {
    if (!file) return
    file.text().then((txt) => {
      try { const data = JSON.parse(txt) as PromptItem[]; if (!Array.isArray(data)) throw new Error(); persistPrompts(data); setPromptError('') } catch { setPromptError('Invalid prompt JSON file.') }
    })
  }
  const importRisks = (file?: File) => {
    if (!file) return
    file.text().then((txt) => {
      try { const data = JSON.parse(txt) as RiskAssessment[]; if (!Array.isArray(data)) throw new Error(); persistAssessments(data); setRiskError('') } catch { setRiskError('Invalid assessment JSON file.') }
    })
  }

  const riskMarkdown = (r: RiskAssessment) => `# Agent Risk Assessment: ${r.name}\n\n## Action\n${r.actionDescription}\n\n## Action Surface\n${r.actionSurface}\n\n## Required Context\n${r.requiredContext}\n\n## Missing Context Risks\n${r.missingContextRisks}\n\n## Blast Radius\n${r.blastRadius}\n\n## Live Condition Gates\n${r.liveConditionGates}\n\n## Human Approval Required\n${r.humanApprovalRequired ? 'Yes' : 'No'}\n\n## Rollback Path\n${r.rollbackPath}\n\n## Risk Score\n${r.riskScore}\n\n## Recommendation\n${r.recommendation}`

  return <div className="app"><header><h1>Operator Kit Lite</h1><div className="tabs"><button className={tab==='vault'?'active':''} onClick={()=>setTab('vault')}>Prompt Vault</button><button className={tab==='ledger'?'active':''} onClick={()=>setTab('ledger')}>Agent Risk Ledger</button></div></header>
  {tab==='vault' ? <section>
    <form className="card form" onSubmit={savePrompt}>{['title','category','useCase'].map((k)=><input key={k} placeholder={k} value={(promptForm as any)[k]} onChange={(e)=>setPromptForm({...promptForm,[k]:e.target.value})} required={k!=='category'} />)}<input placeholder="tags (comma separated)" value={promptForm.tags} onChange={(e)=>setPromptForm({...promptForm,tags:e.target.value})}/><textarea placeholder="body" value={promptForm.body} onChange={(e)=>setPromptForm({...promptForm,body:e.target.value})} required/><textarea placeholder="notes" value={promptForm.notes} onChange={(e)=>setPromptForm({...promptForm,notes:e.target.value})}/><button type="submit">{editingPromptId?'Update':'Add'} Prompt</button></form>
    <div className="toolbar"><input placeholder="search prompts" value={promptSearch} onChange={(e)=>setPromptSearch(e.target.value)} /><select value={promptCategory} onChange={(e)=>setPromptCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select><select value={promptSort} onChange={(e)=>setPromptSort(e.target.value as SortOption)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title</option></select><button onClick={()=>exportJson('prompts.json',prompts)}>Export JSON</button><label className="btn">Import JSON<input type="file" accept="application/json" onChange={(e)=>importPrompts(e.target.files?.[0])}/></label></div>{promptError && <p className="error">{promptError}</p>}
    <div className="list">{filteredPrompts.length===0?<p className="empty">No prompts yet.</p>:filteredPrompts.map(p=><article className="card" key={p.id}><h3>{p.title}</h3><p>{p.body}</p><small>{p.category} · {p.tags.join(', ')}</small><div className="actions"><button onClick={()=>copyText(p.body)}>Copy</button><button onClick={()=>{setEditingPromptId(p.id);setPromptForm({...p,tags:p.tags.join(', ')})}}>Edit</button><button onClick={()=>{if(confirm('Delete this prompt?')) persistPrompts(prompts.filter(x=>x.id!==p.id))}}>Delete</button></div></article>)}</div>
  </section> : <section>
    <form className="card form" onSubmit={saveRisk}><input placeholder="name" value={riskForm.name} onChange={(e)=>setRiskForm({...riskForm,name:e.target.value})} required/><textarea placeholder="actionDescription" value={riskForm.actionDescription} onChange={(e)=>setRiskForm({...riskForm,actionDescription:e.target.value})} required/><select value={riskForm.actionSurface} onChange={(e)=>setRiskForm({...riskForm,actionSurface:e.target.value as ActionSurface})}>{['read-only','write','send','delete','spend','deploy','modify','other'].map(v=><option key={v}>{v}</option>)}</select><textarea placeholder="requiredContext" value={riskForm.requiredContext} onChange={(e)=>setRiskForm({...riskForm,requiredContext:e.target.value})}/><textarea placeholder="missingContextRisks" value={riskForm.missingContextRisks} onChange={(e)=>setRiskForm({...riskForm,missingContextRisks:e.target.value})}/><textarea placeholder="blastRadius" value={riskForm.blastRadius} onChange={(e)=>setRiskForm({...riskForm,blastRadius:e.target.value})}/><textarea placeholder="liveConditionGates" value={riskForm.liveConditionGates} onChange={(e)=>setRiskForm({...riskForm,liveConditionGates:e.target.value})}/><label><input type="checkbox" checked={riskForm.humanApprovalRequired} onChange={(e)=>setRiskForm({...riskForm,humanApprovalRequired:e.target.checked})}/> Human approval required</label><textarea placeholder="rollbackPath" value={riskForm.rollbackPath} onChange={(e)=>setRiskForm({...riskForm,rollbackPath:e.target.value})}/><select value={riskForm.riskScore} onChange={(e)=>setRiskForm({...riskForm,riskScore:e.target.value as RiskScore})}>{['Low','Medium','High','Critical'].map(v=><option key={v}>{v}</option>)}</select><textarea placeholder="recommendation" value={riskForm.recommendation} onChange={(e)=>setRiskForm({...riskForm,recommendation:e.target.value})}/><button type="submit">{editingRiskId?'Update':'Add'} Assessment</button></form>
    <div className="toolbar"><input placeholder="search assessments" value={riskSearch} onChange={(e)=>setRiskSearch(e.target.value)} /><select value={riskFilter} onChange={(e)=>setRiskFilter(e.target.value as any)}><option value="all">All risk levels</option>{['Low','Medium','High','Critical'].map(v=><option key={v}>{v}</option>)}</select><button onClick={()=>exportJson('assessments.json',assessments)}>Export JSON</button><label className="btn">Import JSON<input type="file" accept="application/json" onChange={(e)=>importRisks(e.target.files?.[0])}/></label></div>{riskError && <p className="error">{riskError}</p>}
    <div className="list">{filteredRisks.length===0?<p className="empty">No assessments saved.</p>:filteredRisks.map(r=><article className="card" key={r.id}><h3>{r.name}</h3><p>{r.actionDescription}</p><small>{r.riskScore} · {r.actionSurface}</small><div className="actions"><button onClick={()=>copyText(riskMarkdown(r))}>Copy Markdown</button><button onClick={()=>{setEditingRiskId(r.id);setRiskForm({...r})}}>Edit</button><button onClick={()=>{if(confirm('Delete this assessment?')) persistAssessments(assessments.filter(x=>x.id!==r.id))}}>Delete</button></div></article>)}</div>
  </section>}</div>
}

export default App

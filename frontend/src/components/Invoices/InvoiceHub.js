import React, { useRef, useState } from 'react';
import './InvoiceHub.css';

/* ── helpers ── */
function toWords(n) {
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (!n) return 'Zero';
  if (n < 20) return a[n];
  if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' '+a[n%10] : '');
  if (n < 1000) return a[Math.floor(n/100)]+' Hundred'+(n%100?' '+toWords(n%100):'');
  if (n < 100000) return toWords(Math.floor(n/1000))+' Thousand'+(n%1000?' '+toWords(n%1000):'');
  if (n < 10000000) return toWords(Math.floor(n/100000))+' Lakh'+(n%100000?' '+toWords(n%100000):'');
  return toWords(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+toWords(n%10000000):'');
}
function amountWords(v) {
  const r=Math.floor(v), p=Math.round((v-r)*100);
  return toWords(r)+' Rupees'+(p?' and '+toWords(p)+' Paise':'')+' Only (Rs. '+v.toLocaleString('en-IN')+'-)';
}

const DEFAULTS = {
  trainerName:'VIKAS GOWDA J A', trainerTitle:'Azure DevOps Trainer',
  pan:'AAFCT5800M', gst:'29AAFCT5800M1ZZ',
  invoiceNo:'VIKAS/2026-27/01',
  invoiceDate: new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),
  poNo:'TNTPL/2026-27/04',
  billedToName:'Trans Neuron Technologies Pvt. Ltd.',
  billedToAddress:'Municipal No. 420, P/D No. 68-6-420\nIndiQube Assort, IV Block, 100 Feet Road,\nKoramangala, Bengaluru',
  billedToWebsite:'www.transneuron.com',
  courseName:'Azure DevOps', trainingPeriod:'6th March 2026 to 9th May 2026',
  mode:'Offline', totalSessions:'23 Sessions x 2 hrs = 46 Hours',
  bankAccountName:'VIKAS GOWDA J A', bankAccountNo:'10590150596',
  bankName:'ICICI BANK', ifscCode:'ICIC0001059',
  terms:'1. Payment Terms: 30 Working Days from the date of Invoice.\n2. Subject to Bangalore Jurisdiction.\n3. Any training cancellations due to poor feedback — this agreement would stand void.',
};

const DEF_SESSIONS = [
  {date:'05-Mar-2026 (Fri)',hours:2,rate:1400},
  {date:'07-Mar-2026 (Sat)',hours:2,rate:1400},
  {date:'08-Mar-2026 (Sun)',hours:2,rate:1400},
];

const FIELD_MAP_OPTIONS = [
  {value:'',label:'-- Skip --'},{value:'trainerName',label:'Trainer Name'},
  {value:'trainerTitle',label:'Designation'},{value:'pan',label:'PAN'},
  {value:'gst',label:'GST'},{value:'invoiceNo',label:'Invoice No.'},
  {value:'invoiceDate',label:'Invoice Date'},{value:'poNo',label:'PO No.'},
  {value:'billedToName',label:'Billed To – Name'},{value:'billedToAddress',label:'Billed To – Address'},
  {value:'courseName',label:'Course Name'},{value:'trainingPeriod',label:'Training Period'},
  {value:'mode',label:'Mode'},{value:'totalSessions',label:'Total Sessions'},
  {value:'bankAccountName',label:'Account Name'},{value:'bankAccountNo',label:'Account No.'},
  {value:'bankName',label:'Bank Name'},{value:'ifscCode',label:'IFSC Code'},
];

/* ── Section card definitions ── */
const SECTIONS = [
  { id:'import',   icon:'📥', label:'Import File',        hint:'PDF · DOCX · Image OCR' },
  { id:'trainer',  icon:'👤', label:'Trainer / Issuer',   hint:'Name, PAN, GST…' },
  { id:'invoice',  icon:'🧾', label:'Invoice Details',    hint:'Number, Date, PO…' },
  { id:'billed',   icon:'🏢', label:'Billed To',          hint:'Client & address…' },
  { id:'course',   icon:'📚', label:'Course / Engagement',hint:'Course, Period, Mode…' },
  { id:'sessions', icon:'📅', label:'Session Breakdown',  hint:'Date-wise sessions…' },
  { id:'bank',     icon:'🏦', label:'Bank Details',       hint:'Account & IFSC…' },
  { id:'terms',    icon:'📋', label:'Terms & Conditions', hint:'Payment, jurisdiction…' },
];

function sectionSummary(id, form, sessions) {
  if (id==='trainer') return form.trainerName || '';
  if (id==='invoice') return form.invoiceNo || '';
  if (id==='billed')  return form.billedToName || '';
  if (id==='course')  return form.courseName || '';
  if (id==='sessions') return `${sessions.length} session(s)`;
  if (id==='bank')    return form.bankName || '';
  if (id==='terms')   return form.terms ? 'Set' : '';
  if (id==='import')  return '';
  return '';
}

/* ── Reusable field ── */
function F({ label, name, value, onChange, rows, half }) {
  return (
    <div className={`inv-field${half ? '' : ' inv-field-full'}`}>
      <label>{label}</label>
      {rows
        ? <textarea name={name} value={value} onChange={onChange} rows={rows} />
        : <input name={name} value={value} onChange={onChange} />}
    </div>
  );
}

/* ══════════════════════════════════════════
   MODAL CONTENT per section
   ══════════════════════════════════════════ */
function ModalContent({ id, form, setForm, sessions, setSessions, onClose,
  extractedText, setExtractedText, mappings, setMappings, fileRef, importing, setImporting }) {

  const hf = e => setForm(p => ({...p, [e.target.name]: e.target.value}));

  const handleFile = async (file) => {
    if (!file) return;
    setImporting(true);
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'txt') { setExtractedText(await file.text()); }
      else if (ext === 'pdf' && window.pdfjsLib) {
        const buf = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({data:buf}).promise;
        let txt = '';
        for (let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p);const tc=await pg.getTextContent();txt+=tc.items.map(i=>i.str).join(' ')+'\n';}
        setExtractedText(txt.trim());
      } else if (['png','jpg','jpeg','webp'].includes(ext) && window.Tesseract) {
        const {data:{text}} = await window.Tesseract.recognize(file,'eng');
        setExtractedText(text.trim());
      } else if (['doc','docx'].includes(ext) && window.mammoth) {
        const buf = await file.arrayBuffer();
        const res = await window.mammoth.extractRawText({arrayBuffer:buf});
        setExtractedText(res.value.trim());
      } else {
        setExtractedText('⚠️ Could not auto-extract. Paste raw text below and use the mapper.');
      }
    } catch(e) { setExtractedText('Error: '+e.message); }
    setImporting(false);
  };

  const applyMap = () => {
    const lines = extractedText.split('\n').map(l=>l.trim()).filter(Boolean);
    const upd = {};
    Object.entries(mappings).forEach(([idx,field]) => { if(field && lines[idx]) upd[field]=lines[idx]; });
    if (Object.keys(upd).length) { setForm(p=>({...p,...upd})); alert(`Applied ${Object.keys(upd).length} field(s).`); }
    else alert('Select at least one mapping first.');
  };

  const addSession = () => setSessions(p=>[...p,{date:'',hours:2,rate:1400}]);
  const delSession = i => setSessions(p=>p.filter((_,x)=>x!==i));
  const editSession = (i,k,v) => setSessions(p=>p.map((s,x)=>x===i?{...s,[k]:v}:s));
  const extractedLines = extractedText.split('\n').map(l=>l.trim()).filter(Boolean);

  if (id === 'import') return (
    <div>
      <div className="inv-import-zone" onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}}
        onDragOver={e=>e.preventDefault()} onClick={()=>fileRef.current.click()}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <p>{importing ? '⏳ Extracting text…' : 'Drop file here or click to browse'}</p>
        <p style={{color:'#94a3b8',fontSize:'0.72rem'}}>PDF · DOCX · PNG · JPG · TXT</p>
      </div>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
        style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])} />
      {extractedText && <>
        <div className="inv-field" style={{marginBottom:'0.8rem'}}>
          <label>Extracted Text (edit freely)</label>
          <textarea className="inv-extracted-text" rows={5} value={extractedText} onChange={e=>setExtractedText(e.target.value)} />
        </div>
        <div className="inv-field" style={{marginBottom:'0.8rem'}}><label>Map Lines → Fields</label></div>
        <div className="inv-mapper-grid">
          {extractedLines.slice(0,20).map((line,idx)=>(
            <div className="inv-map-row" key={idx}>
              <div className="inv-map-line" title={line}>{idx+1}. {line}</div>
              <div className="inv-map-arrow">→</div>
              <select className="inv-map-select" value={mappings[idx]||''} onChange={e=>setMappings(p=>({...p,[idx]:e.target.value}))}>
                {FIELD_MAP_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>
        <button style={{marginTop:'1rem',width:'100%',padding:'0.65rem',background:'linear-gradient(135deg,#6366f1,#4f46e5)',color:'#fff',border:'none',borderRadius:'10px',fontWeight:800,fontSize:'0.85rem',cursor:'pointer'}} onClick={applyMap}>
          ✅ Apply Mappings to Invoice
        </button>
      </>}
    </div>
  );

  if (id === 'trainer') return (
    <div className="inv-modal-grid">
      <F label="Trainer Name" name="trainerName" value={form.trainerName} onChange={hf} />
      <F label="Designation / Title" name="trainerTitle" value={form.trainerTitle} onChange={hf} />
      <F label="PAN" name="pan" value={form.pan} onChange={hf} half />
      <F label="GST" name="gst" value={form.gst} onChange={hf} half />
    </div>
  );

  if (id === 'invoice') return (
    <div className="inv-modal-grid">
      <F label="Invoice No." name="invoiceNo" value={form.invoiceNo} onChange={hf} />
      <F label="Invoice Date" name="invoiceDate" value={form.invoiceDate} onChange={hf} />
      <F label="PO No. (optional)" name="poNo" value={form.poNo} onChange={hf} />
    </div>
  );

  if (id === 'billed') return (
    <div className="inv-modal-grid">
      <F label="Company / Client Name" name="billedToName" value={form.billedToName} onChange={hf} />
      <F label="Website (optional)" name="billedToWebsite" value={form.billedToWebsite} onChange={hf} />
      <F label="Full Address" name="billedToAddress" value={form.billedToAddress} onChange={hf} rows={4} />
    </div>
  );

  if (id === 'course') return (
    <div className="inv-modal-grid">
      <F label="Course Name" name="courseName" value={form.courseName} onChange={hf} />
      <F label="Mode" name="mode" value={form.mode} onChange={hf} half />
      <F label="Training Period" name="trainingPeriod" value={form.trainingPeriod} onChange={hf} />
      <F label="Total Sessions Summary" name="totalSessions" value={form.totalSessions} onChange={hf} />
    </div>
  );

  if (id === 'sessions') return (
    <div>
      <div className="inv-sessions-editor">
        <div className="inv-session-header-row">
          <span>Training Date</span><span>Hrs</span><span>Rate/hr</span><span></span>
        </div>
        {sessions.map((s,i)=>(
          <div className="inv-session-row" key={i}>
            <input placeholder="05-Mar-2026 (Fri)" value={s.date} onChange={e=>editSession(i,'date',e.target.value)} />
            <input type="number" value={s.hours} min={0} step={0.5} onChange={e=>editSession(i,'hours',e.target.value)} />
            <input type="number" value={s.rate} min={0} onChange={e=>editSession(i,'rate',e.target.value)} />
            <button className="inv-session-del-btn" onClick={()=>delSession(i)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
        <button className="inv-add-session-btn" onClick={addSession}>+ Add Session</button>
      </div>
      <p style={{fontSize:'0.76rem',color:'#94a3b8',marginTop:'0.6rem',textAlign:'right'}}>
        Total: Rs. {sessions.reduce((s,r)=>s+Number(r.hours)*Number(r.rate),0).toLocaleString('en-IN')}
      </p>
    </div>
  );

  if (id === 'bank') return (
    <div className="inv-modal-grid">
      <F label="Account Name" name="bankAccountName" value={form.bankAccountName} onChange={hf} />
      <F label="Account No." name="bankAccountNo" value={form.bankAccountNo} onChange={hf} />
      <F label="Bank Name" name="bankName" value={form.bankName} onChange={hf} half />
      <F label="IFSC Code" name="ifscCode" value={form.ifscCode} onChange={hf} half />
    </div>
  );

  if (id === 'terms') return (
    <div className="inv-modal-grid">
      <F label="Terms & Conditions" name="terms" value={form.terms} onChange={hf} rows={7} />
    </div>
  );

  return null;
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════ */
export default function InvoiceHub({ user }) {
  const [form, setForm] = useState({...DEFAULTS});
  const [sessions, setSessions] = useState([...DEF_SESSIONS]);
  const [activeSection, setActiveSection] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [mappings, setMappings] = useState({});
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  const total = sessions.reduce((s,r)=>s+Number(r.hours)*Number(r.rate),0);
  const sec = SECTIONS.find(s=>s.id===activeSection);

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <div>
          <h1>Invoice Generator</h1>
          <p>Click a section on the left to fill details — preview updates live in the centre.</p>
        </div>
        <button className="inv-action-btn inv-action-btn-print" onClick={()=>window.print()}
          style={{width:'auto',padding:'0.6rem 1.4rem'}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print / Export PDF
        </button>
      </div>

      <div className="inv-hub-wrap">
        {/* ═══ LEFT — section cards ═══ */}
        <div className="inv-left-panel">
          <div className="inv-left-title">Invoice Sections</div>
          {SECTIONS.map(s => {
            const sub = sectionSummary(s.id, form, sessions);
            const filled = Boolean(sub);
            return (
              <button key={s.id} className={`inv-section-card-btn${filled?' filled':''}`}
                onClick={()=>setActiveSection(s.id)}>
                {filled && <div className="inv-filled-dot" />}
                <div className="inv-card-icon">{s.icon}</div>
                <div className="inv-card-info">
                  <span className="inv-card-info-title">{s.label}</span>
                  <span className="inv-card-info-sub">{sub || s.hint}</span>
                </div>
                <svg className="inv-card-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            );
          })}

          <div className="inv-left-actions">
            <button className="inv-action-btn inv-action-btn-print" onClick={()=>window.print()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print / Export PDF
            </button>
            <button className="inv-action-btn inv-action-btn-reset" onClick={()=>{setForm({...DEFAULTS});setSessions([...DEF_SESSIONS]);}}>
              Reset to Defaults
            </button>
          </div>
        </div>

        {/* ═══ CENTRE — invoice preview ═══ */}
        <div className="inv-preview-wrapper">
          <div className="invoice-paper" id="invoice-paper">

            {/* Header */}
            <div className="inv-paper-header">
              <div className="inv-trainer-info">
                <h2>{form.trainerName||'Trainer Name'}</h2>
                <p>{form.trainerTitle}</p>
                {form.pan && <p>PAN: {form.pan}</p>}
                {form.gst && <p>GST: {form.gst}</p>}
              </div>
              <div className="inv-meta-block">
                <h3>Tax Invoice</h3>
                <p>Invoice No.: {form.invoiceNo}</p>
                <p>Date: {form.invoiceDate}</p>
                {form.poNo && <p>PO No.: {form.poNo}</p>}
              </div>
            </div>

            {/* Billed To */}
            <div className="inv-billed-section">
              <div className="inv-billed-block">
                <h4>Billed To:</h4>
                <p><strong>{form.billedToName}</strong></p>
                <p style={{whiteSpace:'pre-line'}}>{form.billedToAddress}</p>
                {form.billedToWebsite && <p style={{color:'#2563eb'}}>{form.billedToWebsite}</p>}
              </div>
            </div>

            {/* Course */}
            <table className="inv-course-table">
              <tbody>
                <tr><td>Course Name</td><td>{form.courseName}</td></tr>
                <tr><td>Training Period</td><td>{form.trainingPeriod}</td></tr>
                <tr><td>Mode</td><td>{form.mode}</td></tr>
                <tr><td>Total Sessions</td><td>{form.totalSessions}</td></tr>
              </tbody>
            </table>

            {/* Sessions */}
            <div className="inv-section-title">Session-Wise Breakdown</div>
            <table className="inv-sessions-table">
              <thead>
                <tr><th>S.No</th><th>Training Date</th><th>Hours</th><th>Rate/hr</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {sessions.map((s,i)=>(
                  <tr key={i}>
                    <td>{i+1}</td><td>{s.date}</td>
                    <td>{s.hours} hrs</td>
                    <td>Rs. {Number(s.rate).toLocaleString('en-IN')}</td>
                    <td>Rs. {(Number(s.hours)*Number(s.rate)).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={4} style={{textAlign:'right'}}>TOTAL</td>
                  <td>Rs. {total.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>

            {/* Amount in words */}
            <div className="inv-amount-words">
              <div className="inv-amount-words-label">Amount in Words</div>
              <div className="inv-amount-words-value">{amountWords(total)}</div>
            </div>

            {/* Bank */}
            <div className="inv-section-title">Bank Details</div>
            <table className="inv-bank-table">
              <tbody>
                <tr><td>Account Name</td><td>{form.bankAccountName}</td></tr>
                <tr><td>Account No.</td><td>{form.bankAccountNo}</td></tr>
                <tr><td>Bank Name</td><td>{form.bankName}</td></tr>
                <tr><td>IFSC Code</td><td>{form.ifscCode}</td></tr>
              </tbody>
            </table>

            {/* Terms */}
            {form.terms && (
              <div className="inv-terms">
                <strong>Terms &amp; Conditions:</strong>
                <span style={{whiteSpace:'pre-line'}}>{form.terms}</span>
              </div>
            )}

            {/* Signature */}
            <div style={{display:'flex',justifyContent:'flex-end'}}>
              <div className="inv-signature-block">
                <strong>For {form.trainerName||'Trainer'}</strong>
                <div style={{height:40}} />
                <span>Authorised Signatory</span><br/>
                <span style={{fontSize:'0.68rem',color:'#94a3b8'}}>(Computer generated invoice)</span>
              </div>
            </div>

          </div>{/* invoice-paper */}
        </div>{/* inv-preview-wrapper */}
      </div>{/* inv-hub-wrap */}

      {/* ═══ POPUP MODAL ═══ */}
      {activeSection && sec && (
        <div className="inv-modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setActiveSection(null); }}>
          <div className="inv-modal">
            <div className="inv-modal-header">
              <div className="inv-modal-header-icon">{sec.icon}</div>
              <div style={{flex:1}}>
                <h3>{sec.label}</h3>
                <p>{sec.hint}</p>
              </div>
              <button className="inv-modal-close" onClick={()=>setActiveSection(null)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="inv-modal-body">
              <ModalContent
                id={activeSection} form={form} setForm={setForm}
                sessions={sessions} setSessions={setSessions}
                onClose={()=>setActiveSection(null)}
                extractedText={extractedText} setExtractedText={setExtractedText}
                mappings={mappings} setMappings={setMappings}
                fileRef={fileRef} importing={importing} setImporting={setImporting}
              />
            </div>

            <div className="inv-modal-footer">
              <button className="inv-modal-cancel-btn" onClick={()=>setActiveSection(null)}>Cancel</button>
              <button className="inv-modal-save-btn" onClick={()=>setActiveSection(null)}>
                ✓ Done — Preview Updated
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const now = new Date()
const CUR_MONTH = MONTHS[now.getMonth()]
const CUR_YEAR = now.getFullYear()

function fmt(n) { return '$' + Number(n || 0).toLocaleString() }
function initials(name) { return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }

function buildWaMessage(prop, charge) {
  const firstName = (prop.tenant || '').split(' ')[0]
  const svcs = Object.entries(charge.services || {})
  let msg = `Hola ${firstName}, te mando el resumen de ${charge.month} ${charge.year}:\n\n`
  if (charge.rent > 0) msg += `Renta: ${fmt(charge.rent)}\n`
  svcs.forEach(([k, v]) => { msg += `${k}: ${fmt(v)}\n` })
  msg += `\nTotal: ${fmt(charge.total)}`
  if (charge.note) msg += `\n\nNota: ${charge.note}`
  msg += `\n\nPor favor deposita cuando puedas. ¡Gracias!`
  if (charge.receipt_url) msg += `\n\n(Adjunto comprobante de pago)`
  return msg
}

function buildWaLink(prop, charge) {
  return `https://wa.me/${prop.phone}?text=${encodeURIComponent(buildWaMessage(prop, charge))}`
}

// ─── LOGIN ──────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const submit = () => {
    if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) { onLogin(); setErr('') }
    else setErr('Incorrect password')
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ width: 320 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Rental Manager</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Enter your password to continue</p>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="fgroup" style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
        </div>
        <button className="btn-primary btn" style={{ width: '100%' }} onClick={submit}>Login</button>
      </div>
    </div>
  )
}

// ─── NAV ────────────────────────────────────────────────────────────────────
function Nav({ tab, setTab }) {
  const tabs = ['Billing', 'Properties', 'History']
  return (
    <nav style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '0 1.5rem', display: 'flex', gap: 4 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => setTab(t)}
          style={{
            background: 'none', border: 'none', padding: '14px 14px 12px',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            color: tab === t ? '#1a1a1a' : '#888',
            borderBottom: tab === t ? '2px solid #1a1a1a' : '2px solid transparent'
          }}>{t}</button>
      ))}
    </nav>
  )
}

// ─── BILLING ────────────────────────────────────────────────────────────────
function BillingTab({ properties, charges, onRefresh }) {
  const [modal, setModal] = useState(null) // { prop }
  const [chType, setChType] = useState('both')
  const [chMonth, setChMonth] = useState(CUR_MONTH)
  const [chYear, setChYear] = useState(CUR_YEAR)
  const [svcAmounts, setSvcAmounts] = useState({})
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [receiptName, setReceiptName] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [reminderSent, setReminderSent] = useState({})

  function showAlert(msg, type = 'success') {
    setAlert({ msg, type })
    setTimeout(() => setAlert(null), 3500)
  }

  function openModal(prop) {
    setModal({ prop })
    setChType('both')
    setChMonth(CUR_MONTH)
    setChYear(CUR_YEAR)
    setSvcAmounts({})
    setNote('')
    setReceipt(null)
    setReceiptPreview(null)
    setReceiptName('')
  }

  function closeModal() { setModal(null) }

  function handleReceipt(e) {
    const file = e.target.files[0]
    if (!file) return
    setReceipt(file)
    setReceiptName(file.name)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => setReceiptPreview(ev.target.result)
      reader.readAsDataURL(file)
    } else {
      setReceiptPreview(null)
    }
  }

  const buildDraftCharge = useCallback(() => {
    if (!modal) return null
    const p = modal.prop
    const rent = chType === 'service' ? 0 : p.rent
    const services = {}
    if (chType !== 'rent') {
      ;(p.services || []).forEach(s => {
        const v = parseFloat(svcAmounts[s] || 0)
        if (v > 0) services[s] = v
      })
    }
    const total = rent + Object.values(services).reduce((a, b) => a + b, 0)
    return { rent, services, total, note, month: chMonth, year: chYear }
  }, [modal, chType, svcAmounts, note, chMonth, chYear])

  const draft = buildDraftCharge()

  async function saveCharge() {
    if (!modal || !draft || draft.total === 0) { showAlert('Enter at least one amount', 'error'); return }
    setSaving(true)
    try {
      let receipt_url = null
      if (receipt) {
        const ext = receipt.name.split('.').pop()
        const path = `${modal.prop.id}/${chMonth}-${chYear}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('receipts').upload(path, receipt)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
        receipt_url = urlData.publicUrl
      }
      const { error } = await supabase.from('charges').insert({
        property_id: modal.prop.id,
        month: chMonth, year: chYear,
        rent: draft.rent, services: draft.services, total: draft.total,
        note, receipt_url, status: 'pending', wa_sent: false
      })
      if (error) throw error
      showAlert('Charge saved!')
      closeModal()
      onRefresh()
    } catch (e) {
      showAlert(e.message || 'Error saving charge', 'error')
    }
    setSaving(false)
  }

  async function markPaid(charge) {
    const { error } = await supabase.from('charges').update({
      status: 'paid', paid_on: new Date().toISOString()
    }).eq('id', charge.id)
    if (error) { showAlert('Error updating', 'error'); return }
    showAlert('Marked as paid')
    onRefresh()
  }

  async function markWaSent(chargeId) {
    await supabase.from('charges').update({ wa_sent: true }).eq('id', chargeId)
    setReminderSent(r => ({ ...r, [chargeId]: true }))
    onRefresh()
  }

  const monthCharges = charges.filter(c => c.month === CUR_MONTH && c.year === CUR_YEAR)
  const coveredIds = monthCharges.map(c => c.property_id)
  const uncovered = properties.filter(p => !coveredIds.includes(p.id))
  const totalPending = monthCharges.filter(c => c.status !== 'paid').reduce((a, c) => a + c.total, 0)
  const totalCollected = monthCharges.filter(c => c.status === 'paid').reduce((a, c) => a + c.rent, 0)

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="grid4" style={{ marginBottom: '1.5rem' }}>
        <div className="metric"><div className="mlabel">Properties</div><div className="mval">{properties.length}</div></div>
        <div className="metric"><div className="mlabel">Collected</div><div className="mval">{fmt(totalCollected)}</div><div className="msub">rent this month</div></div>
        <div className="metric"><div className="mlabel">Pending</div><div className="mval" style={{ color: '#854f0b' }}>{fmt(totalPending)}</div></div>
        <div className="metric"><div className="mlabel">Not billed</div><div className="mval" style={{ color: uncovered.length ? '#a32d2d' : '#3b6d11' }}>{uncovered.length}</div></div>
      </div>

      {uncovered.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          Not billed yet: {uncovered.map(p => p.name).join(', ')}
        </div>
      )}

      {properties.map(prop => {
        const pCharges = monthCharges.filter(c => c.property_id === prop.id)
        if (!pCharges.length) return (
          <div key={prop.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{prop.name}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{prop.tenant} · Rent {fmt(prop.rent)}/mo</div>
              </div>
              <button className="btn-primary btn btn-sm" onClick={() => openModal(prop)}>+ Create charge</button>
            </div>
          </div>
        )
        return pCharges.map(charge => {
          const svcs = Object.entries(charge.services || {})
          const st = charge.status
          return (
            <div key={charge.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{prop.name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{prop.tenant} · {prop.phone}</div>
                </div>
                <span className={`badge badge-${st}`}>{st}</span>
              </div>
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10, marginBottom: 10 }}>
                {charge.rent > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: '#888' }}>Rent</span><span>{fmt(charge.rent)}</span></div>}
                {svcs.map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: '#888' }}>{k}</span><span>{fmt(v)}</span></div>)}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, padding: '6px 0 0', borderTop: '1px solid #f0f0f0', marginTop: 4 }}><span>Total</span><span>{fmt(charge.total)}</span></div>
              </div>
              {charge.note && <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 10 }}>"{charge.note}"</div>}
              {charge.receipt_url && (
                <div style={{ marginBottom: 10 }}>
                  <a href={charge.receipt_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#185fa5', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    View receipt
                  </a>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {st !== 'paid'
                  ? <button className="btn-primary btn btn-sm" onClick={() => markPaid(charge)}>Mark paid</button>
                  : <span style={{ fontSize: 12, color: '#3b6d11' }}>Paid {charge.paid_on ? new Date(charge.paid_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                }
                <a className="btn-wa btn-sm" href={buildWaLink(prop, charge)} target="_blank" rel="noreferrer"
                  onClick={() => markWaSent(charge.id)}>
                  <WaIcon /> {charge.wa_sent ? 'Resend' : 'Send WhatsApp'}
                </a>
                {charge.receipt_url && <span style={{ fontSize: 11, color: '#888' }}>Remember to attach the receipt in WhatsApp</span>}
              </div>
            </div>
          )
        })
      })}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0' }}
          onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>New charge — {modal.prop.name}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{modal.prop.tenant} · {fmt(modal.prop.rent)}/mo</div>
              </div>
              <button className="btn btn-sm" onClick={closeModal}>Close</button>
            </div>

            <div className="grid3" style={{ marginBottom: 12 }}>
              <div className="fgroup"><label>Type</label>
                <select value={chType} onChange={e => setChType(e.target.value)}>
                  <option value="rent">Rent only</option>
                  <option value="service">Service only</option>
                  <option value="both">Rent + services</option>
                </select>
              </div>
              <div className="fgroup"><label>Month</label>
                <select value={chMonth} onChange={e => setChMonth(e.target.value)}>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="fgroup"><label>Year</label>
                <input type="number" value={chYear} onChange={e => setChYear(parseInt(e.target.value))} />
              </div>
            </div>

            {chType !== 'rent' && modal.prop.services?.length > 0 && (
              <div className="grid2" style={{ marginBottom: 12 }}>
                {modal.prop.services.map(s => (
                  <div key={s} className="fgroup">
                    <label>{s} ($)</label>
                    <input type="number" placeholder="0" value={svcAmounts[s] || ''}
                      onChange={e => setSvcAmounts(a => ({ ...a, [s]: e.target.value }))} />
                  </div>
                ))}
              </div>
            )}

            <div className="fgroup" style={{ marginBottom: 12 }}>
              <label>Note to tenant (optional)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Water was higher due to leak repair" />
            </div>

            <div className="fgroup" style={{ marginBottom: 12 }}>
              <label>Receipt (JPG, PNG or PDF)</label>
              <input type="file" accept="image/*,.pdf" onChange={handleReceipt} />
              {receiptName && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{receiptName}</div>}
              {receiptPreview && <img src={receiptPreview} alt="receipt" style={{ maxHeight: 120, borderRadius: 8, marginTop: 6, border: '1px solid #e5e5e5' }} />}
            </div>

            {draft && draft.total > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#888', marginBottom: 6, display: 'block' }}>WhatsApp message preview</label>
                <div className="wa-preview">{buildWaMessage(modal.prop, draft)}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn" onClick={closeModal}>Cancel</button>
              <button className="btn-primary btn" onClick={saveCharge} disabled={saving}>{saving ? 'Saving...' : 'Save charge'}</button>
              {draft && draft.total > 0 && (
                <a className="btn-wa" href={buildWaLink(modal.prop, draft)} target="_blank" rel="noreferrer">
                  <WaIcon /> Open WhatsApp
                </a>
              )}
            </div>
            {draft && draft.total > 0 && receipt && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#854f0b', background: '#faeeda', padding: '8px 12px', borderRadius: 8 }}>
                Remember to attach the receipt manually in WhatsApp after sending the message.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PROPERTIES ─────────────────────────────────────────────────────────────
function PropertiesTab({ properties, onRefresh }) {
  const [form, setForm] = useState({ name: '', address: '', tenant: '', phone: '', rent: '', pay_day: '1', services: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  function showAlert(msg, type = 'success') {
    setAlert({ msg, type })
    setTimeout(() => setAlert(null), 3500)
  }

  function reset() { setForm({ name: '', address: '', tenant: '', phone: '', rent: '', pay_day: '1', services: '' }); setEditId(null) }

  async function save() {
    if (!form.name || !form.address) { showAlert('Name and address required', 'error'); return }
    const services = form.services.split(',').map(s => s.trim()).filter(Boolean)
    const data = { name: form.name, address: form.address, tenant: form.tenant, phone: form.phone.replace(/\D/g, ''), rent: parseFloat(form.rent) || 0, pay_day: parseInt(form.pay_day) || 1, services }
    setSaving(true)
    try {
      if (editId) {
        const { error } = await supabase.from('properties').update(data).eq('id', editId)
        if (error) throw error
        showAlert('Property updated')
      } else {
        const { error } = await supabase.from('properties').insert(data)
        if (error) throw error
        showAlert('Property added')
      }
      reset(); onRefresh()
    } catch (e) { showAlert(e.message || 'Error', 'error') }
    setSaving(false)
  }

  function edit(p) {
    setEditId(p.id)
    setForm({ name: p.name, address: p.address, tenant: p.tenant || '', phone: p.phone || '', rent: String(p.rent), pay_day: String(p.pay_day), services: (p.services || []).join(', ') })
  }

  async function del(id) {
    if (!confirm('Delete this property and all its charges?')) return
    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) { showAlert('Error deleting', 'error'); return }
    showAlert('Deleted')
    onRefresh()
  }

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>{editId ? 'Edit property' : 'Add property'}</div>
        <div className="grid2" style={{ marginBottom: 12 }}>
          <div className="fgroup"><label>Property name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Maple St 12-A" /></div>
          <div className="fgroup"><label>Address</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="412 Maple St, Apt A" /></div>
          <div className="fgroup"><label>Tenant name</label><input value={form.tenant} onChange={e => setForm(f => ({ ...f, tenant: e.target.value }))} /></div>
          <div className="fgroup"><label>WhatsApp (numbers only, with country code)</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="521551234567" /></div>
          <div className="fgroup"><label>Monthly rent ($)</label><input type="number" value={form.rent} onChange={e => setForm(f => ({ ...f, rent: e.target.value }))} /></div>
          <div className="fgroup"><label>Payment day of month</label><input type="number" min="1" max="31" value={form.pay_day} onChange={e => setForm(f => ({ ...f, pay_day: e.target.value }))} /></div>
        </div>
        <div className="fgroup" style={{ marginBottom: 12 }}>
          <label>Services you pay for this tenant (comma separated)</label>
          <input value={form.services} onChange={e => setForm(f => ({ ...f, services: e.target.value }))} placeholder="Gas, Water, Electricity" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={reset}>Cancel</button>
          <button className="btn-primary btn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>

      <div className="section-hdr"><div className="section-title">All properties</div></div>
      {properties.length === 0 && <div className="empty">No properties yet. Add one above.</div>}
      {properties.map(p => (
        <div key={p.id} className="card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e6f1fb', color: '#185fa5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{initials(p.tenant)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{p.tenant} · {p.address}</div>
            {p.services?.length > 0 && <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Services: {p.services.join(', ')}</div>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: 600 }}>{fmt(p.rent)}/mo</div>
            <div style={{ fontSize: 12, color: '#888' }}>Day {p.pay_day}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => edit(p)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => del(p.id)}>Del</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── HISTORY ────────────────────────────────────────────────────────────────
function HistoryTab({ properties, charges }) {
  const [propFilter, setPropFilter] = useState('')
  const [yearFilter, setYearFilter] = useState(String(CUR_YEAR))

  const years = [...new Set(charges.map(c => c.year))].sort((a, b) => b - a)
  if (!years.includes(CUR_YEAR)) years.unshift(CUR_YEAR)

  const filtered = charges
    .filter(c => c.year === parseInt(yearFilter) && (!propFilter || c.property_id === propFilter))
    .sort((a, b) => MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month))

  const totalRent = filtered.reduce((a, c) => a + c.rent, 0)
  const totalSvcs = filtered.reduce((a, c) => a + Object.values(c.services || {}).reduce((x, y) => x + y, 0), 0)
  const totalAll = filtered.reduce((a, c) => a + c.total, 0)
  const totalPaid = filtered.filter(c => c.status === 'paid').reduce((a, c) => a + c.total, 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={propFilter} onChange={e => setPropFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} style={{ width: 'auto' }}>
          {years.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid4" style={{ marginBottom: '1.5rem' }}>
        <div className="metric"><div className="mlabel">Total rent</div><div className="mval">{fmt(totalRent)}</div></div>
        <div className="metric"><div className="mlabel">Services paid</div><div className="mval">{fmt(totalSvcs)}</div><div className="msub">to reimburse</div></div>
        <div className="metric"><div className="mlabel">Total billed</div><div className="mval">{fmt(totalAll)}</div></div>
        <div className="metric"><div className="mlabel">Collected</div><div className="mval">{fmt(totalPaid)}</div></div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
              {['Month','Property','Tenant','Rent','Services','Total','Status','Receipt'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#888', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>No charges for this period.</td></tr>
            )}
            {filtered.map(c => {
              const p = properties.find(x => x.id === c.property_id)
              const svcsTotal = Object.values(c.services || {}).reduce((a, b) => a + b, 0)
              const svcsStr = Object.entries(c.services || {}).map(([k, v]) => `${k}: ${fmt(v)}`).join(', ') || '—'
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '10px 10px' }}>{c.month}</td>
                  <td style={{ padding: '10px 10px' }}>{p?.name || '—'}</td>
                  <td style={{ padding: '10px 10px', color: '#888' }}>{p?.tenant || '—'}</td>
                  <td style={{ padding: '10px 10px' }}>{fmt(c.rent)}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12, color: '#888' }}>{svcsStr}</td>
                  <td style={{ padding: '10px 10px', fontWeight: 600 }}>{fmt(c.total)}</td>
                  <td style={{ padding: '10px 10px' }}><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                  <td style={{ padding: '10px 10px' }}>
                    {c.receipt_url
                      ? <a href={c.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#185fa5' }}>View</a>
                      : <span style={{ color: '#ccc', fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── WHATSAPP ICON ───────────────────────────────────────────────────────────
function WaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function Home() {
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState('Billing')
  const [properties, setProperties] = useState([])
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: props }, { data: chgs }] = await Promise.all([
      supabase.from('properties').select('*').order('created_at'),
      supabase.from('charges').select('*').order('created_at', { ascending: false })
    ])
    setProperties(props || [])
    setCharges(chgs || [])
    setLoading(false)
  }, [])

  useEffect(() => { if (authed) load() }, [authed, load])

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '0 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 16, padding: '14px 0' }}>Rental Manager</div>
        <Nav tab={tab} setTab={setTab} />
        <button className="btn btn-sm" onClick={() => setAuthed(false)} style={{ fontSize: 12 }}>Logout</button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>
            {tab === 'Billing' ? `${CUR_MONTH} ${CUR_YEAR}` : tab}
          </h1>
          <button className="btn btn-sm" onClick={load}>Refresh</button>
        </div>

        {loading ? (
          <div className="empty">Loading...</div>
        ) : (
          <>
            {tab === 'Billing' && <BillingTab properties={properties} charges={charges} onRefresh={load} />}
            {tab === 'Properties' && <PropertiesTab properties={properties} onRefresh={load} />}
            {tab === 'History' && <HistoryTab properties={properties} charges={charges} />}
          </>
        )}
      </div>
    </div>
  )
}

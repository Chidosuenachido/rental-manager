import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const now = new Date()
const CUR_MONTH = MONTHS[now.getMonth()]
const CUR_MONTH_ES = MONTHS_ES[now.getMonth()]
const CUR_YEAR = now.getFullYear()

function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) }
function initials(name) { return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }
function monthES(m) { return MONTHS_ES[MONTHS.indexOf(m)] || m }

// ─── WA MESSAGES ─────────────────────────────────────────────────────────────
function buildWaMessage(prop, charge) {
  const firstName = (prop.tenant || '').split(' ')[0]
  const svcs = Object.entries(charge.services || {})
  let msg = `Hola ${firstName} 👋, te envío el resumen de ${monthES(charge.month)} ${charge.year}:\n\n`
  if (charge.rent > 0) msg += `🏠 Renta: ${fmt(charge.rent)}\n`
  svcs.forEach(([k, v]) => { msg += `📄 ${k}: ${fmt(v)}\n` })
  msg += `\n💰 *Total: ${fmt(charge.total)}*`
  if (prop.pay_day) msg += `\n📅 Fecha límite: día ${prop.pay_day}`
  if (charge.note) msg += `\n\n📝 ${charge.note}`
  msg += `\n\nPor favor realiza tu depósito y envíame el comprobante. ¡Gracias! 🙏`
  if (charge.receipt_url) msg += `\n\n(Te adjunto el comprobante de servicios)`
  return msg
}
function buildReminderMsg(prop, charge) {
  const firstName = (prop.tenant || '').split(' ')[0]
  return `Hola ${firstName} 😊, solo paso a recordarte que tienes un pago pendiente de ${fmt(charge.total)} de ${monthES(charge.month)} ${charge.year}. Por favor realiza tu depósito cuando puedas. ¡Gracias!`
}
function buildThankYouMsg(prop, charge) {
  const firstName = (prop.tenant || '').split(' ')[0]
  return `Hola ${firstName} ✅, confirmamos recibido tu pago de ${fmt(charge.total)} de ${monthES(charge.month)} ${charge.year}. ¡Muchas gracias, que tengas excelente mes! 😊`
}
function waLink(phone, msg) { return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` }

// ─── WA BUTTON ───────────────────────────────────────────────────────────────
function WaBtn({ href, label, small }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`btn-wa${small ? ' btn-sm' : ''}`}>
      <svg width={small ? 13 : 15} height={small ? 13 : 15} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      {label}
    </a>
  )
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const submit = () => {
    if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) { onLogin(); setErr('') }
    else setErr('Contraseña incorrecta')
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ width: 340 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>👨‍💼 Centro de Control</h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Contraseña del Administrador</p>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="fgroup" style={{ marginBottom: 14 }}>
          <label>Contraseña</label>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
        </div>
        <button className="btn-primary btn-full btn" onClick={submit}>Ingresar al Sistema</button>
      </div>
    </div>
  )
}

// ─── TAB 1: COBRAR ───────────────────────────────────────────────────────────
function TabCobrar({ properties, charges, notes, onRefresh }) {
  const [propSel, setPropSel] = useState(properties[0]?.id || '')
  const [mesSel, setMesSel] = useState(CUR_MONTH)
  const [rentaVal, setRentaVal] = useState(0)
  const [svcAmounts, setSvcAmounts] = useState({})
  const [nota, setNota] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [receiptName, setReceiptName] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [showWaPreview, setShowWaPreview] = useState(false)

  const prop = properties.find(p => p.id === propSel)

  useEffect(() => {
    if (prop) { setRentaVal(prop.rent); setSvcAmounts({}) }
  }, [propSel, prop])

  function showAlert(msg, type = 'success') { setAlert({ msg, type }); setTimeout(() => setAlert(null), 4000) }

  const propCharges = charges.filter(c => c.property_id === propSel)
  const pendientes = propCharges.filter(c => c.status !== 'paid')
  const propNotes = notes.filter(n => n.property_id === propSel).slice(0, 5)
  const existingCharge = charges.find(c => c.property_id === propSel && c.month === mesSel && c.year === CUR_YEAR)
  const isEditing = !!existingCharge

  async function markPaid(charge) {
    const { error } = await supabase.from('charges').update({ status: 'paid', paid_on: new Date().toISOString() }).eq('id', charge.id)
    if (error) { showAlert('Error', 'error'); return }
    showAlert(`✅ ${monthES(charge.month)} saldado`)
    onRefresh()
  }

  async function deleteCharge(charge) {
    if (!confirm(`¿Eliminar cobro de ${monthES(charge.month)} ${charge.year}?`)) return
    const { error } = await supabase.from('charges').delete().eq('id', charge.id)
    if (error) { showAlert('Error al eliminar', 'error'); return }
    showAlert('Cobro eliminado'); onRefresh()
  }

  function loadChargeForEdit(charge) {
    setMesSel(charge.month)
    setRentaVal(charge.rent)
    setSvcAmounts(Object.fromEntries(Object.entries(charge.services || {}).map(([k, v]) => [k, String(v)])))
    setNota(charge.note || '')
    showAlert(`📝 Editando cobro de ${monthES(charge.month)} — modifica y vuelve a publicar`, 'warning')
  }

  function handleReceipt(e) {
    const file = e.target.files[0]; if (!file) return
    setReceipt(file); setReceiptName(file.name)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => setReceiptPreview(ev.target.result)
      reader.readAsDataURL(file)
    } else { setReceiptPreview(null) }
  }

  const draftCharge = prop ? {
    rent: rentaVal,
    services: Object.fromEntries((prop.services || []).map(s => [s, parseFloat(svcAmounts[s] || 0)]).filter(([, v]) => v > 0)),
    total: rentaVal + (prop.services || []).reduce((a, s) => a + (parseFloat(svcAmounts[s] || 0)), 0),
    note: nota, month: mesSel, year: CUR_YEAR
  } : null

  async function publicar() {
    if (!prop || !draftCharge || draftCharge.total === 0) { showAlert('Ingresa al menos un monto', 'error'); return }
    setSaving(true)
    try {
      let receipt_url = existingCharge?.receipt_url || null
      if (receipt) {
        const ext = receipt.name.split('.').pop()
        const path = `${propSel}/${mesSel}-${CUR_YEAR}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('receipts').upload(path, receipt)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
        receipt_url = urlData.publicUrl
      }

      if (isEditing) {
        // Merge new services into existing ones
        const mergedServices = { ...existingCharge.services }
        Object.entries(draftCharge.services).forEach(([k, v]) => { mergedServices[k] = v })
        const newRent = draftCharge.rent > 0 ? draftCharge.rent : existingCharge.rent
        const newTotal = newRent + Object.values(mergedServices).reduce((a, b) => a + b, 0)
        const { error } = await supabase.from('charges').update({
          rent: newRent, services: mergedServices, total: newTotal,
          note: nota || existingCharge.note,
          receipt_url: receipt_url
        }).eq('id', existingCharge.id)
        if (error) throw error
        showAlert(`✅ Cobro de ${monthES(mesSel)} actualizado`)
      } else {
        const { error } = await supabase.from('charges').insert({
          property_id: propSel, month: mesSel, year: CUR_YEAR,
          rent: draftCharge.rent, services: draftCharge.services, total: draftCharge.total,
          note: nota, receipt_url, status: 'pending', wa_sent: false
        })
        if (error) throw error
        showAlert(`✅ Recibos de ${monthES(mesSel)} publicados con éxito`)
      }
      setNota(''); setSvcAmounts({}); setReceipt(null); setReceiptPreview(null); setReceiptName('')
      onRefresh()
    } catch (e) { showAlert(e.message || 'Error', 'error') }
    setSaving(false)
  }

  async function saveNota() {
    if (!nota.trim()) return
    const { error } = await supabase.from('notes').insert({ property_id: propSel, text: nota.trim() })
    if (error) { showAlert('Error al guardar nota', 'error'); return }
    setNota(''); showAlert('Nota guardada'); onRefresh()
  }

  if (!prop) return <div className="empty">Sin propiedades. Ve a Configuración.</div>

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Property selector */}
      <div style={{ marginBottom: 16 }}>
        <div className="fgroup">
          <label>Selecciona Propiedad:</label>
          <select value={propSel} onChange={e => setPropSel(e.target.value)}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* Info bar */}
      <div className="info-bar">
        📅 <b>Hoy:</b> {now.getDate()} de {CUR_MONTH_ES} &nbsp;|&nbsp;
        📌 <b>Día de pago:</b> {prop.pay_day} &nbsp;|&nbsp;
        💵 <b>Renta:</b> {fmt(prop.rent)} &nbsp;|&nbsp;
        📞 {prop.phone}
      </div>

      {/* Two columns like Streamlit */}
      <div style={{ display: 'flex', gap: 20 }} className="two-col">

        {/* LEFT — Cobrar */}
        <div style={{ flex: 2 }}>

          {/* Pending charges */}
          {pendientes.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>✅ Acciones de Cobro:</div>
              <div className="grid2">
                {pendientes.map(c => (
                  <div key={c.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{monthES(c.month)} {c.year}</div>
                        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{fmt(c.total)}</div>
                      </div>
                      <span className="badge badge-pending">Pendiente</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn-green btn btn-sm btn-full" onClick={() => markPaid(c)}>
                        Saldar {monthES(c.month)}
                      </button>
                      <button className="btn btn-sm" onClick={() => loadChargeForEdit(c)} style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                        ✏️ Editar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteCharge(c)}>
                        🗑️
                      </button>
                      <WaBtn href={waLink(prop.phone, buildReminderMsg(prop, c))} label="Recordatorio" small />
                      <WaBtn href={waLink(prop.phone, buildWaMessage(prop, c))} label="Reenviar" small />
                      {c.receipt_url && <a href={c.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }}>Ver comprobante</a>}
                    </div>
                  </div>
                ))}
              </div>
              <hr className="divider" />
            </div>
          )}

          {/* Publish form */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              {isEditing ? `✏️ Editando cobro: ${monthES(mesSel)} ${CUR_YEAR}` : '🚀 Generar Recibo del Mes:'}
            </div>
            {isEditing && <div style={{ fontSize: 12, color: 'var(--orange-text)', marginBottom: 14 }}>Los servicios que ingreses se agregarán o actualizarán en el cobro existente.</div>}
            {!isEditing && <div style={{ marginBottom: 16 }}></div>}

            <div className="grid2" style={{ marginBottom: 14 }}>
              <div className="fgroup">
                <label>Mes a cobrar:</label>
                <select value={mesSel} onChange={e => setMesSel(e.target.value)}>
                  {MONTHS.map((m, i) => <option key={m} value={m}>{MONTHS_ES[i]}</option>)}
                </select>
              </div>
              <div className="fgroup">
                <label>Confirmar Renta ($)</label>
                <input type="number" value={rentaVal} onChange={e => setRentaVal(parseFloat(e.target.value) || 0)} step="100" />
              </div>
            </div>

            {prop.services?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>Servicios Variables:</div>
                <div className="grid2">
                  {prop.services.map(s => (
                    <div key={s} className="fgroup">
                      <label>{s} ($)</label>
                      <input type="number" min="0" step="10" value={svcAmounts[s] || ''} placeholder="0.00"
                        onChange={e => setSvcAmounts(a => ({ ...a, [s]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="fgroup" style={{ marginBottom: 14 }}>
              <label>Nota para el inquilino (opcional)</label>
              <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: El agua subió por la reparación de tubería..." />
            </div>

            <div className="fgroup" style={{ marginBottom: 14 }}>
              <label>Comprobante de servicio (JPG, PNG o PDF)</label>
              <input type="file" accept="image/*,.pdf" onChange={handleReceipt} />
              {receiptName && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>📎 {receiptName}</div>}
              {receiptPreview && <img src={receiptPreview} alt="comprobante" style={{ maxHeight: 100, borderRadius: 8, marginTop: 8, border: '1px solid var(--border)' }} />}
            </div>

            {/* WA preview toggle */}
            {draftCharge && draftCharge.total > 0 && (
              <div style={{ marginBottom: 14 }}>
                <button className="btn btn-sm" onClick={() => setShowWaPreview(!showWaPreview)}>
                  {showWaPreview ? 'Ocultar' : 'Ver'} vista previa WhatsApp
                </button>
                {showWaPreview && (
                  <div className="wa-preview" style={{ marginTop: 10 }}>
                    {buildWaMessage(prop, draftCharge)}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-primary btn btn-full" onClick={publicar} disabled={saving}>
                {saving ? 'Guardando...' : isEditing ? '💾 Actualizar Cobro' : '🚀 Publicar Todo al Inquilino'}
              </button>
              {draftCharge && draftCharge.total > 0 && (
                <WaBtn href={waLink(prop.phone, buildWaMessage(prop, draftCharge))} label="Abrir WhatsApp" />
              )}
            </div>

            {receipt && (
              <div className="alert alert-warning" style={{ marginTop: 10 }}>
                📎 Recuerda adjuntar el comprobante manualmente en WhatsApp.
              </div>
            )}
          </div>

          {/* Paid charges this month */}
          {propCharges.filter(c => c.status === 'paid').length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: 'var(--green-text)' }}>✅ Pagos recibidos</div>
              {propCharges.filter(c => c.status === 'paid').slice(0, 3).map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13 }}>{monthES(c.month)} {c.year}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(c.total)}</span>
                    <WaBtn href={waLink(prop.phone, buildThankYouMsg(prop, c))} label="Enviar gracias" small />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Notas */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>📝 Notas: {prop.name}</div>
            <div className="fgroup" style={{ marginBottom: 10 }}>
              <label>Reporte de daños o recordatorios:</label>
              <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: Fuga en baño detectada..." />
            </div>
            <button className="btn-primary btn btn-full" onClick={saveNota} style={{ marginBottom: 16 }}>
              Guardar Nota
            </button>
            <hr className="divider" />
            {propNotes.length === 0 && <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', padding: '1rem 0' }}>Sin notas</div>}
            {[...propNotes].reverse().map(n => (
              <div key={n.id} className="note-card">
                <div className="note-date">📅 {new Date(n.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <div className="note-text" style={{ marginTop: 4 }}>{n.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TAB 2: CONFIGURACIÓN ────────────────────────────────────────────────────
function TabConfig({ properties, onRefresh }) {
  const [form, setForm] = useState({ name: '', address: '', tenant: '', phone: '', rent: '', pay_day: '5', services: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [propExp, setPropExp] = useState(properties[0]?.id || '')

  function showAlert(msg, type = 'success') { setAlert({ msg, type }); setTimeout(() => setAlert(null), 3500) }
  function reset() { setForm({ name: '', address: '', tenant: '', phone: '', rent: '', pay_day: '5', services: '' }); setEditId(null) }

  async function save() {
    if (!form.name || !form.tenant) { showAlert('Nombre e Inquilino son obligatorios', 'error'); return }
    const services = form.services.split(',').map(s => s.trim()).filter(Boolean)
    const data = { name: form.name, address: form.address, tenant: form.tenant, phone: form.phone.replace(/\D/g, ''), rent: parseFloat(form.rent) || 0, pay_day: parseInt(form.pay_day) || 5, services }
    setSaving(true)
    try {
      if (editId) { const { error } = await supabase.from('properties').update(data).eq('id', editId); if (error) throw error; showAlert('Propiedad actualizada') }
      else { const { error } = await supabase.from('properties').insert(data); if (error) throw error; showAlert('Propiedad dada de alta') }
      reset(); onRefresh()
    } catch (e) { showAlert(e.message || 'Error', 'error') }
    setSaving(false)
  }

  async function del(id) {
    if (!confirm('¿Eliminar esta propiedad del sistema?')) return
    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) { showAlert('Error', 'error'); return }
    showAlert('Propiedad eliminada'); onRefresh()
  }

  function edit(p) {
    setEditId(p.id)
    setForm({ name: p.name, address: p.address, tenant: p.tenant || '', phone: p.phone || '', rent: String(p.rent), pay_day: String(p.pay_day), services: (p.services || []).join(', ') })
  }

  const expProp = properties.find(p => p.id === propExp)
  const tenantUrl = typeof window !== 'undefined' ? `${window.location.origin}/?id=${propExp}` : ''

  return (
    <div style={{ display: 'flex', gap: 20 }} className="two-col">
      {/* LEFT — form */}
      <div style={{ flex: 1 }}>
        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>{editId ? 'Editar Propiedad' : 'Nueva Propiedad'}</div>
          <div className="fgroup" style={{ marginBottom: 10 }}>
            <label>ID Propiedad (Ej: Depto 101)</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Maple St 12-A" />
          </div>
          <div className="fgroup" style={{ marginBottom: 10 }}>
            <label>Dirección completa</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="fgroup" style={{ marginBottom: 10 }}>
            <label>Nombre del Inquilino</label>
            <input value={form.tenant} onChange={e => setForm(f => ({ ...f, tenant: e.target.value }))} />
          </div>
          <div className="fgroup" style={{ marginBottom: 10 }}>
            <label>Teléfono de contacto (con código de país)</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="521551234567" />
          </div>
          <div className="grid2" style={{ marginBottom: 10 }}>
            <div className="fgroup">
              <label>Renta Mensual ($)</label>
              <input type="number" min="0" step="500" value={form.rent} onChange={e => setForm(f => ({ ...f, rent: e.target.value }))} />
            </div>
            <div className="fgroup">
              <label>Día límite de pago</label>
              <input type="number" min="1" max="31" value={form.pay_day} onChange={e => setForm(f => ({ ...f, pay_day: e.target.value }))} />
            </div>
          </div>
          <div className="fgroup" style={{ marginBottom: 16 }}>
            <label>Servicios (separados por coma: Luz, Agua, Gas)</label>
            <textarea value={form.services} onChange={e => setForm(f => ({ ...f, services: e.target.value }))} placeholder="Luz, Agua, Gas" style={{ minHeight: 48 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={reset}>Cancelar</button>
            <button className="btn-primary btn btn-full" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Dar de Alta'}</button>
          </div>
        </div>
      </div>

      {/* RIGHT — expediente */}
      <div style={{ flex: 2 }}>
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Expediente</div>
          {properties.length === 0 ? <div className="empty">Sin propiedades</div> : (
            <>
              <div className="fgroup" style={{ marginBottom: 14 }}>
                <label>Ver detalles de:</label>
                <select value={propExp} onChange={e => setPropExp(e.target.value)}>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {expProp && (
                <div className="expediente">
                  <h3>👤 {expProp.tenant || 'Sin inquilino'}</h3>
                  <p>
                    <b>📞 Tel:</b> {expProp.phone || '—'}<br />
                    <b>📍 Dir:</b> {expProp.address || '—'}<br />
                    <b>💵 Renta:</b> {fmt(expProp.rent)} / mes · Día {expProp.pay_day}<br />
                    <b>🛠 Servicios:</b> {expProp.services?.join(', ') || '—'}
                  </p>
                  {expProp.phone && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Link de estado de cuenta para el inquilino:</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <code style={{ fontSize: 11, background: 'var(--bg)', padding: '4px 8px', borderRadius: 6, color: 'var(--accent)', border: '1px solid var(--border)', wordBreak: 'break-all' }}>{tenantUrl}</code>
                        <button className="btn btn-sm" onClick={() => navigator.clipboard.writeText(tenantUrl).then(() => alert('¡Link copiado!'))}>Copiar</button>
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm" onClick={() => edit(expProp)}>✏️ Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(expProp.id)}>🗑️ Eliminar del Sistema</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TAB 3: HISTORIAL ────────────────────────────────────────────────────────
function TabHistorial({ properties, charges, onRefresh }) {
  const [propFilter, setPropFilter] = useState('')
  const [yearFilter, setYearFilter] = useState(String(CUR_YEAR))
  const [editCharge, setEditCharge] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  function showAlert(msg, type = 'success') { setAlert({ msg, type }); setTimeout(() => setAlert(null), 3500) }

  const years = [...new Set([CUR_YEAR, ...charges.map(c => c.year)])].sort((a, b) => b - a)
  const filtered = charges
    .filter(c => c.year === parseInt(yearFilter) && (!propFilter || c.property_id === propFilter))
    .sort((a, b) => MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month))

  const totalRent = filtered.reduce((a, c) => a + c.rent, 0)
  const totalSvcs = filtered.reduce((a, c) => a + Object.values(c.services || {}).reduce((x, y) => x + y, 0), 0)
  const totalAll = filtered.reduce((a, c) => a + c.total, 0)
  const totalPaid = filtered.filter(c => c.status === 'paid').reduce((a, c) => a + c.total, 0)

  function openEdit(c) {
    setEditCharge(c)
    setEditForm({
      rent: c.rent,
      note: c.note || '',
      status: c.status,
      services: { ...c.services }
    })
  }

  async function saveEdit() {
    const total = parseFloat(editForm.rent || 0) + Object.values(editForm.services || {}).reduce((a, b) => a + parseFloat(b || 0), 0)
    setSaving(true)
    const { error } = await supabase.from('charges').update({
      rent: parseFloat(editForm.rent || 0),
      services: Object.fromEntries(Object.entries(editForm.services || {}).map(([k, v]) => [k, parseFloat(v || 0)])),
      total,
      note: editForm.note,
      status: editForm.status,
      paid_on: editForm.status === 'paid' ? (editCharge.paid_on || new Date().toISOString()) : null
    }).eq('id', editCharge.id)
    setSaving(false)
    if (error) { showAlert('Error al guardar', 'error'); return }
    showAlert('✅ Cobro actualizado')
    setEditCharge(null)
    onRefresh()
  }

  async function delCharge(id) {
    if (!confirm('¿Eliminar este cobro?')) return
    const { error } = await supabase.from('charges').delete().eq('id', id)
    if (error) { showAlert('Error', 'error'); return }
    showAlert('Eliminado'); onRefresh()
  }

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>📊 Historial de Pagos</div>

      <div className="grid4" style={{ marginBottom: 20 }}>
        <div className="metric"><div className="mlabel">Total renta</div><div className="mval">{fmt(totalRent)}</div></div>
        <div className="metric"><div className="mlabel">Servicios</div><div className="mval">{fmt(totalSvcs)}</div><div className="msub">reembolsables</div></div>
        <div className="metric"><div className="mlabel">Total cobrado</div><div className="mval">{fmt(totalAll)}</div></div>
        <div className="metric"><div className="mlabel">Recibido</div><div className="mval" style={{ color: 'var(--green-text)' }}>{fmt(totalPaid)}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="fgroup" style={{ flex: 1, minWidth: 180 }}>
          <label>Filtrar por Propiedad:</label>
          <select value={propFilter} onChange={e => setPropFilter(e.target.value)}>
            <option value="">Todas</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="fgroup" style={{ width: 100 }}>
          <label>Año:</label>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {['Mes','Propiedad','Inquilino','Renta','Servicios','Total','Estado','Comprobante',''].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text2)', padding: '2rem' }}>Sin cobros para este período.</td></tr>}
            {filtered.map(c => {
              const p = properties.find(x => x.id === c.property_id)
              const svcsStr = Object.entries(c.services || {}).map(([k, v]) => `${k}: ${fmt(v)}`).join(', ') || '—'
              return (
                <tr key={c.id}>
                  <td>{monthES(c.month)} {c.year}</td>
                  <td>{p?.name || '—'}</td>
                  <td style={{ color: 'var(--text2)' }}>{p?.tenant || '—'}</td>
                  <td>{fmt(c.rent)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{svcsStr}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(c.total)}</td>
                  <td><span className={`badge badge-${c.status}`}>{c.status === 'paid' ? 'Pagado' : 'Pendiente'}</span></td>
                  <td>{c.receipt_url ? <a href={c.receipt_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 12 }}>Ver</a> : <span style={{ color: 'var(--border)' }}>—</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(c)} style={{ color: 'var(--accent)', borderColor: 'var(--accent)', padding: '3px 8px' }}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => delCharge(c.id)} style={{ padding: '3px 8px' }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editCharge && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
          onClick={e => e.target === e.currentTarget && setEditCharge(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 480, padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>✏️ Editar — {monthES(editCharge.month)} {editCharge.year}</div>
              <button className="btn btn-sm" onClick={() => setEditCharge(null)}>Cerrar</button>
            </div>
            <div className="grid2" style={{ marginBottom: 12 }}>
              <div className="fgroup">
                <label>Renta ($)</label>
                <input type="number" value={editForm.rent} onChange={e => setEditForm(f => ({ ...f, rent: e.target.value }))} />
              </div>
              <div className="fgroup">
                <label>Estado</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="pending">Pendiente</option>
                  <option value="paid">Pagado</option>
                </select>
              </div>
            </div>
            {Object.keys(editForm.services || {}).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Servicios:</div>
                <div className="grid2">
                  {Object.entries(editForm.services).map(([k, v]) => (
                    <div key={k} className="fgroup">
                      <label>{k} ($)</label>
                      <input type="number" value={v} onChange={e => setEditForm(f => ({ ...f, services: { ...f.services, [k]: e.target.value } }))} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="fgroup" style={{ marginBottom: 16 }}>
              <label>Nota</label>
              <textarea value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setEditCharge(null)}>Cancelar</button>
              <button className="btn-primary btn" onClick={saveEdit} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function TenantView({ propId, properties, charges }) {
  const prop = properties.find(p => p.id === propId)
  if (!prop) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
        <div style={{ color: 'var(--red-text)' }}>Propiedad no encontrada en la base de datos.</div>
      </div>
    </div>
  )

  const propCharges = charges.filter(c => c.property_id === propId)
  const pendientes = propCharges.filter(c => c.status !== 'paid')
  const total = pendientes.reduce((a, c) => a + c.total, 0)

  return (
    <div className="tenant-page">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🏠 Estado de Cuenta</h1>
      <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>{prop.name} · {prop.tenant}</div>

      {pendientes.length === 0 ? (
        <div className="tenant-card" style={{ textAlign: 'center', borderColor: 'var(--green)' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--green-text)' }}>¡Estás al corriente!</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>No tienes deudas pendientes por el momento.</div>
        </div>
      ) : (
        <>
          <div className="tenant-card" style={{ borderColor: 'var(--orange)' }}>
            <div style={{ fontSize: 13, color: 'var(--orange-text)', marginBottom: 4 }}>⚠️ Tienes pagos pendientes</div>
            <div className="tenant-total">{fmt(total)}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Total a pagar</div>
          </div>

          <div className="tenant-card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Desglose:</div>
            {pendientes.map(c => (
              <div key={c.id} style={{ marginBottom: 12, padding: 12, background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{monthES(c.month)} {c.year}</span>
                  <span className="badge badge-pending">Pendiente</span>
                </div>
                {c.rent > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}><span style={{ color: 'var(--text2)' }}>🏠 Renta</span><span>{fmt(c.rent)}</span></div>}
                {Object.entries(c.services || {}).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}><span style={{ color: 'var(--text2)' }}>📄 {k}</span><span>{fmt(v)}</span></div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
                  <span>Total</span><span>{fmt(c.total)}</span>
                </div>
                {c.receipt_url && <div style={{ marginTop: 8 }}><a href={c.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>Ver comprobante de servicios</a></div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState(0)
  const [properties, setProperties] = useState([])
  const [charges, setCharges] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState(null)

  useEffect(() => {
    if (router.isReady) {
      const id = router.query.id
      if (id) setTenantId(id)
    }
  }, [router.isReady, router.query])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: props }, { data: chgs }, { data: nts }] = await Promise.all([
      supabase.from('properties').select('*').order('created_at'),
      supabase.from('charges').select('*').order('created_at', { ascending: false }),
      supabase.from('notes').select('*').order('created_at', { ascending: false })
    ])
    setProperties(props || []); setCharges(chgs || []); setNotes(nts || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Tenant view
  if (tenantId) {
    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text2)' }}>Cargando...</div>
    return <TenantView propId={tenantId} properties={properties} charges={charges} />
  }

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  const tabs = ['💰 Principal (Cobrar)', '🏠 Configuración', '📊 Historial']

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 16, padding: '14px 0', color: 'var(--text)' }}>👨‍💼 Centro de Control</div>
        <div style={{ display: 'flex', gap: 2 }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{
              background: 'none', border: 'none', padding: '14px 16px 12px',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              color: tab === i ? 'var(--text)' : 'var(--text2)',
              borderBottom: tab === i ? '2px solid var(--accent)' : '2px solid transparent'
            }}>{t}</button>
          ))}
        </div>
        <button className="btn btn-sm" onClick={() => setAuthed(false)}>Salir</button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem' }}>
        {loading ? <div className="empty">Cargando...</div> : (
          <>
            {tab === 0 && properties.length === 0 && (
              <div className="alert alert-warning">⚠️ No hay propiedades configuradas. Ve a la pestaña de Configuración.</div>
            )}
            {tab === 0 && properties.length > 0 && <TabCobrar properties={properties} charges={charges} notes={notes} onRefresh={load} />}
            {tab === 1 && <TabConfig properties={properties} onRefresh={load} />}
            {tab === 2 && <TabHistorial properties={properties} charges={charges} onRefresh={load} />}
          </>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
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

function diasParaPago(payDay) {
  const today = now.getDate()
  const daysInMonth = new Date(CUR_YEAR, now.getMonth() + 1, 0).getDate()
  let diff = payDay - today
  if (diff < 0) diff = (daysInMonth - today) + payDay
  return diff
}

// ─── WA MESSAGES ─────────────────────────────────────────────────────────────
function buildWaMessage(prop, charge) {
  const firstName = (prop.tenant || '').split(' ')[0]
  const svcs = Object.entries(charge.services || {})
  const dias = diasParaPago(prop.pay_day)
  const monthEsStr = monthES(charge.month)

  let msg = `Estimado/a ${firstName},\n\n`
  msg += `Le envío el presente mensaje para informarle el resumen de su cuenta correspondiente a ${monthEsStr} ${charge.year}:\n\n`
  if (charge.rent > 0) msg += `🏠 Renta: ${fmt(charge.rent)}\n`
  svcs.forEach(([k, v]) => { if (v > 0) msg += `📄 ${k}: ${fmt(v)}\n` })
  msg += `\n💰 *Total a depositar: ${fmt(charge.total)}*\n\n`
  if (dias === 0) {
    msg += `📅 Su fecha de pago es el día de hoy (día ${prop.pay_day}).`
  } else if (dias === 1) {
    msg += `📅 Le recuerdo que su fecha límite de pago es mañana (día ${prop.pay_day}).`
  } else {
    msg += `📅 Su fecha límite de pago es en ${dias} días (día ${prop.pay_day}).`
  }
  if (charge.note) msg += `\n\n📝 Nota: ${charge.note}`
  msg += `\n\nPor favor, una vez realizado su depósito, le agradecería enviarme el comprobante.\n\n¡Que tenga un excelente día! 😊`
  if (charge.receipt_url) msg += `\n\n(Se adjunta comprobante de servicios pagados)`
  return msg
}

function buildReminderMsg(prop, charge) {
  const firstName = (prop.tenant || '').split(' ')[0]
  const dias = diasParaPago(prop.pay_day)
  let msg = `Estimado/a ${firstName},\n\n`
  if (dias === 0) {
    msg += `Le recuerdo amablemente que el día de hoy (día ${prop.pay_day}) es la fecha límite de pago por un total de ${fmt(charge.total)} correspondiente a ${monthES(charge.month)} ${charge.year}.`
  } else if (dias === 1) {
    msg += `Le recuerdo amablemente que mañana (día ${prop.pay_day}) vence su pago de ${fmt(charge.total)} correspondiente a ${monthES(charge.month)} ${charge.year}.`
  } else {
    msg += `Le recuerdo amablemente que en ${dias} días (día ${prop.pay_day}) vence su pago de ${fmt(charge.total)} correspondiente a ${monthES(charge.month)} ${charge.year}.`
  }
  msg += `\n\nPor favor, realice su depósito a la brevedad posible.\n\n¡Gracias por su atención y que tenga un excelente día! 🙏`
  return msg
}

function buildThankYouMsg(prop, charge) {
  const firstName = (prop.tenant || '').split(' ')[0]
  return `Estimado/a ${firstName},\n\nPor medio del presente, confirmamos haber recibido correctamente su pago de ${fmt(charge.total)} correspondiente a ${monthES(charge.month)} ${charge.year}.\n\nMuchas gracias por su puntualidad. ¡Que tenga un excelente mes! 😊`
}

function waLink(phone, msg) { return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` }

// ─── WA BUTTON ───────────────────────────────────────────────────────────────
function WaBtn({ href, label, small, color }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: small ? '5px 10px' : '8px 16px',
      background: color || '#25D366', color: '#fff', borderRadius: 8,
      fontSize: small ? 12 : 14, fontWeight: 500, textDecoration: 'none'
    }}>
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
  // FIX 1: propSel stored in ref so it survives re-renders without resetting
  const [propSel, setPropSelState] = useState(properties[0]?.id || '')
  const propSelRef = useRef(propSel)
  function setPropSel(id) { propSelRef.current = id; setPropSelState(id) }

  const [mesSel, setMesSel] = useState(CUR_MONTH)
  const [rentaVal, setRentaVal] = useState(0)
  const [svcAmounts, setSvcAmounts] = useState({})
  const [notaServicio, setNotaServicio] = useState('')
  const [notaRapida, setNotaRapida] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [receiptName, setReceiptName] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingNota, setSavingNota] = useState(false)
  const [alert, setAlert] = useState(null)
  const [showWaPreview, setShowWaPreview] = useState(false)
  const [showServiceForm, setShowServiceForm] = useState(false)

  const prop = properties.find(p => p.id === propSel)

  // Only reset form when property CHANGES, not on every re-render
  const prevPropSel = useRef(propSel)
  useEffect(() => {
    if (prevPropSel.current !== propSel && prop) {
      setRentaVal(prop.rent)
      setSvcAmounts({})
      setNotaServicio('')
      setShowServiceForm(false)
      setReceipt(null)
      setReceiptPreview(null)
      setReceiptName('')
    }
    if (prop && rentaVal === 0) setRentaVal(prop.rent)
    prevPropSel.current = propSel
  }, [propSel])

  function showAlert(msg, type = 'success') { setAlert({ msg, type }); setTimeout(() => setAlert(null), 4000) }

  const propCharges = charges.filter(c => c.property_id === propSel)
  const curMonthCharge = propCharges.find(c => c.month === CUR_MONTH && c.year === CUR_YEAR)
  const pendientes = propCharges.filter(c => c.status !== 'paid')
  const pagados = propCharges.filter(c => c.status === 'paid')
  const propNotes = notes.filter(n => n.property_id === propSel)

  const isEditing = !!curMonthCharge

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

  function handleReceipt(e) {
    const file = e.target.files[0]; if (!file) return
    setReceipt(file); setReceiptName(file.name)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => setReceiptPreview(ev.target.result)
      reader.readAsDataURL(file)
    } else { setReceiptPreview(null) }
  }

  // FIX 4: show existing service amounts as placeholders when editing
  const svcPlaceholders = curMonthCharge?.services || {}

  const draftServices = Object.fromEntries(
    (prop?.services || []).map(s => [s, parseFloat(svcAmounts[s] || 0)]).filter(([, v]) => v > 0)
  )
  const draftTotal = rentaVal + Object.values(draftServices).reduce((a, b) => a + b, 0)
  const draftCharge = prop ? { rent: rentaVal, services: draftServices, total: draftTotal, note: notaServicio, month: mesSel, year: CUR_YEAR } : null

  async function guardarCobro() {
    if (!prop) return
    const hasServices = Object.values(draftServices).some(v => v > 0)
    if (rentaVal === 0 && !hasServices) { showAlert('Ingresa al menos un monto', 'error'); return }
    setSaving(true)
    try {
      let receipt_url = curMonthCharge?.receipt_url || null
      if (receipt) {
        const ext = receipt.name.split('.').pop()
        const path = `${propSel}/${mesSel}-${CUR_YEAR}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('receipts').upload(path, receipt)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
        receipt_url = urlData.publicUrl
      }

      if (isEditing) {
        const mergedServices = { ...curMonthCharge.services }
        Object.entries(draftServices).forEach(([k, v]) => { mergedServices[k] = v })
        const newRent = rentaVal > 0 ? rentaVal : curMonthCharge.rent
        const newTotal = newRent + Object.values(mergedServices).reduce((a, b) => a + b, 0)
        const { error } = await supabase.from('charges').update({
          rent: newRent, services: mergedServices, total: newTotal,
          note: notaServicio || curMonthCharge.note, receipt_url
        }).eq('id', curMonthCharge.id)
        if (error) throw error
        showAlert(`✅ Cobro de ${monthES(mesSel)} actualizado`)
      } else {
        const { error } = await supabase.from('charges').insert({
          property_id: propSel, month: mesSel, year: CUR_YEAR,
          rent: rentaVal, services: draftServices, total: draftTotal,
          note: notaServicio, receipt_url, status: 'pending', wa_sent: false
        })
        if (error) throw error
        showAlert(`✅ Cobro de ${monthES(mesSel)} guardado`)
      }
      setSvcAmounts({}); setNotaServicio(''); setReceipt(null); setReceiptPreview(null); setReceiptName('')
      setShowServiceForm(false)
      onRefresh()
    } catch (e) { showAlert(e.message || 'Error', 'error') }
    setSaving(false)
  }

  async function saveNota() {
    if (!notaRapida.trim()) return
    setSavingNota(true)
    const { error } = await supabase.from('notes').insert({ property_id: propSel, text: notaRapida.trim() })
    setSavingNota(false)
    if (error) { showAlert('Error al guardar nota', 'error'); return }
    setNotaRapida(''); showAlert('Nota guardada'); onRefresh()
  }

  if (!prop) return <div className="empty">Sin propiedades. Ve a Configuración.</div>

  const dias = diasParaPago(prop.pay_day)

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* FIX 1: Property selector */}
      <div style={{ marginBottom: 16 }}>
        <div className="fgroup">
          <label>Selecciona Propiedad:</label>
          <select value={propSel} onChange={e => setPropSel(e.target.value)}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* Info bar with days to payment */}
      <div className="info-bar">
        📅 <b>Hoy:</b> {now.getDate()} de {CUR_MONTH_ES} &nbsp;|&nbsp;
        📌 <b>Día de pago:</b> {prop.pay_day} &nbsp;
        {dias === 0
          ? <span style={{ color: '#ff6b6b', fontWeight: 600 }}>¡Hoy!</span>
          : dias === 1
            ? <span style={{ color: '#ffa94d', fontWeight: 600 }}>(mañana)</span>
            : <span style={{ color: 'var(--text2)' }}>({dias} días)</span>
        } &nbsp;|&nbsp;
        💵 <b>Renta:</b> {fmt(prop.rent)} &nbsp;|&nbsp;
        📞 {prop.phone}
      </div>

      <div style={{ display: 'flex', gap: 20 }} className="two-col">

        {/* LEFT COLUMN */}
        <div style={{ flex: 2 }}>

          {/* FIX 2: Main status card — first thing you see */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>
              Estado del mes — {CUR_MONTH_ES} {CUR_YEAR}
            </div>

            {!curMonthCharge ? (
              /* Not billed yet */
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 12 }}>Sin cobro generado este mes</div>
                <button className="btn-primary btn" onClick={() => setShowServiceForm(true)}>
                  + Generar cobro de {CUR_MONTH_ES}
                </button>
              </div>
            ) : curMonthCharge.status === 'paid' ? (
              /* PAID */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 32 }}>✅</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--green-text)' }}>Pagado</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                      {curMonthCharge.paid_on
                        ? new Date(curMonthCharge.paid_on).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
                        : ''}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 20 }}>{fmt(curMonthCharge.total)}</div>
                  </div>
                </div>
                {/* Breakdown */}
                <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  {curMonthCharge.rent > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: 'var(--text2)' }}>🏠 Renta</span><span>{fmt(curMonthCharge.rent)}</span></div>}
                  {Object.entries(curMonthCharge.services || {}).map(([k, v]) => v > 0 && (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: 'var(--text2)' }}>📄 {k}</span><span>{fmt(v)}</span></div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <WaBtn href={waLink(prop.phone, buildThankYouMsg(prop, curMonthCharge))} label="Enviar gracias" small />
                  <button className="btn btn-sm" onClick={() => setShowServiceForm(!showServiceForm)}>+ Agregar servicio</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteCharge(curMonthCharge)}>🗑️ Eliminar</button>
                  {curMonthCharge.receipt_url && <a href={curMonthCharge.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }}>Ver comprobante</a>}
                </div>
              </div>
            ) : (
              /* PENDING */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 32 }}>⏳</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--orange-text)' }}>Pendiente de pago</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                      {dias === 0 ? '¡Vence hoy!' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 20 }}>{fmt(curMonthCharge.total)}</div>
                  </div>
                </div>
                {/* Breakdown */}
                <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  {curMonthCharge.rent > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: 'var(--text2)' }}>🏠 Renta</span><span>{fmt(curMonthCharge.rent)}</span></div>}
                  {Object.entries(curMonthCharge.services || {}).map(([k, v]) => v > 0 && (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: 'var(--text2)' }}>📄 {k}</span><span>{fmt(v)}</span></div>
                  ))}
                  {curMonthCharge.note && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginTop: 6 }}>"{curMonthCharge.note}"</div>}
                </div>
                {/* FIX 2: Single WhatsApp button */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn-green btn" onClick={() => markPaid(curMonthCharge)}>✅ Marcar pagado</button>
                  <WaBtn href={waLink(prop.phone, buildWaMessage(prop, curMonthCharge))} label="Enviar WhatsApp" />
                  <button className="btn btn-sm" onClick={() => setShowServiceForm(!showServiceForm)}>+ Agregar servicio</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteCharge(curMonthCharge)}>🗑️</button>
                  {curMonthCharge.receipt_url && <a href={curMonthCharge.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }}>Ver comprobante</a>}
                </div>
              </div>
            )}
          </div>

          {/* FIX 4: Service form — shows existing values as placeholder */}
          {showServiceForm && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                {isEditing ? `✏️ Agregar / editar servicios — ${monthES(mesSel)} ${CUR_YEAR}` : `🚀 Generar cobro — ${monthES(mesSel)} ${CUR_YEAR}`}
              </div>
              {isEditing && (
                <div style={{ fontSize: 12, color: 'var(--orange-text)', marginBottom: 14 }}>
                  Los valores actuales se muestran como referencia. Ingresa el nuevo monto para actualizarlo.
                </div>
              )}
              {!isEditing && <div style={{ marginBottom: 14 }}></div>}

              <div className="grid2" style={{ marginBottom: 14 }}>
                <div className="fgroup">
                  <label>Mes</label>
                  <select value={mesSel} onChange={e => setMesSel(e.target.value)}>
                    {MONTHS.map((m, i) => <option key={m} value={m}>{MONTHS_ES[i]}</option>)}
                  </select>
                </div>
                <div className="fgroup">
                  <label>Renta ($) {isEditing && curMonthCharge.rent > 0 ? `— actual: ${fmt(curMonthCharge.rent)}` : ''}</label>
                  <input type="number" value={rentaVal} onChange={e => setRentaVal(parseFloat(e.target.value) || 0)} step="100" />
                </div>
              </div>

              {prop.services?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>Servicios Variables:</div>
                  <div className="grid2">
                    {prop.services.map(s => {
                      const currentVal = svcPlaceholders[s]
                      return (
                        <div key={s} className="fgroup">
                          <label>{s} ($) {currentVal > 0 ? <span style={{ color: 'var(--accent)' }}>— actual: {fmt(currentVal)}</span> : ''}</label>
                          <input type="number" min="0" step="10"
                            value={svcAmounts[s] || ''}
                            placeholder={currentVal > 0 ? String(currentVal) : '0.00'}
                            onChange={e => setSvcAmounts(a => ({ ...a, [s]: e.target.value }))} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="fgroup" style={{ marginBottom: 14 }}>
                <label>Nota para el inquilino (opcional)</label>
                <textarea value={notaServicio} onChange={e => setNotaServicio(e.target.value)} placeholder="Ej: El agua subió por la reparación de tubería..." />
              </div>

              <div className="fgroup" style={{ marginBottom: 14 }}>
                <label>Comprobante (JPG, PNG o PDF)</label>
                <input type="file" accept="image/*,.pdf" onChange={handleReceipt} />
                {receiptName && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>📎 {receiptName}</div>}
                {receiptPreview && <img src={receiptPreview} alt="comprobante" style={{ maxHeight: 100, borderRadius: 8, marginTop: 8, border: '1px solid var(--border)' }} />}
              </div>

              {draftCharge && draftTotal > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <button className="btn btn-sm" onClick={() => setShowWaPreview(!showWaPreview)}>
                    {showWaPreview ? 'Ocultar' : 'Ver'} vista previa WhatsApp
                  </button>
                  {showWaPreview && (
                    <div className="wa-preview" style={{ marginTop: 10 }}>{buildWaMessage(prop, draftCharge)}</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => { setShowServiceForm(false); setSvcAmounts({}); setNotaServicio('') }}>Cancelar</button>
                <button className="btn-primary btn" onClick={guardarCobro} disabled={saving}>
                  {saving ? 'Guardando...' : isEditing ? '💾 Actualizar cobro' : '💾 Guardar cobro'}
                </button>
                {draftCharge && draftTotal > 0 && (
                  <WaBtn href={waLink(prop.phone, buildWaMessage(prop, draftCharge))} label="Abrir WhatsApp" />
                )}
              </div>
              {receipt && (
                <div className="alert alert-warning" style={{ marginTop: 10 }}>
                  📎 Recuerda adjuntar el comprobante manualmente en WhatsApp.
                </div>
              )}
            </div>
          )}

          {/* Other pending charges (not current month) */}
          {pendientes.filter(c => !(c.month === CUR_MONTH && c.year === CUR_YEAR)).length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: 'var(--orange-text)' }}>⏳ Meses anteriores pendientes</div>
              {pendientes.filter(c => !(c.month === CUR_MONTH && c.year === CUR_YEAR)).map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{monthES(c.month)} {c.year}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>{fmt(c.total)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn-green btn btn-sm" onClick={() => markPaid(c)}>Saldar</button>
                    <WaBtn href={waLink(prop.phone, buildReminderMsg(prop, c))} label="Recordatorio" small />
                    <button className="btn btn-danger btn-sm" onClick={() => deleteCharge(c)}>🗑️</button>
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
              <textarea value={notaRapida} onChange={e => setNotaRapida(e.target.value)} placeholder="Ej: Fuga en baño detectada..." />
            </div>
            <button className="btn-primary btn btn-full" onClick={saveNota} disabled={savingNota} style={{ marginBottom: 16 }}>
              {savingNota ? 'Guardando...' : 'Guardar Nota'}
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
      <div style={{ flex: 1 }}>
        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>{editId ? 'Editar Propiedad' : 'Nueva Propiedad'}</div>
          <div className="fgroup" style={{ marginBottom: 10 }}><label>ID Propiedad</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Depto 101" /></div>
          <div className="fgroup" style={{ marginBottom: 10 }}><label>Dirección completa</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="fgroup" style={{ marginBottom: 10 }}><label>Nombre del Inquilino</label><input value={form.tenant} onChange={e => setForm(f => ({ ...f, tenant: e.target.value }))} /></div>
          <div className="fgroup" style={{ marginBottom: 10 }}><label>Teléfono (con código de país)</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="521551234567" /></div>
          <div className="grid2" style={{ marginBottom: 10 }}>
            <div className="fgroup"><label>Renta Mensual ($)</label><input type="number" min="0" step="500" value={form.rent} onChange={e => setForm(f => ({ ...f, rent: e.target.value }))} /></div>
            <div className="fgroup"><label>Día límite de pago</label><input type="number" min="1" max="31" value={form.pay_day} onChange={e => setForm(f => ({ ...f, pay_day: e.target.value }))} /></div>
          </div>
          <div className="fgroup" style={{ marginBottom: 16 }}><label>Servicios (separados por coma: Luz, Agua, Gas)</label><textarea value={form.services} onChange={e => setForm(f => ({ ...f, services: e.target.value }))} placeholder="Luz, Agua, Gas" style={{ minHeight: 48 }} /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={reset}>Cancelar</button>
            <button className="btn-primary btn btn-full" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Dar de Alta'}</button>
          </div>
        </div>
      </div>

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
    setEditForm({ rent: c.rent, note: c.note || '', status: c.status, services: { ...c.services } })
  }

  async function saveEdit() {
    const total = parseFloat(editForm.rent || 0) + Object.values(editForm.services || {}).reduce((a, b) => a + parseFloat(b || 0), 0)
    setSaving(true)
    const { error } = await supabase.from('charges').update({
      rent: parseFloat(editForm.rent || 0),
      services: Object.fromEntries(Object.entries(editForm.services || {}).map(([k, v]) => [k, parseFloat(v || 0)])),
      total, note: editForm.note, status: editForm.status,
      paid_on: editForm.status === 'paid' ? (editCharge.paid_on || new Date().toISOString()) : null
    }).eq('id', editCharge.id)
    setSaving(false)
    if (error) { showAlert('Error al guardar', 'error'); return }
    showAlert('✅ Cobro actualizado'); setEditCharge(null); onRefresh()
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
            {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text2)', padding: '2rem' }}>Sin cobros para este período.</td></tr>}
            {filtered.map(c => {
              const p = properties.find(x => x.id === c.property_id)
              const svcsStr = Object.entries(c.services || {}).filter(([,v]) => v > 0).map(([k, v]) => `${k}: ${fmt(v)}`).join(', ') || '—'
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

      {editCharge && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
          onClick={e => e.target === e.currentTarget && setEditCharge(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 480, padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>✏️ Editar — {monthES(editCharge.month)} {editCharge.year}</div>
              <button className="btn btn-sm" onClick={() => setEditCharge(null)}>Cerrar</button>
            </div>
            <div className="grid2" style={{ marginBottom: 12 }}>
              <div className="fgroup"><label>Renta ($)</label><input type="number" value={editForm.rent} onChange={e => setEditForm(f => ({ ...f, rent: e.target.value }))} /></div>
              <div className="fgroup"><label>Estado</label>
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
                    <div key={k} className="fgroup"><label>{k} ($)</label>
                      <input type="number" value={v} onChange={e => setEditForm(f => ({ ...f, services: { ...f.services, [k]: e.target.value } }))} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="fgroup" style={{ marginBottom: 16 }}><label>Nota</label><textarea value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} /></div>
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

// ─── VISTA INQUILINO ─────────────────────────────────────────────────────────
function TenantView({ propId, properties, charges }) {
  const prop = properties.find(p => p.id === propId)
  if (!prop) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
        <div style={{ color: 'var(--red-text)' }}>Propiedad no encontrada.</div>
      </div>
    </div>
  )

  const propCharges = charges.filter(c => c.property_id === propId)
  const pendientes = propCharges.filter(c => c.status !== 'paid')
  const total = pendientes.reduce((a, c) => a + c.total, 0)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🏠 Estado de Cuenta</h1>
      <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>{prop.name} · {prop.tenant}</div>

      {pendientes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', borderColor: 'var(--green)' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--green-text)' }}>¡Estás al corriente!</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>No tienes deudas pendientes.</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 12, borderColor: 'var(--orange)' }}>
            <div style={{ fontSize: 13, color: 'var(--orange-text)', marginBottom: 4 }}>⚠️ Tienes pagos pendientes</div>
            <div style={{ fontSize: 36, fontWeight: 700, margin: '.5rem 0' }}>{fmt(total)}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Total a pagar</div>
          </div>
          {pendientes.map(c => (
            <div key={c.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{monthES(c.month)} {c.year}</span>
                <span className="badge badge-pending">Pendiente</span>
              </div>
              {c.rent > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}><span style={{ color: 'var(--text2)' }}>🏠 Renta</span><span>{fmt(c.rent)}</span></div>}
              {Object.entries(c.services || {}).filter(([,v]) => v > 0).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}><span style={{ color: 'var(--text2)' }}>📄 {k}</span><span>{fmt(v)}</span></div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}><span>Total</span><span>{fmt(c.total)}</span></div>
              {c.receipt_url && <div style={{ marginTop: 8 }}><a href={c.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>Ver comprobante de servicios</a></div>}
            </div>
          ))}
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

  if (tenantId) {
    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text2)' }}>Cargando...</div>
    return <TenantView propId={tenantId} properties={properties} charges={charges} />
  }

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  const tabs = ['💰 Principal (Cobrar)', '🏠 Configuración', '📊 Historial']

  return (
    <div style={{ minHeight: '100vh' }}>
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

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem' }}>
        {loading ? <div className="empty">Cargando...</div> : (
          <>
            {tab === 0 && properties.length === 0 && <div className="alert alert-warning">⚠️ No hay propiedades. Ve a Configuración.</div>}
            {tab === 0 && properties.length > 0 && <TabCobrar properties={properties} charges={charges} notes={notes} onRefresh={load} />}
            {tab === 1 && <TabConfig properties={properties} onRefresh={load} />}
            {tab === 2 && <TabHistorial properties={properties} charges={charges} onRefresh={load} />}
          </>
        )}
      </div>
    </div>
  )
}

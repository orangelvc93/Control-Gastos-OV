// Lee la factura electrónica del SRI (XML) en el navegador y devuelve sus datos. El archivo no se guarda.
// Acepta el XML autorizado (<autorizacion> con el comprobante dentro, a veces en CDATA) o la <factura> sola.

const text = (node, tag) => node?.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
// En el XML los montos van con punto decimal y a veces con más de dos decimales.
const cents = (value) => {
  const number = Number(String(value).replace(',', '.'));
  return value !== '' && Number.isFinite(number) ? Math.round(number * 100) : null;
};

export function parseInvoiceXml(source) {
  const parser = new DOMParser();
  let doc = parser.parseFromString(source, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('El archivo no es un XML válido.');
  // El comprobante autorizado viene como texto dentro de <comprobante>: se vuelve a leer.
  if (!doc.getElementsByTagName('factura').length) {
    const inner = text(doc, 'comprobante');
    if (inner) doc = parser.parseFromString(inner, 'application/xml');
  }
  const factura = doc.getElementsByTagName('factura')[0];
  if (!factura) throw new Error('No es una factura electrónica (falta <factura>).');

  const tributaria = factura.getElementsByTagName('infoTributaria')[0];
  const info = factura.getElementsByTagName('infoFactura')[0];
  const [day, month, year] = text(info, 'fechaEmision').split('/');
  // IVA: impuestos con código 2 dentro de totalConImpuestos.
  const taxes = [...(info?.getElementsByTagName('totalImpuesto') ?? [])];
  const iva = taxes.filter((tax) => text(tax, 'codigo') === '2').reduce((total, tax) => total + (cents(text(tax, 'valor')) ?? 0), 0);

  return {
    ruc: text(tributaria, 'ruc'),
    number: [text(tributaria, 'estab'), text(tributaria, 'ptoEmi'), text(tributaria, 'secuencial')].filter(Boolean).join('-'),
    supplier: text(tributaria, 'nombreComercial') || text(tributaria, 'razonSocial'),
    date: year && month && day ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : '',
    baseCents: cents(text(info, 'totalSinImpuestos')),
    ivaCents: iva,
    totalCents: cents(text(info, 'importeTotal')),
  };
}

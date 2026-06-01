export async function downloadPdf(text: string, filename: string): Promise<void> {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })

  const marginLeft = 60
  const marginTop  = 60
  const maxWidth   = doc.internal.pageSize.getWidth() - marginLeft * 2
  const lineHeight = 14
  const fontSize   = 11

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(fontSize)

  const lines = doc.splitTextToSize(text, maxWidth) as string[]

  let y = marginTop
  for (const line of lines) {
    if (y + lineHeight > doc.internal.pageSize.getHeight() - marginTop) {
      doc.addPage()
      y = marginTop
    }
    doc.text(line, marginLeft, y)
    y += lineHeight
  }

  doc.save(filename)
}

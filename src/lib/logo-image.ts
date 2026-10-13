const LOGO_MAX_SIZE = 160 // px — logos aparecem com 36–48px; 160 cobre telas 3x
const LOGO_QUALITY = 0.85

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Logo pronta pra gravar no cartão: reduzida pra caber em 160×160 e em WebP.
 * A logo fica em base64 no próprio registro e viaja em toda resposta de
 * colunas/tarefas — gravar a imagem original (às vezes vários MB) pesava
 * cada carregamento de quadro. Se o navegador não conseguir decodificar o
 * arquivo (ex.: SVG em alguns navegadores), usa o original.
 */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, LOGO_MAX_SIZE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas indisponível')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const webp = canvas.toDataURL('image/webp', LOGO_QUALITY)
    // Navegadores sem encoder WebP devolvem PNG silenciosamente.
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
  } catch {
    return readAsDataUrl(file)
  }
}

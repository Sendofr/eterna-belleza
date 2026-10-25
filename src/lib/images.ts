const MAX_INPUT_BYTES = 20 * 1024 * 1024
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024
const MAX_DIMENSION = 1600
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== 'image/webp') {
          reject(
            new Error(
              'Este navegador no puede convertir a WebP. Probá con una versión actual de Chrome, Firefox o Safari.',
            ),
          )
        } else resolve(blob)
      },
      'image/webp',
      quality,
    ),
  )
}

/** Decode and re-encode rather than trusting a filename or changing its extension. */
export async function convertToWebP(file: File): Promise<File> {
  if (!SUPPORTED_TYPES.includes(file.type))
    throw new Error('Elegí una imagen JPG, PNG o WebP.')
  if (file.size === 0 || file.size > MAX_INPUT_BYTES)
    throw new Error('La imagen original debe pesar entre 1 byte y 20 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch {
      throw new Error(
        'No se pudo abrir la imagen. Elegí otro archivo JPG, PNG o WebP.',
      )
    }
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error('La imagen no tiene dimensiones válidas.')
    const ratio = Math.min(
      1,
      MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error('No se pudo procesar la imagen en este navegador.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    let blob = await canvasBlob(canvas, 0.82)
    if (blob.size > MAX_OUTPUT_BYTES) blob = await canvasBlob(canvas, 0.65)
    if (blob.size > MAX_OUTPUT_BYTES)
      throw new Error(
        'La imagen sigue superando los 2 MB después de comprimirla. Elegí una más pequeña.',
      )
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'prenda'}.webp`
    return new File([blob], name, {
      type: 'image/webp',
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

const allowedTypes = {
  'application/pdf': { extension: 'pdf', signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  'image/png': { extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'image/jpeg': { extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
} as const

// F-34: uploads pass through a Vercel function, whose request body limit is 4.5 MB. 4 MB leaves
// room for multipart overhead. Larger files would need signed upload URLs straight to Storage.
export const MAX_COURSE_MATERIAL_BYTES = 4 * 1024 * 1024

export async function validateCourseMaterialFile(file: File) {
  if (file.size < 1 || file.size > MAX_COURSE_MATERIAL_BYTES) return null
  const type = allowedTypes[file.type as keyof typeof allowedTypes]
  if (!type) return null
  const bytes = new Uint8Array(await file.slice(0, type.signature.length).arrayBuffer())
  if (!type.signature.every((byte, index) => bytes[index] === byte)) return null
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension !== type.extension && !(type.extension === 'jpg' && extension === 'jpeg')) return null
  return type.extension
}

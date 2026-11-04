import { useEffect, useState } from 'react'

export default function ObjectUrlImage({ file, src, alt = '', ...props }) {
  const [objectUrl, setObjectUrl] = useState(null)

  useEffect(() => {
    if (!file || src) {
      setObjectUrl(null)
      return undefined
    }

    const nextUrl = URL.createObjectURL(file)
    setObjectUrl(nextUrl)

    return () => URL.revokeObjectURL(nextUrl)
  }, [file, src])

  const imageSrc = src || objectUrl
  if (!imageSrc) return null

  return <img src={imageSrc} alt={alt} {...props} />
}

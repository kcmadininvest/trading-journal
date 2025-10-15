import React, { useRef, useState } from 'react'
import Button from './Button'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSize?: number
  loading?: boolean
}

function FileUpload({ 
  onFileSelect, 
  accept = '.csv', 
  maxSize = 10 * 1024 * 1024,
  loading = false 
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrag(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  function handleFile(file: File) {
    if (file.size > maxSize) {
      alert(`Le fichier est trop volumineux (max ${maxSize / 1024 / 1024}MB)`)
      return
    }
    setSelectedFile(file)
    onFileSelect(file)
  }

  function handleButtonClick() {
    inputRef.current?.click()
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-xl p-6 md:p-8 text-center cursor-pointer transition-all ${
          dragActive 
            ? 'border-blue-500 bg-blue-50 scale-[1.02]' 
            : selectedFile 
            ? 'border-green-500 bg-green-50' 
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleChange}
          disabled={loading}
        />
        
        <div className="flex flex-col items-center gap-3">
          {selectedFile ? (
            <>
              <div className="text-5xl">📄</div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-gray-900 m-0">{selectedFile.name}</p>
                <p className="text-sm text-gray-500 m-0">{formatFileSize(selectedFile.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedFile(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
              >
                Changer
              </Button>
            </>
          ) : (
            <>
              <div className="text-5xl">📤</div>
              <p className="text-base text-gray-700 m-0">
                <strong className="text-blue-600">Cliquez pour sélectionner</strong> ou glissez-déposez un fichier
              </p>
              <p className="text-sm text-gray-500 m-0">
                Formats acceptés : CSV (max {maxSize / 1024 / 1024}MB)
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileUpload


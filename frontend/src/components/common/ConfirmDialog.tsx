import React from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  title?: string
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  isOpen,
  title = 'Confirmation',
  message = 'Êtes-vous sûr ? Cette action est irréversible.',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const confirmClasses = tone === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700 border-rose-600 text-white'
    : 'bg-blue-600 hover:bg-blue-700 border-blue-600 text-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onCancel}></div>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-5">
        <h3 className="text-lg font-semibold text-gray-900 m-0 mb-2">{title}</h3>
        <div className="text-sm text-gray-700 mb-5">{message}</div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-3 py-2 text-sm text-gray-700 bg-transparent border border-gray-300 rounded-md"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm border rounded-md ${confirmClasses}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog



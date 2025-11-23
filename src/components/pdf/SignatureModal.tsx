import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, Trash2, Check } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string, width: number, height: number) => void;
}

const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave }) => {
  const signatureRef = useRef<SignatureCanvas>(null);

  if (!isOpen) return null;

  const handleClear = () => {
    signatureRef.current?.clear();
  };

  const handleSave = () => {
    if (signatureRef.current?.isEmpty()) {
      return;
    }
    const trimmedCanvas = signatureRef.current?.getTrimmedCanvas();
    if (trimmedCanvas) {
      const dataUrl = trimmedCanvas.toDataURL('image/png');
      onSave(dataUrl, trimmedCanvas.width, trimmedCanvas.height);
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Draw Your Signature</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg mb-4 bg-white">
          <SignatureCanvas
            ref={signatureRef}
            canvasProps={{
              className: 'w-full h-48 rounded-lg',
              style: { width: '100%', height: '192px' },
            }}
            backgroundColor="rgba(0,0,0,0)"
          />
        </div>

        <div className="flex justify-between">
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            Clear
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Check size={16} />
            Add Signature
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;

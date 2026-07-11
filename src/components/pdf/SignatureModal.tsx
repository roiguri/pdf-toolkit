import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, Trash2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { UserSignature } from '@/services/firestore';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string, width: number, height: number, saveToProfile: boolean) => void;
  savedSignature?: UserSignature | null;
}

const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave, savedSignature }) => {
  const { t } = useTranslation('tools');
  const signatureRef = useRef<SignatureCanvas>(null);
  const [saveToProfile, setSaveToProfile] = React.useState(false);

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
      onSave(dataUrl, trimmedCanvas.width, trimmedCanvas.height, saveToProfile);
      onClose();
    }
  };

  const handleUseSaved = () => {
    if (savedSignature) {
      onSave(savedSignature.dataUrl, savedSignature.width, savedSignature.height, false);
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
      <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-md mx-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{t('edit.signatureModal.title')}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label={t('edit.signatureModal.close')}
            title={t('edit.signatureModal.close')}
          >
            <X size={20} />
          </button>
        </div>

        {savedSignature && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">{t('edit.signatureModal.savedSignature')}</p>
            <div className="flex items-center justify-between">
              <div className="h-10 border rounded bg-white px-2 flex items-center">
                <img
                  src={savedSignature.dataUrl}
                  alt={t('edit.signatureModal.savedSignature')}
                  className="max-h-8 object-contain"
                />
              </div>
              <button
                onClick={handleUseSaved}
                className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-200 transition-colors font-medium"
              >
                {t('edit.signatureModal.useSaved')}
              </button>
            </div>
          </div>
        )}

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

        {!savedSignature && (
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="saveToProfile"
              checked={saveToProfile}
              onChange={(e) => setSaveToProfile(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="saveToProfile" className="ms-2 block text-sm text-gray-900">
              {t('edit.signatureModal.saveToProfile')}
            </label>
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            {t('edit.signatureModal.clear')}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Check size={16} />
            {t('edit.signatureModal.addNew')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;

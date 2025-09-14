/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { ErrorIcon } from './icons';

interface ApiErrorToastProps {
    error: string | null;
    onClose: () => void;
}

const ApiErrorToast: React.FC<ApiErrorToastProps> = ({ error, onClose }) => {
    if (!error) return null;

    return (
        <div className="api-error-toast" role="alert">
            <div className="flex items-center">
                <ErrorIcon className="w-6 h-6 text-red-400 mr-3 flex-shrink-0" />
                <p className="text-base text-gray-200">{error}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white ml-4" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

export default ApiErrorToast;

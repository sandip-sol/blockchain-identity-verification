'use client';

import { useState, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';

export default function FileUpload({
    onFilesChange,
    accept = 'image/*,application/pdf',
    maxFiles = 5,
    maxSizeMB = 10
}) {
    const [files, setFiles] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState(null);

    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    const validateFile = (file) => {
        if (file.size > maxSizeBytes) {
            return `File ${file.name} is too large. Max size is ${maxSizeMB}MB`;
        }
        return null;
    };

    const handleFiles = useCallback((newFiles) => {
        setError(null);

        if (files.length + newFiles.length > maxFiles) {
            setError(`Maximum ${maxFiles} files allowed`);
            return;
        }

        const validFiles = [];
        for (const file of newFiles) {
            const error = validateFile(file);
            if (error) {
                setError(error);
                return;
            }
            validFiles.push(file);
        }

        const updatedFiles = [...files, ...validFiles];
        setFiles(updatedFiles);
        onFilesChange?.(updatedFiles);
    }, [files, maxFiles, maxSizeBytes, onFilesChange]);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(Array.from(e.dataTransfer.files));
        }
    }, [handleFiles]);

    const handleChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(Array.from(e.target.files));
        }
    };

    const removeFile = (index) => {
        const updatedFiles = files.filter((_, i) => i !== index);
        setFiles(updatedFiles);
        onFilesChange?.(updatedFiles);
    };

    const getFileIcon = (file) => {
        if (file.type.startsWith('image/')) {
            return <ImageIcon className="w-6 h-6" />;
        }
        return <FileText className="w-6 h-6" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                className={`
                    relative border-2 border-dashed rounded-lg p-8 transition-all
                    ${dragActive
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-gray-600 hover:border-gray-500'
                    }
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    multiple
                    accept={accept}
                    onChange={handleChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                <div className="text-center">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium mb-2">
                        Drop files here or click to browse
                    </p>
                    <p className="text-sm text-gray-400">
                        Max {maxFiles} files, up to {maxSizeMB}MB each
                    </p>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm text-gray-400 font-medium">
                        Uploaded Files ({files.length}/{maxFiles})
                    </p>
                    {files.map((file, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                            <div className="text-primary-400">
                                {getFileIcon(file)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                    {file.name}
                                </p>
                                <p className="text-xs text-gray-400">
                                    {formatFileSize(file.size)}
                                </p>
                            </div>
                            <button
                                onClick={() => removeFile(index)}
                                className="p-1 hover:bg-red-500/20 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-red-400" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { FileCheck, Send, CheckCircle } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Card, { CardHeader, CardContent } from '../../components/Card';
import FileUpload from '../../components/FileUpload';
import { useKYC } from '../../hooks/useKYC';

export default function KYCPage() {
    const { address, isConnected } = useAccount();
    const router = useRouter();
    const { submitKYC, loading, error } = useKYC();
    const { register, handleSubmit, formState: { errors } } = useForm();

    const [files, setFiles] = useState([]);
    const [verificationType, setVerificationType] = useState('KYC');
    const [submitted, setSubmitted] = useState(false);

    const onSubmit = async (data) => {
        if (!isConnected) {
            toast.error('Please connect your wallet first');
            return;
        }

        if (files.length === 0) {
            toast.error('Please upload at least one document');
            return;
        }

        try {
            const kycData = {
                ...data,
                verificationType,
            };

            await submitKYC(kycData, files);
            setSubmitted(true);
            toast.success('KYC application submitted successfully!');

            // Redirect to dashboard after 3 seconds
            setTimeout(() => {
                router.push('/dashboard');
            }, 3000);
        } catch (err) {
            toast.error(err.message || error || 'Failed to submit KYC application');
        }
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen">
                <Navbar />
                <div className="max-w-4xl mx-auto px-4 py-20 text-center">
                    <Card>
                        <CardContent>
                            <FileCheck className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                            <h2 className="text-2xl font-bold mb-4">Connect Wallet Required</h2>
                            <p className="text-gray-400">
                                Please connect your wallet to submit a KYC application
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen">
                <Navbar />
                <div className="max-w-4xl mx-auto px-4 py-20 text-center">
                    <Card className="animate-fade-in">
                        <CardContent className="py-12">
                            <CheckCircle className="w-20 h-20 mx-auto mb-6 text-green-400" />
                            <h2 className="text-3xl font-bold text-gradient mb-4">
                                Application Submitted!
                            </h2>
                            <p className="text-gray-400 mb-2">
                                Your KYC application has been submitted successfully.
                            </p>
                            <p className="text-gray-400 mb-8">
                                You will be notified once your verification is complete.
                            </p>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="primary-button"
                            >
                                Go to Dashboard
                            </button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Navbar />

            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gradient mb-2">KYC/KYB Verification</h1>
                    <p className="text-gray-400">
                        Submit your information to receive a verified Soulbound identity token
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-6">
                        {/* Verification Type */}
                        <Card>
                            <CardHeader
                                title="Select Verification Type"
                                subtitle="Choose between individual (KYC) or business (KYB) verification"
                            />
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setVerificationType('KYC')}
                                        className={`
                                            p-6 rounded-lg border-2 transition-all text-left
                                            ${verificationType === 'KYC'
                                                ? 'border-primary-500 bg-primary-500/10'
                                                : 'border-gray-600 hover:border-gray-500'
                                            }
                                        `}
                                    >
                                        <h3 className="text-xl font-bold mb-2">KYC</h3>
                                        <p className="text-sm text-gray-400">Individual Verification</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setVerificationType('KYB')}
                                        className={`
                                            p-6 rounded-lg border-2 transition-all text-left
                                            ${verificationType === 'KYB'
                                                ? 'border-primary-500 bg-primary-500/10'
                                                : 'border-gray-600 hover:border-gray-500'
                                            }
                                        `}
                                    >
                                        <h3 className="text-xl font-bold mb-2">KYB</h3>
                                        <p className="text-sm text-gray-400">Business Verification</p>
                                    </button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Personal/Business Information */}
                        <Card>
                            <CardHeader
                                title={verificationType === 'KYC' ? 'Personal Information' : 'Business Information'}
                                subtitle="All data is encrypted before storage"
                            />
                            <CardContent>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {verificationType === 'KYC' ? (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">
                                                    Full Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    {...register('fullName', { required: 'Full name is required' })}
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                                                             focus:outline-none focus:border-primary-500"
                                                    placeholder="John Doe"
                                                />
                                                {errors.fullName && (
                                                    <p className="text-red-400 text-sm mt-1">{errors.fullName.message}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">
                                                    Date of Birth *
                                                </label>
                                                <input
                                                    type="date"
                                                    {...register('dateOfBirth', { required: 'Date of birth is required' })}
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                                                             focus:outline-none focus:border-primary-500"
                                                />
                                                {errors.dateOfBirth && (
                                                    <p className="text-red-400 text-sm mt-1">{errors.dateOfBirth.message}</p>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">
                                                    Business Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    {...register('businessName', { required: 'Business name is required' })}
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                                                             focus:outline-none focus:border-primary-500"
                                                    placeholder="Acme Inc."
                                                />
                                                {errors.businessName && (
                                                    <p className="text-red-400 text-sm mt-1">{errors.businessName.message}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2">
                                                    Registration Number *
                                                </label>
                                                <input
                                                    type="text"
                                                    {...register('registrationNumber', { required: 'Registration number is required' })}
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                                                             focus:outline-none focus:border-primary-500"
                                                    placeholder="123456789"
                                                />
                                                {errors.registrationNumber && (
                                                    <p className="text-red-400 text-sm mt-1">{errors.registrationNumber.message}</p>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            Email Address *
                                        </label>
                                        <input
                                            type="email"
                                            {...register('email', {
                                                required: 'Email is required',
                                                pattern: {
                                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                                    message: 'Invalid email address'
                                                }
                                            })}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                                                     focus:outline-none focus:border-primary-500"
                                            placeholder="john@example.com"
                                        />
                                        {errors.email && (
                                            <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            Country *
                                        </label>
                                        <input
                                            type="text"
                                            {...register('country', { required: 'Country is required' })}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                                                     focus:outline-none focus:border-primary-500"
                                            placeholder="United States"
                                        />
                                        {errors.country && (
                                            <p className="text-red-400 text-sm mt-1">{errors.country.message}</p>
                                        )}
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-2">
                                            Address
                                        </label>
                                        <input
                                            type="text"
                                            {...register('address')}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                                                     focus:outline-none focus:border-primary-500"
                                            placeholder="123 Main St, City, State, ZIP"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Document Upload */}
                        <Card>
                            <CardHeader
                                title="Upload Documents"
                                subtitle="Upload government-issued ID, proof of address, or business registration"
                            />
                            <CardContent>
                                <FileUpload
                                    onFilesChange={setFiles}
                                    accept="image/*,application/pdf"
                                    maxFiles={5}
                                    maxSizeMB={10}
                                />
                            </CardContent>
                        </Card>

                        {/* Submit Button */}
                        <Card>
                            <CardContent>
                                <div className="flex items-start gap-3 mb-6">
                                    <input
                                        type="checkbox"
                                        {...register('agreeToTerms', { required: 'You must agree to the terms' })}
                                        className="mt-1"
                                    />
                                    <div>
                                        <label className="text-sm">
                                            I confirm that all information provided is accurate and I agree to the{' '}
                                            <span className="text-primary-400 cursor-pointer hover:underline">
                                                Terms of Service
                                            </span>
                                            {' '}and{' '}
                                            <span className="text-primary-400 cursor-pointer hover:underline">
                                                Privacy Policy
                                            </span>
                                        </label>
                                        {errors.agreeToTerms && (
                                            <p className="text-red-400 text-sm mt-1">{errors.agreeToTerms.message}</p>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="primary-button w-full flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Submit Application
                                        </>
                                    )}
                                </button>
                            </CardContent>
                        </Card>
                    </div>
                </form>
            </div>
        </div>
    );
}
